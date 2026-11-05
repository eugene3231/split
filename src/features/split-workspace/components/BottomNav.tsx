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
  /** On the summary, the step renders its own primary action into this element. */
  finalActionRef?: (element: HTMLDivElement | null) => void;
  /** The step has a sidebar from xl, so the bar centres on the main column instead of the page. */
  besideRail?: boolean;
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
  finalActionRef,
  besideRail = false,
}: Props) {
  const isFirstStep = activeStep === 'people';
  const isFinalStep = activeStep === 'final';
  const bottomInset = useVisualViewportBottomInset();

  return (
    <footer
      className="sticky bottom-0 z-50 w-full px-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-8"
      style={{ bottom: bottomInset }}
    >
      <div className={cn('mx-auto max-w-7xl', besideRail && 'xl:grid xl:grid-cols-12 xl:gap-8')}>
        <div
          className={cn(
            'mx-auto flex max-w-3xl items-center gap-2 rounded-3xl bg-primary p-2 text-on-primary shadow-[0_12px_32px_-8px_rgba(23,28,39,0.45)] md:gap-3',
            isFinalStep && 'w-fit',
            besideRail && 'xl:col-span-8 xl:w-full',
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
              <span className="hidden md:inline">Back</span>
            </button>
          )}

          {isFinalStep ? (
            <div ref={finalActionRef} className="contents" />
          ) : (
            <div
              data-testid="wizard-status"
              className={cn(
                'flex min-h-12 min-w-0 flex-1 flex-col justify-center pl-1 md:pl-3',
                isFirstStep && 'pl-3',
              )}
            >
              {status}
            </div>
          )}
          {!isFinalStep && (
            <>
              <button
                type="button"
                data-testid="wizard-continue-btn"
                onClick={onNext}
                disabled={!canContinue}
                className={cn(
                  'flex max-w-[60%] shrink-0 items-center justify-center gap-1 rounded-2xl px-5 py-3 text-sm font-semibold transition-all active:scale-95',
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
      </div>
    </footer>
  );
}

interface BottomNavStatusProps {
  label: ReactNode;
  value: ReactNode;
  className?: string;
}

export function BottomNavStatus({ label, value, className }: BottomNavStatusProps) {
  return (
    <div className={cn('min-w-0', className)}>
      <p aria-live="polite" className="h-4 truncate text-xs text-white/60">
        {label}
      </p>
      <p className="truncate font-headline text-xl leading-tight font-bold tabular-nums">{value}</p>
    </div>
  );
}
