export interface GradeScaleEntry {
  grade: string;
  points: number;
  isPass: boolean;
  isArrear: boolean;
  label?: string | null;
}

export const DEFAULT_ANNA_2021_SCALE: GradeScaleEntry[] = [
  { grade: 'O', points: 10, isPass: true, isArrear: false, label: 'Outstanding' },
  { grade: 'A+', points: 9, isPass: true, isArrear: false, label: 'Excellent' },
  { grade: 'A', points: 8, isPass: true, isArrear: false, label: 'Very Good' },
  { grade: 'B+', points: 7, isPass: true, isArrear: false, label: 'Good' },
  { grade: 'B', points: 6, isPass: true, isArrear: false, label: 'Average' },
  { grade: 'C', points: 5, isPass: true, isArrear: false, label: 'Satisfactory' },
  { grade: 'RA', points: 0, isPass: false, isArrear: true, label: 'Reappear' },
  { grade: 'WH', points: 0, isPass: false, isArrear: true, label: 'With Held' },
  { grade: 'WD', points: 0, isPass: false, isArrear: true, label: 'With Drawal' },
  { grade: 'AB', points: 0, isPass: false, isArrear: true, label: 'Absent' },
];

export interface SubjectScoreInput {
  subjectCode: string;
  subjectName: string;
  credits: number;
  grade: string;
  result?: string;
}

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function buildScaleMap(scale: GradeScaleEntry[] = DEFAULT_ANNA_2021_SCALE) {
  const map = new Map<string, GradeScaleEntry>();
  for (const item of scale) {
    map.set(item.grade.trim().toUpperCase(), item);
  }
  return map;
}

export function computeSemesterSummary(
  subjects: SubjectScoreInput[],
  scale: GradeScaleEntry[] = DEFAULT_ANNA_2021_SCALE
) {
  const scaleMap = buildScaleMap(scale);
  let totalCredits = 0;
  let totalGradePoints = 0;
  let arrearCount = 0;

  const evaluated = subjects.map((s) => {
    const code = s.subjectCode.trim().toUpperCase();
    const gradeKey = s.grade.trim().toUpperCase();
    const entry = scaleMap.get(gradeKey) || { grade: gradeKey, points: 0, isPass: false, isArrear: true };
    const credits = Math.max(0, Number(s.credits) || 0);
    const isNonCredit = credits === 0;
    const isArrear = !entry.isPass || entry.isArrear;
    const gradePoint = entry.points;

    if (!isNonCredit) {
      totalCredits += credits;
      totalGradePoints += credits * gradePoint;
    }
    if (isArrear) {
      arrearCount += 1;
    }

    return {
      subjectCode: code,
      subjectName: s.subjectName.trim(),
      credits,
      grade: gradeKey,
      gradePoint,
      result: s.result?.trim().toUpperCase() || (entry.isPass ? 'PASS' : 'RA'),
      isArrear,
      isNonCredit,
      isCleared: !isArrear,
    };
  });

  const gpa = totalCredits > 0 ? round2(totalGradePoints / totalCredits) : 0;

  return {
    subjects: evaluated,
    totalCredits: round2(totalCredits),
    totalGradePoints: round2(totalGradePoints),
    gpa,
    arrearCount,
  };
}

export function computeCumulativeCGPA(
  semesters: Array<{
    semesterNumber: number;
    subjects: Array<{
      subjectCode: string;
      subjectName: string;
      credits: number;
      grade: string;
      gradePoint: number;
      isArrear: boolean;
      isNonCredit: boolean;
      result?: string;
    }>;
  }>,
  cgpaMultiplier = 10
) {
  const sorted = [...semesters].sort((a, b) => a.semesterNumber - b.semesterNumber);
  // Map by subjectCode so clearing an RA in a later semester replaces the earlier arrear attempt
  const effectiveMap = new Map<
    string,
    {
      subjectCode: string;
      subjectName: string;
      credits: number;
      grade: string;
      gradePoint: number;
      isArrear: boolean;
      isNonCredit: boolean;
      semesterNumber: number;
      attempts: Array<{ semesterNumber: number; grade: string; gradePoint: number; result?: string }>;
    }
  >();

  for (const sem of sorted) {
    for (const sub of sem.subjects) {
      const code = sub.subjectCode.trim().toUpperCase();
      const prev = effectiveMap.get(code);
      const attempt = {
        semesterNumber: sem.semesterNumber,
        grade: sub.grade,
        gradePoint: sub.gradePoint,
        result: sub.result,
      };
      if (!prev) {
        effectiveMap.set(code, {
          ...sub,
          subjectCode: code,
          semesterNumber: sem.semesterNumber,
          attempts: [attempt],
        });
      } else {
        // Keep history of attempts; if new attempt is a pass or replaces earlier arrear, replace active score
        const attempts = [...prev.attempts, attempt];
        effectiveMap.set(code, {
          ...sub,
          subjectCode: code,
          semesterNumber: sem.semesterNumber,
          attempts,
        });
      }
    }
  }

  let totalCredits = 0;
  let totalGradePoints = 0;
  let totalCreditsEarned = 0;
  const activeArrears: Array<{ subjectCode: string; subjectName: string; semesterNumber: number; grade: string }> = [];

  for (const item of effectiveMap.values()) {
    if (!item.isNonCredit) {
      totalCredits += item.credits;
      totalGradePoints += item.credits * item.gradePoint;
      if (!item.isArrear) {
        totalCreditsEarned += item.credits;
      }
    }
    if (item.isArrear) {
      activeArrears.push({
        subjectCode: item.subjectCode,
        subjectName: item.subjectName,
        semesterNumber: item.semesterNumber,
        grade: item.grade,
      });
    }
  }

  const cgpa = totalCredits > 0 ? round2(totalGradePoints / totalCredits) : 0;
  const percentageEquivalent = round2(cgpa * cgpaMultiplier);

  return {
    cgpa,
    percentageEquivalent,
    totalCredits: round2(totalCredits),
    totalCreditsEarned: round2(totalCreditsEarned),
    totalGradePoints: round2(totalGradePoints),
    activeArrears,
    arrearsCount: activeArrears.length,
    effectiveSubjects: Array.from(effectiveMap.values()),
  };
}

export function computeTargetCGPA(params: {
  currentCredits: number;
  currentGradePoints: number;
  nextSemesterCredits: number;
  targetCGPA?: number;
  expectedNextGPA?: number;
}) {
  const { currentCredits, currentGradePoints, nextSemesterCredits, targetCGPA, expectedNextGPA } = params;
  const combinedCredits = currentCredits + nextSemesterCredits;

  let requiredNextGPA: number | null = null;
  let achievable = true;
  if (targetCGPA !== undefined && nextSemesterCredits > 0) {
    requiredNextGPA = round2((targetCGPA * combinedCredits - currentGradePoints) / nextSemesterCredits);
    achievable = requiredNextGPA <= 10;
  }

  let projectedCGPA: number | null = null;
  if (expectedNextGPA !== undefined && combinedCredits > 0) {
    projectedCGPA = round2((currentGradePoints + expectedNextGPA * nextSemesterCredits) / combinedCredits);
  }

  return {
    requiredNextGPA,
    achievable,
    projectedCGPA,
  };
}
