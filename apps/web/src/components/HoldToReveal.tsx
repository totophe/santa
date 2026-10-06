import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n';

const HOLD_MS = 1000;

interface Props {
  /** Fetched only when the hold completes — never preloaded or cached. */
  onReveal: () => Promise<string>;
}

type Phase = 'idle' | 'holding' | 'revealed';

/**
 * Press-and-hold to reveal. The name is requested from the server only when the
 * hold completes, shown while the press lasts, and hidden the instant it ends.
 * Holding Space or Enter works too. Honours prefers-reduced-motion.
 */
export function HoldToReveal({ onReveal }: Props) {
  const { t } = useI18n();
  const [phase, setPhase] = useState<Phase>('idle');
  const [pct, setPct] = useState(0);
  const [name, setName] = useState<string | null>(null);
  const raf = useRef<number | null>(null);
  const start = useRef(0);
  const done = useRef(false);

  const reset = useCallback(() => {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = null;
    done.current = false;
    setPct(0);
    setName(null);
    setPhase('idle');
  }, []);

  const tick = useCallback(async () => {
    const p = Math.min(100, ((performance.now() - start.current) / HOLD_MS) * 100);
    setPct(p);
    if (p >= 100) {
      if (!done.current) {
        done.current = true;
        try {
          const revealed = await onReveal();
          // Only show if still holding.
          setName(revealed);
          setPhase('revealed');
        } catch {
          reset();
        }
      }
      return;
    }
    raf.current = requestAnimationFrame(tick);
  }, [onReveal, reset]);

  const begin = useCallback(() => {
    if (phase !== 'idle') return;
    setPhase('holding');
    start.current = performance.now();
    raf.current = requestAnimationFrame(tick);
  }, [phase, tick]);

  useEffect(() => reset, [reset]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
      e.preventDefault();
      begin();
    }
  };

  const showName = phase === 'revealed' && name;

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div
        aria-live="polite"
        style={{
          minHeight: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Chewy, cursive',
          fontSize: 48,
          color: 'var(--primary)',
        }}
      >
        {showName ? name : ''}
      </div>
      <button
        type="button"
        className="btn btn-soft"
        style={{
          position: 'relative',
          overflow: 'hidden',
          height: 56,
          userSelect: 'none',
          WebkitUserSelect: 'none',
          touchAction: 'none',
        }}
        onPointerDown={begin}
        onPointerUp={reset}
        onPointerLeave={reset}
        onPointerCancel={reset}
        onKeyDown={onKeyDown}
        onKeyUp={reset}
        onContextMenu={(e) => e.preventDefault()}
        onBlur={reset}
      >
        <span
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            width: `${pct}%`,
            background: 'var(--primary)',
            transition: 'none',
          }}
        />
        <span style={{ position: 'relative', color: phase === 'idle' ? 'var(--text)' : 'var(--on-primary)' }}>
          {showName ? t('draw.release_to_hide') : phase === 'holding' ? t('draw.keep_holding') : t('draw.press_hold')}
        </span>
      </button>
    </div>
  );
}
