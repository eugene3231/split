import type { ItemsSubPhase, SimpleWizardStep } from '../../types'

type Props = {
  activeStep: SimpleWizardStep
  itemsSubPhase: ItemsSubPhase
  canContinue: boolean
  onBack: () => void
  onNext: () => void
}

export function WizardNav({ activeStep, itemsSubPhase, canContinue, onBack, onNext }: Props) {
  const continueLabel =
    activeStep === 'people'
      ? 'Continue →'
      : activeStep === 'receipt'
        ? 'Continue to Assign →'
        : itemsSubPhase === 'assign'
          ? 'Review Items →'
          : 'See Split Result →'

  return (
    <div className="flex items-center justify-between gap-3">
      <button
        type="button"
        data-testid="wizard-back-btn"
        onClick={onBack}
        disabled={activeStep === 'people'}
        className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:border-slate-500 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Back
      </button>

      {activeStep !== 'final' ? (
        <button
          type="button"
          data-testid="wizard-continue-btn"
          onClick={onNext}
          disabled={!canContinue && !(activeStep === 'items' && itemsSubPhase === 'assign')}
          className="rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
        >
          {continueLabel}
        </button>
      ) : null}
    </div>
  )
}
