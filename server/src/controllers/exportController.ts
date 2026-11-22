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

    // 1. Header block
    sheet.mergeCells('A1:N1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'VELAN ENGINEERING COLLEGE — OFFICIAL ATTENDANCE REGISTER';
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
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="Velan_Attendance_Register_${classData.name.replace(/\s+/g, '_')}.xlsx"`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error: any) {
    console.error('exportMonthlyRegister error:', error);
    return res.status(500).json({ error: 'Failed to export attendance register' });
  }
};
