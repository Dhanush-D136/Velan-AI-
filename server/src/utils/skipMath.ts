export type SkipStatus = 'NO_DATA' | 'SAFE' | 'BORDERLINE' | 'CONDONATION' | 'DANGER';

export interface SkipCalculationInput {
  present: number;
  total: number;
  requiredPercent?: number;
  condonationPercent?: number;
  remainingScheduled?: number;
  subjectLabel?: string;
}

export interface SkipCalculationResult {
  present: number;
  total: number;
  percentage: number;
  requiredPercent: number;
  condonationPercent: number;
  safeToSkip: number;
  mustAttend: number | null; // null if mathematically impossible (e.g. t=100% with miss)
  status: SkipStatus;
  advice: string;
  projection: {
    remainingScheduled: number;
    bestCasePercent: number;
    worstCasePercent: number;
    currentPacePercent: number;
    maxFurtherMiss: number;
    recoveryPossible: boolean;
    note: string;
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function calculateSkipMetrics(input: SkipCalculationInput): SkipCalculationResult {
  const present = Math.max(0, input.present);
  const total = Math.max(0, input.total);
  const requiredPercent = input.requiredPercent ?? 75;
  const condonationPercent = input.condonationPercent ?? 65;
  const remainingScheduled = Math.max(0, input.remainingScheduled ?? 0);
  const label = input.subjectLabel ? `${input.subjectLabel} ` : '';

  const t = Math.min(1, Math.max(0.01, requiredPercent / 100));

  if (total === 0) {
    return {
      present: 0,
      total: 0,
      percentage: 0,
      requiredPercent,
      condonationPercent,
      safeToSkip: 0,
      mustAttend: 0,
      status: 'NO_DATA',
      advice: `No closed ${label}sessions conducted yet.`,
      projection: {
        remainingScheduled,
        bestCasePercent: remainingScheduled > 0 ? 100 : 0,
        worstCasePercent: 0,
        currentPacePercent: 0,
        maxFurtherMiss: remainingScheduled > 0 ? Math.max(0, Math.floor(remainingScheduled * (1 - t) + 1e-9)) : 0,
        recoveryPossible: true,
        note: 'Attendance tracking starts once your first session is closed.',
      },
    };
  }

  const percentage = round1((present / total) * 100);
  const safeToSkip = t >= 1 ? 0 : Math.max(0, Math.floor(present / t - total + 1e-9));

  let mustAttend: number | null = 0;
  if (present / total < t) {
    if (t >= 1) {
      mustAttend = null; // 100% cannot be recovered once missed
    } else {
      mustAttend = Math.max(0, Math.ceil((t * total - present) / (1 - t) - 1e-9));
    }
  }

  // Projections to semester end
  const finalTotal = total + remainingScheduled;
  const bestCasePercent = finalTotal > 0 ? round1(((present + remainingScheduled) / finalTotal) * 100) : percentage;
  const worstCasePercent = finalTotal > 0 ? round1((present / finalTotal) * 100) : percentage;
  const currentPacePercent = percentage;
  const maxFurtherMiss =
    finalTotal > 0
      ? Math.max(0, Math.min(remainingScheduled, Math.floor(present + remainingScheduled - t * finalTotal + 1e-9)))
      : 0;
  const recoveryPossible = finalTotal > 0 ? (present + remainingScheduled) / finalTotal + 1e-9 >= t : present / total + 1e-9 >= t;

  let status: SkipStatus;
  if (percentage < condonationPercent) {
    status = 'DANGER';
  } else if (percentage < requiredPercent) {
    status = 'CONDONATION';
  } else if (safeToSkip <= 2) {
    status = 'BORDERLINE';
  } else {
    status = 'SAFE';
  }

  let advice = '';
  if (percentage >= requiredPercent) {
    if (safeToSkip === 0) {
      advice = `You are at ${percentage}%. Do not miss the next ${label}class or you will drop below ${requiredPercent}%.`;
    } else {
      advice = `You can miss ${safeToSkip} more ${label}class${safeToSkip === 1 ? '' : 'es'}. After that you drop below ${requiredPercent}%.`;
    }
  } else if (!recoveryPossible) {
    advice = `Recovery is no longer possible without condonation (best possible: ${bestCasePercent}%).`;
  } else if (mustAttend !== null) {
    advice = `Attend the next ${mustAttend} consecutive ${label}class${mustAttend === 1 ? '' : 'es'} to reach ${requiredPercent}%.`;
  } else {
    advice = `Recovery is no longer possible without condonation.`;
  }

  const note = !recoveryPossible
    ? 'Recovery is no longer possible without condonation'
    : remainingScheduled === 0
      ? 'No remaining scheduled periods in this semester.'
      : `Across ${remainingScheduled} remaining period(s), you can miss up to ${maxFurtherMiss} and still finish ≥ ${requiredPercent}%.`;

  return {
    present,
    total,
    percentage,
    requiredPercent,
    condonationPercent,
    safeToSkip,
    mustAttend,
    status,
    advice,
    projection: {
      remainingScheduled,
      bestCasePercent,
      worstCasePercent,
      currentPacePercent,
      maxFurtherMiss,
      recoveryPossible,
      note,
    },
  };
}
