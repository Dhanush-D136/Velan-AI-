import { Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import {
  loginSchema,
  changePasswordSchema,
  requestPasswordResetSchema,
  deviceChangeRequestSchema,
  completeProfileSchema,
  requestProfileEditSchema,
  profileUpdateSchema,
} from '@velan/shared';
import { notifyUsers } from './notificationController';
import { enqueueAuthEvent, parseClientMeta } from '../services/authEventQueue';
import { presenceService } from '../services/presenceService';
import { revokeSessionToken, getJwtSecret } from '../middleware/auth';
import { validateNewPassword, setPassword } from '../services/passwordService';

function hashRefreshToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function formatUserSummary(user: any) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    name: user.name,
    role: user.role as any,
    status: user.status as any,
    mustChangePassword: user.mustChangePassword,
    lastRoute: user.lastRoute || null,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    facultyProfile: user.facultyProfile
      ? {
          id: user.facultyProfile.id,
          employeeId: user.facultyProfile.employeeId,
          departmentId: user.facultyProfile.departmentId,
          departmentName: user.facultyProfile.department?.name,
          designation: user.facultyProfile.designation,
        }
      : null,
    studentProfile: user.studentProfile
      ? {
          id: user.studentProfile.id,
          registerNo: user.studentProfile.registerNo,
          rollNo: user.studentProfile.rollNo,
          classId: user.studentProfile.classId,
          className: user.studentProfile.class?.name,
          departmentName: user.studentProfile.class?.academicYear?.department?.name,
          personalEmail: user.studentProfile.personalEmail,
          phone: user.studentProfile.phone,
          dob: user.studentProfile.dob ? user.studentProfile.dob.toISOString() : null,
          gender: user.studentProfile.gender,
          bloodGroup: user.studentProfile.bloodGroup,
          address: user.studentProfile.address,
          guardianName: user.studentProfile.guardianName,
          guardianPhone: user.studentProfile.guardianPhone,
          photoUrl: user.studentProfile.photoUrl,
          isProfileLocked: user.studentProfile.isProfileLocked,
          canEditProfile: user.studentProfile.canEditProfile,
        }
      : null,
  };
}

async function issueSessionTokens(
  res: Response,
  user: any,
  sessionId: string,
  scope: 'full' | 'password_change_only'
) {
  const tokenPayload = {
    id: user.id,
    role: user.role,
    name: user.name,
    username: user.username,
    email: user.email,
    sid: sessionId,
    scope,
  };

  const accessToken = jwt.sign(tokenPayload, getJwtSecret(), { expiresIn: '20m' });
  const rawRefresh = crypto.randomBytes(48).toString('hex');
  const tokenHash = hashRefreshToken(rawRefresh);
  const expiresAt = new Date(Date.now() + 30 * 86400000); // 30 days sliding

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      sessionId,
      tokenHash,
      expiresAt,
    },
  });

  const isProd = process.env.NODE_ENV === 'production';
  res.cookie('velan_refresh_token', rawRefresh, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: 30 * 86400000,
  });

  res.cookie('velan_access_token', accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: 20 * 60 * 1000,
  });

  return { accessToken };
}

const JWT_SECRET = process.env.JWT_SECRET || 'velan_jwt_secret_dev_2026';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'velan_refresh_secret_dev_2026';

export const login = async (req: Request, res: Response) => {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0].message });
    }

    const { identifier, password, deviceId, deviceLabel, platform } = parseResult.data;
    const meta = parseClientMeta(req, platform, deviceLabel);
    const cleanId = identifier.trim();
    const lowerId = cleanId.toLowerCase();
    const upperId = cleanId.toUpperCase();
    const titleId = cleanId.charAt(0).toUpperCase() + cleanId.slice(1);

    // 1. Resolve user by: Username (Vel / vel), Register No, Roll No, Employee ID, or Email (case-insensitive)
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: cleanId },
          { username: lowerId },
          { username: upperId },
          { username: titleId },
          { email: cleanId },
          { email: lowerId },
          { studentProfile: { registerNo: cleanId } },
          { studentProfile: { registerNo: upperId } },
          { studentProfile: { registerNo: lowerId } },
          { studentProfile: { rollNo: cleanId } },
          { studentProfile: { rollNo: upperId } },
          { studentProfile: { rollNo: lowerId } },
          { facultyProfile: { employeeId: cleanId } },
          { facultyProfile: { employeeId: upperId } },
          { facultyProfile: { employeeId: lowerId } },
        ],
      },
      include: {
        devices: true,
        facultyProfile: { include: { department: true } },
        studentProfile: {
          include: {
            class: {
              include: {
                academicYear: { include: { department: true } },
              },
            },
          },
        },
      },
    });

    if (!user) {
      enqueueAuthEvent({ event: 'login_failed', deviceId, ...meta, details: `Unknown identifier: ${cleanId}` });
      return res.status(401).json({ error: 'Invalid login credentials. User not found.' });
    }

    // 2. Validate password
    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      enqueueAuthEvent({
        userId: user.id,
        role: user.role,
        event: 'login_failed',
        deviceId,
        ...meta,
        classId: user.studentProfile?.classId || null,
        details: 'Incorrect password',
      });
      return res.status(401).json({ error: 'Incorrect password.' });
    }

    if (user.status !== 'ACTIVE') {
      enqueueAuthEvent({
        userId: user.id,
        role: user.role,
        event: 'login_failed',
        deviceId,
        ...meta,
        details: `Account status ${user.status}`,
      });
      return res.status(403).json({ error: 'Your account is inactive or suspended. Please contact administrator.' });
    }

    if (user.mustChangePassword && user.tempPasswordExpiresAt && new Date() > new Date(user.tempPasswordExpiresAt)) {
      return res.status(403).json({
        code: 'TEMP_PASSWORD_EXPIRED',
        error: 'Your temporary password has expired. Please request a password reset from the administrator.',
      });
    }

    // 3. Hardware Device Lock verification (Max 2 devices per student: 1 PHONE + 1 COMPUTER)
    if (user.role === 'STUDENT') {
      const ua = String(req.headers['user-agent'] || '');
      const deviceType: 'PHONE' | 'COMPUTER' = /mobile|android|iphone/i.test(`${platform || ''} ${deviceLabel || ''} ${ua}`)
        ? 'PHONE'
        : 'COMPUTER';

      const activeDevices = user.devices.filter((d) => d.status === 'ACTIVE');
      const matchedActive = activeDevices.find((d) => d.deviceId === deviceId);

      if (matchedActive) {
        await prisma.userDevice.update({
          where: { id: matchedActive.id },
          data: { lastUsedAt: new Date() },
        });
      } else {
        const sameSlotTaken = activeDevices.find((d) => d.deviceType === deviceType);
        if (activeDevices.length >= 2 || sameSlotTaken) {
          enqueueAuthEvent({
            userId: user.id,
            role: user.role,
            event: 'device_limit_blocked',
            deviceId,
            ...meta,
            classId: user.studentProfile?.classId || null,
          });
          return res.status(403).json({
            code: 'DEVICE_LIMIT_REACHED',
            error:
              'This account is already signed in on 2 devices (phone and computer). To use a new device, send a request to the admin.',
            boundDeviceId: sameSlotTaken?.deviceId || activeDevices[0]?.deviceId,
          });
        }

        // Check if this deviceId is already bound to another user
        const existingDevice = await prisma.userDevice.findUnique({ where: { deviceId } });
        if (existingDevice && existingDevice.userId !== user.id) {
          return res.status(403).json({
            code: 'DEVICE_LOCKED',
            error: 'This hardware device is already registered to another student account.',
            boundDeviceId: existingDevice.deviceId,
          });
        }

        if (existingDevice && existingDevice.userId === user.id) {
          await prisma.userDevice.update({
            where: { id: existingDevice.id },
            data: { status: 'ACTIVE', deviceType, lastUsedAt: new Date() },
          });
        } else {
          await prisma.userDevice.create({
            data: {
              userId: user.id,
              deviceId,
              deviceType,
              label: deviceLabel || (deviceType === 'PHONE' ? 'Mobile Browser' : 'Desktop Browser'),
              platform: platform || 'Web',
              status: 'ACTIVE',
            },
          });
        }
      }
    }

    // 4. Create UserSession & Generate Tokens
    const userSession = await prisma.userSession.create({
      data: {
        userId: user.id,
        role: user.role,
        deviceId,
        deviceType: meta.deviceType,
        browser: meta.browser,
        os: meta.os,
        ip: meta.ip,
        classId: user.studentProfile?.classId || null,
      },
    });

    presenceService.registerSession({
      sessionId: userSession.id,
      userId: user.id,
      name: user.name,
      role: user.role,
      classId: user.studentProfile?.classId || null,
      className: user.studentProfile?.class?.name || null,
      deviceId,
      deviceType: meta.deviceType,
      browser: meta.browser,
      os: meta.os,
      startedAt: userSession.startedAt.getTime(),
    });

    enqueueAuthEvent({
      userId: user.id,
      role: user.role,
      event: 'login',
      deviceId,
      ...meta,
      classId: user.studentProfile?.classId || null,
    });

    const scope: 'full' | 'password_change_only' = user.mustChangePassword
      ? 'password_change_only'
      : 'full';
    const { accessToken } = await issueSessionTokens(res, user, userSession.id, scope);
    const userSummary = formatUserSummary(user);

    return res.json({
      message: 'Login successful',
      token: accessToken,
      user: userSummary,
      mustChangePassword: user.mustChangePassword,
      scope,
      code: user.mustChangePassword ? 'PASSWORD_CHANGE_REQUIRED' : undefined,
      lastRoute: user.lastRoute || null,
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error during authentication' });
  }
};

// Silent Refresh (30-day rotating httpOnly cookie)
export const refreshAccessToken = async (req: Request, res: Response) => {
  try {
    const rawRefresh = req.cookies?.velan_refresh_token || req.body?.refreshToken;
    if (!rawRefresh || typeof rawRefresh !== 'string') {
      return res.status(401).json({ error: 'Refresh token missing' });
    }

    const tokenHash = hashRefreshToken(rawRefresh);
    const existing = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: {
            facultyProfile: { include: { department: true } },
            studentProfile: {
              include: {
                class: { include: { academicYear: { include: { department: true } } } },
              },
            },
          },
        },
      },
    });

    if (!existing || existing.revokedAt || new Date() > existing.expiresAt) {
      return res.status(401).json({ error: 'Refresh token expired or revoked' });
    }

    if (existing.user.status !== 'ACTIVE') {
      return res.status(401).json({ error: 'Account inactive' });
    }

    const sess = await prisma.userSession.findUnique({ where: { id: existing.sessionId } });
    if (!sess || sess.endedAt) {
      return res.status(401).json({ error: 'Session ended' });
    }

    // Rotate refresh token
    await prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });
    await prisma.userSession.update({
      where: { id: sess.id },
      data: { lastSeenAt: new Date() },
    });

    const scope: 'full' | 'password_change_only' = existing.user.mustChangePassword
      ? 'password_change_only'
      : 'full';
    const { accessToken } = await issueSessionTokens(res, existing.user, sess.id, scope);

    return res.json({
      token: accessToken,
      user: formatUserSummary(existing.user),
      mustChangePassword: existing.user.mustChangePassword,
      scope,
      lastRoute: existing.user.lastRoute || null,
    });
  } catch (err) {
    console.error('refreshAccessToken error:', err);
    return res.status(500).json({ error: 'Failed to refresh session' });
  }
};

export const updateLastRoute = async (req: Request, res: Response) => {
  try {
    const route = String(req.body?.route || '').trim();
    if (!route || !route.startsWith('/')) {
      return res.status(400).json({ error: 'Valid route required' });
    }
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { lastRoute: route.slice(0, 250) },
    });
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: 'Failed to save route' });
  }
};

// Forced Password Change (on first login or after admin reset) OR voluntary change in Settings
export const changePassword = async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!newPassword || typeof newPassword !== 'string') {
      return res.status(400).json({ error: 'New password is required.' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: {
        facultyProfile: { include: { department: true } },
        studentProfile: {
          include: { class: { include: { academicYear: { include: { department: true } } } } },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Regular Settings change requires currentPassword; forced first-login screen does not ask for it
    if (!user.mustChangePassword) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Current password is required.' });
      }
      const matchesCurrent = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!matchesCurrent) {
        return res.status(400).json({ error: 'Current password does not match.' });
      }
    }

    const minSetting = await prisma.setting.findUnique({ where: { key: 'PASSWORD_MIN_LENGTH' } });
    const minLen = minSetting ? Math.max(8, Number(minSetting.value) || 8) : 8;
    const validation = await validateNewPassword(newPassword, user, minLen);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    await setPassword(user.id, newPassword, {
      by: 'self',
      mustChange: false,
      keepSessionId: req.user?.sid,
      actorUserId: user.id,
      io: req.app.get('io'),
    });

    const refreshedUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        facultyProfile: { include: { department: true } },
        studentProfile: {
          include: { class: { include: { academicYear: { include: { department: true } } } } },
        },
      },
    });

    let accessToken: string | undefined;
    if (req.user?.sid && refreshedUser) {
      const issued = await issueSessionTokens(res, refreshedUser, req.user.sid, 'full');
      accessToken = issued.accessToken;
    }

    return res.json({
      message: 'Password changed successfully',
      token: accessToken,
      user: refreshedUser ? formatUserSummary(refreshedUser) : undefined,
      scope: 'full',
    });
  } catch (error: any) {
    console.error('changePassword error:', error);
    return res.status(500).json({ error: 'Failed to change password' });
  }
};

// Forgot Password Request from Login Screen (rate-limited, neutral response)
export const requestPasswordReset = async (req: Request, res: Response) => {
  const NEUTRAL_MSG =
    'If an account matches those details, a password reset request has been sent to the administrator.';
  try {
    const identifier = String(req.body?.identifier || '').trim();
    const verifyDetail = String(req.body?.registerNo || req.body?.phoneLast4 || '').trim();
    if (!identifier) {
      return res.status(400).json({ error: 'Please enter your Login ID or Register Number.' });
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: identifier },
          { email: identifier },
          { studentProfile: { registerNo: identifier } },
          { studentProfile: { rollNo: identifier } },
          { facultyProfile: { employeeId: identifier } },
        ],
      },
      include: { studentProfile: true },
    });

    if (!user) {
      return res.json({ message: NEUTRAL_MSG });
    }

    if (verifyDetail) {
      const phoneDigits = (user.phone || user.studentProfile?.phone || '').replace(/\D/g, '');
      const regMatch = user.studentProfile?.registerNo?.toLowerCase() === verifyDetail.toLowerCase();
      const phoneMatch = phoneDigits.length >= 4 && phoneDigits.endsWith(verifyDetail.slice(-4));
      if (!regMatch && !phoneMatch && user.studentProfile) {
        // Return same neutral reply without leaking whether ID exists
        return res.json({ message: NEUTRAL_MSG });
      }
    }

    await prisma.passwordResetRequest.create({
      data: {
        userId: user.id,
        identifier,
        status: 'PENDING',
      },
    });

    const io = req.app.get('io');
    if (io) io.emit('data:updated', { resource: 'requests' });

    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } });
    await notifyUsers(io, admins.map((a) => a.id), {
      title: 'Password Reset Requested',
      message: `${user.name} (${identifier}) requested a password reset.`,
      type: 'REQUEST',
      link: '/admin/requests',
    });

    return res.json({ message: NEUTRAL_MSG });
  } catch {
    return res.json({ message: NEUTRAL_MSG });
  }
};

// Student Profile Completion (One-Time Lock)
export const completeStudentProfile = async (req: Request, res: Response) => {
  try {
    const parseResult = completeProfileSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0].message });
    }

    const studentProfile = await prisma.studentProfile.findUnique({
      where: { userId: req.user!.id },
    });

    if (!studentProfile) {
      return res.status(404).json({ error: 'Student profile not found' });
    }

    // Check if profile is already locked without edit permission
    if (studentProfile.isProfileLocked && !studentProfile.canEditProfile) {
      return res.status(403).json({
        error: 'Profile is locked. Request edit permission from administrator to update.',
      });
    }

    const { personalEmail, phone, dob, gender, bloodGroup, address, guardianName, guardianPhone, photoUrl } =
      parseResult.data;

    const updated = await prisma.studentProfile.update({
      where: { id: studentProfile.id },
      data: {
        personalEmail,
        phone,
        dob: new Date(dob),
        gender,
        bloodGroup,
        address,
        guardianName,
        guardianPhone,
        photoUrl,
        isProfileLocked: true,
        canEditProfile: false, // Relocks after save
      },
    });

    return res.json({
      message: 'Profile completed and locked successfully',
      profile: updated,
    });
  } catch (error: any) {
    console.error('completeStudentProfile error:', error);
    return res.status(500).json({ error: 'Failed to save student profile' });
  }
};

// Student Request Profile Edit Permission
export const requestProfileEdit = async (req: Request, res: Response) => {
  try {
    const parseResult = requestProfileEditSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0].message });
    }

    const studentProfile = await prisma.studentProfile.findUnique({
      where: { userId: req.user!.id },
    });

    if (!studentProfile) {
      return res.status(404).json({ error: 'Student profile not found' });
    }

    await prisma.profileEditRequest.create({
      data: {
        studentId: studentProfile.id,
        reason: parseResult.data.reason,
        status: 'PENDING',
      },
    });

    return res.json({ message: 'Edit permission request submitted to administrator.' });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to request profile edit' });
  }
};

// Device Change Request (works without login)
export const requestDeviceChange = async (req: Request, res: Response) => {
  try {
    const body = {
      ...req.body,
      identifier: req.body.identifier || req.body.registerNo || req.body.studentId || '',
      newDeviceId: req.body.newDeviceId || String(req.headers['x-device-id'] || 'web_device'),
      reason: req.body.reason || req.body.note || 'Device reset requested from login screen',
    };
    const parseResult = deviceChangeRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0].message });
    }

    const { identifier, newDeviceId, deviceLabel, platform, reason } = parseResult.data;
    const cleanId = identifier.trim();

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: cleanId },
          { email: cleanId },
          { studentProfile: { registerNo: cleanId } },
          { studentProfile: { rollNo: cleanId } },
          { facultyProfile: { employeeId: cleanId } },
        ],
      },
      include: { devices: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'Student or user account not found for that ID / Register Number.' });
    }

    const activeDevice = user.devices.find((d) => d.status === 'ACTIVE');
    const oldDeviceId = activeDevice ? activeDevice.deviceId : 'none';

    const changeRequest = await prisma.deviceChangeRequest.create({
      data: {
        userId: user.id,
        oldDeviceId,
        newDeviceId,
        label: deviceLabel,
        platform,
        reason,
        status: 'PENDING',
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'DEVICE_RESET_REQUESTED',
        details: JSON.stringify({ identifier: cleanId, newDeviceId, reason }),
      },
    });

    const io = req.app.get('io');
    if (io) io.emit('data:updated', { resource: 'requests' });

    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } });
    await notifyUsers(io, admins.map((a) => a.id), {
      title: 'Device Reset Requested',
      message: `${user.name} (${cleanId}) requested a device limit reset: ${reason}`,
      type: 'REQUEST',
      link: '/admin/requests',
    });

    return res.json({
      message: 'Device change request submitted to admin for review',
      requestId: changeRequest.id,
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to process device change request' });
  }
};

// Update My Profile (C2: Student safe fields; Faculty profile fields)
export const updateMyProfile = async (req: Request, res: Response) => {
  try {
    const parse = profileUpdateSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.errors[0].message });

    const userId = req.user!.id;
    const role = req.user!.role;
    const { name, phone, email, avatarUrl, departmentId, designation, qualification, bio } = parse.data;

    if (email) {
      const cleanEmail = email.trim().toLowerCase();
      const existing = await prisma.user.findFirst({
        where: { email: cleanEmail, NOT: { id: userId } },
      });
      if (existing) {
        return res.status(409).json({ error: 'This email address is already in use by another account.' });
      }
    }

    if (role === 'STUDENT') {
      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: userId },
          data: {
            ...(phone !== undefined ? { phone: phone || null } : {}),
            ...(avatarUrl !== undefined ? { avatarUrl: avatarUrl || null } : {}),
          },
        });
        await tx.studentProfile.update({
          where: { userId },
          data: {
            ...(phone !== undefined ? { phone: phone || null } : {}),
          },
        });
      });
    } else if (role === 'FACULTY') {
      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: userId },
          data: {
            ...(name ? { name: name.trim() } : {}),
            ...(phone !== undefined ? { phone: phone || null } : {}),
            ...(email !== undefined ? { email: email ? email.trim().toLowerCase() : null } : {}),
            ...(avatarUrl !== undefined ? { avatarUrl: avatarUrl || null } : {}),
          },
        });
        await tx.facultyProfile.update({
          where: { userId },
          data: {
            ...(departmentId ? { departmentId } : {}),
            ...(designation ? { designation: designation.trim() } : {}),
            ...(qualification !== undefined ? { qualification: qualification || null } : {}),
            ...(bio !== undefined ? { bio: bio || null } : {}),
          },
        });
      });
    } else {
      await prisma.user.update({
        where: { id: userId },
        data: {
          ...(name ? { name: name.trim() } : {}),
          ...(phone !== undefined ? { phone: phone || null } : {}),
          ...(email !== undefined ? { email: email ? email.trim().toLowerCase() : null } : {}),
          ...(avatarUrl !== undefined ? { avatarUrl: avatarUrl || null } : {}),
        },
      });
    }

    const updatedUser = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        facultyProfile: { include: { department: true } },
        studentProfile: {
          include: {
            class: {
              include: {
                academicYear: { include: { department: true } },
                advisor: { include: { user: true } },
              },
            },
          },
        },
        devices: { where: { status: 'ACTIVE' } },
      },
    });

    const io = req.app.get('io');
    if (io) io.emit('data:updated', { resource: 'profile', userId });

    return res.json({ message: 'Profile updated successfully', user: updatedUser });
  } catch (err: any) {
    console.error('updateMyProfile error:', err);
    return res.status(500).json({ error: 'Failed to update profile' });
  }
};

export const getCurrentUser = async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: {
      facultyProfile: { include: { department: true } },
      studentProfile: {
        include: {
          class: {
            include: {
              academicYear: { include: { department: true } },
              advisor: { include: { user: true } },
            },
          },
        },
      },
      devices: { where: { status: 'ACTIVE' } },
    },
  });

  if (!user) return res.status(404).json({ error: 'User not found' });

  return res.json({ user });
};

export const getMyDevices = async (req: Request, res: Response) => {
  try {
    const devices = await prisma.userDevice.findMany({
      where: { userId: req.user!.id, status: 'ACTIVE' },
      orderBy: { boundAt: 'asc' },
    });
    return res.json({ devices });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to load registered devices' });
  }
};

export const presenceHeartbeat = async (req: Request, res: Response) => {
  try {
    const sid = req.user?.sid;
    const active = req.body?.active !== false;
    if (sid) {
      presenceService.handleHeartbeat(sid, active);
      await prisma.userSession.update({
        where: { id: sid },
        data: { lastSeenAt: new Date() },
      }).catch(() => {});
    }
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: 'Heartbeat failed' });
  }
};

export const getMyAuthHistory = async (req: Request, res: Response) => {
  try {
    const events = await prisma.authEvent.findMany({
      where: { userId: req.user!.id },
      orderBy: { timestamp: 'desc' },
      take: 30,
    });
    return res.json({ events });
  } catch {
    return res.status(500).json({ error: 'Failed to load login history' });
  }
};

export const logout = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers['authorization'];
    const token =
      authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.split(' ')[1]
        : req.cookies?.velan_access_token;

    let sid = req.user?.sid;
    let userId = req.user?.id;
    let role = req.user?.role;
    if (!sid && token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        sid = decoded?.sid;
        userId = decoded?.id;
        role = decoded?.role;
      } catch {
        // expired token
      }
    }

    const reason = req.body?.reason === 'idle_timeout' ? 'idle_timeout' : 'logout';
    if (sid) {
      revokeSessionToken(sid);
      presenceService.removeSession(sid);
      await prisma.userSession.updateMany({
        where: { id: sid, endedAt: null },
        data: { endedAt: new Date(), endReason: reason },
      });
      await prisma.refreshToken.updateMany({
        where: { sessionId: sid, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    if (userId) {
      const meta = parseClientMeta(req);
      enqueueAuthEvent({
        userId,
        role: role || 'UNKNOWN',
        event: reason === 'idle_timeout' ? 'idle_timeout' : 'logout',
        deviceId: (req.headers['x-device-id'] as string) || null,
        ...meta,
      });
    }
  } catch {
    // non-fatal
  }

  res.clearCookie('velan_access_token');
  res.clearCookie('velan_refresh_token');
  return res.json({ message: 'Logged out successfully' });
};
