import React, { useState, useEffect, useMemo } from 'react';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { CheckCircle2, AlertTriangle, RefreshCw, X } from 'lucide-react';

export interface ThirukkuralItem {
  id: string;
  number?: string;
  chapter?: string;
  kural: string;
  porul: string;
  english?: string;
}

const FALLBACK_PREVIEW_KURALS: ThirukkuralItem[] = [
  {
    id: 'k611',
    number: 'குறள் 611',
    chapter: 'ஆள்வினையுடைமை (Perseverance)',
    kural: 'அருமை உடைத்தென் றசாவாமை வேண்டும் / பெருமை முயற்சி தரும்.',
    porul: 'செய்வதற்கு அரிய செயல் என்று சோர்வு கொள்ளாமல் முயற்சி செய்தால் அது பெருமையைத் தரும்.',
    english: 'Yield not to weakness, saying a task is too difficult; earnest effort will bring greatness.',
  },
  {
    id: 'k616',
    number: 'குறள் 616',
    chapter: 'ஆள்வினையுடைமை (Perseverance)',
    kural: 'முயற்சி திருவினை ஆக்கும் முயற்றின்மை / இன்மை புகுத்தி விடும்.',
    porul: 'முயற்சி ஒருவருக்குச் செல்வத்தைப் பெருக்கும்; முயற்சி இல்லாமை வறுமையைக் கொண்டு வந்து சேர்த்துவிடும்.',
    english: 'Persevering effort brings prosperity; lack of effort leads only to poverty.',
  },
  {
    id: 'k619',
    number: 'குறள் 619',
    chapter: 'ஆள்வினையுடைமை (Perseverance)',
    kural: 'தெய்வத்தான் ஆகா தெனினும் முயற்சிதன் / மெய்வருத்தக் கூலி தரும்.',
    porul: 'விதியால் முடியாவிட்டாலும், முயற்சி தன் உடல் உழைப்புக்கு ஏற்ற பலனைத் தவறாமல் தரும்.',
    english: "Though fate may deny success, persistent effort will always reward the labour of one's body.",
  },
  {
    id: 'k620',
    number: 'குறள் 620',
    chapter: 'ஆள்வினையுடைமை (Perseverance)',
    kural: 'ஊழையும் உப்பக்கம் காண்பர் உலைவின்றித் / தாழாது உஞற்று பவர்.',
    porul: 'சோர்வு இல்லாமல் தொடர்ந்து முயற்சி செய்கிறவர்கள் விதியையும் வென்று வெற்றி காண்பார்கள்.',
    english: 'Those who labour tirelessly without faltering will triumph even over fate.',
  },
];

export interface RushQueueConfigUI {
  showQuotes: boolean;
  showPosition: boolean;
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
  const [totalInQueue, setTotalInQueue] = useState(initialTicket?.totalInQueue || initialTicket?.position || 1);
  const [secondsLeft, setSecondsLeft] = useState(initialTicket?.estimatedSeconds || 8);
  const [errorReason, setErrorReason] = useState('');
  const [quoteIdx, setQuoteIdx] = useState(0);
  const [previewTheme, setPreviewTheme] = useState<'light' | 'dark' | 'emerald'>('light');

  const reducedMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    []
  );

  const quotes =
    config.quotes?.length > 0
      ? config.quotes
      : previewMode
        ? FALLBACK_PREVIEW_KURALS
        : [];

  // Rotate Thirukkural + Tamil Porul without back-to-back repeats
  useEffect(() => {
    if (!config.showQuotes || quotes.length <= 1) return;
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
  }, [config.showQuotes, config.quoteIntervalSeconds, quotes.length]);

  // Live countdown tick
  useEffect(() => {
    if (state === 'saved' || state === 'failed' || state === 'rejected') return;
    const t = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [state]);

  // Preview mode is interactive (admin switches states/themes/couplets manually)
  useEffect(() => {
    if (!previewMode) return;
    setErrorReason('Sample preview: you appear to be outside the geofence radius.');
  }, [previewMode]);

  // Real ticket Socket.IO + polling fallback
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
        sessionStorage.removeItem('velan_active_checkin_ticket');
        setTimeout(() => onSuccess?.({ distanceMeters: payload.distanceMeters, markedAt: payload.markedAt }), 900);
      }
    };

    socket.on('checkin:ticket_update', onUpdate);

    const poll = async () => {
      try {
        const res = await api.get(`/api/checkin/ticket/${ticketId}`);
        const tk = res.data?.ticket;
        if (tk) onUpdate({ ...tk, ticketId: tk.id });
      } catch {
        // ignore transient poll errors
      }
    };

    const pollTimer = setInterval(poll, 2500);
    return () => {
      socket.off('checkin:ticket_update', onUpdate);
      clearInterval(pollTimer);
    };
  }, [previewMode, ticketId, onSuccess]);

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
      // handled
    }
  };

  const maxEst = Math.max(1, initialTicket?.estimatedSeconds || 10);
  const progressPct =
    state === 'saved' ? 100 : Math.min(95, Math.max(10, Math.round(((maxEst - secondsLeft) / maxEst) * 100)));

  const currentQuote = quotes[quoteIdx % Math.max(1, quotes.length)];
  const stepIndex = state === 'saved' ? 3 : state === 'verifying' ? 2 : 1;
  const themeShell =
    previewTheme === 'dark'
      ? 'bg-slate-950 text-white'
      : previewTheme === 'emerald'
        ? 'bg-emerald-50 text-slate-900'
        : 'bg-white text-content';

  return (
    <div
      className={`fixed inset-0 z-50 ${themeShell} flex flex-col items-center justify-center p-4 sm:p-8 overflow-y-auto`}
      role="dialog"
      aria-modal="true"
      aria-label="Attendance verification queue"
    >
      {previewMode && (
        <div className="w-full max-w-2xl mb-4 p-2.5 rounded-2xl border border-slate-200 bg-white/95 text-slate-900 shadow-sm flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-1">
            {([
              { id: 'queued', label: 'Queued' },
              { id: 'verifying', label: 'Saving' },
              { id: 'saved', label: 'Success' },
              { id: 'failed', label: 'Failed' },
            ] as const).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setState(s.id)}
                className={`px-2.5 py-1 rounded-lg font-bold ${
                  state === s.id ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {([
              { id: 'light', label: 'Classic' },
              { id: 'dark', label: 'Slate Dark' },
              { id: 'emerald', label: 'Emerald' },
            ] as const).map((th) => (
              <button
                key={th.id}
                type="button"
                onClick={() => setPreviewTheme(th.id)}
                className={`px-2 py-1 rounded-lg font-semibold ${
                  previewTheme === th.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                {th.label}
              </button>
            ))}
          </div>
          {quotes.length > 0 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setQuoteIdx((i) => (i - 1 + quotes.length) % quotes.length)}
                className="px-2 py-1 rounded-lg bg-slate-100 font-semibold hover:bg-slate-200"
              >
                Prev
              </button>
              <span className="px-1 font-mono text-[11px]">
                {(quoteIdx % quotes.length) + 1}/{quotes.length}
              </span>
              <button
                type="button"
                onClick={() => setQuoteIdx((i) => (i + 1) % quotes.length)}
                className="px-2 py-1 rounded-lg bg-slate-100 font-semibold hover:bg-slate-200"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-content-secondary hover:bg-surface-soft"
          aria-label="Close waiting screen"
        >
          <X className="w-5 h-5" />
        </button>
      )}

      <div className="w-full max-w-md mx-auto flex flex-col items-center text-center space-y-5">
        <div className={reducedMotion ? '' : ''}>
          <BrandLogo size="md" />
        </div>

        {/* Countdown Ring or Reduced-Motion Bar */}
        {state === 'saved' ? (
          <div className="w-28 h-28 rounded-full bg-emerald-50 border-4 border-emerald-500 flex items-center justify-center">
            <CheckCircle2 className="w-14 h-14 text-emerald-600" />
          </div>
        ) : state === 'failed' || state === 'rejected' ? (
          <div className="w-28 h-28 rounded-full bg-rose-50 border-4 border-rose-500 flex items-center justify-center">
            <AlertTriangle className="w-12 h-12 text-rose-600" />
          </div>
        ) : reducedMotion ? (
          <div className="w-full space-y-2">
            <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full bg-brand-gradient" style={{ width: `${progressPct}%` }} />
            </div>
            <div className="text-sm font-bold text-content">
              {secondsLeft > config.maxWaitSeconds ? 'Taking a little longer than usual' : `About ${secondsLeft}s`}
            </div>
          </div>
        ) : (
          <div className="relative w-32 h-32 flex items-center justify-center">
            <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="52" fill="none" stroke="#f1f5f9" strokeWidth="8" />
              <circle
                cx="60"
                cy="60"
                r="52"
                fill="none"
                stroke="#e11d48"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={326.7}
                strokeDashoffset={326.7 - (326.7 * progressPct) / 100}
                style={{ transition: 'stroke-dashoffset 0.5s ease' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-heading font-extrabold text-content">{secondsLeft}s</span>
              <span className="text-[10px] text-content-muted uppercase font-bold">
                {secondsLeft > config.maxWaitSeconds ? 'Busy' : 'Est. wait'}
              </span>
            </div>
          </div>
        )}

        {/* Live Announcements */}
        <div aria-live="polite" className="space-y-1.5">
          <h2 className="text-xl font-heading font-extrabold text-content">
            {state === 'saved'
              ? 'Marked Present!'
              : state === 'failed' || state === 'rejected'
                ? 'Could Not Complete Check-In'
                : config.headline}
          </h2>
          <p className="text-xs text-content-secondary leading-relaxed">
            {state === 'failed' || state === 'rejected'
              ? errorReason || 'Please tap again to mark your attendance.'
              : config.subline}
          </p>
          {config.showPosition && state === 'queued' && (
            <p className="text-xs font-bold text-brand-600 pt-1">
              You are #{position} of {totalInQueue}
            </p>
          )}
        </div>

        {/* Step Tracker */}
        <div className="w-full grid grid-cols-4 gap-1 text-[10px] font-bold">
          {['Location verified', 'In queue', 'Saving', 'Marked present'].map((label, idx) => (
            <div
              key={label}
              className={`p-2 rounded-xl border ${
                idx <= stepIndex
                  ? 'bg-brand-50 border-brand-200 text-brand-700'
                  : 'bg-surface-soft border-border text-content-muted'
              }`}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Thirukkural + Tamil Porul Card */}
        {(config.showQuotes || previewMode) && currentQuote && (previewMode || state !== 'saved') && (
          <div
            className={`w-full p-4 rounded-2xl border text-left space-y-2 transition-opacity duration-300 ${
              previewTheme === 'dark'
                ? 'bg-slate-900 border-slate-800 text-white'
                : 'bg-surface-soft border-border text-content'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              {currentQuote.number && (
                <div className="text-[10px] font-bold uppercase text-brand-500">{currentQuote.number}</div>
              )}
              {currentQuote.chapter && (
                <div className="text-[10px] opacity-75">{currentQuote.chapter}</div>
              )}
            </div>
            <p
              className="text-xs sm:text-sm font-bold leading-relaxed whitespace-pre-line"
              style={{ fontFamily: "'Noto Serif Tamil', 'Noto Sans Tamil', serif" }}
            >
              {currentQuote.kural.replace(' / ', '\n')}
            </p>
            <p
              className="text-xs opacity-90 leading-relaxed"
              style={{ fontFamily: "'Noto Sans Tamil', sans-serif" }}
            >
              <strong>பொருள்:</strong> {currentQuote.porul}
            </p>
            {currentQuote.english && (
              <p className="text-[11px] opacity-75 leading-relaxed italic">{currentQuote.english}</p>
            )}
          </div>
        )}

        {/* Fallback Controls */}
        {(state === 'failed' || state === 'rejected') && onRetry && (
          <Button onClick={onRetry} leftIcon={<RefreshCw className="w-4 h-4" />}>
            Tap to Retry
          </Button>
        )}
        {!previewMode && ticketId && state !== 'saved' && (
          <button
            type="button"
            onClick={checkStatusManually}
            className="text-xs font-semibold text-content-muted hover:text-brand-600 underline"
          >
            Check status
          </button>
        )}
      </div>
    </div>
  );
};
