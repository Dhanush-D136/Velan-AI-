import { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import { prisma } from '../lib/prisma';

// Export Classic Monthly Attendance Register
export const exportMonthlyRegister = async (req: Request, res: Response) => {
  try {
    const { classId } = req.query;

    const classData = await prisma.class.findFirst({
      where: classId ? { id: String(classId) } : undefined,
      include: {
        students: { include: { user: true }, orderBy: { rollNo: 'asc' } },
        sessions: {
          include: { records: true, classSubject: { include: { subject: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!classData) {
      return res.status(404).json({ error: 'Class not found' });
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Velan AI College Platform';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Attendance Register', {
      views: [{ state: 'frozen', xSplit: 3, ySplit: 4 }],
    });

    const instSetting = await prisma.setting.findUnique({ where: { key: 'INSTITUTION_NAME' } });
    const instTitle = instSetting?.value?.trim()
      ? `${instSetting.value.trim().toUpperCase()} — OFFICIAL ATTENDANCE REGISTER`
      : 'OFFICIAL ATTENDANCE REGISTER';

    // 1. Header block
    sheet.mergeCells('A1:N1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = instTitle;
    titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4F46E5' }, // Indigo brand
    };

    sheet.mergeCells('A2:N2');
    const subTitleCell = sheet.getCell('A2');
    subTitleCell.value = `Class: ${classData.name} | Total Students: ${classData.students.length} | Generated: ${new Date().toLocaleDateString()}`;
    subTitleCell.font = { name: 'Arial', size: 10, italic: true };
    subTitleCell.alignment = { horizontal: 'center' };

    // 2. Table Column Headers
    const headers = ['S.No', 'Roll No', 'Student Name'];
    const sessionDates: string[] = [];

    // Distinct dates from sessions
    const sessions = classData.sessions.slice(0, 20); // sample of up to 20 periods
    sessions.forEach((sess, i) => {
      const d = new Date(sess.createdAt);
      const label = `${d.getDate()}/${d.getMonth() + 1} P${i + 1}`;
      headers.push(label);
      sessionDates.push(sess.id);
    });

    headers.push('Total Present', 'Total Absent', 'Attendance %');

    const headerRow = sheet.addRow(headers);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FF0F172A' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF1F5F9' },
      };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'medium' },
        right: { style: 'thin' },
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    // Set column widths
    sheet.getColumn(1).width = 8;
    sheet.getColumn(2).width = 14;
    sheet.getColumn(3).width = 24;
    for (let c = 4; c <= headers.length; c++) {
      sheet.getColumn(c).width = 12;
    }

    // 3. Populate Students Rows
    classData.students.forEach((stud, idx) => {
      let presentCount = 0;
      let absentCount = 0;
      const rowData: any[] = [idx + 1, stud.rollNo, stud.user.name];

      sessions.forEach((sess) => {
        const rec = sess.records.find((r) => r.studentId === stud.id);
        if (rec && rec.status === 'PRESENT') {
          rowData.push('P');
          presentCount++;
        } else {
          rowData.push('A');
          absentCount++;
        }
      });

      const totalPeriods = presentCount + absentCount;
      const percent = totalPeriods > 0 ? Math.round((presentCount / totalPeriods) * 100) : 0;

      rowData.push(presentCount, absentCount, `${percent}%`);

      const dataRow = sheet.addRow(rowData);

      // Color code cells
      dataRow.eachCell((cell, colNumber) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };

        if (cell.value === 'P') {
          cell.font = { bold: true, color: { argb: 'FF10B981' } }; // Green
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F4EA' } };
          cell.alignment = { horizontal: 'center' };
        } else if (cell.value === 'A') {
          cell.font = { bold: true, color: { argb: 'FFEF4444' } }; // Red
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE8E6' } };
          cell.alignment = { horizontal: 'center' };
        }
      });
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    const safeClassName = classData.name.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="Velan_Attendance_Register_${safeClassName}.xlsx"`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error: any) {
    console.error('exportMonthlyRegister error:', error);
    return res.status(500).json({ error: 'Failed to export attendance register' });
  }
};

// Export Single Session Attendance Roster (Particular Class + Period + Day)
export const exportSessionExcel = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const session = await prisma.attendanceSession.findUnique({
      where: { id: sessionId },
      include: {
        class: { include: { students: { include: { user: true }, orderBy: { rollNo: 'asc' } } } },
        classSubject: { include: { subject: true } },
        faculty: { include: { user: true } },
        records: true,
      },
    });

    if (!session) {
      return res.status(404).json({ error: 'Attendance session not found' });
    }

    const instSetting = await prisma.setting.findUnique({ where: { key: 'INSTITUTION_NAME' } });
    const instTitle = instSetting?.value?.trim()
      ? `${instSetting.value.trim().toUpperCase()} — SESSION ATTENDANCE REPORT`
      : 'SESSION ATTENDANCE REPORT';

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Velan AI';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Session Attendance', {
      views: [{ state: 'frozen', ySplit: 4 }],
    });

    sheet.mergeCells('A1:H1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = instTitle;
    titleCell.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };

    sheet.mergeCells('A2:H2');
    const subCell = sheet.getCell('A2');
    const sessionDate = new Date(session.createdAt).toLocaleString();
    subCell.value = `Class: ${session.class.name} | Subject: ${session.classSubject.subject.code} - ${session.classSubject.subject.name} | Faculty: ${session.faculty.user.name} | Date: ${sessionDate}`;
    subCell.font = { name: 'Arial', size: 10, italic: true };
    subCell.alignment = { horizontal: 'center' };

    sheet.addRow([]);

    const headerRow = sheet.addRow([
      'S.No',
      'Roll No',
      'Register No',
      'Student Name',
      'Status',
      'Method',
      'Distance (m)',
      'Marked / Updated At',
    ]);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FF0F172A' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'medium' },
        right: { style: 'thin' },
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    const widths = [8, 15, 20, 28, 14, 12, 14, 24];
    widths.forEach((w, idx) => (sheet.getColumn(idx + 1).width = w));

    const recMap = new Map(session.records.map((r) => [r.studentId, r]));
    let presentCount = 0;

    session.class.students.forEach((stud, idx) => {
      const rec = recMap.get(stud.id);
      const status = rec?.status || 'ABSENT';
      if (status === 'PRESENT' || status === 'LATE') presentCount++;

      const row = sheet.addRow([
        idx + 1,
        stud.rollNo,
        stud.registerNo,
        stud.user.name,
        status,
        rec?.method || 'NONE',
        rec?.distanceMeters != null ? Math.round(rec.distanceMeters) : '-',
        rec?.markedAt ? new Date(rec.markedAt).toLocaleString() : '-',
      ]);

      const statusCell = row.getCell(5);
      if (status === 'PRESENT' || status === 'LATE') {
        statusCell.font = { bold: true, color: { argb: 'FF10B981' } };
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F4EA' } };
      } else {
        statusCell.font = { bold: true, color: { argb: 'FFEF4444' } };
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE8E6' } };
      }
      statusCell.alignment = { horizontal: 'center' };
    });

    sheet.addRow([]);
    const totalStudents = session.class.students.length;
    const summaryRow = sheet.addRow([
      'Summary',
      `Total: ${totalStudents}`,
      `Present: ${presentCount}`,
      `Absent: ${totalStudents - presentCount}`,
      totalStudents > 0 ? `${Math.round((presentCount / totalStudents) * 100)}%` : '0%',
    ]);
    summaryRow.font = { bold: true };

    const safeClass = session.class.name.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
    const safeSubj = session.classSubject.subject.code.replace(/[^a-zA-Z0-9_-]+/g, '_');
    const dateStr = new Date(session.createdAt).toISOString().split('T')[0];

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${safeClass}_${safeSubj}_${dateStr}.xlsx"`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error: any) {
    console.error('exportSessionExcel error:', error);
    return res.status(500).json({ error: 'Failed to export session attendance' });
  }
};
