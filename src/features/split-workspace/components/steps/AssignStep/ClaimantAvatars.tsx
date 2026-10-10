import type { ClaimPerson } from '@features/split-workspace/logic/claim';
import { PersonAvatar } from '@features/split-workspace/components/shared/PersonAvatar';
import { HoverLabel } from './HoverLabel';

const MAX_AVATARS = 4;

interface Props {
  claimants: ClaimPerson[];
  leftLabel: string | null;
  testId: string;
}

/** Who has an item, as overlapping avatars named on hover or long press. */
export function ClaimantAvatars({ claimants, leftLabel, testId }: Props) {
  if (claimants.length === 0) return null;

  const shown = claimants.length > MAX_AVATARS ? claimants.slice(0, MAX_AVATARS - 1) : claimants;
  const hidden = claimants.slice(shown.length);
  const names = claimants.map((person) => person.name).join(', ');

  return (
    <span
      role="img"
      aria-label={leftLabel ? `${names}, ${leftLabel}` : names}
      data-testid={testId}
      className="mt-1 flex items-center gap-2"
    >
      <span className="flex -space-x-1">
        {shown.map((person) => (
          <HoverLabel key={person.id} label={person.name}>
            <PersonAvatar
              name={person.name}
              colorIndex={person.colorIndex}
              className="h-5 w-5 text-[10px] ring-2 ring-surface"
            />
          </HoverLabel>
        ))}
        {hidden.length > 0 && (
          <HoverLabel label={hidden.map((person) => person.name).join(', ')}>
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-surface-container-high px-1 text-[10px] font-bold text-on-surface-variant ring-2 ring-surface">
              +{hidden.length}
            </span>
          </HoverLabel>
        )}
      </span>
      {leftLabel && <span className="text-xs text-on-surface-variant">{leftLabel}</span>}
    </span>
  );
}
