import { prisma } from '../lib/prisma';

export interface CRSettings {
  crCanEditFacultyPosts: boolean;
  crNotifyFacultyOnEdit: boolean;
  crMaxPerClass: number;
}

export async function getCRSettings(): Promise<CRSettings> {
  const rows = await prisma.setting.findMany({
    where: {
      key: {
        in: ['cr_can_edit_faculty_posts', 'cr_notify_faculty_on_edit', 'cr_max_per_class'],
      },
    },
  });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    crCanEditFacultyPosts: map.get('cr_can_edit_faculty_posts') !== 'false',
    crNotifyFacultyOnEdit: map.get('cr_notify_faculty_on_edit') !== 'false',
    crMaxPerClass: Math.max(1, Number(map.get('cr_max_per_class') || 2) || 2),
  };
}

export async function getStudentCRInfo(userId: string) {
  const student = await prisma.studentProfile.findUnique({
    where: { userId },
    include: {
      user: { select: { status: true, name: true } },
      class: { select: { id: true, name: true } },
      classRepresentatives: true,
    },
  });
  if (!student || student.deletedAt || student.user.status !== 'ACTIVE') return null;
  const cr = student.classRepresentatives.find((r) => r.classId === student.classId);
  if (!cr) return null;
  return {
    student,
    crRecord: cr,
    classId: student.classId,
    className: student.class.name,
  };
}

export async function canManageClassContent(
  user: { id: string; role: string },
  classId: string,
  item?: {
    createdByUserId?: string | null;
    createdByRole?: string | null;
    classSubject?: { facultyId: string | null };
  }
): Promise<{
  allowed: boolean;
  status?: 403;
  error?: string;
  isCR: boolean;
  settings?: CRSettings;
}> {
  if (user.role === 'ADMIN') {
    return { allowed: true, isCR: false };
  }

  if (user.role === 'FACULTY') {
    const fac = await prisma.facultyProfile.findUnique({ where: { userId: user.id } });
    if (!fac) {
      return { allowed: false, status: 403, error: 'Faculty profile not found', isCR: false };
    }
    if (item?.classSubject && item.classSubject.facultyId !== fac.id) {
      return { allowed: false, status: 403, error: 'You can only manage your own class items', isCR: false };
    }
    return { allowed: true, isCR: false };
  }

  if (user.role === 'STUDENT') {
    const crInfo = await getStudentCRInfo(user.id);
    if (!crInfo || crInfo.classId !== classId) {
      return {
        allowed: false,
        status: 403,
        error: 'Only faculty or Class Representatives of this class can manage class content',
        isCR: false,
      };
    }

    const settings = await getCRSettings();
    if (item) {
      const isFacultyPost =
        item.createdByRole === 'FACULTY' ||
        (!item.createdByRole && item.createdByUserId !== user.id);
      if (isFacultyPost && !settings.crCanEditFacultyPosts) {
        return {
          allowed: false,
          status: 403,
          error: 'Class Representatives can only edit or delete their own items.',
          isCR: true,
          settings,
        };
      }
    }

    return { allowed: true, isCR: true, settings };
  }

  return { allowed: false, status: 403, error: 'Forbidden', isCR: false };
}
