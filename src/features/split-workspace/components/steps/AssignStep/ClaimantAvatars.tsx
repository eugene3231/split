import type { ClaimPerson } from '@features/split-workspace/logic/claim';
import { PersonAvatar } from '@features/split-workspace/components/shared/PersonAvatar';
import { HoverLabel } from '@features/split-workspace/components/shared/HoverLabel';
import { ExitingClaimantAvatar } from './ExitingClaimantAvatar';
import { useClaimantPresence } from './useClaimantPresence';
import { cn } from '@shared/utils/cn';

const MAX_AVATARS = 4;

interface Props {
  claimants: ClaimPerson[];
  leftLabel: string | null;
  testId: string;
}

/** Who has an item, as overlapping avatars named on hover or long press. */
export function ClaimantAvatars({ claimants, leftLabel, testId }: Props) {
  const { visible, avatars, finishExit } = useClaimantPresence(claimants, MAX_AVATARS);
  if (claimants.length === 0 && avatars.length === 0) return null;

  const hidden = claimants.slice(visible.length);
  const names = claimants.map((person) => person.name).join(', ');

  return (
    <span
      role="img"
      aria-hidden={claimants.length === 0 || undefined}
      aria-label={leftLabel ? `${names}, ${leftLabel}` : names}
      data-testid={testId}
      className="flex min-w-0 items-center gap-1"
    >
      <span className="flex shrink-0 -space-x-1">
        {avatars.map(({ person, isExiting }) => (
          <span
            key={person.id}
            aria-hidden={isExiting || undefined}
            data-testid={isExiting ? `claim-avatar-exiting-${person.id}` : undefined}
            className={cn('flex', isExiting && 'pointer-events-none motion-safe:animate-pop-out')}
          >
            {isExiting ? (
              <ExitingClaimantAvatar person={person} onExit={finishExit} />
            ) : (
              <HoverLabel label={person.name} showOnTap>
                <PersonAvatar
                  name={person.name}
                  colorIndex={person.colorIndex}
                  className="h-5 w-5 text-[10px] ring-2 ring-surface motion-safe:animate-pop-in"
                />
              </HoverLabel>
            )}
          </span>
        ))}
        {hidden.length > 0 && (
          <HoverLabel label={hidden.map((person) => person.name).join(', ')} showOnTap>
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-surface-container-high px-1 text-[10px] font-bold text-on-surface-variant ring-2 ring-surface">
              +{hidden.length}
            </span>
          </HoverLabel>
        )}
      </span>
    </span>
  );
}
