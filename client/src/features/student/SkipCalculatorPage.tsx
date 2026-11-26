import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Switch } from '@/components/ui/Switch';
import { EmptyState } from '@/components/ui/EmptyState';
import { DatabaseLoader } from '@/components/ui/DatabaseLoader';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';
import { useRealtimeSync } from '@/lib/socket';
import { Calculator, CalendarDays, AlertTriangle, TrendingUp, Sliders } from 'lucide-react';

function getStatusBadge(status: string) {
  switch (status) {
    case 'SAFE':
      return { variant: 'success' as const, label: 'Safe' };
    case 'BORDERLINE':
      return { variant: 'warning' as const, label: 'Borderline' };
    case 'CONDONATION':
      return { variant: 'warning' as const, label: 'Condonation Zone' };
    case 'DANGER':
      return { variant: 'danger' as const, label: 'Danger' };
    default:
      return { variant: 'neutral' as const, label: 'No Sessions Yet' };
  }
}

function simulateSubject(present: number, total: number, skipN: number, nextM: number, requiredPercent: number) {
  const attend = Math.max(0, nextM - skipN);
  const newPresent = present + attend;
  const newTotal = total + nextM;
  const pct = newTotal > 0 ? Math.round((newPresent / newTotal) * 1000) / 10 : 0;
  const t = requiredPercent / 100;
  const safe = t >= 1 ? 0 : Math.max(0, Math.floor(newPresent / t - newTotal + 1e-9));
  return { newPresent, newTotal, pct, safe, above: pct >= requiredPercent };
}

export const SkipCalculatorPage: React.FC = () => {
  const { user } = useAuthStore();
  const classId = user?.studentProfile?.classId;

  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [skipTomorrow, setSkipTomorrow] = useState(false);
  const [skipWholeDay, setSkipWholeDay] = useState(false);
  const [simSliders, setSimSliders] = useState<Record<string, { skipN: number; nextM: number }>>({});

  const fetchOverview = useCallback(async () => {
    try {
      const res = await api.get('/api/skip/overview');
      setData(res.data);
    } catch {
      // handled
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  useRealtimeSync(
    ['attendance:session_closed', 'timetable:updated', 'data:updated'],
    fetchOverview,
    { classId }
  );

  if (isLoading) {
    return <DatabaseLoader message="Calculating your skip margins..." subtext="Analyzing closed sessions, timetable, and holidays" />;
  }

  if (!data) {
    return (
      <EmptyState
        icon={Calculator}
        title="Unable to load Skip Calculator"
        description="Please ensure your student profile is linked to a class."
      />
    );
  }

  const { overall, subjects = [], requiredPercent, condonationPercent, semesterDate, tomorrowDay, tomorrowIsHoliday, tomorrowSlots = [] } = data;
  const overallBadge = getStatusBadge(overall.status);

  // Compute combined What-If simulation across subjects
  let simTotalPresent = 0;
  let simTotalConducted = 0;

  const simulatedSubjects = subjects.map((s: any) => {
    const custom = simSliders[s.subjectId] || { skipN: 0, nextM: Math.max(1, Math.min(10, s.projection?.remainingScheduled || 5)) };
    const tomorrowCount = skipTomorrow ? tomorrowSlots.filter((ts: any) => ts.subjectId === s.subjectId).length : 0;
    const wholeDayCount = skipWholeDay ? 1 : 0;
    const extraSkip = tomorrowCount + wholeDayCount;
    const effectiveNextM = Math.max(custom.nextM, custom.skipN + extraSkip);
    const effectiveSkipN = Math.min(effectiveNextM, custom.skipN + extraSkip);

    const sim = simulateSubject(s.present, s.total, effectiveSkipN, effectiveNextM, requiredPercent);
    simTotalPresent += sim.newPresent;
    simTotalConducted += sim.newTotal;
    return { ...s, sim, custom, effectiveSkipN, effectiveNextM };
  });

  const simOverallPct = simTotalConducted > 0 ? Math.round((simTotalPresent / simTotalConducted) * 1000) / 10 : overall.percentage;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-content tracking-tight">
            &ldquo;Can I Skip?&rdquo; Attendance Calculator
          </h1>
          <p className="text-xs sm:text-sm text-content-secondary mt-1">
            Required: <strong>{requiredPercent}%</strong> • Condonation Zone: <strong>{condonationPercent}%–{requiredPercent - 1}%</strong>
            {semesterDate ? ` • ${semesterDate.label} ends ${new Date(semesterDate.endDate).toLocaleDateString()}` : ''}
          </p>
        </div>
        <Badge variant={overallBadge.variant} size="md">
          {overallBadge.label} • {overall.percentage}%
        </Badge>
      </div>

      {/* Overall Summary & Semester-End Projection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-heading font-bold text-base text-content flex items-center gap-2">
              <Calculator className="w-4 h-4 text-brand-600" />
              Overall Attendance Status
            </h3>
            <Badge variant={overallBadge.variant} size="sm">{overallBadge.label}</Badge>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3 rounded-2xl bg-surface-soft border border-border">
              <div className="text-xs text-content-muted">Attended</div>
              <div className="text-lg font-extrabold text-content">{overall.present} / {overall.total}</div>
            </div>
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200">
              <div className="text-xs text-emerald-700">Safe to Skip</div>
              <div className="text-lg font-extrabold text-emerald-800">{overall.safeToSkip}</div>
            </div>
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200">
              <div className="text-xs text-rose-700">Must Attend</div>
              <div className="text-lg font-extrabold text-rose-800">
                {overall.mustAttend === null ? 'Impossible' : overall.mustAttend}
              </div>
            </div>
          </div>

          <p className="text-xs font-medium text-content-secondary bg-slate-50 p-3 rounded-xl border border-border">
            {overall.advice}
          </p>
        </Card>

        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-heading font-bold text-base text-content flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-brand-600" />
              Semester-End Projection
            </h3>
            <Badge variant="neutral" size="sm">{overall.projection.remainingScheduled} Remaining</Badge>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200">
              <div className="text-[11px] text-emerald-700">Best Case</div>
              <div className="text-base font-extrabold text-emerald-800">{overall.projection.bestCasePercent}%</div>
            </div>
            <div className="p-3 rounded-2xl bg-surface-soft border border-border">
              <div className="text-[11px] text-content-muted">Current Pace</div>
              <div className="text-base font-extrabold text-content">{overall.projection.currentPacePercent}%</div>
            </div>
            <div className="p-3 rounded-2xl bg-rose-50/70 border border-rose-200">
              <div className="text-[11px] text-rose-700">Worst Case</div>
              <div className="text-base font-extrabold text-rose-800">{overall.projection.worstCasePercent}%</div>
            </div>
          </div>

          <div className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
            overall.projection.recoveryPossible
              ? 'bg-indigo-50/60 border-indigo-200 text-indigo-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}>
            {!overall.projection.recoveryPossible && <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />}
            <span>{overall.projection.note}</span>
          </div>
        </Card>
      </div>

      {/* What-If Simulator Controls */}
      <Card className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-brand-600" />
            <h3 className="font-heading font-bold text-base text-content">What-If Simulator</h3>
          </div>
          <Badge variant={simOverallPct >= requiredPercent ? 'success' : 'danger'} size="md">
            Simulated Overall: {simOverallPct}% ({simTotalPresent}/{simTotalConducted})
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border">
          <div className="flex items-center justify-between p-3 rounded-2xl bg-surface-soft border border-border">
            <div>
              <div className="text-xs font-bold text-content">Skip Tomorrow ({tomorrowDay})</div>
              <div className="text-[11px] text-content-secondary">
                {tomorrowIsHoliday
                  ? 'Tomorrow is a holiday / Sunday (0 periods)'
                  : `${tomorrowSlots.length} scheduled period(s) tomorrow`}
              </div>
            </div>
            <Switch checked={skipTomorrow} onChange={setSkipTomorrow} />
          </div>

          <div className="flex items-center justify-between p-3 rounded-2xl bg-surface-soft border border-border">
            <div>
              <div className="text-xs font-bold text-content">Skip a Whole Day</div>
              <div className="text-[11px] text-content-secondary">
                Simulates missing 1 full class across each subject
              </div>
            </div>
            <Switch checked={skipWholeDay} onChange={setSkipWholeDay} />
          </div>
        </div>
      </Card>

      {/* Per-Subject Skip Cards & Sliders */}
      {simulatedSubjects.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No subjects found"
          description="Once subjects and closed attendance sessions are recorded for your class, per-subject skip margins appear here."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {simulatedSubjects.map((s: any) => {
            const st = getStatusBadge(s.status);
            return (
              <Card key={s.subjectId} className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-mono text-xs font-bold text-brand-600">{s.code}</span>
                    <h4 className="font-bold text-sm text-content">{s.name}</h4>
                    <span className="text-xs text-content-secondary">
                      {s.present} / {s.total} attended ({s.percentage}%)
                    </span>
                  </div>
                  <Badge variant={st.variant} size="sm">{st.label}</Badge>
                </div>

                <p className="text-xs text-content-secondary bg-surface-soft p-2.5 rounded-xl border border-border">
                  {s.advice}
                </p>

                <div className="pt-2 border-t border-border space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-content">
                      What if I skip {s.custom.skipN} of next {s.custom.nextM} classes?
                    </span>
                    <span className={`font-bold ${s.sim.above ? 'text-emerald-600' : 'text-rose-600'}`}>
                      → {s.sim.pct}% ({s.sim.newPresent}/{s.sim.newTotal})
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="text-[10px] text-content-muted">Skip N: {s.custom.skipN}</span>
                      <input
                        type="range"
                        min={0}
                        max={s.custom.nextM}
                        value={s.custom.skipN}
                        onChange={(e) => {
                          const skipN = Number(e.target.value);
                          setSimSliders((prev) => ({
                            ...prev,
                            [s.subjectId]: { skipN, nextM: s.custom.nextM },
                          }));
                        }}
                        className="w-full accent-brand-600"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[10px] text-content-muted">Next M: {s.custom.nextM}</span>
                      <input
                        type="range"
                        min={1}
                        max={20}
                        value={s.custom.nextM}
                        onChange={(e) => {
                          const nextM = Number(e.target.value);
                          setSimSliders((prev) => ({
                            ...prev,
                            [s.subjectId]: { skipN: Math.min(s.custom.skipN, nextM), nextM },
                          }));
                        }}
                        className="w-full accent-brand-600"
                      />
                    </label>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
