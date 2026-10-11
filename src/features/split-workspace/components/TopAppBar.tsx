import type { ReactNode } from 'react';
import { WIZARD_STEPS } from '@features/split-workspace/types';
import { cn } from '@shared/utils/cn';
import type { WizardStep } from '@features/split-workspace/types';
import { STEP_LABELS } from '@features/split-workspace/logic/wizardSteps';

interface Props {
  activeStep: WizardStep;
  stepReachability: Record<WizardStep, boolean>;
  onStepSelect: (step: WizardStep) => void;
  actions?: ReactNode;
}

export function TopAppBar({ activeStep, stepReachability, onStepSelect, actions }: Props) {
  const stepIndex = WIZARD_STEPS.indexOf(activeStep);
  const stepNumber = stepIndex + 1;

  return (
    <header className="sticky top-0 z-40 bg-surface/80 backdrop-blur-md">
      <div className="mx-auto flex h-(--app-bar-height) w-full max-w-7xl items-center gap-3 border-b border-surface-container-highest px-6 md:gap-6 md:px-8">
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
          {WIZARD_STEPS.map((step, i) => {
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
                    'group flex items-center gap-2 rounded-xl px-2 py-1.5 transition-all',
                    disabled
                      ? 'cursor-not-allowed opacity-45'
                      : 'hover:bg-surface-container-low active:scale-95',
                  )}
                >
                  <div
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-all',
                      disabled
                        ? 'bg-surface-container-highest text-on-surface-variant'
                        : completed
                          ? 'bg-primary text-on-primary'
                          : isCurrent
                            ? 'bg-primary text-on-primary ring-4 ring-primary/15 motion-safe:animate-step-pulse'
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
                      'text-sm',
                      isCurrent
                        ? 'font-semibold text-on-surface'
                        : 'font-medium text-on-surface-variant',
                    )}
                  >
                    {STEP_LABELS[step]}
                  </span>
                </button>
                {i < WIZARD_STEPS.length - 1 && (
                  <div
                    className={cn(
                      'mx-1 h-0.5 w-4 lg:w-12',
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
            {WIZARD_STEPS.map((step, i) => {
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
                            ? 'bg-primary text-on-primary ring-4 ring-primary/15 motion-safe:animate-step-pulse'
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
        <div data-testid="wizard-step-context" className="hidden w-44 shrink-0 text-right lg:block">
          <p className="truncate text-xs font-medium text-on-surface-variant">
            Step {stepNumber} of {WIZARD_STEPS.length}
          </p>
        </div>

        {actions}
      </div>
    </header>
  );
}
