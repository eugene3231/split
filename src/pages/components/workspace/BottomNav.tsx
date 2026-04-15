import { cn } from '@shared/utils/cn';
import type { ItemsSubPhase, SimpleWizardStep } from '@pages/types';

interface Props {
  activeStep: SimpleWizardStep;
  itemsSubPhase: ItemsSubPhase;
  isLastAssignableItem: boolean;
  canContinue: boolean;
  onBack: () => void;
  onNext: () => void;
  grandTotalFormatted?: string;
}

function getContinueLabel(
  activeStep: SimpleWizardStep,
  itemsSubPhase: ItemsSubPhase,
  isLastAssignableItem: boolean,
): string {
  if (activeStep === 'people') return 'Add Receipts';
  if (activeStep === 'receipt') return 'Assign Items';
  if (activeStep === 'items' && itemsSubPhase === 'assign')
    return isLastAssignableItem ? 'Review Items' : 'Next Item';
  return 'Summary';
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
    <footer className="fixed bottom-0 left-0 w-full z-50 bg-surface/90 backdrop-blur-xl border-t border-surface-container-highest shadow-[0_-8px_24px_rgba(25,28,29,0.06)]">
      <div className="flex justify-between items-center px-6 md:px-10 py-3 max-w-7xl mx-auto">
        {/* Back */}
        {!isFirstStep && (
          <button
            type="button"
            data-testid="wizard-back-btn"
            onClick={onBack}
            disabled={isFirstStep}
            className={cn(
              'flex items-center gap-2 text-on-surface-variant px-3 py-2 hover:bg-surface-container-low rounded-xl transition-all',
              isFirstStep && 'opacity-40 cursor-not-allowed pointer-events-none',
            )}
          >
            <span className="material-symbols-outlined text-xl">arrow_back</span>
            <span className="text-xs font-bold tracking-widest font-label uppercase">Back</span>
          </button>
        )}

        {/* Center: grand total or context hint */}
        <div className="flex flex-col items-center">
          {grandTotalFormatted && (activeStep === 'receipt' || activeStep === 'items') ? (
            <div className="hidden md:flex items-center gap-2">
              <span className="text-xs font-extrabold text-on-surface-variant uppercase tracking-widest">
                Grand Total
              </span>
              <span className="text-base font-extrabold font-headline text-primary">
                {grandTotalFormatted}
              </span>
            </div>
          ) : isFirstStep ? (
            <p className="hidden md:block text-primary text-xs font-semibold tracking-wide">
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
              'flex items-center gap-2 rounded-xl px-5 py-2 active:scale-95 transition-all shadow-md',
              continueDisabled
                ? 'bg-surface-container-high text-on-surface-variant cursor-not-allowed opacity-60'
                : isSummaryStep
                  ? 'bg-gradient-to-br from-primary to-primary-container text-on-primary shadow-primary/20'
                  : 'bg-white text-neutral-900 shadow-black/10',
            )}
          >
            <span className="text-xs font-label uppercase tracking-wider font-bold">
              {continueLabel}
            </span>
            <span className="material-symbols-outlined text-xl group-hover:translate-x-1 transition-transform">
              arrow_forward
            </span>
          </button>
        )}
      </div>
    </footer>
  );
}
