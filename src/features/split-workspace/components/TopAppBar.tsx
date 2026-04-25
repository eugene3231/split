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
    <header className="sticky top-0 z-40 border-b border-surface-container-highest bg-surface/80 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-6 px-6 py-4 md:px-8">
        {/* Logo */}
        <div className="font-headline shrink-0 text-2xl font-bold tracking-tight text-primary">
          Split
        </div>

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
                          ? 'bg-secondary text-on-secondary'
                          : isCurrent
                            ? 'bg-primary text-on-primary ring-4 ring-primary/10'
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
                          ? 'text-secondary'
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
                      completed ? 'bg-secondary' : 'bg-surface-container-highest',
                    )}
                  />
                )}
              </div>
            );
          })}
        </nav>

        {/* Right: "STEP X: LABEL" on mobile, step count on desktop */}
        <div data-testid="wizard-step-context" className="ml-auto shrink-0 text-right">
          <p className="text-xs font-bold tracking-widest text-on-surface-variant uppercase md:hidden">
            Step {stepNumber}: {STEP_LABELS[activeStep]}
          </p>
          <p className="hidden text-xs font-bold tracking-widest text-primary uppercase md:block">
            Step {stepNumber} of {STEP_ORDER.length}
          </p>
          {contextText && <p className="text-[10px] text-on-surface-variant">{contextText}</p>}
        </div>

        {/* GitHub link */}
        <a
          href="https://github.com/eugene3231/split"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="View source on GitHub"
          className="shrink-0 text-on-surface-variant transition-colors hover:text-primary"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.335-1.755-1.335-1.755-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12z" />
          </svg>
        </a>
      </div>

      {/* Mobile: compact interactive step buttons */}
      <nav
        aria-label="Wizard steps"
        className="border-t border-surface-container-highest px-3 py-2 md:hidden"
      >
        <div className="mx-auto grid max-w-7xl grid-cols-4 gap-1">
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
                className={cn(
                  'flex min-w-0 flex-col items-center gap-1 rounded-xl px-1.5 py-2 transition-all',
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
                        ? 'bg-secondary text-on-secondary'
                        : isCurrent
                          ? 'bg-primary text-on-primary ring-4 ring-primary/10'
                          : 'bg-surface-container-highest text-on-surface-variant',
                  )}
                >
                  {completed ? (
                    <span
                      className="material-symbols-outlined text-[10px]"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      check
                    </span>
                  ) : (
                    i + 1
                  )}
                </span>
                <span
                  className={cn(
                    'truncate text-[9px] font-bold tracking-wider uppercase',
                    disabled
                      ? 'text-on-surface-variant'
                      : completed
                        ? 'text-secondary'
                        : isCurrent
                          ? 'text-primary'
                          : 'text-on-surface-variant',
                  )}
                >
                  {STEP_LABELS[step]}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
