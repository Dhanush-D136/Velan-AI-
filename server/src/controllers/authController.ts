import { Request, Response } from 'express';
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
} from '@velan/shared';

const JWT_SECRET = process.env.JWT_SECRET || 'velan_jwt_secret_dev_2026';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'velan_refresh_secret_dev_2026';

export const login = async (req: Request, res: Response) => {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0].message });
    }

    const { identifier, password, deviceId, deviceLabel, platform } = parseResult.data;
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
      return res.status(401).json({ error: 'Invalid login credentials. User not found.' });
    }

    // 2. Validate password
    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      return res.status(401).json({ error: 'Incorrect password.' });
    }

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({ error: 'Your account is inactive or suspended. Please contact administrator.' });
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
          return res.status(403).json({
            code: 'DEVICE_LOCKED',
            error:
              activeDevices.length >= 2
                ? 'This account is already registered on 2 devices. Send a request to admin to reset your devices.'
                : `This account already has a ${deviceType.toLowerCase()} registered. Send a request to admin to reset your devices.`,
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

    // 4. Generate Tokens
    const tokenPayload = {
      id: user.id,
      role: user.role,
      name: user.name,
      username: user.username,
      email: user.email,
    };

    const accessToken = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign(tokenPayload, JWT_REFRESH_SECRET, { expiresIn: '7d' });

    res.cookie('velan_refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.cookie('velan_access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 15 * 60 * 1000,
    });

    const userSummary = {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      role: user.role as any,
      status: user.status as any,
      mustChangePassword: user.mustChangePassword,
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

    return res.json({
      message: 'Login successful',
      token: accessToken,
      user: userSummary,
      mustChangePassword: user.mustChangePassword,
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error during authentication' });
  }
};

// Forced Password Change (on first login or after admin reset)
export const changePassword = async (req: Request, res: Response) => {
  try {
    const parseResult = changePasswordSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0].message });
    }

    const { currentPassword, newPassword } = parseResult.data;

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const matchesCurrent = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!matchesCurrent) {
      return res.status(400).json({ error: 'Current password does not match.' });
    }

    if (newPassword === '1234') {
      return res.status(400).json({ error: 'Password cannot stay 1234. Please choose a new password.' });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newHash,
        mustChangePassword: false,
      },
    });

    return res.json({ message: 'Password changed successfully' });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to change password' });
  }
};

// Forgot Password Request from Login Screen
export const requestPasswordReset = async (req: Request, res: Response) => {
  try {
    const parseResult = requestPasswordResetSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0].message });
    }

    const { identifier } = parseResult.data;
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
    });

    if (!user) {
      return res.status(404).json({ error: 'No account found with this Register Number / Employee ID / Username.' });
    }

    await prisma.passwordResetRequest.create({
      data: {
        userId: user.id,
        identifier: cleanId,
        status: 'PENDING',
      },
    });

    return res.json({
      message: 'Password reset request submitted. Contact administrator for approval.',
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to submit password reset request' });
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

// Device Change Request
export const requestDeviceChange = async (req: Request, res: Response) => {
  try {
    const parseResult = deviceChangeRequestSchema.safeParse(req.body);
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
      return res.status(404).json({ error: 'User not found' });
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

    return res.json({
      message: 'Device change request submitted to admin for review',
      requestId: changeRequest.id,
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to process device change request' });
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

export const logout = (req: Request, res: Response) => {
  res.clearCookie('velan_access_token');
  res.clearCookie('velan_refresh_token');
  return res.json({ message: 'Logged out successfully' });
};
