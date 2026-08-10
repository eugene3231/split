type InlineStepperProps = {
  weight: number;
  /** What to show in the center readout — defaults to the raw weight, but a
   * variant can pass a computed fraction instead so the stepper doesn't need
   * a separate label next to it. */
  display?: string;
  onDelta: (delta: number) => void;
  /** Defaults to weight<=1 (floor). Pass false when the caller wants minus at
   * the floor to mean something else (e.g. remove the person) instead of a
   * dead button. */
  decrementDisabled?: boolean;
  testId?: string;
};

export function InlineStepper({
  weight,
  display,
  onDelta,
  decrementDisabled,
  testId,
}: InlineStepperProps) {
  return (
    <div
      className="flex items-center gap-1"
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        data-testid={testId ? `${testId}-decrement` : undefined}
        onClick={() => onDelta(-1)}
        disabled={decrementDisabled ?? weight <= 1}
        className="flex h-6 w-6 items-center justify-center rounded-md bg-surface-container text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-30"
      >
        <span className="material-symbols-outlined !text-sm leading-none">remove</span>
      </button>
      <span
        data-testid={testId ? `${testId}-value` : undefined}
        className="font-headline min-w-9 text-center text-base font-extrabold whitespace-nowrap text-secondary"
      >
        {display ?? weight}
      </span>
      <button
        type="button"
        data-testid={testId ? `${testId}-increment` : undefined}
        onClick={() => onDelta(1)}
        className="flex h-6 w-6 items-center justify-center rounded-md bg-surface-container text-on-surface transition-colors hover:bg-surface-container-high"
      >
        <span className="material-symbols-outlined !text-sm leading-none">add</span>
      </button>
    </div>
  );
}
