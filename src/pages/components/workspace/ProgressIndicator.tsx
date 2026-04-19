import { cn } from '@shared/utils/cn';
import { getStepNumber, isStepCompleted, STEP_LABELS, STEP_ORDER } from '@pages/logic/wizardSteps';
import type { ItemsSubPhase, WizardStep } from '@pages/types';

interface Props {
  activeStep: WizardStep;
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
      <div className="mx-auto mb-10 flex max-w-2xl items-center justify-between">
        {STEP_ORDER.map((step, i) => {
          const completed = isStepCompleted(step, activeStep);
          const isCurrent = step === activeStep;
          return (
            <div key={step} className="flex flex-1 items-center">
              <div className="group flex flex-col items-center gap-2">
                <div
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-full font-bold transition-transform group-hover:scale-105',
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
                    'text-[10px] font-bold tracking-widest uppercase',
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
                    'mx-4 h-0.5 flex-1',
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
      <div className="mb-2 flex items-center justify-between text-on-surface-variant">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
            {stepNumber}
          </span>
          <span className="font-bold text-primary">{STEP_LABELS[activeStep]}</span>
          {contextText && (
            <span className="ml-2 text-xs font-medium text-on-surface-variant">{contextText}</span>
          )}
        </div>
        <span className="text-sm font-medium text-primary">Step {stepNumber} of 4</span>
      </div>
      <div className="h-0.5 overflow-hidden rounded-full bg-surface-container-highest">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${trackFillPercent}%` }}
        />
      </div>
    </div>
  );
}
