import { useLayoutEffect, useRef } from 'react';
import { formatCurrencyFromCents } from '@shared/logic/core/money';
import { prefersMotion } from './motion';

const DURATION_MS = 400;

interface Props {
  cents: number;
  currency: string;
  className?: string;
}

/** An amount that counts from its last value to the new one instead of jumping. */
export function CountUpAmount({ cents, currency, className }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const shownCents = useRef(cents);

  // Layout effect, so the old amount is back in place before the browser paints the new one.
  useLayoutEffect(() => {
    // React owns this text node and resets it on every render; only its value is animated here.
    const text = ref.current?.firstChild;
    const from = shownCents.current;
    if (!text || from === cents || !prefersMotion()) {
      shownCents.current = cents;
      return;
    }

    text.nodeValue = formatCurrencyFromCents(from, currency);
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / DURATION_MS);
      const eased = 1 - (1 - progress) ** 3;
      shownCents.current = Math.round(from + (cents - from) * eased);
      text.nodeValue = formatCurrencyFromCents(shownCents.current, currency);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
  }, [cents, currency]);

  return (
    <span ref={ref} className={className}>
      {formatCurrencyFromCents(cents, currency)}
    </span>
  );
}
