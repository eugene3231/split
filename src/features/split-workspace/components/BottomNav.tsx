import { useLayoutEffect, useState } from 'react';
import { cn } from '@shared/utils/cn';
import { getContinueLabel } from '@features/split-workspace/logic/wizardSteps';
import type { ItemsSubPhase, WizardStep } from '@features/split-workspace/types';

interface Props {
  activeStep: WizardStep;
  itemsSubPhase: ItemsSubPhase;
  isLastAssignableItem: boolean;
  canContinue: boolean;
  onBack: () => void;
  onNext: () => void;
  grandTotalFormatted?: string;
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
  itemsSubPhase,
  isLastAssignableItem,
  canContinue,
  onBack,
  onNext,
  grandTotalFormatted,
}: Props) {
  const isFirstStep = activeStep === 'people';
  const isFinalStep = activeStep === 'final';
  const continueLabel = getContinueLabel(activeStep, itemsSubPhase, isLastAssignableItem);
  const continueDisabled = !canContinue && !(activeStep === 'items' && itemsSubPhase === 'assign');
  const bottomInset = useVisualViewportBottomInset();

  if (isFinalStep) {
    return null;
  }

  return (
    <footer
      className="fixed bottom-0 left-0 z-50 w-full bg-bg/95 backdrop-blur-md"
      style={{ bottom: bottomInset }}
    >
      <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3 md:px-8">
        {/* Back */}
        {!isFirstStep ? (
          <button
            type="button"
            data-testid="wizard-back-btn"
            onClick={onBack}
            className="flex items-center gap-1.5 rounded-full px-3 py-2 text-ink2 transition-colors hover:text-ink active:scale-95"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            <span className="font-body text-sm font-medium">Back</span>
          </button>
        ) : (
          <div />
        )}

        {/* Center: grand total (desktop only) */}
        {grandTotalFormatted && (activeStep === 'receipt' || activeStep === 'items') && (
          <div className="hidden items-center gap-2 md:flex">
            <span className="font-body text-xs font-semibold tracking-widest text-ink2 uppercase">
              Total
            </span>
            <span className="font-display text-base font-semibold text-ink">
              {grandTotalFormatted}
            </span>
          </div>
        )}

        {/* Continue */}
        <button
          type="button"
          data-testid="wizard-continue-btn"
          onClick={onNext}
          disabled={continueDisabled}
          className={cn(
            'flex items-center gap-2 rounded-full px-5 py-3 font-body text-sm font-semibold transition-all active:scale-95',
            continueDisabled
              ? 'cursor-not-allowed bg-cream-dim text-ink2 opacity-60'
              : 'bg-ink text-white shadow-sm shadow-ink/20 hover:opacity-90',
          )}
        >
          {continueLabel}
          <span className="material-symbols-outlined text-lg">arrow_forward</span>
        </button>
      </div>
    </footer>
  );
}
