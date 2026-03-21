import { cn } from '@shared/utils/cn'
import type { ItemsSubPhase, SimpleWizardStep } from '@pages/types'

const STEP_ORDER: SimpleWizardStep[] = ['people', 'receipt', 'items', 'final']
const STEP_LABELS: Record<SimpleWizardStep, string> = {
  people: 'People',
  receipt: 'Receipt',
  items: 'Assign',
  final: 'Summary',
}

interface Props {
  activeStep: SimpleWizardStep
  itemsSubPhase: ItemsSubPhase
  assignedItemCount: number
  detectedItemsCount: number
}

export function TopAppBar({ activeStep, itemsSubPhase, assignedItemCount, detectedItemsCount }: Props) {
  const stepIndex = STEP_ORDER.indexOf(activeStep)
  const stepNumber = stepIndex + 1
  const trackFillPercent = (stepNumber / STEP_ORDER.length) * 100

  let contextText = ''
  if (activeStep === 'items') {
    contextText = itemsSubPhase === 'assign'
      ? `${assignedItemCount} of ${detectedItemsCount} items assigned`
      : 'Reviewing'
  }

  return (
    <header className="bg-surface/80 backdrop-blur-md sticky top-0 z-40 border-b border-surface-container-highest">
      <div className="flex items-center w-full px-6 md:px-8 py-4 max-w-7xl mx-auto gap-6">
        {/* Logo */}
        <div className="text-2xl font-bold text-primary tracking-tight font-headline shrink-0">Split</div>

        {/* Desktop: connected step circles */}
        <nav className="hidden md:flex items-center flex-1 justify-center">
          {STEP_ORDER.map((step, i) => {
            const completed = i < stepIndex
            const isCurrent = step === activeStep
            return (
              <div key={step} className="flex items-center">
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={cn(
                      'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all',
                      completed ? 'bg-secondary text-on-secondary' : isCurrent ? 'bg-primary text-on-primary ring-4 ring-primary/10' : 'bg-surface-container-highest text-on-surface-variant',
                    )}
                  >
                    {completed ? (
                      <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>
                    ) : (
                      i + 1
                    )}
                  </div>
                  <span className={cn('text-[9px] font-bold uppercase tracking-widest', completed ? 'text-secondary' : isCurrent ? 'text-primary' : 'text-on-surface-variant')}>
                    {STEP_LABELS[step]}
                  </span>
                </div>
                {i < STEP_ORDER.length - 1 && (
                  <div className={cn('h-0.5 w-12 mx-2 mb-4', completed ? 'bg-secondary' : 'bg-surface-container-highest')} />
                )}
              </div>
            )
          })}
        </nav>

        {/* Right: "STEP X: LABEL" on mobile, step count on desktop */}
        <div data-testid="wizard-step-context" className="ml-auto shrink-0 text-right">
          <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest md:hidden">
            Step {stepNumber}: {STEP_LABELS[activeStep]}
          </p>
          <p className="hidden md:block text-xs font-bold text-primary uppercase tracking-widest">
            Step {stepNumber} of {STEP_ORDER.length}
          </p>
          {contextText && (
            <p className="text-[10px] text-on-surface-variant">{contextText}</p>
          )}
        </div>
      </div>

      {/* Mobile: thin progress bar */}
      <div className="md:hidden h-0.5 bg-surface-container-highest">
        <div
          className="h-full bg-primary transition-all duration-500"
          style={{ width: `${trackFillPercent}%` }}
        />
      </div>
    </header>
  )
}
