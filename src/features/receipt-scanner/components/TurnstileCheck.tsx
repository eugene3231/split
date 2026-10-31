import { useEffect, useRef } from 'react';
import { ScanError } from '@features/receipt-scanner/logic/scanError';
import { loadTurnstile } from '@features/receipt-scanner/api/turnstileScript';
import { useTurnstileStore } from '@features/receipt-scanner/stores/turnstileStore';

export function TurnstileCheck() {
  const pending = useTurnstileStore((state) => state.pending);
  if (!pending) return null;

  return (
    <div className="space-y-2" data-testid="turnstile-check">
      <p className="text-xs text-on-surface-variant">Checking this device is not a bot…</p>
      <TurnstileWidget resolve={pending.resolve} reject={pending.reject} />
    </div>
  );
}

interface TurnstileWidgetProps {
  resolve: (token: string) => void;
  reject: (error: ScanError) => void;
}

function TurnstileWidget({ resolve, reject }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
    if (!container) return;
    if (!siteKey) {
      reject(new ScanError('misconfigured'));
      return;
    }

    let widgetId: string | null = null;
    let cancelled = false;
    loadTurnstile().then(
      (turnstile) => {
        if (cancelled) return;
        widgetId = turnstile.render(container, {
          sitekey: siteKey,
          callback: resolve,
          'error-callback': () => reject(new ScanError('bot-check-failed')),
        });
      },
      () => {
        if (!cancelled) reject(new ScanError('bot-check-failed'));
      },
    );

    return () => {
      cancelled = true;
      if (widgetId !== null) window.turnstile?.remove(widgetId);
    };
  }, [resolve, reject]);

  return <div ref={containerRef} className="min-h-[65px]" />;
}
