import { cn } from '@shared/utils/cn';
import type { ItemsSubPhase, WizardStep } from '@pages/types';

const STEP_ORDER: WizardStep[] = ['people', 'receipt', 'items', 'final'];
const STEP_LABELS: Record<WizardStep, string> = {
  people: 'People',
  receipt: 'Receipt',
  items: 'Assign',
  final: 'Summary',
};

interface Props {
  activeStep: WizardStep;
  itemsSubPhase: ItemsSubPhase;
  assignedItemCount: number;
  detectedItemsCount: number;
}

export function TopAppBar({
  activeStep,
  itemsSubPhase,
  assignedItemCount,
  detectedItemsCount,
}: Props) {
  const stepIndex = STEP_ORDER.indexOf(activeStep);
  const stepNumber = stepIndex + 1;
  const trackFillPercent = (stepNumber / STEP_ORDER.length) * 100;

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

        {/* Desktop: connected step circles */}
        <nav className="hidden flex-1 items-center justify-center md:flex">
          {STEP_ORDER.map((step, i) => {
            const completed = i < stepIndex;
            const isCurrent = step === activeStep;
            return (
              <div key={step} className="flex items-center">
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all',
                      completed
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

      {/* Mobile: thin progress bar */}
      <div className="h-0.5 bg-surface-container-highest md:hidden">
        <div
          className="h-full bg-primary transition-all duration-500"
          style={{ width: `${trackFillPercent}%` }}
        />
      </div>
    </header>
  );
}
