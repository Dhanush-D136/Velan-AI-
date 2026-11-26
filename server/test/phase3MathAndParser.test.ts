import { describe, it, expect } from 'vitest';
import { calculateSkipMetrics } from '../src/utils/skipMath';
import { computeSemesterSummary, computeCumulativeCGPA, computeTargetCGPA } from '../src/utils/gpaMath';
import { parseResultText, validateResultIdentity } from '../../client/src/utils/resultParser';

const SAMPLE_RESULT_TEXT = `Provisional Results of End Semester Examinations - April / May 2026
Name of the Student DHANUSH D Register Number 113024243032
Degree & Branch B.TECH ARTIFICIAL INTELLIGENCE
AND DATA SCIENCE
Regulation 2021
Semester Subject Code Subject Name Credit Grade Result
4 21AI41T DATA ENGINEERING 3.0 A+ PASS
4 21AI42IT MACHINE LEARNING TECHNIQUES 4.0 O PASS
4 21MA43T STATISTICS FOR DATA SCIENCE 4.0 O PASS
4 21HC44T OPERATING SYSTEMS 3.0 A PASS
4 21HE32T DIGITAL LOGIC CIRCUITS 3.0 A PASS
4 21MC02T ENVIRONMENTAL SCIENCES 0.0 A PASS
4 21HC47P OPERATING SYSTEMS LABORATORY 2.0 O PASS
4 21HE38P DIGITAL LOGIC CIRCUITS LABORATORY 2.0 A+ PASS
4 21EE04P INTERNSHIP 1.0 O PASS
Letter Grade O A+ A B+ B C RA WH WD AB
Grade Point 10 9 8 7 6 5 Reappear With Held With Drawal Absent
DISCLAIMER : This result publised at this website is provisional only.
Designed by VVel el TTech High ech High TTech ech
Print this page`;

describe('Phase 3 Unit Tests: Skip Calculator Formulas & Edge Cases', () => {
  it('computes safeToSkip = 2 for present 18, total 22, t = 75%', () => {
    const res = calculateSkipMetrics({ present: 18, total: 22, requiredPercent: 75 });
    expect(res.safeToSkip).toBe(2);
    expect(res.status).toBe('BORDERLINE');
  });

  it('computes recovery x = 6 for present 15, total 22, t = 75% (21/28 = 75%)', () => {
    const res = calculateSkipMetrics({ present: 15, total: 22, requiredPercent: 75, condonationPercent: 65 });
    expect(res.mustAttend).toBe(6);
    expect(res.status).toBe('CONDONATION');
  });

  it('handles edge cases: empty (total=0), 100%, zero remaining, t=100%', () => {
    const empty = calculateSkipMetrics({ present: 0, total: 0 });
    expect(empty.status).toBe('NO_DATA');

    const perfect = calculateSkipMetrics({ present: 20, total: 20, requiredPercent: 75 });
    expect(perfect.percentage).toBe(100);
    expect(perfect.safeToSkip).toBe(6);

    const impossible = calculateSkipMetrics({ present: 10, total: 20, requiredPercent: 75, remainingScheduled: 2 });
    expect(impossible.projection.recoveryPossible).toBe(false);
    expect(impossible.advice).toContain('Recovery is no longer possible without condonation');

    const req100 = calculateSkipMetrics({ present: 9, total: 10, requiredPercent: 100 });
    expect(req100.mustAttend).toBeNull();
    expect(req100.safeToSkip).toBe(0);
  });
});

describe('Phase 3 Unit Tests: Anna University GPA, CGPA & Arrear Replacement', () => {
  it('computes sample Sem 4 GPA = 9.23 (203 points / 22 credits) ignoring 0-credit course', () => {
    const sem4 = computeSemesterSummary([
      { subjectCode: '21AI41T', subjectName: 'DATA ENGINEERING', credits: 3, grade: 'A+' },
      { subjectCode: '21AI42IT', subjectName: 'MACHINE LEARNING TECHNIQUES', credits: 4, grade: 'O' },
      { subjectCode: '21MA43T', subjectName: 'STATISTICS FOR DATA SCIENCE', credits: 4, grade: 'O' },
      { subjectCode: '21HC44T', subjectName: 'OPERATING SYSTEMS', credits: 3, grade: 'A' },
      { subjectCode: '21HE32T', subjectName: 'DIGITAL LOGIC CIRCUITS', credits: 3, grade: 'A' },
      { subjectCode: '21MC02T', subjectName: 'ENVIRONMENTAL SCIENCES', credits: 0, grade: 'A' },
      { subjectCode: '21HC47P', subjectName: 'OPERATING SYSTEMS LABORATORY', credits: 2, grade: 'O' },
      { subjectCode: '21HE38P', subjectName: 'DIGITAL LOGIC CIRCUITS LABORATORY', credits: 2, grade: 'A+' },
      { subjectCode: '21EE04P', subjectName: 'INTERNSHIP', credits: 1, grade: 'O' },
    ]);
    expect(sem4.totalCredits).toBe(22);
    expect(sem4.totalGradePoints).toBe(203);
    expect(sem4.gpa).toBe(9.23);
    expect(sem4.arrearCount).toBe(0);
  });

  it('replaces cleared RA arrear without double counting credits', () => {
    const sem1 = computeSemesterSummary([
      { subjectCode: '21CS11T', subjectName: 'PYTHON', credits: 4, grade: 'RA' },
    ]);
    const sem2 = computeSemesterSummary([
      { subjectCode: '21CS11T', subjectName: 'PYTHON', credits: 4, grade: 'A+' },
    ]);
    const cum = computeCumulativeCGPA([
      { semesterNumber: 1, subjects: sem1.subjects },
      { semesterNumber: 2, subjects: sem2.subjects },
    ]);
    expect(cum.totalCredits).toBe(4);
    expect(cum.totalGradePoints).toBe(36);
    expect(cum.cgpa).toBe(9);
    expect(cum.arrearsCount).toBe(0);
    expect(cum.effectiveSubjects[0].attempts.length).toBe(2);
  });

  it('computes Target CGPA planner accurately', () => {
    const plan = computeTargetCGPA({
      currentCredits: 22,
      currentGradePoints: 203,
      nextSemesterCredits: 22,
      targetCGPA: 9.0,
      expectedNextGPA: 9.5,
    });
    expect(plan.requiredNextGPA).toBe(8.77);
    expect(plan.projectedCGPA).toBe(9.36);
  });
});

describe('Phase 3 Unit Tests: Regulation 2021 Result Sheet Parser', () => {
  it('parses the real Regulation 2021 Semester 4 sample text accurately (GPA 9.23)', () => {
    const parsed = parseResultText(SAMPLE_RESULT_TEXT);
    expect(parsed.registerNo).toBe('113024243032');
    expect(parsed.studentName).toBe('DHANUSH D');
    expect(parsed.regulation).toBe('2021');
    expect(parsed.sessionLabel).toBe('April/May 2026');
    expect(parsed.degreeBranch).toContain('B.TECH ARTIFICIAL INTELLIGENCE');
    expect(parsed.semesters.length).toBe(1);

    const sem4 = parsed.semesters[0];
    expect(sem4.semesterNumber).toBe(4);
    expect(sem4.subjects.length).toBe(9);
    expect(sem4.totalCredits).toBe(22);
    expect(sem4.totalGradePoints).toBe(203);
    expect(sem4.gpa).toBe(9.23);
    expect(sem4.arrearsCount).toBe(0);

    const env = sem4.subjects.find((s) => s.subjectCode === '21MC02T');
    expect(env?.credits).toBe(0);
    expect(env?.isNonCredit).toBe(true);
  });

  it('handles RA, WH, AB rows, multi-semester files, and wrong register number', () => {
    const fixture = `Name of the Student TEST USER Register Number 999999999999
Regulation 2021
1 21CS11T PROGRAMMING 3.0 RA RA
1 21CS12T MATH I 4.0 WH WH
2 21CS21T DATA STRUCTURES 3.0 AB AB
2 21CS22T DIGITAL SYSTEMS 3.0 O PASS`;

    const parsed = parseResultText(fixture);
    expect(parsed.semesters.length).toBe(2);
    expect(parsed.semesters[0].arrearsCount).toBe(2);
    expect(parsed.semesters[1].arrearsCount).toBe(1);
    expect(parsed.semesters[1].gpa).toBe(5); // (0 + 30) / 6

    const idCheck = validateResultIdentity(parsed, '113024243032', 'DHANUSH D');
    expect(idCheck.valid).toBe(false);
    expect(idCheck.reason).toBe('This result sheet belongs to a different student.');
  });
});
