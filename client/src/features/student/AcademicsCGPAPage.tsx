import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { DatabaseLoader } from '@/components/ui/DatabaseLoader';
import { useAuthStore } from '@/stores/authStore';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import { useRealtimeSync } from '@/lib/socket';
import {
  parseResultFile,
  validateResultIdentity,
  ParsedResultSheet,
  ParsedSubjectRow,
} from '@/utils/resultParser';
import {
  saveResultFileToVault,
  listResultFilesFromVault,
  deleteResultFileFromVault,
  triggerBlobDownload,
  StoredResultFile,
} from '@/utils/localResultVault';
import {
  GraduationCap,
  Upload,
  Plus,
  Trash2,
  Calculator,
  FileCheck2,
  AlertTriangle,
  Download,
  Eye,
  HardDrive,
  TrendingUp,
} from 'lucide-react';

const GRADES = ['O', 'A+', 'A', 'B+', 'B', 'C', 'RA', 'WH', 'WD', 'AB'];
const GRADE_POINT_MAP: Record<string, number> = {
  O: 10,
  'A+': 9,
  A: 8,
  'B+': 7,
  B: 6,
  C: 5,
  RA: 0,
  WH: 0,
  WD: 0,
  AB: 0,
};

function calcDraftGPA(rows: Array<{ credits: number; grade: string }>) {
  let credits = 0;
  let points = 0;
  for (const r of rows) {
    const c = Number(r.credits) || 0;
    if (c <= 0) continue;
    credits += c;
    points += c * (GRADE_POINT_MAP[r.grade] ?? 0);
  }
  const gpa = credits > 0 ? Math.round((points / credits + Number.EPSILON) * 100) / 100 : 0;
  return { credits, points, gpa };
}

export const AcademicsCGPAPage: React.FC = () => {
  const { user } = useAuthStore();
  const { showToast } = useToast();

  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mode, setMode] = useState<'OVERVIEW' | 'UPLOAD' | 'MANUAL'>('OVERVIEW');

  // Upload & review state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parsedSheet, setParsedSheet] = useState<ParsedResultSheet | null>(null);
  const [reviewRows, setReviewRows] = useState<ParsedSubjectRow[]>([]);
  const [identityError, setIdentityError] = useState<string | null>(null);
  const [consentChecked, setConsentChecked] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Manual SRM-style grid state
  const [manualSemester, setManualSemester] = useState(1);
  const [calculatorOnly, setCalculatorOnly] = useState(false);
  const [manualRows, setManualRows] = useState<
    Array<{ subjectCode: string; subjectName: string; credits: number; grade: string }>
  >([
    { subjectCode: 'CS101', subjectName: 'Course 1', credits: 3, grade: 'O' },
    { subjectCode: 'CS102', subjectName: 'Course 2', credits: 4, grade: 'A+' },
  ]);

  // Target CGPA planner
  const [nextSemCredits, setNextSemCredits] = useState(22);
  const [targetCGPAInput, setTargetCGPAInput] = useState(8.5);
  const [expectedNextGPA, setExpectedNextGPA] = useState(9.0);

  // IndexedDB Vault
  const [vaultFiles, setVaultFiles] = useState<StoredResultFile[]>([]);

  const fetchAcademics = useCallback(async () => {
    try {
      const res = await api.get('/api/academics-records/my');
      setData(res.data);
      if (res.data?.hasSavedBefore) setConsentChecked(true);
      if (res.data?.student?.id) {
        const files = await listResultFilesFromVault(res.data.student.id);
        setVaultFiles(files);
      }
    } catch {
      // handled
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAcademics();
  }, [fetchAcademics]);

  useRealtimeSync(['data:updated'], fetchAcademics, { userId: user?.id });

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setIdentityError(null);
    setParsedSheet(null);
    setIsParsing(true);

    try {
      const lookupMap: Record<string, number> = {};
      for (const l of data?.creditLookups || []) {
        lookupMap[l.subjectCode] = l.credits;
      }
      const parsed = await parseResultFile(file, lookupMap);
      setParsedSheet(parsed);
      setReviewRows(parsed.allRows);

      const idCheck = validateResultIdentity(
        parsed,
        data?.student?.registerNo || user?.studentProfile?.registerNo || '',
        data?.student?.name || user?.name
      );
      if (!idCheck.valid) {
        setIdentityError(idCheck.reason || 'This result sheet belongs to a different student.');
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to parse result sheet', 'error');
    } finally {
      setIsParsing(false);
    }
  };

  const handleSaveParsed = async () => {
    if (identityError) {
      return showToast(identityError, 'error');
    }
    if (!data?.hasSavedBefore && !consentChecked) {
      return showToast('Please tick the consent notice before saving.', 'error');
    }
    if (reviewRows.length === 0) {
      return showToast('No subjects found to save.', 'error');
    }

    setIsSaving(true);
    try {
      const bySem = new Map<number, ParsedSubjectRow[]>();
      for (const r of reviewRows) {
        const arr = bySem.get(r.semesterNumber) || [];
        arr.push(r);
        bySem.set(r.semesterNumber, arr);
      }

      for (const [semNum, subs] of bySem.entries()) {
        await api.post('/api/academics-records/my/semester', {
          semesterNumber: semNum,
          regulation: parsedSheet?.regulation || '2021',
          sessionLabel: parsedSheet?.sessionLabel || undefined,
          source: parsedSheet?.source || 'PDF',
          consentGiven: true,
          subjects: subs.map((s) => ({
            subjectCode: s.subjectCode,
            subjectName: s.subjectName,
            credits: Number(s.credits) || 0,
            grade: s.grade,
            result: s.result || (['RA', 'WH', 'WD', 'AB'].includes(s.grade) ? 'RA' : 'PASS'),
          })),
        });

        if (selectedFile && data?.student?.id) {
          await saveResultFileToVault({
            id: `${data.student.id}_sem_${semNum}_${Date.now()}`,
            studentId: data.student.id,
            semesterNumber: semNum,
            fileName: selectedFile.name,
            mimeType: selectedFile.type || 'application/pdf',
            size: selectedFile.size,
            blob: selectedFile,
            savedAt: new Date().toISOString(),
          });
        }
      }

      showToast('Result sheet confirmed and saved!', 'success');
      setMode('OVERVIEW');
      setParsedSheet(null);
      setSelectedFile(null);
      fetchAcademics();
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Failed to save results', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveManual = async () => {
    if (calculatorOnly) return;
    if (!data?.hasSavedBefore && !consentChecked) {
      return showToast('Please tick the consent notice before saving.', 'error');
    }
    setIsSaving(true);
    try {
      await api.post('/api/academics-records/my/semester', {
        semesterNumber: manualSemester,
        regulation: data?.regulation || '2021',
        source: 'MANUAL',
        consentGiven: true,
        subjects: manualRows.map((r, i) => ({
          subjectCode: r.subjectCode.trim().toUpperCase() || `SUB${manualSemester}0${i + 1}`,
          subjectName: r.subjectName.trim() || `Course ${i + 1}`,
          credits: Number(r.credits) || 0,
          grade: r.grade,
          result: ['RA', 'WH', 'WD', 'AB'].includes(r.grade) ? 'RA' : 'PASS',
        })),
      });
      showToast(`Semester ${manualSemester} saved!`, 'success');
      setMode('OVERVIEW');
      fetchAcademics();
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Failed to save manual semester', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSemester = async (semId: string, semNum: number) => {
    if (!window.confirm(`Delete Semester ${semNum} records?`)) return;
    try {
      await api.delete(`/api/academics-records/my/semester/${semId}`);
      showToast(`Semester ${semNum} deleted`, 'success');
      fetchAcademics();
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Failed to delete semester', 'error');
    }
  };

  if (isLoading) {
    return <DatabaseLoader message="Loading Academics & CGPA..." subtext="Fetching your semesters, grades, and regulation scale" />;
  }

  const semesters = data?.semesters || [];
  const manualStats = calcDraftGPA(manualRows);
  const reviewStats = calcDraftGPA(reviewRows);

  // Target CGPA calculations
  const currCredits = data?.totalCredits || 0;
  const currPoints = data?.totalGradePoints || 0;
  const combinedCredits = currCredits + (Number(nextSemCredits) || 0);
  const requiredNextGPA =
    nextSemCredits > 0
      ? Math.round(((targetCGPAInput * combinedCredits - currPoints) / nextSemCredits + Number.EPSILON) * 100) / 100
      : 0;
  const projectedCGPA =
    combinedCredits > 0
      ? Math.round(((currPoints + expectedNextGPA * nextSemCredits) / combinedCredits + Number.EPSILON) * 100) / 100
      : 0;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-content tracking-tight">
            Academics &amp; CGPA
          </h1>
          <p className="text-xs sm:text-sm text-content-secondary mt-1">
            Anna University Regulation {data?.regulation || '2021'} • Scale: O=10, A+=9, A=8, B+=7, B=6, C=5, RA/WH/WD/AB=0
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant={mode === 'OVERVIEW' ? 'primary' : 'secondary'} size="sm" onClick={() => setMode('OVERVIEW')}>
            Overview
          </Button>
          <Button variant={mode === 'UPLOAD' ? 'primary' : 'secondary'} size="sm" leftIcon={<Upload className="w-4 h-4" />} onClick={() => setMode('UPLOAD')}>
            Upload Result Sheet
          </Button>
          <Button variant={mode === 'MANUAL' ? 'primary' : 'secondary'} size="sm" leftIcon={<Calculator className="w-4 h-4" />} onClick={() => setMode('MANUAL')}>
            Manual / Calculator
          </Button>
        </div>
      </div>

      {/* Top Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-xs text-content-muted">Current CGPA</div>
          <div className="text-2xl font-heading font-extrabold text-brand-600 mt-1">
            {(data?.cgpa ?? 0).toFixed(2)}
          </div>
          <div className="text-[11px] text-content-secondary">
            ~{(data?.percentageEquivalent ?? 0).toFixed(1)}%
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-content-muted">Credits Earned</div>
          <div className="text-2xl font-heading font-extrabold text-content mt-1">
            {data?.totalCreditsEarned ?? 0}
          </div>
          <div className="text-[11px] text-content-secondary">of {data?.totalCredits ?? 0} attempted</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-content-muted">Active Arrears</div>
          <div className={`text-2xl font-heading font-extrabold mt-1 ${(data?.arrearsCount ?? 0) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
            {data?.arrearsCount ?? 0}
          </div>
          <div className="text-[11px] text-content-secondary">RA / WH / WD / AB</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-content-muted">Semesters Saved</div>
          <div className="text-2xl font-heading font-extrabold text-content mt-1">{semesters.length}</div>
          <div className="text-[11px] text-content-secondary">
            {data?.lastUpdated ? `Updated ${new Date(data.lastUpdated).toLocaleDateString()}` : 'Not saved yet'}
          </div>
        </Card>
      </div>

      {/* MODE: UPLOAD RESULT SHEET */}
      {mode === 'UPLOAD' && (
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-heading font-bold text-base text-content">Upload Result Sheet (PDF or Image)</h3>
              <p className="text-xs text-content-secondary">
                Parsed privately in your browser. Student photos are ignored and never stored.
              </p>
            </div>
            <Badge variant="brand" size="sm">Reg. {data?.student?.registerNo}</Badge>
          </div>

          <input
            type="file"
            accept=".pdf,image/*"
            onChange={handleFilePick}
            className="block w-full text-xs text-content-secondary file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
          />

          {isParsing && (
            <div className="p-4 rounded-2xl bg-slate-50 border border-border text-xs font-semibold text-content">
              Extracting courses, credits, and grades in your browser...
            </div>
          )}

          {identityError && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center gap-2 font-bold">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{identityError}</span>
            </div>
          )}

          {parsedSheet && (
            <div className="space-y-4">
              <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-xs flex flex-wrap items-center justify-between gap-2">
                <span>
                  <strong>Checksum:</strong> {reviewRows.length} subjects found,{' '}
                  <strong>{reviewStats.credits}</strong> credits,{' '}
                  <strong>{reviewStats.points}</strong> grade points,{' '}
                  <strong>GPA {reviewStats.gpa.toFixed(2)}</strong>
                </span>
                {parsedSheet.sessionLabel && <Badge variant="neutral" size="sm">{parsedSheet.sessionLabel}</Badge>}
              </div>

              <div className="overflow-x-auto border border-border rounded-2xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-surface-soft text-content-secondary uppercase text-[10px]">
                    <tr>
                      <th className="p-2.5">Sem</th>
                      <th className="p-2.5">Code</th>
                      <th className="p-2.5">Subject Name</th>
                      <th className="p-2.5">Credits</th>
                      <th className="p-2.5">Grade</th>
                      <th className="p-2.5">Confidence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {reviewRows.map((row, idx) => (
                      <tr key={idx} className={row.confidence === 'LOW' ? 'bg-amber-50/50' : ''}>
                        <td className="p-2">
                          <input
                            type="number"
                            min={1}
                            max={12}
                            value={row.semesterNumber}
                            onChange={(e) => {
                              const next = [...reviewRows];
                              next[idx].semesterNumber = Number(e.target.value);
                              setReviewRows(next);
                            }}
                            className="w-12 px-2 py-1 rounded-lg border border-border"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={row.subjectCode}
                            onChange={(e) => {
                              const next = [...reviewRows];
                              next[idx].subjectCode = e.target.value.toUpperCase();
                              setReviewRows(next);
                            }}
                            className="w-24 px-2 py-1 rounded-lg border border-border font-mono"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={row.subjectName}
                            onChange={(e) => {
                              const next = [...reviewRows];
                              next[idx].subjectName = e.target.value;
                              setReviewRows(next);
                            }}
                            className="w-full min-w-[180px] px-2 py-1 rounded-lg border border-border"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            step="0.5"
                            min={0}
                            max={12}
                            value={row.credits}
                            onChange={(e) => {
                              const next = [...reviewRows];
                              next[idx].credits = Number(e.target.value);
                              setReviewRows(next);
                            }}
                            className="w-16 px-2 py-1 rounded-lg border border-border"
                          />
                        </td>
                        <td className="p-2">
                          <select
                            value={row.grade}
                            onChange={(e) => {
                              const next = [...reviewRows];
                              next[idx].grade = e.target.value;
                              setReviewRows(next);
                            }}
                            className="px-2 py-1 rounded-lg border border-border bg-white"
                          >
                            {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
                          </select>
                        </td>
                        <td className="p-2">
                          <Badge variant={row.confidence === 'HIGH' ? 'success' : 'warning'} size="sm">
                            {row.confidence}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {!data?.hasSavedBefore && (
                <label className="flex items-center gap-2 text-xs text-content bg-slate-50 p-3 rounded-xl border border-border cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consentChecked}
                    onChange={(e) => setConsentChecked(e.target.checked)}
                  />
                  <span>Your confirmed results will be visible to your class advisor and the admin.</span>
                </label>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="secondary" size="sm" onClick={() => setParsedSheet(null)}>Clear</Button>
                <Button
                  size="sm"
                  onClick={handleSaveParsed}
                  isLoading={isSaving}
                  disabled={!!identityError || reviewRows.length === 0}
                  leftIcon={<FileCheck2 className="w-4 h-4" />}
                >
                  Confirm &amp; Save Results
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* MODE: MANUAL SRM-STYLE GRID + CALCULATOR ONLY */}
      {mode === 'MANUAL' && (
        <Card className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
            <div>
              <div className="text-xs text-content-muted uppercase font-bold">Grade Point Average</div>
              <div className="text-3xl font-heading font-extrabold text-brand-600">
                {manualStats.gpa.toFixed(2)}
                <span className="text-xs font-normal text-content-secondary ml-2">
                  ({manualStats.credits} credits • {manualStats.points} points)
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={manualSemester}
                onChange={(e) => setManualSemester(Number(e.target.value))}
                className="px-3 py-2 rounded-xl border border-border text-xs font-bold bg-white"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <option key={n} value={n}>Semester {n}</option>
                ))}
              </select>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-content cursor-pointer">
                <input
                  type="checkbox"
                  checked={calculatorOnly}
                  onChange={(e) => setCalculatorOnly(e.target.checked)}
                />
                Calculator only (do not save)
              </label>
            </div>
          </div>

          <div className="space-y-2">
            {manualRows.map((row, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-2 sm:col-span-1 text-xs font-bold text-content-muted text-center">
                  #{idx + 1}
                </div>
                <input
                  type="text"
                  placeholder="Code"
                  value={row.subjectCode}
                  onChange={(e) => {
                    const next = [...manualRows];
                    next[idx].subjectCode = e.target.value.toUpperCase();
                    setManualRows(next);
                  }}
                  className="col-span-4 sm:col-span-2 px-2.5 py-2 rounded-xl border border-border text-xs font-mono"
                />
                <input
                  type="text"
                  placeholder="Course Name"
                  value={row.subjectName}
                  onChange={(e) => {
                    const next = [...manualRows];
                    next[idx].subjectName = e.target.value;
                    setManualRows(next);
                  }}
                  className="col-span-6 sm:col-span-4 px-2.5 py-2 rounded-xl border border-border text-xs"
                />
                <input
                  type="number"
                  step="0.5"
                  min={0}
                  max={12}
                  placeholder="Credits"
                  value={row.credits}
                  onChange={(e) => {
                    const next = [...manualRows];
                    next[idx].credits = Number(e.target.value);
                    setManualRows(next);
                  }}
                  className="col-span-5 sm:col-span-2 px-2.5 py-2 rounded-xl border border-border text-xs"
                />
                <select
                  value={row.grade}
                  onChange={(e) => {
                    const next = [...manualRows];
                    next[idx].grade = e.target.value;
                    setManualRows(next);
                  }}
                  className="col-span-5 sm:col-span-2 px-2.5 py-2 rounded-xl border border-border text-xs bg-white font-semibold"
                >
                  {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
                <button
                  type="button"
                  onClick={() => setManualRows((prev) => prev.filter((_, i) => i !== idx))}
                  className="col-span-2 sm:col-span-1 p-2 text-rose-500 hover:bg-rose-50 rounded-xl flex justify-center"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {!calculatorOnly && !data?.hasSavedBefore && (
            <label className="flex items-center gap-2 text-xs text-content bg-slate-50 p-3 rounded-xl border border-border cursor-pointer">
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
              />
              <span>Your confirmed results will be visible to your class advisor and the admin.</span>
            </label>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() =>
                setManualRows((prev) => [
                  ...prev,
                  { subjectCode: `CS${manualSemester}0${prev.length + 1}`, subjectName: `Course ${prev.length + 1}`, credits: 3, grade: 'A+' },
                ])
              }
            >
              Add course
            </Button>
            {!calculatorOnly && (
              <Button size="sm" onClick={handleSaveManual} isLoading={isSaving}>
                Save Semester {manualSemester}
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* OVERVIEW: GPA TREND, TARGET CGPA PLANNER, SAVED SEMESTERS, VAULT */}
      {mode === 'OVERVIEW' && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* GPA Trend Chart */}
            <Card className="space-y-4">
              <h3 className="font-heading font-bold text-base text-content flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-brand-600" />
                Semester GPA Trend
              </h3>
              {semesters.length === 0 ? (
                <div className="py-8 text-center text-xs text-content-secondary">
                  Add your first semester to see your GPA trend.
                </div>
              ) : (
                <div className="flex items-end gap-3 h-40 pt-4 px-2">
                  {semesters.map((sem: any) => (
                    <div key={sem.id} className="flex-1 flex flex-col items-center gap-1.5">
                      <span className="text-[11px] font-bold text-brand-700">{sem.gpa.toFixed(2)}</span>
                      <div className="w-full bg-slate-100 rounded-t-xl h-28 flex items-end overflow-hidden">
                        <div
                          className="w-full bg-brand-gradient rounded-t-xl transition-all"
                          style={{ height: `${Math.min(100, (sem.gpa / 10) * 100)}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-semibold text-content-secondary">Sem {sem.semesterNumber}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Target CGPA Planner */}
            <Card className="space-y-4">
              <h3 className="font-heading font-bold text-base text-content flex items-center gap-2">
                <Calculator className="w-4 h-4 text-brand-600" />
                Target CGPA Planner
              </h3>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <label className="block">
                  <span className="text-content-muted block mb-1">Next Sem Credits</span>
                  <input
                    type="number"
                    min={1}
                    max={40}
                    value={nextSemCredits}
                    onChange={(e) => setNextSemCredits(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-border"
                  />
                </label>
                <label className="block">
                  <span className="text-content-muted block mb-1">Target CGPA</span>
                  <input
                    type="number"
                    step="0.05"
                    min={1}
                    max={10}
                    value={targetCGPAInput}
                    onChange={(e) => setTargetCGPAInput(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-border"
                  />
                </label>
                <label className="block">
                  <span className="text-content-muted block mb-1">Expected GPA</span>
                  <input
                    type="number"
                    step="0.05"
                    min={1}
                    max={10}
                    value={expectedNextGPA}
                    onChange={(e) => setExpectedNextGPA(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-border"
                  />
                </label>
              </div>
              <div className="space-y-2 text-xs">
                <div className="p-3 rounded-xl bg-surface-soft border border-border flex justify-between">
                  <span>GPA needed next semester for {targetCGPAInput.toFixed(2)} CGPA:</span>
                  <strong className={requiredNextGPA > 10 ? 'text-rose-600' : 'text-brand-700'}>
                    {requiredNextGPA > 10 ? `${requiredNextGPA.toFixed(2)} (> 10.0)` : requiredNextGPA.toFixed(2)}
                  </strong>
                </div>
                <div className="p-3 rounded-xl bg-surface-soft border border-border flex justify-between">
                  <span>Projected CGPA if you score {expectedNextGPA.toFixed(2)} next sem:</span>
                  <strong className="text-emerald-700">{projectedCGPA.toFixed(2)}</strong>
                </div>
              </div>
            </Card>
          </div>

          {/* Saved Semesters */}
          {semesters.length === 0 ? (
            <EmptyState
              icon={GraduationCap}
              title="No academic results saved yet"
              description="Upload your Regulation 2021 result PDF/image or enter grades manually."
            />
          ) : (
            <div className="space-y-4">
              {semesters.map((sem: any) => (
                <Card key={sem.id} className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-heading font-bold text-base text-content">
                        Semester {sem.semesterNumber}
                      </h3>
                      <Badge variant="brand" size="sm">GPA: {sem.gpa.toFixed(2)}</Badge>
                      <Badge variant="neutral" size="sm">{sem.totalCredits} Credits</Badge>
                      {sem.editedByAdmin && <Badge variant="warning" size="sm">Edited by Admin</Badge>}
                    </div>
                    <button
                      onClick={() => handleDeleteSemester(sem.id, sem.semesterNumber)}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-xl"
                      title="Delete Semester"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="text-[10px] uppercase text-content-muted border-b border-border">
                        <tr>
                          <th className="py-2 pr-3">Code</th>
                          <th className="py-2 pr-3">Subject</th>
                          <th className="py-2 pr-3">Credits</th>
                          <th className="py-2 pr-3">Grade</th>
                          <th className="py-2">Result</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {sem.subjects.map((sub: any) => (
                          <tr key={sub.id}>
                            <td className="py-2 pr-3 font-mono font-semibold">{sub.subjectCode}</td>
                            <td className="py-2 pr-3">
                              {sub.subjectName}
                              {sub.isNonCredit && <span className="ml-2 text-[10px] text-content-muted">(Non-Credit)</span>}
                            </td>
                            <td className="py-2 pr-3">{sub.credits.toFixed(1)}</td>
                            <td className="py-2 pr-3 font-bold">{sub.grade}</td>
                            <td className="py-2">
                              <Badge variant={sub.isArrear ? 'danger' : 'success'} size="sm">
                                {sub.result}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Local IndexedDB Result Vault */}
          <Card className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-bold text-base text-content flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-brand-600" />
                Local Result Files (Stored on This Device Only)
              </h3>
              <Badge variant="neutral" size="sm">{vaultFiles.length} File(s)</Badge>
            </div>
            <p className="text-[11px] text-content-secondary">
              Original PDF/image files are saved privately in your browser (IndexedDB) and are never uploaded to the server. Clearing browser data will remove them — use Download Backup to keep a copy.
            </p>
            {vaultFiles.length > 0 && (
              <div className="space-y-2">
                {vaultFiles.map((f) => (
                  <div key={f.id} className="p-3 rounded-2xl bg-surface-soft border border-border flex items-center justify-between gap-2 text-xs">
                    <div>
                      <div className="font-bold text-content">{f.fileName}</div>
                      <div className="text-[11px] text-content-muted">
                        Semester {f.semesterNumber} • {(f.size / 1024).toFixed(1)} KB
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const url = URL.createObjectURL(f.blob);
                          window.open(url, '_blank', 'noopener,noreferrer');
                        }}
                        leftIcon={<Eye className="w-3.5 h-3.5" />}
                      >
                        View
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => triggerBlobDownload(f.blob, f.fileName)}
                        leftIcon={<Download className="w-3.5 h-3.5" />}
                      >
                        Download Backup
                      </Button>
                      <button
                        onClick={async () => {
                          await deleteResultFileFromVault(f.id);
                          setVaultFiles((prev) => prev.filter((x) => x.id !== f.id));
                          showToast('Local file deleted', 'success');
                        }}
                        className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
};
