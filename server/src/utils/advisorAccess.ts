import { prisma } from '../lib/prisma';

export const MAX_MENTORS_PER_CLASS = 2;

export interface AdvisorClassRole {
  classId: string;
  className: string;
  role: 'advisor' | 'mentor';
}

export async function getAdvisorAndMentorClasses(userId: string): Promise<AdvisorClassRole[]> {
  const faculty = await prisma.facultyProfile.findUnique({
    where: { userId },
    include: {
      advisedClasses: { select: { id: true, name: true } },
      classMentors: {
        include: { class: { select: { id: true, name: true } } },
      },
    },
  });

  if (!faculty) return [];

  const map = new Map<string, AdvisorClassRole>();

  for (const c of faculty.advisedClasses) {
    map.set(c.id, { classId: c.id, className: c.name, role: 'advisor' });
  }

  for (const m of faculty.classMentors) {
    const existing = map.get(m.classId);
    if (!existing) {
      map.set(m.classId, {
        classId: m.classId,
        className: m.class.name,
        role: m.role === 'advisor' ? 'advisor' : 'mentor',
      });
    }
  }

  return Array.from(map.values());
}

export async function canActAsAdvisor(
  user: { id: string; role: string },
  classId: string
): Promise<boolean> {
  if (!user || !classId) return false;
  if (user.role === 'ADMIN') return true;
  if (user.role !== 'FACULTY') return false;

  const faculty = await prisma.facultyProfile.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!faculty) return false;

  const [cls, mentorRow] = await Promise.all([
    prisma.class.findUnique({ where: { id: classId }, select: { advisorId: true } }),
    prisma.classMentor.findUnique({
      where: { classId_facultyId: { classId, facultyId: faculty.id } },
      select: { id: true },
    }),
  ]);

  return cls?.advisorId === faculty.id || !!mentorRow;
}
