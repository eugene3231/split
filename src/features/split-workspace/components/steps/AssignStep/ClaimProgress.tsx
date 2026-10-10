import type { ClaimProgress as ClaimProgressValue } from '@features/split-workspace/logic/claim';

const RADIUS = 9;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function ClaimProgress({ claimed, total, remaining }: ClaimProgressValue) {
  const fraction = total > 0 ? claimed / total : 0;

  return (
    <div data-testid="claim-progress" className="flex items-center gap-2 text-sm font-semibold">
      <svg viewBox="0 0 24 24" className="h-6 w-6 -rotate-90" aria-hidden>
        <circle
          cx="12"
          cy="12"
          r={RADIUS}
          fill="none"
          className="stroke-outline-variant"
          strokeWidth="3"
        />
        <circle
          cx="12"
          cy="12"
          r={RADIUS}
          fill="none"
          className="stroke-primary transition-all duration-300"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
        />
      </svg>
      <span>
        {claimed} of {total} claimed
      </span>
      {remaining > 0 ? (
        <span className="font-medium text-on-surface-variant">· {remaining} left</span>
      ) : (
        <span className="font-medium text-on-surface-variant">· all done</span>
      )}
    </div>
  );
}
