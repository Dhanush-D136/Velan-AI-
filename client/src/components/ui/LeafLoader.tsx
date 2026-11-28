import React, { useEffect, useRef, useState } from 'react';
import { KURALS } from '@/config/loadingMessages';
import { LEAF_DESIGN, LOADING_SIZES, LeafSizeVariant } from '@/config/loadingSizes';

let tamilFontRequested = false;

function ensureTamilFont() {
  if (tamilFontRequested || typeof document === 'undefined') return;
  tamilFontRequested = true;
  if (!document.querySelector('link[data-velan-tamil-font]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.dataset.velanTamilFont = 'true';
    link.href = 'https://fonts.googleapis.com/css2?family=Noto+Serif+Tamil:wght@500;600&display=swap';
    document.head.appendChild(link);
  }
}

function getBoxTargetWidth(size: LeafSizeVariant, viewportWidth: number): number {
  const isPhone = viewportWidth < 640;
  const spec = LOADING_SIZES[size];
  const desired = isPhone ? spec.mobileBoxPx : spec.desktopBoxPx;
  const maxAllowed = Math.floor(viewportWidth * LOADING_SIZES.maxViewportFraction);
  return Math.min(desired, maxAllowed);
}

export const LeafLoader: React.FC<{ size?: LeafSizeVariant; className?: string }> = ({
  size = 'full',
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stackRef = useRef<HTMLDivElement | null>(null);
  const frontRef = useRef<HTMLDivElement | null>(null);
  const line0Ref = useRef<HTMLDivElement | null>(null);
  const line1Ref = useRef<HTMLDivElement | null>(null);

  const [boxWidth, setBoxWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? getBoxTargetWidth(size, window.innerWidth) : LOADING_SIZES[size].desktopBoxPx
  );

  // Lazy-load Noto Serif Tamil only when a leaf loader is about to show
  useEffect(() => {
    ensureTamilFont();
  }, []);

  // Container-based scaling using ResizeObserver: --s = boxWidth / 636
  useEffect(() => {
    const updateSize = () => {
      const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
      const measured = containerRef.current?.clientWidth || vw;
      const target = Math.min(getBoxTargetWidth(size, vw), measured || vw);
      setBoxWidth(Math.max(110, target));
    };

    updateSize();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateSize) : null;
    if (ro && containerRef.current) ro.observe(containerRef.current);
    window.addEventListener('resize', updateSize);

    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, [size]);

  const scale = boxWidth / LEAF_DESIGN.spreadWidth;
  const reservedHeight = Math.ceil(LEAF_DESIGN.height * scale) + 18;
  const hasTurnedRef = useRef(false);

  // Keep spread centered when leaves turn
  useEffect(() => {
    const stack = stackRef.current;
    if (!stack) return;
    stack.style.setProperty('--s', String(scale));
    stack.style.setProperty('--tx', hasTurnedRef.current ? `${0.435 * LEAF_DESIGN.width * scale}px` : '0px');
  }, [scale]);

  // Palm-leaf writing + stylus + page-turn animation loop
  useEffect(() => {
    const stack = stackRef.current;
    const front = frontRef.current;
    const lineEls = [line0Ref.current, line1Ref.current].filter(Boolean) as HTMLDivElement[];
    if (!stack || !front || lineEls.length < 2) return;

    let cancelled = false;
    const timers = new Set<number>();
    const turned: HTMLElement[] = [];

    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        const id = window.setTimeout(() => {
          timers.delete(id);
          resolve();
        }, ms);
        timers.add(id);
      });

    const waitUntilVisible = () => {
      if (typeof document === 'undefined' || !document.hidden) return Promise.resolve();
      return new Promise<void>((resolve) => {
        const onVis = () => {
          if (!document.hidden) {
            document.removeEventListener('visibilitychange', onVis);
            resolve();
          }
        };
        document.addEventListener('visibilitychange', onVis);
      });
    };

    const setText = (kural: readonly [string, string]) => {
      kural.forEach((txt, i) => {
        const span = lineEls[i].firstElementChild as HTMLElement | null;
        if (span) span.textContent = txt;
        lineEls[i].style.fontSize = `${LEAF_DESIGN.baseFontSize}px`;
      });
      const maxW = Math.max(...lineEls.map((l) => l.offsetWidth || 1));
      const fs = Math.min(LEAF_DESIGN.baseFontSize, (LEAF_DESIGN.baseFontSize * LEAF_DESIGN.availTextWidth) / maxW);
      lineEls.forEach((l) => {
        l.style.fontSize = `${fs}px`;
      });
    };

    const prefersReduced =
      typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      setText(KURALS[0]);
      lineEls.forEach((l) => {
        const span = l.firstElementChild as HTMLElement | null;
        if (span) span.style.clipPath = 'none';
      });
      return () => {
        cancelled = true;
      };
    }

    const EASE = 'cubic-bezier(.45,.05,.4,1)';

    const writeLine = async (line: HTMLDivElement) => {
      if (cancelled) return;
      const span = line.firstElementChild as HTMLElement | null;
      const pen = line.querySelector('.edu-pen') as HTMLElement | null;
      if (!span || !pen || typeof span.animate !== 'function') return;

      const d = Math.max(1100, (span.textContent?.length || 10) * 95);
      const opts: KeyframeAnimationOptions = { duration: d, easing: EASE, fill: 'forwards' };
      span.animate([{ clipPath: 'inset(-30% 100% -30% 0)' }, { clipPath: 'inset(-30% -3% -30% 0)' }], opts);
      pen.animate(
        [
          { left: '0%', opacity: 0, offset: 0 },
          { left: '0%', opacity: 1, offset: 0.04 },
          { left: '100%', opacity: 1, offset: 1 },
        ],
        opts
      );
      await wait(d);
      if (cancelled) return;
      await pen
        .animate(
          [
            { opacity: 1, transform: 'translateY(0)' },
            { opacity: 0, transform: 'translateY(-14px)' },
          ],
          { duration: 350, fill: 'forwards' }
        )
        .finished.catch(() => {});
    };

    const flip = async () => {
      if (cancelled || typeof front.animate !== 'function') return;
      hasTurnedRef.current = true;
      const curScale = parseFloat(stack.style.getPropertyValue('--s') || '1') || 1;
      stack.style.setProperty('--tx', `${0.435 * LEAF_DESIGN.width * curScale}px`);

      const zTimer = window.setTimeout(() => {
        timers.delete(zTimer);
        if (!cancelled) front.style.zIndex = '1';
      }, 480);
      timers.add(zTimer);

      await front
        .animate(
          [
            { transform: 'translateY(0) rotateY(0deg)', offset: 0 },
            { transform: 'translateY(-8px) rotateY(-90deg)', offset: 0.5 },
            { transform: 'translateY(0) rotateY(-180deg)', offset: 1 },
          ],
          { duration: 1100, easing: 'cubic-bezier(.55,0,.3,1)', fill: 'forwards' }
        )
        .finished.catch(() => {});
    };

    const land = () => {
      if (cancelled) return;
      const clone = front.cloneNode(true) as HTMLElement;
      clone.classList.add('edu-turned');
      clone.style.zIndex = '1';
      clone.style.transform = 'rotateY(-180deg)';
      stack.appendChild(clone);
      turned.unshift(clone);
      turned.forEach((t, i) => {
        t.style.transform = `translate(${-i * 6}px,${i * 4}px) rotateY(-180deg)`;
      });
      if (turned.length > 3) {
        const old = turned.pop();
        if (old) {
          old.style.opacity = '0';
          const rmTimer = window.setTimeout(() => {
            timers.delete(rmTimer);
            old.remove();
          }, 700);
          timers.add(rmTimer);
        }
      }
      front.style.zIndex = '';
      front.getAnimations?.({ subtree: true }).forEach((a) => a.cancel());
    };

    const run = async () => {
      // Wait up to 1.5s for Tamil font, never block longer
      await Promise.race([document.fonts?.ready ?? Promise.resolve(), wait(1500)]);
      await wait(250);
      for (let i = 0; !cancelled; i++) {
        await waitUntilVisible();
        if (cancelled) break;
        setText(KURALS[i % KURALS.length]);
        for (const l of lineEls) {
          await waitUntilVisible();
          if (cancelled) break;
          await writeLine(l);
          await wait(250);
        }
        if (cancelled) break;
        await wait(1100);
        await waitUntilVisible();
        if (cancelled) break;
        await flip();
        land();
        await wait(150);
      }
    };

    run();

    return () => {
      cancelled = true;
      timers.forEach((id) => window.clearTimeout(id));
      timers.clear();
      front.getAnimations?.({ subtree: true }).forEach((a) => a.cancel());
      turned.forEach((el) => el.remove());
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={`w-full flex items-center justify-center overflow-hidden ${className}`}
      style={{ height: `${reservedHeight}px` }}
    >
      <div
        ref={stackRef}
        className="edu-stack"
        style={
          {
            '--s': scale,
            '--tx': '0px',
          } as React.CSSProperties
        }
      >
        <div className="edu-cord edu-cord-a" />
        <div className="edu-cord edu-cord-b" />
        <div className="edu-leaf edu-leaf-back">
          <div className="edu-face">
            <div className="edu-hole edu-hole-a" />
            <div className="edu-hole edu-hole-b" />
          </div>
        </div>
        <div ref={frontRef} className="edu-leaf edu-leaf-front">
          <div className="edu-face">
            <div className="edu-hole edu-hole-a" />
            <div className="edu-hole edu-hole-b" />
            <div ref={line0Ref} className="edu-line">
              <span />
              <div className="edu-pen">
                <i />
              </div>
            </div>
            <div ref={line1Ref} className="edu-line">
              <span />
              <div className="edu-pen">
                <i />
              </div>
            </div>
          </div>
          <div className="edu-rev">
            <div className="edu-hole edu-hole-a" />
            <div className="edu-hole edu-hole-b" />
            <div className="edu-rev-title">திருக்குறள்</div>
          </div>
        </div>
      </div>
    </div>
  );
};
