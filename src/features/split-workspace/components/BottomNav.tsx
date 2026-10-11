import { useLayoutEffect, useState, type ReactNode } from 'react';
import { cn } from '@shared/utils/cn';
import type { WizardStep } from '@features/split-workspace/types';

interface Props {
  activeStep: WizardStep;
  continueLabel: string;
  canContinue: boolean;
  onBack: () => void;
  onNext: () => void;
  status?: ReactNode;
}

function getVisualViewportBottomInset() {
  const viewport = window.visualViewport;

  if (!viewport) {
    return 0;
  }

  return Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop));
}

function useVisualViewportBottomInset() {
  const [bottomInset, setBottomInset] = useState(0);

  useLayoutEffect(() => {
    let frameId = 0;

    const applyBottomInset = () => {
      setBottomInset(getVisualViewportBottomInset());
    };

    const updateBottomInset = () => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(applyBottomInset);
    };

    applyBottomInset();
    updateBottomInset();

    window.visualViewport?.addEventListener('resize', updateBottomInset);
    window.visualViewport?.addEventListener('scroll', updateBottomInset);
    window.addEventListener('resize', updateBottomInset);
    window.addEventListener('scroll', updateBottomInset, { passive: true });
    window.addEventListener('orientationchange', updateBottomInset);

    return () => {
      cancelAnimationFrame(frameId);
      window.visualViewport?.removeEventListener('resize', updateBottomInset);
      window.visualViewport?.removeEventListener('scroll', updateBottomInset);
      window.removeEventListener('resize', updateBottomInset);
      window.removeEventListener('scroll', updateBottomInset);
      window.removeEventListener('orientationchange', updateBottomInset);
    };
  }, []);

  return bottomInset;
}

export function BottomNav({
  activeStep,
  continueLabel,
  canContinue,
  onBack,
  onNext,
  status,
}: Props) {
  const isFirstStep = activeStep === 'people';
  const isFinalStep = activeStep === 'final';
  const bottomInset = useVisualViewportBottomInset();

  return (
    <footer
      className="sticky bottom-0 z-50 w-full px-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-8"
      style={{ bottom: bottomInset }}
    >
      <div
        className={cn(
          'mx-auto flex max-w-3xl items-center gap-2 rounded-3xl bg-primary p-2 text-on-primary shadow-2xl shadow-black/20 md:gap-3',
          isFinalStep && 'ml-0 w-fit md:mx-auto',
        )}
      >
        {!isFirstStep && (
          <button
            type="button"
            data-testid="wizard-back-btn"
            aria-label="Back"
            onClick={onBack}
            className="flex shrink-0 items-center gap-1.5 rounded-2xl px-3 py-3 text-sm font-semibold text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <span className="material-symbols-outlined text-xl">arrow_back</span>
            <span className={cn(!isFinalStep && 'hidden md:inline')}>Back</span>
          </button>
        )}

        {!isFinalStep && (
          <>
            <div className="flex min-w-0 flex-1 flex-col justify-center pl-1 md:pl-3">{status}</div>
            <button
              type="button"
              data-testid="wizard-continue-btn"
              onClick={onNext}
              disabled={!canContinue}
              className={cn(
                'flex max-w-[60%] shrink-0 items-center justify-center gap-1 rounded-2xl px-5 py-3 text-sm font-bold transition-all active:scale-95',
                canContinue
                  ? 'bg-white text-primary'
                  : 'cursor-not-allowed bg-white/15 text-white/50',
              )}
            >
              <span key={continueLabel} className="block truncate motion-safe:animate-nudge">
                {continueLabel}
              </span>
              <span className="material-symbols-outlined text-lg">arrow_forward</span>
            </button>
          </>
        )}
      </div>
    </footer>
  );
}

interface BottomNavStatusProps {
  label: string;
  value: ReactNode;
  className?: string;
}

export function BottomNavStatus({ label, value, className }: BottomNavStatusProps) {
  return (
    <div data-testid="wizard-status" className={cn('min-w-0', className)}>
      <p className="truncate text-xs text-white/60">{label}</p>
      <p className="truncate text-xl leading-tight font-extrabold tabular-nums">{value}</p>
    </div>
  );
}
