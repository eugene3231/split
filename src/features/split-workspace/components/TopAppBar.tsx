import { cn } from '@shared/utils/cn';
import type { ItemsSubPhase, WizardStep } from '@features/split-workspace/types';
import { STEP_LABELS, STEP_ORDER } from '@features/split-workspace/logic/wizardSteps';

interface Props {
  activeStep: WizardStep;
  itemsSubPhase: ItemsSubPhase;
  assignedItemCount: number;
  detectedItemsCount: number;
  stepReachability: Record<WizardStep, boolean>;
  onStepSelect: (step: WizardStep) => void;
}

export function TopAppBar({
  activeStep,
  itemsSubPhase,
  assignedItemCount,
  detectedItemsCount,
  stepReachability,
  onStepSelect,
}: Props) {
  const stepIndex = STEP_ORDER.indexOf(activeStep);
  const stepNumber = stepIndex + 1;

  let contextText = '';
  if (activeStep === 'items') {
    contextText =
      itemsSubPhase === 'assign'
        ? `${assignedItemCount} of ${detectedItemsCount} items assigned`
        : 'Reviewing';
  }

  return (
    <header className="sticky top-0 z-40 bg-surface/80 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-3 border-b border-surface-container-highest px-6 py-3 md:gap-6 md:px-8 md:py-4">
        {/* Logo */}
        <div className="shrink-0 font-headline text-2xl font-bold tracking-tight text-primary">
          Split
        </div>

        {/* TODO: Extract desktop/mobile step navigation into WizardStepNav when this grows again. */}
        {/* Desktop: connected step buttons */}
        <nav
          aria-label="Wizard steps"
          className="hidden flex-1 items-center justify-center md:flex"
        >
          {STEP_ORDER.map((step, i) => {
            const completed = i < stepIndex;
            const isCurrent = step === activeStep;
            const disabled = !stepReachability[step];
            return (
              <div key={step} className="flex items-center">
                <button
                  type="button"
                  data-testid={`wizard-step-nav-${step}`}
                  onClick={() => onStepSelect(step)}
                  disabled={disabled}
                  aria-current={isCurrent ? 'step' : undefined}
                  className={cn(
                    'group flex flex-col items-center gap-1 rounded-xl px-2 py-1 transition-all',
                    disabled
                      ? 'cursor-not-allowed opacity-45'
                      : 'hover:bg-surface-container-low active:scale-95',
                  )}
                >
                  <div
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all',
                      disabled
                        ? 'bg-surface-container-highest text-on-surface-variant'
                        : completed
                          ? 'bg-primary text-on-primary'
                          : isCurrent
                            ? 'bg-primary text-on-primary ring-4 ring-primary/15'
                            : 'bg-surface-container-highest text-on-surface-variant',
                    )}
                  >
                    {completed ? (
                      <span
                        className="material-symbols-outlined text-xs"
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
                      'text-[9px] font-bold tracking-widest uppercase',
                      disabled
                        ? 'text-on-surface-variant'
                        : completed
                          ? 'text-on-surface'
                          : isCurrent
                            ? 'text-primary'
                            : 'text-on-surface-variant',
                    )}
                  >
                    {STEP_LABELS[step]}
                  </span>
                </button>
                {i < STEP_ORDER.length - 1 && (
                  <div
                    className={cn(
                      'mx-2 mb-4 h-0.5 w-12',
                      completed ? 'bg-primary' : 'bg-surface-container-highest',
                    )}
                  />
                )}
              </div>
            );
          })}
        </nav>

        {/* Mobile: compact interactive step buttons */}
        <nav aria-label="Wizard steps" className="ml-auto flex flex-1 justify-end md:hidden">
          <div className="grid grid-cols-4 gap-1">
            {STEP_ORDER.map((step, i) => {
              const completed = i < stepIndex;
              const isCurrent = step === activeStep;
              const disabled = !stepReachability[step];
              return (
                <button
                  key={step}
                  type="button"
                  data-testid={`wizard-step-nav-mobile-${step}`}
                  onClick={() => onStepSelect(step)}
                  disabled={disabled}
                  aria-current={isCurrent ? 'step' : undefined}
                  aria-label={`Step ${i + 1}: ${STEP_LABELS[step]}`}
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-xl transition-all',
                    disabled
                      ? 'cursor-not-allowed opacity-45'
                      : isCurrent
                        ? 'bg-primary/10'
                        : 'active:scale-95',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold transition-all',
                      disabled
                        ? 'bg-surface-container-highest text-on-surface-variant'
                        : completed
                          ? 'bg-primary text-on-primary'
                          : isCurrent
                            ? 'bg-primary text-on-primary ring-4 ring-primary/15'
                            : 'bg-surface-container-highest text-on-surface-variant',
                    )}
                  >
                    {completed ? (
                      <span
                        className="material-symbols-outlined text-[20px]!"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        check
                      </span>
                    ) : (
                      i + 1
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Right: step count on desktop */}
        <div data-testid="wizard-step-context" className="hidden w-44 shrink-0 text-right md:block">
          <p className="truncate text-xs font-bold tracking-widest text-primary uppercase">
            Step {stepNumber} of {STEP_ORDER.length}
          </p>
          {contextText && (
            <p className="truncate text-[10px] text-on-surface-variant">{contextText}</p>
          )}
        </div>
      </div>
    </header>
  );
}
