interface Props {
  claimed: number;
  total: number;
  color: string;
}

const RADIUS = 9;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function ClaimProgress({ claimed, total, color }: Props) {
  const remaining = total - claimed;
  return (
    <div className="flex items-center gap-2 text-sm font-semibold">
      <svg viewBox="0 0 24 24" className="h-6 w-6 -rotate-90" aria-hidden>
        <circle cx="12" cy="12" r={RADIUS} fill="none" stroke="#0000001a" strokeWidth="3" />
        <circle
          cx="12"
          cy="12"
          r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - claimed / total)}
          className="transition-all duration-300"
        />
      </svg>
      <span>
        {claimed} of {total} claimed
      </span>
      {remaining > 0 && <span className="text-neutral-500">· {remaining} left</span>}
    </div>
  );
}
