import type { PersonShare, ShareStep } from '@features/split-workspace/logic/itemShare';

interface Props {
  share: PersonShare;
  onStep: (step: ShareStep) => void;
  testId: string;
}

/** Fixed width so the steppers and prices line up down the list, whatever the label. */
export function ShareStepper({ share, onStep, testId }: Props) {
  return (
    <span className="flex h-8 w-22 shrink-0 items-center rounded-full bg-surface-container">
      <StepButton
        icon="remove"
        label="Take a smaller share"
        disabled={!share.canDecrease}
        onClick={() => onStep('decrease')}
        testId={`${testId}-decrease`}
      />
      <span data-testid={testId} className="flex-1 text-center text-sm font-bold tabular-nums">
        <span className="sr-only">Your share: </span>
        {share.label}
      </span>
      <StepButton
        icon="add"
        label="Take a bigger share"
        disabled={!share.canIncrease}
        onClick={() => onStep('increase')}
        testId={`${testId}-increase`}
      />
    </span>
  );
}

interface StepButtonProps {
  icon: 'add' | 'remove';
  label: string;
  disabled: boolean;
  onClick: () => void;
  testId: string;
}

function StepButton({ icon, label, disabled, onClick, testId }: StepButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      data-testid={testId}
      disabled={disabled}
      onClick={onClick}
      className="flex h-8 w-7 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:text-on-surface disabled:opacity-30"
    >
      <span className="material-symbols-outlined text-base">{icon}</span>
    </button>
  );
}
