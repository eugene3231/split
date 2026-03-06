import type { SimpleWizardStep, WizardProgressContext } from '../types'
import { SIMPLE_WIZARD_STEPS } from '../types'

type WizardProgressHeaderProps = {
  activeStep: SimpleWizardStep
  context: WizardProgressContext
}

export const STEP_CONTENT: Record<SimpleWizardStep, { label: string; description: string }> = {
  people: {
    label: 'Add People',
    description: 'The oweing parties.',
  },
  receipt: {
    label: 'Add Receipt',
    description: 'Import line items and other charges using Gemini.',
  },
  items: {
    label: 'Assign Items',
    description: 'Pick who shares each item.',
  },
  final: {
    label: 'Split Result',
    description: 'Check final amounts, then share the split result.',
  },
}

export function WizardProgressHeader({ activeStep, context }: WizardProgressHeaderProps) {
  const activeStepIndex = SIMPLE_WIZARD_STEPS.indexOf(activeStep)

  return (
    <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/95 p-4 backdrop-blur">
      <div className="grid gap-2 sm:grid-cols-4">
        {SIMPLE_WIZARD_STEPS.map((step, index) => {
          const state = index < activeStepIndex ? 'completed' : index === activeStepIndex ? 'active' : 'pending'

          return (
            <div
              key={step}
              className={[
                'rounded-lg border px-3 py-2 text-xs',
                state === 'active' ? 'border-sky-400 bg-sky-500/10 text-sky-200' : '',
                state === 'completed' ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200' : '',
                state === 'pending' ? 'border-slate-700 bg-slate-950/60 text-slate-400' : '',
              ].join(' ')}
            >
              <p className="font-semibold">{index + 1}. {STEP_CONTENT[step].label}</p>
              <p className="mt-1 text-[11px] leading-snug">{STEP_CONTENT[step].description}</p>
            </div>
          )
        })}
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-300" data-testid="wizard-step-context">
        {buildContextText(activeStep, context)}
      </div>
    </section>
  )
}

function buildContextText(step: SimpleWizardStep, context: WizardProgressContext): string {
  if (step === 'receipt') {
    return `Step 2 of 4 • Scan + Verify • Detected ${context.detectedItemsCount} item(s)`
  }

  if (step === 'items') {
    const itemNumber = context.detectedItemsCount === 0 ? 0 : Math.min(context.activeItemIndex + 1, context.detectedItemsCount)
    return `Step 3 of 4 • Assign Items • Item ${itemNumber}/${context.detectedItemsCount} • Assigned ${context.assignedItemCount}/${context.detectedItemsCount}`
  }

  if (step === 'final') {
    return `Step 4 of 4 • Final • ${context.detectedItemsCount}/${context.detectedItemsCount} complete`
  }

  return 'Step 1 of 4 • Add the people involved in this receipt split'
}
