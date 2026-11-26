export interface ParsedSubjectRow {
  semesterNumber: number;
  subjectCode: string;
  subjectName: string;
  credits: number;
  grade: string;
  gradePoint: number;
  result: string;
  isArrear: boolean;
  isNonCredit: boolean;
  confidence: 'HIGH' | 'LOW';
}

export interface ParsedSemesterGroup {
  semesterNumber: number;
  subjects: ParsedSubjectRow[];
  totalCredits: number;
  totalGradePoints: number;
  gpa: number;
  arrearsCount: number;
}

export interface ParsedResultSheet {
  sessionLabel: string | null;
  studentName: string | null;
  registerNo: string | null;
  degreeBranch: string | null;
  regulation: string;
  semesters: ParsedSemesterGroup[];
  allRows: ParsedSubjectRow[];
  unparsedLines: string[];
  source: 'PDF' | 'OCR';
}

const GRADE_POINTS: Record<string, { points: number; isArrear: boolean }> = {
  O: { points: 10, isArrear: false },
  'A+': { points: 9, isArrear: false },
  A: { points: 8, isArrear: false },
  'B+': { points: 7, isArrear: false },
  B: { points: 6, isArrear: false },
  C: { points: 5, isArrear: false },
  RA: { points: 0, isArrear: true },
  WH: { points: 0, isArrear: true },
  WD: { points: 0, isArrear: true },
  AB: { points: 0, isArrear: true },
};

const ROW_REGEX =
  /^(\d{1,2})\s+(\d{2}[A-Z]{2}\d{2}[A-Z]{1,2})\s+(.+?)\s+(\d+(?:\.\d)?)\s+(O|A\+|A|B\+|B|C|RA|WH|WD|AB)\s+(\S+)$/i;

const ROW_NO_CREDIT_REGEX =
  /^(\d{1,2})\s+(\d{2}[A-Z]{2}\d{2}[A-Z]{1,2})\s+(.+?)\s+(O|A\+|A|B\+|B|C|RA|WH|WD|AB)\s+(\S+)$/i;

const IGNORE_PATTERNS = [
  /^Letter\s+Grade/i,
  /^Grade\s+Point/i,
  /^DISCLAIMER/i,
  /^Print\s+this\s+page/i,
  /^Designed\s+by/i,
  /^Semester\s+Subject\s+Code/i,
  /^Vel\s+Tech/i,
  /^\(An\s+Autonomous/i,
  /^#42,\s*Avadi/i,
];

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function parseResultText(
  rawText: string,
  options?: { creditLookup?: Record<string, number>; source?: 'PDF' | 'OCR' }
): ParsedResultSheet {
  const cleaned = rawText.replace(/\r/g, '\n').replace(/\uFFFD/g, ' ');
  const lines = cleaned
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  let sessionLabel: string | null = null;
  let studentName: string | null = null;
  let registerNo: string | null = null;
  let degreeBranch: string | null = null;
  let regulation = '2021';

  const sessionMatch = cleaned.match(
    /Provisional\s+Results.*?[-–]\s*([A-Za-z]+\s*\/\s*[A-Za-z]+\s*\d{4})/i
  );
  if (sessionMatch) {
    sessionLabel = sessionMatch[1].replace(/\s*\/\s*/g, '/').replace(/\s+/g, ' ').trim();
  }

  const nameRegMatch = cleaned.match(
    /Name\s+of\s+the\s+Student\s+([A-Z0-9.\s]+?)\s+Register\s+Number\s+(\d{6,16})/i
  );
  if (nameRegMatch) {
    studentName = nameRegMatch[1].replace(/\s+/g, ' ').trim();
    registerNo = nameRegMatch[2].trim();
  } else {
    const regOnly = cleaned.match(/Register\s+Number\s*[:\-]?\s*(\d{6,16})/i);
    if (regOnly) registerNo = regOnly[1].trim();
    const nameOnly = cleaned.match(/Name\s+of\s+the\s+Student\s*[:\-]?\s*([A-Z.\s]{2,50})/i);
    if (nameOnly) studentName = nameOnly[1].replace(/\s+/g, ' ').trim();
  }

  const regMatch = cleaned.match(/Regulation\s*[:\-]?\s*(\d{4})/i);
  if (regMatch) regulation = regMatch[1].trim();

  const branchMatch = cleaned.match(
    /Degree\s*&\s*Branch\s+([\s\S]+?)(?:\s+Regulation|\nSemester\s+Subject)/i
  );
  if (branchMatch) {
    degreeBranch = branchMatch[1].replace(/\s+/g, ' ').trim();
  }

  const allRows: ParsedSubjectRow[] = [];
  const unparsedLines: string[] = [];
  const source = options?.source || 'PDF';

  // Join wrapped subject lines if a row starts with "<sem> <code>" but wraps before grade/result
  const mergedLines: string[] = [];
  for (const line of lines) {
    if (IGNORE_PATTERNS.some((p) => p.test(line))) continue;
    if (/^\d{1,2}\s+\d{2}[A-Z]{2}\d{2}[A-Z]{1,2}\b/i.test(line)) {
      mergedLines.push(line);
    } else if (
      mergedLines.length > 0 &&
      !ROW_REGEX.test(mergedLines[mergedLines.length - 1]) &&
      !ROW_NO_CREDIT_REGEX.test(mergedLines[mergedLines.length - 1])
    ) {
      mergedLines[mergedLines.length - 1] = `${mergedLines[mergedLines.length - 1]} ${line}`;
    } else {
      mergedLines.push(line);
    }
  }

  for (const line of mergedLines) {
    const m = line.match(ROW_REGEX);
    if (m) {
      const semesterNumber = Number(m[1]);
      const subjectCode = m[2].toUpperCase();
      const subjectName = m[3].trim();
      const credits = Number(m[4]);
      const grade = m[5].toUpperCase();
      const result = m[6].toUpperCase();
      const gp = GRADE_POINTS[grade] || { points: 0, isArrear: true };
      allRows.push({
        semesterNumber,
        subjectCode,
        subjectName,
        credits,
        grade,
        gradePoint: gp.points,
        result,
        isArrear: gp.isArrear,
        isNonCredit: credits === 0,
        confidence: source === 'OCR' ? 'LOW' : 'HIGH',
      });
      continue;
    }

    const mNoCred = line.match(ROW_NO_CREDIT_REGEX);
    if (mNoCred) {
      const semesterNumber = Number(mNoCred[1]);
      const subjectCode = mNoCred[2].toUpperCase();
      const subjectName = mNoCred[3].trim();
      const grade = mNoCred[4].toUpperCase();
      const result = mNoCred[5].toUpperCase();
      const fallbackCredit = options?.creditLookup?.[subjectCode] ?? 0;
      const gp = GRADE_POINTS[grade] || { points: 0, isArrear: true };
      allRows.push({
        semesterNumber,
        subjectCode,
        subjectName,
        credits: fallbackCredit,
        grade,
        gradePoint: gp.points,
        result,
        isArrear: gp.isArrear,
        isNonCredit: fallbackCredit === 0,
        confidence: 'LOW',
      });
      continue;
    }

    if (/^\d{1,2}\s+\d{2}[A-Z]{2}/.test(line)) {
      unparsedLines.push(line);
    }
  }

  // Group by semester
  const semMap = new Map<number, ParsedSubjectRow[]>();
  for (const row of allRows) {
    const arr = semMap.get(row.semesterNumber) || [];
    arr.push(row);
    semMap.set(row.semesterNumber, arr);
  }

  const semesters: ParsedSemesterGroup[] = Array.from(semMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([semesterNumber, subjects]) => {
      let totalCredits = 0;
      let totalGradePoints = 0;
      let arrearsCount = 0;
      for (const s of subjects) {
        if (!s.isNonCredit) {
          totalCredits += s.credits;
          totalGradePoints += s.credits * s.gradePoint;
        }
        if (s.isArrear) arrearsCount++;
      }
      const gpa = totalCredits > 0 ? round2(totalGradePoints / totalCredits) : 0;
      return {
        semesterNumber,
        subjects,
        totalCredits: round2(totalCredits),
        totalGradePoints: round2(totalGradePoints),
        gpa,
        arrearsCount,
      };
    });

  return {
    sessionLabel,
    studentName,
    registerNo,
    degreeBranch,
    regulation,
    semesters,
    allRows,
    unparsedLines,
    source,
  };
}

export function validateResultIdentity(
  parsed: ParsedResultSheet,
  studentRegisterNo: string,
  studentName?: string
): { valid: boolean; reason?: string } {
  const cleanExpected = (studentRegisterNo || '').trim();
  const cleanFound = (parsed.registerNo || '').trim();

  if (!cleanFound || cleanFound !== cleanExpected) {
    return { valid: false, reason: 'This result sheet belongs to a different student.' };
  }

  if (studentName && parsed.studentName) {
    const expectedTokens = studentName.toUpperCase().split(/\s+/).filter((t) => t.length > 1);
    const foundUpper = parsed.studentName.toUpperCase();
    const hasMatch = expectedTokens.length === 0 || expectedTokens.some((t) => foundUpper.includes(t));
    if (!hasMatch) {
      return { valid: false, reason: 'This result sheet belongs to a different student.' };
    }
  }

  return { valid: true };
}

export async function parseResultFile(
  file: File,
  creditLookup?: Record<string, number>
): Promise<ParsedResultSheet> {
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

  if (isPdf) {
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.mjs',
      import.meta.url
    ).toString();

    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    const pageTexts: string[] = [];

    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      // Rebuild lines by y-position (tolerance 3px), sorted left-to-right by x
      const items = (content.items as any[])
        .filter((it) => typeof it.str === 'string' && it.str.trim().length > 0)
        .map((it) => ({
          str: it.str,
          x: it.transform?.[4] ?? 0,
          y: Math.round((it.transform?.[5] ?? 0) / 3) * 3,
        }));

      const rows = new Map<number, Array<{ str: string; x: number }>>();
      for (const item of items) {
        const list = rows.get(item.y) || [];
        list.push({ str: item.str, x: item.x });
        rows.set(item.y, list);
      }

      const sortedY = Array.from(rows.keys()).sort((a, b) => b - a);
      const lines = sortedY.map((y) =>
        rows
          .get(y)!
          .sort((a, b) => a.x - b.x)
          .map((i) => i.str)
          .join(' ')
      );
      pageTexts.push(lines.join('\n'));
    }

    const fullText = pageTexts.join('\n');
    if (fullText.replace(/\s+/g, '').length >= 60) {
      return parseResultText(fullText, { creditLookup, source: 'PDF' });
    }

    // Scanned PDF fallback: render page 1 to canvas and OCR
    const page1 = await pdf.getPage(1);
    const viewport = page1.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      await page1.render({ canvasContext: ctx, viewport, canvas } as any).promise;
      const Tesseract = await import('tesseract.js');
      const ocr = await Tesseract.recognize(canvas, 'eng');
      return parseResultText(ocr.data.text || '', { creditLookup, source: 'OCR' });
    }
  }

  // Image OCR
  const Tesseract = await import('tesseract.js');
  const ocr = await Tesseract.recognize(file, 'eng');
  return parseResultText(ocr.data.text || '', { creditLookup, source: 'OCR' });
}
