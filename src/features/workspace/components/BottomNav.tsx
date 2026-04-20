import { cn } from '@shared/utils/cn';
import { getContinueLabel } from '@features/workspace/logic/wizardSteps';
import type { ItemsSubPhase, WizardStep } from '@features/workspace/types';

interface Props {
  activeStep: WizardStep;
  itemsSubPhase: ItemsSubPhase;
  isLastAssignableItem: boolean;
  canContinue: boolean;
  onBack: () => void;
  onNext: () => void;
  grandTotalFormatted?: string;
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
  const isSummaryStep = activeStep === 'items' && itemsSubPhase === 'review';
  const continueLabel = getContinueLabel(activeStep, itemsSubPhase, isLastAssignableItem);
  const continueDisabled = !canContinue && !(activeStep === 'items' && itemsSubPhase === 'assign');

  return (
    <footer className="fixed bottom-0 left-0 z-50 w-full border-t border-surface-container-highest bg-surface/90 shadow-[0_-8px_24px_rgba(25,28,29,0.06)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3 md:px-10">
        {/* Back */}
        {!isFirstStep && (
          <button
            type="button"
            data-testid="wizard-back-btn"
            onClick={onBack}
            disabled={isFirstStep}
            className={cn(
              'flex items-center gap-2 rounded-xl px-3 py-2 text-on-surface-variant transition-all hover:bg-surface-container-low',
              isFirstStep && 'pointer-events-none cursor-not-allowed opacity-40',
            )}
          >
            <span className="material-symbols-outlined text-xl">arrow_back</span>
            <span className="font-label text-xs font-bold tracking-widest uppercase">Back</span>
          </button>
        )}

        {/* Center: grand total or context hint */}
        <div className="flex flex-col items-center">
          {grandTotalFormatted && (activeStep === 'receipt' || activeStep === 'items') ? (
            <div className="hidden items-center gap-2 md:flex">
              <span className="text-xs font-extrabold tracking-widest text-on-surface-variant uppercase">
                Grand Total
              </span>
              <span className="font-headline text-base font-extrabold text-primary">
                {grandTotalFormatted}
              </span>
            </div>
          ) : isFirstStep ? (
            <p className="hidden text-xs font-semibold tracking-wide text-primary md:block">
              Add at least one person to continue
            </p>
          ) : null}
        </div>

        {/* Final step actions / Continue */}
        {isFinalStep ? null : (
          <button
            type="button"
            data-testid="wizard-continue-btn"
            onClick={onNext}
            disabled={continueDisabled}
            className={cn(
              'flex items-center gap-2 rounded-xl px-5 py-2 shadow-md transition-all active:scale-95',
              continueDisabled
                ? 'cursor-not-allowed bg-surface-container-high text-on-surface-variant opacity-60'
                : isSummaryStep
                  ? 'bg-gradient-to-br from-primary to-primary-container text-on-primary shadow-primary/20'
                  : 'bg-white text-neutral-900 shadow-black/10',
            )}
          >
            <span className="font-label text-xs font-bold tracking-wider uppercase">
              {continueLabel}
            </span>
            <span className="material-symbols-outlined text-xl transition-transform group-hover:translate-x-1">
              arrow_forward
            </span>
          </button>
        )}
      </div>
    </footer>
  );
}
