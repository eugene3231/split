import type { SimpleWizardStep, WizardProgressContext } from '../../types'
import { SIMPLE_WIZARD_STEPS } from '../../types'

type WizardProgressHeaderProps = {
  activeStep: SimpleWizardStep
  context: WizardProgressContext
}

const STEP_CONTENT: Record<SimpleWizardStep, { label: string; description: string }> = {
  people: {
    label: 'People',
    description: 'Who is splitting?',
  },
  receipt: {
    label: 'Receipt',
    description: 'Scan with Gemini',
  },
  items: {
    label: 'Assign',
    description: 'Who gets what?',
  },
  final: {
    label: 'Summary',
    description: 'Review & share',
  },
}

export function ProgressHeader({ activeStep, context }: WizardProgressHeaderProps) {
  const activeStepIndex = SIMPLE_WIZARD_STEPS.indexOf(activeStep)

  return (
    <section className="space-y-3 rounded-2xl border border-white/8 bg-slate-900/80 p-4 shadow-lg shadow-black/20 backdrop-blur-sm">
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {SIMPLE_WIZARD_STEPS.map((step, index) => {
          const state = index < activeStepIndex ? 'completed' : index === activeStepIndex ? 'active' : 'pending'

          return (
            <div
              key={step}
              className={[
                'rounded-xl border px-3 py-2.5 transition-all',
                state === 'active'    ? 'border-sky-500/40 bg-sky-500/10'     : '',
                state === 'completed' ? 'border-emerald-500/25 bg-emerald-500/8' : '',
                state === 'pending'   ? 'border-slate-800 bg-slate-900/50'      : '',
              ].join(' ')}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className={[
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold',
                    state === 'active'    ? 'bg-sky-500 text-slate-950'      : '',
                    state === 'completed' ? 'bg-emerald-500 text-emerald-950' : '',
                    state === 'pending'   ? 'bg-slate-800 text-slate-500'      : '',
                  ].join(' ')}
                >
                  {state === 'completed' ? '✓' : index + 1}
                </span>
                <p
                  className={[
                    'text-[11px] font-semibold leading-none',
                    state === 'active'    ? 'text-sky-200'    : '',
                    state === 'completed' ? 'text-emerald-300' : '',
                    state === 'pending'   ? 'text-slate-600'   : '',
                  ].join(' ')}
                >
                  {STEP_CONTENT[step].label}
                </p>
              </div>
              <p
                className={[
                  'mt-1 text-[10px] leading-snug',
                  state === 'active'    ? 'text-sky-300/70'    : '',
                  state === 'completed' ? 'text-emerald-400/60' : '',
                  state === 'pending'   ? 'text-slate-700'      : '',
                ].join(' ')}
              >
                {STEP_CONTENT[step].description}
              </p>
            </div>
          )
        })}
      </div>

      <p
        className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-[11px] text-slate-400"
        data-testid="wizard-step-context"
      >
        {buildContextText(activeStep, context)}
      </p>

    </section>
  )
}

function buildContextText(step: SimpleWizardStep, context: WizardProgressContext): string {
  const stepNumber = SIMPLE_WIZARD_STEPS.indexOf(step) + 1
  const total = SIMPLE_WIZARD_STEPS.length
  const prefix = `Step ${stepNumber} of ${total}`
  const receiptPrefix = context.totalReceipts > 1 ? ` · Receipt ${context.receiptNumber} of ${context.totalReceipts}` : ''

  switch (step) {
    case 'people':
      return `${prefix} · Add everyone splitting this bill`
    case 'receipt': {
      const n = context.detectedItemsCount
      return `${prefix}${receiptPrefix} · Scan + Verify · Found ${n} ${n === 1 ? 'item' : 'items'}`
    }
    case 'items': {
      const itemNumber = context.detectedItemsCount === 0 ? 0 : Math.min(context.activeItemIndex + 1, context.detectedItemsCount)
      return `${prefix}${receiptPrefix} · Item ${itemNumber} of ${context.detectedItemsCount} · ${context.assignedItemCount} assigned so far`
    }
    case 'final':
      return context.totalReceipts > 1
        ? `${prefix} · ${context.totalReceipts} receipts · All items assigned — consolidated split ready`
        : `${prefix} · All ${context.detectedItemsCount} items assigned — split result ready`
  }
}

