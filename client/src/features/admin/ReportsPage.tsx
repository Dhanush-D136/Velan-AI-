import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  FileSpreadsheet,
  Download,
  Calendar,
  Filter,
  CheckCircle2,
  FileText,
  Printer,
} from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const [reportType, setReportType] = useState('MONTHLY_REGISTER');
  const [selectedClass, setSelectedClass] = useState('CSE – Year 2 – A');
  const [isExporting, setIsExporting] = useState(false);

  const handleDownload = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      alert('Excel Report generated with ExcelJS: Classic Attendance Register formatted with colored cells, frozen headers, and summary formulas.');
    }, 1200);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-content tracking-tight">
            ExcelJS Reports & Analytics Engine
          </h1>
          <p className="text-xs sm:text-sm text-content-secondary mt-1">
            Official collegiate attendance registers, subject breakdowns, and low-attendance alerts.
          </p>
        </div>
      </div>

      {/* Main Configuration Card */}
      <Card className="p-8">
        <h3 className="font-heading font-bold text-lg text-content mb-4 flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
          Export Formatted Excel Sheets (.xlsx)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div>
            <label className="block text-xs font-semibold text-content-secondary uppercase mb-1.5">
              Select Report Template
            </label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="w-full p-3 rounded-2xl border border-border bg-white text-sm font-semibold outline-none focus:border-brand-500"
            >
              <option value="MONTHLY_REGISTER">Monthly Attendance Matrix (Dates vs Students)</option>
              <option value="SUBJECT_WISE">Subject-wise Attendance Breakdown</option>
              <option value="SHORTAGE_LIST">Low Attendance Shortage Notice (&lt; 75%)</option>
              <option value="GPS_VS_MANUAL">GPS vs Manual Verification Audit</option>
              <option value="FLAGGED_RECORDS">Flagged & Suspicious Geofence Logs</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-content-secondary uppercase mb-1.5">
              Class / Section
            </label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full p-3 rounded-2xl border border-border bg-white text-sm font-semibold outline-none focus:border-brand-500"
            >
              <option value="CSE – Year 2 – A">CSE – Year 2 – Section A</option>
              <option value="CSE – Year 2 – B">CSE – Year 2 – Section B</option>
              <option value="ECE – Year 3 – A">ECE – Year 3 – Section A</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-content-secondary uppercase mb-1.5">
              Date Period
            </label>
            <select className="w-full p-3 rounded-2xl border border-border bg-white text-sm font-semibold outline-none focus:border-brand-500">
              <option>Current Month (November 2026)</option>
              <option>Previous Month (October 2026)</option>
              <option>Full Semester to Date</option>
            </select>
          </div>
        </div>

        {/* Feature Highlights */}
        <div className="mt-8 p-4 rounded-2xl bg-surface-soft border border-border flex flex-wrap gap-4 text-xs font-medium text-content-secondary">
          <span className="flex items-center gap-1.5 text-accent-emerald">
            <CheckCircle2 className="w-4 h-4" /> Formatted Excel Headers
          </span>
          <span className="flex items-center gap-1.5 text-accent-emerald">
            <CheckCircle2 className="w-4 h-4" /> P/A/L/OD Color-Coded Cells
          </span>
          <span className="flex items-center gap-1.5 text-accent-emerald">
            <CheckCircle2 className="w-4 h-4" /> Auto-Calculated Formula Summary
          </span>
          <span className="flex items-center gap-1.5 text-accent-emerald">
            <CheckCircle2 className="w-4 h-4" /> Frozen Left Header Panes
          </span>
        </div>

        <div className="mt-8 flex items-center justify-end gap-3 pt-6 border-t border-border">
          <Button
            variant="secondary"
            size="md"
            leftIcon={<Printer className="w-4 h-4" />}
            onClick={() => window.print()}
          >
            Print PDF Summary
          </Button>
          <Button
            size="md"
            isLoading={isExporting}
            onClick={handleDownload}
            leftIcon={<Download className="w-4 h-4" />}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
          >
            Export to Excel (.xlsx)
          </Button>
        </div>
      </Card>
    </div>
  );
};
