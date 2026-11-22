import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { loginSchema, deviceChangeRequestSchema } from '@velan/shared';

const JWT_SECRET = process.env.JWT_SECRET || 'velan_jwt_secret_dev_2026';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'velan_refresh_secret_dev_2026';

export const login = async (req: Request, res: Response) => {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0].message });
    }

    const { email, password, deviceId, deviceLabel, platform } = parseResult.data;

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        devices: true,
        facultyProfile: { include: { department: true } },
        studentProfile: { include: { class: { include: { academicYear: { include: { department: true } } } } } },
      },
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({ error: 'Account is inactive or suspended' });
    }

    // Hardware Device Lock verification
    if (user.role === 'STUDENT') {
      const activeDevice = user.devices.find((d) => d.status === 'ACTIVE');
      if (activeDevice) {
        if (activeDevice.deviceId !== deviceId) {
          return res.status(403).json({
            code: 'DEVICE_LOCKED',
            error: 'This account is linked to another device. Request admin approval.',
            boundDeviceId: activeDevice.deviceId,
          });
        } else {
          // Update last used timestamp
          await prisma.userDevice.update({
            where: { id: activeDevice.id },
            data: { lastUsedAt: new Date() },
          });
        }
      } else {
        // First login: bind account to this device
        await prisma.userDevice.create({
          data: {
            userId: user.id,
            deviceId,
            label: deviceLabel || 'Primary Device',
            platform: platform || 'Web',
            status: 'ACTIVE',
          },
        });
      }
    }

    // Generate Tokens
    const tokenPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    };

    const accessToken = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign(tokenPayload, JWT_REFRESH_SECRET, { expiresIn: '7d' });

    // Set refresh token cookie (SameSite=None, Secure for cross-origin Vercel/Render)
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
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
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
            parentPhone: user.studentProfile.parentPhone,
          }
        : null,
    };

    return res.json({
      message: 'Login successful',
      token: accessToken,
      user: userSummary,
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error during authentication' });
  }
};

export const requestDeviceChange = async (req: Request, res: Response) => {
  try {
    const parseResult = deviceChangeRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0].message });
    }

    const { email, newDeviceId, deviceLabel, platform, reason } = parseResult.data;

    const user = await prisma.user.findUnique({
      where: { email },
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
      studentProfile: { include: { class: true } },
    },
  });

  if (!user) return res.status(404).json({ error: 'User not found' });

  return res.json({ user });
};

export const logout = (req: Request, res: Response) => {
  res.clearCookie('velan_access_token');
  res.clearCookie('velan_refresh_token');
  return res.json({ message: 'Logged out successfully' });
};
