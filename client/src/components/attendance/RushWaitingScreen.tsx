import React, { useState, useEffect, useMemo } from 'react';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import {
  MapPin,
  Users,
  DatabaseZap,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Award,
  X,
} from 'lucide-react';

export interface ThirukkuralItem {
  id: string;
  kural_number?: number;
  chapter_ta?: string;
  chapter_en?: string;
  line1_ta?: string;
  line2_ta?: string;
  transliteration?: string;
  meaning_ta?: string;
  meaning_en?: string;
  explanation_source?: string;
  isCollegeMessage?: boolean;
  // Legacy compatibility
  number?: string;
  kural?: string;
  porul?: string;
}

export interface RushQueueConfigUI {
  showQuotes: boolean;
  showPosition: boolean;
  showTransliteration?: boolean;
  playSound?: boolean;
  maxWaitSeconds: number;
  quoteIntervalSeconds: number;
  headline: string;
  subline: string;
  quotes: ThirukkuralItem[];
}

interface RushWaitingScreenProps {
  ticketId?: string;
  initialTicket?: {
    position: number;
    totalInQueue?: number;
    estimatedSeconds: number;
    state: string;
  };
  config: RushQueueConfigUI;
  previewMode?: boolean;
  onSuccess?: (result: { distanceMeters?: number; markedAt?: string }) => void;
  onRetry?: () => void;
  onClose?: () => void;
}

const DEFAULT_FALLBACK_KURALS: ThirukkuralItem[] = [
  {
    id: 'k611',
    kural_number: 611,
    chapter_ta: 'ஆள்வினையுடைமை',
    chapter_en: 'Perseverance',
    line1_ta: 'அருமை உடைத்தென் றசாவாமை வேண்டும்',
    line2_ta: 'பெருமை முயற்சி தரும்.',
    meaning_ta: 'செய்வதற்கு அரிய செயல் என்று சோர்வு கொள்ளாமல் முயற்சி செய்தால் அது பெருமையைத் தரும்.',
    meaning_en: 'Do not give up thinking "this is too hard"; effort brings greatness.',
    explanation_source: 'மு. வரதராசனார் உரை · Tamil Virtual Academy',
  },
];

function playSoftChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.18);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.45);
  } catch {
    // ignore audio block
  }
}

export const RushWaitingScreen: React.FC<RushWaitingScreenProps> = ({
  ticketId,
  initialTicket,
  config,
  previewMode = false,
  onSuccess,
  onRetry,
  onClose,
}) => {
  const [state, setState] = useState(initialTicket?.state || 'queued');
  const [position, setPosition] = useState(initialTicket?.position || 1);
  const [totalInQueue, setTotalInQueue] = useState(
    initialTicket?.totalInQueue || initialTicket?.position || 1
  );
  const [secondsLeft, setSecondsLeft] = useState(initialTicket?.estimatedSeconds || 12);
  const [errorReason, setErrorReason] = useState('');
  const [quoteIdx, setQuoteIdx] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [previewPhase, setPreviewPhase] = useState<'queued' | 'verifying' | 'saved' | 'failed'>('queued');

  const reducedMotion = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    []
  );

  // Lazy-load Noto Serif Tamil & Noto Sans Tamil only when this screen mounts
  useEffect(() => {
    const id = 'velan-tamil-fonts';
    if (!document.getElementById(id)) {
      const link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href =
        'https://fonts.googleapis.com/css2?family=Noto+Sans+Tamil:wght@400;500;600&family=Noto+Serif+Tamil:wght@500;600;700&display=swap';
      document.head.appendChild(link);
    }
  }, []);

  const quotes = useMemo(() => {
    const raw = config.quotes?.length > 0 ? config.quotes : DEFAULT_FALLBACK_KURALS;
    return raw.map((q) => {
      const splitLegacy = q.kural ? q.kural.split(' / ') : [];
      return {
        ...q,
        line1_ta: q.line1_ta || splitLegacy[0] || q.kural || '',
        line2_ta: q.line2_ta || splitLegacy[1] || '',
        meaning_ta: q.meaning_ta || q.porul || '',
      };
    });
  }, [config.quotes]);

  // Rotate Thirukkural every ~9s without back-to-back repeats
  useEffect(() => {
    if (!config.showQuotes || quotes.length <= 1 || isPaused) return;
    const ms = Math.max(4000, (config.quoteIntervalSeconds || 9) * 1000);
    const timer = setInterval(() => {
      setQuoteIdx((prev) => {
        if (quotes.length <= 1) return 0;
        let next = Math.floor(Math.random() * quotes.length);
        if (next === prev) next = (prev + 1) % quotes.length;
        return next;
      });
    }, ms);
    return () => clearInterval(timer);
  }, [config.showQuotes, config.quoteIntervalSeconds, quotes.length, isPaused]);

  // Countdown tick
  useEffect(() => {
    if (state === 'saved' || state === 'failed' || state === 'rejected') return;
    const t = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [state]);

  // Preview mode state cycling (queued -> verifying -> saved -> failed)
  useEffect(() => {
    if (!previewMode) return;
    setState(previewPhase);
    if (previewPhase === 'queued') {
      setPosition(37);
      setTotalInQueue(120);
      setSecondsLeft(12);
    } else if (previewPhase === 'verifying') {
      setPosition(1);
      setSecondsLeft(2);
    } else if (previewPhase === 'saved') {
      setSecondsLeft(0);
      if (config.playSound) playSoftChime();
    } else if (previewPhase === 'failed') {
      setErrorReason('Preview: Network timed out while saving. Tap Try again.');
    }
  }, [previewMode, previewPhase, config.playSound]);

  // Real ticket Socket.IO + polling fallback (unchanged logic)
  useEffect(() => {
    if (previewMode || !ticketId) return;
    const socket = getSocket();
    const onUpdate = (payload: any) => {
      if (payload?.ticketId !== ticketId) return;
      if (payload.state) setState(payload.state);
      if (typeof payload.position === 'number') setPosition(payload.position);
      if (typeof payload.totalInQueue === 'number') setTotalInQueue(payload.totalInQueue);
      if (typeof payload.estimatedSeconds === 'number') setSecondsLeft(payload.estimatedSeconds);
      if (payload.errorReason) setErrorReason(payload.errorReason);
      if (payload.state === 'saved') {
        if (config.playSound) playSoftChime();
        sessionStorage.removeItem('velan_active_checkin_ticket');
        setTimeout(
          () => onSuccess?.({ distanceMeters: payload.distanceMeters, markedAt: payload.markedAt }),
          1100
        );
      }
    };

    socket.on('checkin:ticket_update', onUpdate);
    const poll = async () => {
      try {
        const res = await api.get(`/api/checkin/ticket/${ticketId}`);
        const tk = res.data?.ticket;
        if (tk) onUpdate({ ...tk, ticketId: tk.id });
      } catch {
        // ignore transient poll error
      }
    };
    const pollTimer = setInterval(poll, 2500);
    return () => {
      socket.off('checkin:ticket_update', onUpdate);
      clearInterval(pollTimer);
    };
  }, [previewMode, ticketId, onSuccess, config.playSound]);

  const checkStatusManually = async () => {
    if (!ticketId) return;
    try {
      const res = await api.get(`/api/checkin/ticket/${ticketId}`);
      const tk = res.data?.ticket;
      if (tk) {
        setState(tk.state);
        if (tk.state === 'saved') {
          sessionStorage.removeItem('velan_active_checkin_ticket');
          onSuccess?.({ distanceMeters: tk.distanceMeters });
        }
      }
    } catch {
      // ignore
    }
  };

  const maxEst = Math.max(1, initialTicket?.estimatedSeconds || 12);
  const progressPct =
    state === 'saved'
      ? 100
      : Math.min(95, Math.max(12, Math.round(((maxEst - secondsLeft) / maxEst) * 100)));

  const currentQuote = quotes[quoteIdx % quotes.length];
  const stepIndex = state === 'saved' ? 3 : state === 'verifying' ? 2 : 1;
  const isSlow = secondsLeft > config.maxWaitSeconds;

  const steps = [
    { label: 'Location verified', short: 'Location', icon: MapPin },
    { label: 'In queue', short: 'In queue', icon: Users },
    { label: 'Saving attendance', short: 'Saving', icon: DatabaseZap },
    { label: 'Marked present', short: 'Present', icon: CheckCircle2 },
  ];

  const ringStroke =
    state === 'saved'
      ? '#12B76A'
      : state === 'verifying'
        ? 'url(#velanAmberGrad)'
        : 'url(#velanRedGoldGrad)';

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto overflow-x-hidden"
      style={{
        backgroundColor: '#FFFFFF',
        color: '#0B0B0F',
        minHeight: '100dvh',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Attendance verification waiting screen"
    >
      <style>{`
        @keyframes velanDriftA { 0%,100% { transform: translate3d(0,0,0) scale(1); } 50% { transform: translate3d(24px,18px,0) scale(1.06); } }
        @keyframes velanDriftB { 0%,100% { transform: translate3d(0,0,0) scale(1); } 50% { transform: translate3d(-24px,-18px,0) scale(1.05); } }
        @keyframes velanSpinSlow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes velanKuralIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes velanTickDraw { from { stroke-dashoffset: 48; } to { stroke-dashoffset: 0; } }
        @keyframes velanSparkle { 0% { opacity: 1; transform: translate(0,0) scale(1); } 100% { opacity: 0; transform: translate(var(--tx), var(--ty)) scale(0.3); } }
      `}</style>

      {/* Top Red-to-Gold Hairline */}
      <div
        className="fixed top-0 left-0 right-0 h-1 z-30"
        style={{ background: 'linear-gradient(90deg, #D6101F 0%, #C9972B 100%)' }}
      />

      {/* Faint Dotted Grid (3% opacity) & Drifting Color Washes */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage: 'radial-gradient(#0B0B0F 1px, transparent 1px)',
          backgroundSize: '22px 22px',
          opacity: 0.03,
        }}
      />
      {!reducedMotion && (
        <>
          <div
            className="pointer-events-none fixed -top-32 -left-32 w-96 h-96 rounded-full blur-3xl z-0"
            style={{ background: '#FDECEE', opacity: 0.45, animation: 'velanDriftA 24s ease-in-out infinite' }}
          />
          <div
            className="pointer-events-none fixed -bottom-32 -right-32 w-96 h-96 rounded-full blur-3xl z-0"
            style={{ background: '#FFF4D6', opacity: 0.45, animation: 'velanDriftB 28s ease-in-out infinite' }}
          />
        </>
      )}

      {onClose && (
        <button
          onClick={onClose}
          className="fixed top-4 right-4 z-40 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-2xl border bg-white/90 hover:bg-[#FDECEE] transition"
          style={{ borderColor: '#EDEDF0', color: '#0B0B0F' }}
          aria-label="Close waiting screen"
        >
          <X className="w-5 h-5" />
        </button>
      )}

      {/* Preview Mode Switcher Bar */}
      {previewMode && (
        <div className="relative z-20 max-w-[1040px] mx-auto px-4 pt-4 flex flex-wrap items-center justify-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-[#FFF4D6] text-[#8A6211] border border-[#C9972B]/40">
            Admin Preview Mode (No data saved)
          </span>
          {(['queued', 'verifying', 'saved', 'failed'] as const).map((ph) => (
            <button
              key={ph}
              type="button"
              onClick={() => setPreviewPhase(ph)}
              className="px-3 py-1.5 rounded-full text-xs font-bold border transition"
              style={{
                backgroundColor: previewPhase === ph ? '#D6101F' : '#FFFFFF',
                color: previewPhase === ph ? '#FFFFFF' : '#0B0B0F',
                borderColor: previewPhase === ph ? '#D6101F' : '#EDEDF0',
              }}
            >
              {ph}
            </button>
          ))}
        </div>
      )}

      {/* Main Responsive Layout: Desktop 2-col (>=900px), Mobile 1-col (360/390px) */}
      <div className="relative z-10 max-w-[1040px] mx-auto px-4 py-6 sm:py-10 min-h-[calc(100dvh-56px)] flex flex-col justify-center">
        <div className="grid grid-cols-1 min-[900px]:grid-cols-12 gap-5 sm:gap-7 items-center">
          {/* LEFT COLUMN (40% -> 5 cols): STATUS CARD */}
          <div
            className="min-[900px]:col-span-5 rounded-[24px] border bg-white p-5 sm:p-7 flex flex-col items-center text-center"
            style={{
              borderColor: '#EDEDF0',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 12px 32px -12px rgba(214,16,31,0.18)',
            }}
          >
            {/* Real Velan AI Logo */}
            <img
              src="/logo.png"
              alt="Velan AI"
              className="h-11 w-auto object-contain mb-4"
            />

            {/* Progress Ring (200px desktop, 150px mobile) or Reduced-Motion Bar */}
            {state === 'saved' ? (
              <div className="relative w-[150px] h-[150px] min-[900px]:w-[188px] min-[900px]:h-[188px] flex items-center justify-center my-1">
                <div
                  className="w-28 h-28 min-[900px]:w-36 min-[900px]:h-36 rounded-full flex items-center justify-center border-4"
                  style={{ backgroundColor: '#ECFDF3', borderColor: '#12B76A' }}
                >
                  <svg className="w-14 h-14" viewBox="0 0 48 48" fill="none">
                    <path
                      d="M12 25L20 33L36 16"
                      stroke="#12B76A"
                      strokeWidth="4.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray="48"
                      style={{ animation: reducedMotion ? 'none' : 'velanTickDraw 0.5s ease forwards' }}
                    />
                  </svg>
                </div>
                {!reducedMotion &&
                  Array.from({ length: 12 }).map((_, i) => {
                    const angle = (i * 30 * Math.PI) / 180;
                    const tx = `${Math.round(Math.cos(angle) * 68)}px`;
                    const ty = `${Math.round(Math.sin(angle) * 68)}px`;
                    return (
                      <span
                        key={i}
                        className="absolute w-2 h-2 rounded-full"
                        style={
                          {
                            backgroundColor: i % 2 === 0 ? '#D6101F' : '#C9972B',
                            '--tx': tx,
                            '--ty': ty,
                            animation: 'velanSparkle 0.75s ease-out forwards',
                          } as React.CSSProperties
                        }
                      />
                    );
                  })}
              </div>
            ) : state === 'failed' || state === 'rejected' ? (
              <div
                className="w-full p-4 rounded-2xl border text-left space-y-3 my-2"
                style={{ backgroundColor: '#FDECEE', borderColor: '#D6101F' }}
              >
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: '#B00D19' }} />
                  <div className="text-xs">
                    <div className="font-bold" style={{ color: '#B00D19' }}>Check-in could not be saved</div>
                    <p className="mt-0.5" style={{ color: '#0B0B0F' }}>
                      {errorReason || 'Please try again to record your attendance.'}
                    </p>
                  </div>
                </div>
                {onRetry && (
                  <button
                    type="button"
                    onClick={onRetry}
                    className="w-full min-h-[44px] rounded-xl font-bold text-xs text-white flex items-center justify-center gap-2"
                    style={{ backgroundColor: '#D6101F' }}
                  >
                    <RefreshCw className="w-4 h-4" />
                    Try again
                  </button>
                )}
              </div>
            ) : reducedMotion ? (
              <div className="w-full space-y-2 my-3">
                <div className="w-full h-3 rounded-full overflow-hidden" style={{ backgroundColor: '#EDEDF0' }}>
                  <div
                    className="h-full"
                    style={{
                      width: `${progressPct}%`,
                      background: 'linear-gradient(90deg, #D6101F 0%, #C9972B 100%)',
                    }}
                  />
                </div>
                <div className="text-sm font-bold tabular-nums" style={{ color: '#0B0B0F' }}>
                  {isSlow ? 'Taking a little longer than usual. Your spot is safe.' : `${secondsLeft} seconds, est. wait`}
                </div>
              </div>
            ) : (
              <div className="relative w-[150px] h-[150px] min-[900px]:w-[200px] min-[900px]:h-[200px] flex items-center justify-center my-1">
                {/* Dashed outer rotating ring */}
                <svg
                  className="absolute inset-0 w-full h-full"
                  viewBox="0 0 200 200"
                  style={{ animation: 'velanSpinSlow 24s linear infinite' }}
                >
                  <circle
                    cx="100"
                    cy="100"
                    r="95"
                    fill="none"
                    stroke="#C9972B"
                    strokeOpacity="0.35"
                    strokeWidth="1.5"
                    strokeDasharray="6 8"
                  />
                </svg>

                <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
                  <defs>
                    <linearGradient id="velanRedGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#D6101F" />
                      <stop offset="55%" stopColor="#D97706" />
                      <stop offset="100%" stopColor="#C9972B" />
                    </linearGradient>
                    <linearGradient id="velanAmberGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#B00D19" />
                      <stop offset="100%" stopColor="#C9972B" />
                    </linearGradient>
                  </defs>
                  <circle cx="100" cy="100" r="78" fill="none" stroke="#EDEDF0" strokeWidth="11" />
                  <circle
                    cx="100"
                    cy="100"
                    r="78"
                    fill="none"
                    stroke={ringStroke}
                    strokeWidth="11"
                    strokeLinecap="round"
                    strokeDasharray={490.1}
                    strokeDashoffset={490.1 - (490.1 * progressPct) / 100}
                    style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                  />
                </svg>

                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span
                    className="text-3xl min-[900px]:text-4xl font-extrabold tabular-nums leading-none"
                    style={{ color: '#0B0B0F' }}
                  >
                    {secondsLeft}
                  </span>
                  <span className="text-[11px] font-semibold mt-1" style={{ color: '#6B7280' }}>
                    {isSlow ? 'est. wait (busy)' : 'seconds, est. wait'}
                  </span>
                </div>
              </div>
            )}

            {/* Position Pill */}
            {config.showPosition && state === 'queued' && (
              <div
                className="mt-2 px-3.5 py-1 rounded-full text-xs font-bold tabular-nums border"
                style={{ backgroundColor: '#FDECEE', color: '#B00D19', borderColor: '#D6101F33' }}
              >
                You are #{position} of {totalInQueue}
              </div>
            )}

            {/* Headline & Subline */}
            <div aria-live="polite" role="status" className="mt-3 space-y-1.5">
              <h1 className="text-lg sm:text-xl font-heading font-extrabold tracking-tight" style={{ color: '#0B0B0F' }}>
                {state === 'saved'
                  ? 'You are marked present!'
                  : isSlow
                    ? 'Taking a little longer than usual. Your spot is safe.'
                    : config.headline}
              </h1>
              <p className="text-xs leading-relaxed" style={{ color: '#6B7280' }}>
                {config.subline}
              </p>
            </div>

            {/* 4-Step Tracker */}
            <div className="w-full mt-5 pt-4 border-t" style={{ borderColor: '#EDEDF0' }}>
              <div className="relative flex items-start justify-between">
                <div
                  className="absolute top-4 left-6 right-6 h-0.5 z-0"
                  style={{ backgroundColor: '#EDEDF0' }}
                >
                  <div
                    className="h-full origin-left"
                    style={{
                      background: 'linear-gradient(90deg, #D6101F 0%, #C9972B 100%)',
                      transform: `scaleX(${stepIndex / 3})`,
                      transition: reducedMotion ? 'none' : 'transform 400ms ease',
                    }}
                  />
                </div>

                {steps.map((st, idx) => {
                  const Icon = st.icon;
                  const isDone = idx < stepIndex || state === 'saved';
                  const isActive = idx === stepIndex && state !== 'saved';
                  return (
                    <div key={st.label} className="relative z-10 flex flex-col items-center w-1/4 px-0.5">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition ${
                          isActive && !reducedMotion ? 'animate-pulse' : ''
                        }`}
                        style={{
                          backgroundColor: isDone ? '#D6101F' : '#FFFFFF',
                          borderColor: isDone || isActive ? '#D6101F' : '#EDEDF0',
                          color: isDone ? '#FFFFFF' : isActive ? '#D6101F' : '#9CA3AF',
                        }}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <span
                        className="mt-1.5 text-[10px] sm:text-[11px] font-semibold leading-tight text-center"
                        style={{ color: isDone || isActive ? '#0B0B0F' : '#6B7280' }}
                      >
                        <span className="hidden sm:inline">{st.label}</span>
                        <span className="sm:hidden">{st.short}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {!previewMode && ticketId && state !== 'saved' && (
              <button
                type="button"
                onClick={checkStatusManually}
                className="mt-3 text-xs font-semibold underline min-h-[36px]"
                style={{ color: '#6B7280' }}
              >
                Check status
              </button>
            )}
          </div>

          {/* RIGHT COLUMN (60% -> 7 cols): THIRUKKURAL HERO CARD */}
          {config.showQuotes && currentQuote && (
            <div className="min-[900px]:col-span-7 flex flex-col">
              <div
                onMouseEnter={() => setIsPaused(true)}
                onMouseLeave={() => setIsPaused(false)}
                onTouchStart={() => setIsPaused(true)}
                onTouchEnd={() => setIsPaused(false)}
                className="relative rounded-[24px] p-[1.5px]"
                style={{
                  background: 'linear-gradient(135deg, #C9972B 0%, #D6101F 100%)',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 12px 32px -12px rgba(214,16,31,0.18)',
                }}
              >
                <div className="relative rounded-[22.5px] bg-white p-5 sm:p-8 min-h-[280px] min-[900px]:min-h-[410px] flex flex-col justify-between overflow-hidden">
                  {/* Original Kolam / Temple Corner SVG Ornaments */}
                  <svg className="pointer-events-none absolute top-3 left-3 w-8 h-8 opacity-35" viewBox="0 0 32 32" fill="none">
                    <path d="M2 16C2 8.268 8.268 2 16 2M2 8V2H8" stroke="#C9972B" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <svg className="pointer-events-none absolute bottom-3 right-3 w-8 h-8 opacity-35 rotate-180" viewBox="0 0 32 32" fill="none">
                    <path d="M2 16C2 8.268 8.268 2 16 2M2 8V2H8" stroke="#C9972B" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>

                  {/* Header Row */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b" style={{ borderColor: '#EDEDF0' }}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: '#FFF4D6', color: '#C9972B' }}
                      >
                        <Award className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold" style={{ color: '#0B0B0F', fontFamily: '"Noto Sans Tamil", sans-serif' }}>
                          திருக்குறள் · Thirukkural
                        </div>
                        {(currentQuote.chapter_ta || currentQuote.chapter_en) && (
                          <div className="text-[11px]" style={{ color: '#6B7280' }}>
                            {currentQuote.chapter_ta} {currentQuote.chapter_en ? `· ${currentQuote.chapter_en}` : ''}
                          </div>
                        )}
                      </div>
                    </div>

                    {(currentQuote.kural_number || currentQuote.number) && (
                      <span
                        className="px-3 py-1 rounded-full text-xs font-bold border"
                        style={{ backgroundColor: '#FFF4D6', color: '#8A6211', borderColor: '#C9972B55' }}
                      >
                        {currentQuote.kural_number ? `குறள் ${currentQuote.kural_number}` : currentQuote.number}
                      </span>
                    )}
                  </div>

                  {/* Hero Couplet */}
                  <div
                    key={currentQuote.id}
                    className="relative py-5 sm:py-7 space-y-4"
                    style={{
                      animation: reducedMotion ? 'none' : 'velanKuralIn 500ms cubic-bezier(.22,1,.36,1)',
                    }}
                  >
                    <span
                      aria-hidden="true"
                      className="pointer-events-none select-none absolute -top-2 left-0 text-7xl font-serif leading-none"
                      style={{ color: '#FFF4D6' }}
                    >
                      &ldquo;
                    </span>

                    <div
                      lang="ta"
                      className="relative z-10 text-[21px] sm:text-[26px] min-[900px]:text-[28px] font-semibold tracking-normal"
                      style={{
                        fontFamily: '"Noto Serif Tamil", "Latha", serif',
                        lineHeight: 1.75,
                        color: '#0B0B0F',
                        hyphens: 'none',
                      }}
                    >
                      <div>{currentQuote.line1_ta}</div>
                      {currentQuote.line2_ta && <div>{currentQuote.line2_ta}</div>}
                    </div>

                    {config.showTransliteration && currentQuote.transliteration && (
                      <p className="text-xs italic" style={{ color: '#6B7280' }}>
                        {currentQuote.transliteration}
                      </p>
                    )}

                    {/* Ornamental Kolam Divider */}
                    <div className="flex items-center gap-3 py-1">
                      <div className="flex-1 h-px" style={{ backgroundColor: '#C9972B44' }} />
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                        <path d="M12 3L15 12L12 21L9 12L12 3Z" stroke="#C9972B" strokeWidth="1.4" />
                        <circle cx="12" cy="12" r="2" fill="#D6101F" />
                      </svg>
                      <div className="flex-1 h-px" style={{ backgroundColor: '#C9972B44' }} />
                    </div>

                    {/* Tamil & English Meanings */}
                    <div className="space-y-2">
                      {currentQuote.meaning_ta && (
                        <p
                          lang="ta"
                          className="text-[15px] sm:text-[16px]"
                          style={{
                            fontFamily: '"Noto Sans Tamil", "Latha", sans-serif',
                            lineHeight: 1.7,
                            color: '#374151',
                          }}
                        >
                          <strong style={{ color: '#B00D19' }}>பொருள்:</strong> {currentQuote.meaning_ta}
                        </p>
                      )}
                      {currentQuote.meaning_en && (
                        <p className="text-[14px] leading-relaxed" style={{ color: '#6B7280' }}>
                          <strong>Meaning:</strong> {currentQuote.meaning_en}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Footer & Controls */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t text-xs" style={{ borderColor: '#EDEDF0' }}>
                    <div style={{ color: '#6B7280' }}>
                      <span className="font-semibold" style={{ color: '#0B0B0F' }}>
                        — திருவள்ளுவர் · Thiruvalluvar
                      </span>
                      {currentQuote.explanation_source && (
                        <span className="block text-[11px]">{currentQuote.explanation_source}</span>
                      )}
                    </div>

                    {quotes.length > 1 && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setQuoteIdx((p) => (p - 1 + quotes.length) % quotes.length)}
                          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl border hover:bg-[#FDECEE] transition"
                          style={{ borderColor: '#EDEDF0', color: '#0B0B0F' }}
                          aria-label="Previous Kural"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setQuoteIdx((p) => (p + 1) % quotes.length)}
                          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl border hover:bg-[#FDECEE] transition"
                          style={{ borderColor: '#EDEDF0', color: '#0B0B0F' }}
                          aria-label="Next Kural"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Dots indicator */}
              {quotes.length > 1 && (
                <div className="flex items-center justify-center gap-2 mt-3">
                  {quotes.map((q, i) => (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => setQuoteIdx(i)}
                      aria-label={`Show Kural ${i + 1}`}
                      className="h-2 rounded-full transition-all"
                      style={{
                        width: i === quoteIdx ? '24px' : '8px',
                        backgroundColor: i === quoteIdx ? '#D6101F' : '#EDEDF0',
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Sticky mobile safe-area footer */}
      <div
        className="sticky bottom-0 z-20 bg-white/95 backdrop-blur border-t py-2.5 px-4 text-center text-[11px] font-medium"
        style={{ borderColor: '#EDEDF0', color: '#6B7280' }}
      >
        You can leave this screen open, we will update it automatically.
      </div>
    </div>
  );
};
