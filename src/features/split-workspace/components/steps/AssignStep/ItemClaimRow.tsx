import type { AssignmentCommand } from '@features/split-workspace/logic/assignmentInteraction';
import type { ItemClaim } from '@features/split-workspace/logic/claim';
import { prefersMotion } from '@features/split-workspace/components/shared/motion';
import { cn } from '@shared/utils/cn';
import { ClaimantAvatars } from './ClaimantAvatars';
import { PersonChip } from './PersonChip';

interface Props {
  item: ItemClaim;
  isOpen: boolean;
  scrollOnOpen: boolean;
  hasNext: boolean;
  onToggleOpen: () => void;
  onNext: () => void;
  onCommand: (command: AssignmentCommand) => void;
}

function scrollRowIntoView(element: HTMLLIElement | null) {
  element?.scrollIntoView?.({ behavior: prefersMotion() ? 'smooth' : 'auto', block: 'nearest' });
}

export function ItemClaimRow({
  item,
  isOpen,
  scrollOnOpen,
  hasNext,
  onToggleOpen,
  onNext,
  onCommand,
}: Props) {
  const panelId = `item-claim-people-${item.id}`;

  return (
    <li
      ref={scrollOnOpen ? scrollRowIntoView : undefined}
      data-testid={`item-claim-${item.id}`}
      className={cn(
        'scroll-mt-[calc(var(--app-bar-height)+4rem)] scroll-mb-32 transition-colors',
        isOpen &&
          '-mx-3 my-2 rounded-2xl border-transparent bg-surface-container-lowest px-3 shadow-sm',
      )}
    >
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        data-testid={`item-claim-toggle-${item.id}`}
        onClick={onToggleOpen}
        className="flex min-h-14 w-full items-center gap-3 py-2 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block font-semibold break-words">{item.name}</span>
          <span className="mt-1 flex min-h-5 items-center">
            <ClaimantAvatars
              claimants={item.claimants}
              leftLabel={item.leftLabel}
              testId={`item-claim-claimants-${item.id}`}
            />
            {item.claimants.length === 0 && (
              <span className="text-xs font-semibold text-warning">Nobody yet</span>
            )}
          </span>
        </span>
        <span className="shrink-0 text-on-surface-variant tabular-nums">{item.priceLabel}</span>
      </button>
      {isOpen && (
        <div id={panelId} className="pb-3">
          <div
            role="group"
            aria-label={`Who had ${item.name}`}
            className="flex flex-wrap gap-2 motion-safe:animate-rise-in"
          >
            <EveryoneChip
              pressed={item.isSplitEvenly}
              testId={`item-claim-everyone-${item.id}`}
              onClick={() =>
                onCommand({
                  type: 'split-evenly',
                  personIds: item.isSplitEvenly ? [] : item.chips.map((chip) => chip.person.id),
                })
              }
            />
            {item.chips.map((chip) => (
              <PersonChip
                key={chip.person.id}
                chip={chip}
                testId={`item-claim-chip-${item.id}-${chip.person.id}`}
                onToggle={() =>
                  onCommand({
                    type: 'toggle-person',
                    personId: chip.person.id,
                    checked: !chip.selected,
                  })
                }
              />
            ))}
          </div>
          {item.hasUnevenShares && (
            <p className="mt-2 text-xs text-on-surface-variant">
              Shares here are uneven. Change them in By person.
            </p>
          )}
          <button
            type="button"
            data-testid={`item-claim-next-${item.id}`}
            onClick={onNext}
            className="mt-3 h-11 w-full rounded-full bg-primary text-sm font-bold text-on-primary transition-opacity hover:opacity-90"
          >
            {hasNext ? 'Next item' : 'Done'}
          </button>
        </div>
      )}
    </li>
  );
}

interface EveryoneChipProps {
  pressed: boolean;
  testId: string;
  onClick: () => void;
}

function EveryoneChip({ pressed, testId, onClick }: EveryoneChipProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      data-testid={testId}
      onClick={onClick}
      className={cn(
        'flex min-h-10 items-center gap-1 rounded-full border-2 px-3 text-sm font-semibold transition-colors',
        pressed
          ? 'border-primary bg-primary text-on-primary'
          : 'border-dashed border-outline-variant text-on-surface-variant hover:text-on-surface',
      )}
    >
      <span aria-hidden className="material-symbols-outlined text-base">
        groups
      </span>
      Everyone
    </button>
  );
}
