import { prisma } from '../lib/prisma';

export interface StudentAccessResult {
  allowed: boolean;
  scope: 'admin' | 'advisor' | 'mentor' | 'self' | 'none';
  facultyId?: string;
}

export async function canViewStudent(
  user: { id: string; role: string },
  studentId: string
): Promise<StudentAccessResult> {
  if (!user) return { allowed: false, scope: 'none' };

  const student = await prisma.studentProfile.findUnique({
    where: { id: studentId },
    include: { class: true },
  });
  if (!student) return { allowed: false, scope: 'none' };

  if (user.role === 'ADMIN') {
    return { allowed: true, scope: 'admin' };
  }

  if (user.role === 'STUDENT') {
    return student.userId === user.id
      ? { allowed: true, scope: 'self' }
      : { allowed: false, scope: 'none' };
  }

  if (user.role === 'FACULTY') {
    const faculty = await prisma.facultyProfile.findUnique({ where: { userId: user.id } });
    if (!faculty) return { allowed: false, scope: 'none' };

    if (student.class.advisorId === faculty.id) {
      return { allowed: true, scope: 'advisor', facultyId: faculty.id };
    }

    const menteeLink = await prisma.menteeAssignment.findFirst({
      where: { studentId, mentorId: faculty.id },
    });
    if (menteeLink) {
      return { allowed: true, scope: 'mentor', facultyId: faculty.id };
    }
  }

  return { allowed: false, scope: 'none' };
}
