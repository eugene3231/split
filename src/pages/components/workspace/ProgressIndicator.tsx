import { cn } from '@shared/utils/cn';
import { getStepNumber, isStepCompleted, STEP_LABELS, STEP_ORDER } from '@pages/logic/wizardSteps';
import type { ItemsSubPhase, SimpleWizardStep } from '@pages/types';

interface Props {
  activeStep: SimpleWizardStep;
  itemsSubPhase: ItemsSubPhase;
  assignedItemCount: number;
  detectedItemsCount: number;
}

export function ProgressIndicator({
  activeStep,
  itemsSubPhase,
  assignedItemCount,
  detectedItemsCount,
}: Props) {
  // Final step shows the 4-circle connected stepper
  if (activeStep === 'final') {
    return (
      <div className="mb-10 flex items-center justify-between max-w-2xl mx-auto">
        {STEP_ORDER.map((step, i) => {
          const completed = isStepCompleted(step, activeStep);
          const isCurrent = step === activeStep;
          return (
            <div key={step} className="flex items-center flex-1">
              <div className="flex flex-col items-center gap-2 group">
                <div
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center font-bold transition-transform group-hover:scale-105',
                    completed
                      ? 'bg-secondary text-on-secondary'
                      : isCurrent
                        ? 'bg-primary text-on-primary ring-4 ring-primary/10'
                        : 'bg-surface-container-highest text-on-surface-variant',
                  )}
                >
                  {completed ? (
                    <span
                      className="material-symbols-outlined text-sm"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      check
                    </span>
                  ) : (
                    i + 1
                  )}
                </div>
                <span
                  className={cn(
                    'text-[10px] font-bold uppercase tracking-widest',
                    completed
                      ? 'text-secondary'
                      : isCurrent
                        ? 'text-primary'
                        : 'text-on-surface-variant',
                  )}
                >
                  {STEP_LABELS[step]}
                </span>
              </div>
              {i < STEP_ORDER.length - 1 && (
                <div
                  className={cn(
                    'h-0.5 flex-1 mx-4',
                    completed ? 'bg-secondary' : 'bg-surface-container-highest',
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // Steps 1-3: circle + label + track bar + "Step X of 4"
  const stepNumber = getStepNumber(activeStep);
  const trackFillPercent = (stepNumber / 4) * 100;

  let contextText = '';
  if (activeStep === 'items') {
    if (itemsSubPhase === 'assign') {
      contextText = `${assignedItemCount} of ${detectedItemsCount} items assigned`;
    } else {
      contextText = 'Reviewing assignments';
    }
  }

  return (
    <div className="mb-10">
      <div className="flex items-center justify-between text-on-surface-variant mb-2">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm">
            {stepNumber}
          </span>
          <span className="font-bold text-primary">{STEP_LABELS[activeStep]}</span>
          {contextText && (
            <span className="text-xs font-medium text-on-surface-variant ml-2">{contextText}</span>
          )}
        </div>
        <span className="text-sm font-medium text-primary">Step {stepNumber} of 4</span>
      </div>
      <div className="h-0.5 bg-surface-container-highest rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-500"
          style={{ width: `${trackFillPercent}%` }}
        />
      </div>
    </div>
  );
}
