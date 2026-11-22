import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';

// Get academic hierarchy: Departments -> Years -> Classes
export const getAcademicHierarchy = async (req: Request, res: Response) => {
  try {
    const departments = await prisma.department.findMany({
      include: {
        academicYears: {
          include: {
            classes: {
              include: {
                advisor: { include: { user: true } },
                _count: { select: { students: true, classSubjects: true } },
              },
            },
          },
        },
        subjects: true,
      },
    });

    return res.json({ departments });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to fetch academic hierarchy' });
  }
};

// Get faculty list
export const getFacultyList = async (req: Request, res: Response) => {
  try {
    const faculty = await prisma.facultyProfile.findMany({
      include: {
        user: true,
        department: true,
        classSubjects: { include: { subject: true, class: true } },
      },
    });

    return res.json({ faculty });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to fetch faculty list' });
  }
};

// Get students list
export const getStudentsList = async (req: Request, res: Response) => {
  try {
    const { classId } = req.query;

    const students = await prisma.studentProfile.findMany({
      where: classId ? { classId: String(classId) } : undefined,
      include: {
        user: { include: { devices: true } },
        class: true,
        _count: { select: { attendanceRecords: true } },
      },
    });

    return res.json({ students });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to fetch students' });
  }
};

// Get device change requests for admin queue
export const getDeviceRequests = async (req: Request, res: Response) => {
  try {
    const requests = await prisma.deviceChangeRequest.findMany({
      include: {
        user: {
          include: {
            studentProfile: { include: { class: true } },
          },
        },
      },
      orderBy: { requestedAt: 'desc' },
    });

    return res.json({ requests });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to fetch device requests' });
  }
};

// Decide device change request (Approve or Reject)
export const decideDeviceRequest = async (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;
    const { action } = req.body; // 'APPROVE' | 'REJECT'

    const request = await prisma.deviceChangeRequest.findUnique({
      where: { id: requestId },
      include: { user: true },
    });

    if (!request) return res.status(404).json({ error: 'Request not found' });

    if (action === 'APPROVE') {
      // 1. Revoke existing devices for this user
      await prisma.userDevice.updateMany({
        where: { userId: request.userId },
        data: { status: 'REVOKED' },
      });

      // 2. Bind new device
      await prisma.userDevice.upsert({
        where: { deviceId: request.newDeviceId },
        update: { status: 'ACTIVE', userId: request.userId, lastUsedAt: new Date() },
        create: {
          userId: request.userId,
          deviceId: request.newDeviceId,
          label: request.label || 'Rebound Device',
          platform: request.platform || 'Web',
          status: 'ACTIVE',
        },
      });

      // 3. Mark request as APPROVED
      await prisma.deviceChangeRequest.update({
        where: { id: requestId },
        data: { status: 'APPROVED', decidedBy: req.user!.name, decidedAt: new Date() },
      });

      // 4. Audit Log
      await prisma.auditLog.create({
        data: {
          userId: req.user!.id,
          action: 'DEVICE_CHANGE_APPROVED',
          details: `Approved device reset for ${request.user.name} (${request.user.email}) to device ID ${request.newDeviceId}`,
        },
      });

      return res.json({ message: 'Device change approved and account rebound successfully' });
    } else {
      await prisma.deviceChangeRequest.update({
        where: { id: requestId },
        data: { status: 'REJECTED', decidedBy: req.user!.name, decidedAt: new Date() },
      });

      return res.json({ message: 'Device change request rejected' });
    }
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to process request decision' });
  }
};
