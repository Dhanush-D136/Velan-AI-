import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import {
  FileSpreadsheet,
  Download,
  CheckCircle2,
  Printer,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const ReportsPage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadClasses = async () => {
      try {
        const res = await api.get('/api/academics/classes');
        const list = res.data.classes || res.data.data || [];
        setClasses(list);
        if (list.length > 0) {
          setSelectedClassId(list[0].id);
        }
      } catch {
        // handled
      } finally {
        setIsLoading(false);
      }
    };
    loadClasses();
  }, []);

  const handleDownload = async () => {
    if (!selectedClassId) {
      showToast('Please select a class first.', 'error');
      return;
    }

    setIsExporting(true);
    try {
      const res = await api.get('/api/export/monthly-register', {
        params: { classId: selectedClassId },
        responseType: 'blob',
      });
      const cls = classes.find((c) => c.id === selectedClassId);
      const safeName = (cls?.name || 'Class').replace(/[^a-zA-Z0-9_-]+/g, '_');
      const dateStr = new Date().toISOString().split('T')[0];

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${safeName}_Attendance_${dateStr}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showToast('Excel report downloaded successfully!', 'success');
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to generate Excel report', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  if (!isLoading && classes.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-content tracking-tight">
          ExcelJS Reports & Analytics Engine
        </h1>
        <EmptyState
          icon={FileSpreadsheet}
          title="No classes available to export"
          description="Create at least one class and record attendance sessions to generate Excel attendance registers."
          actionLabel="Setup Classes"
          onAction={() => navigate('/admin/academics')}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-content tracking-tight">
            ExcelJS Reports & Analytics Engine
          </h1>
          <p className="text-xs sm:text-sm text-content-secondary mt-1">
            Official collegiate attendance registers generated live from PostgreSQL.
          </p>
        </div>
      </div>

      <Card className="p-8">
        <h3 className="font-heading font-bold text-lg text-content mb-4 flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
          Export Formatted Excel Sheets (.xlsx)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-semibold text-content-secondary uppercase mb-1.5">
              Select Class / Section
            </label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full p-3 rounded-2xl border border-border bg-white text-sm font-semibold outline-none focus:border-brand-500"
            >
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name} ({cls._count?.students || 0} students)
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <div className="p-3 rounded-2xl bg-surface-soft border border-border w-full flex flex-wrap gap-3 text-xs font-medium text-content-secondary">
              <span className="flex items-center gap-1.5 text-accent-emerald">
                <CheckCircle2 className="w-4 h-4" /> Real Database Records
              </span>
              <span className="flex items-center gap-1.5 text-accent-emerald">
                <CheckCircle2 className="w-4 h-4" /> P/A Color-Coded Cells
              </span>
              <span className="flex items-center gap-1.5 text-accent-emerald">
                <CheckCircle2 className="w-4 h-4" /> Frozen Headers
              </span>
            </div>
          </div>
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
            leftIcon={<Download className="w-4 h-4" />}
            onClick={handleDownload}
          >
            Generate & Download Excel (.xlsx)
          </Button>
        </div>
      </Card>
    </div>
  );
};
