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

/** Laid out like `ClaimItemRow`, so switching modes leaves every name and price where it was.
 *  An open row drops its claimant line, since its chips already show who has it. */
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
        'scroll-mt-[calc(var(--app-bar-height)+4rem)] scroll-mb-32 py-2 transition-colors',
        isOpen && '-mx-3 rounded-2xl border-transparent bg-surface-container-lowest px-3 shadow-sm',
      )}
    >
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        data-testid={`item-claim-toggle-${item.id}`}
        onClick={onToggleOpen}
        className="group block w-full cursor-pointer text-left"
      >
        <span className="flex min-h-11 items-center gap-3">
          <span
            aria-hidden
            className={cn(
              'material-symbols-outlined flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-on-surface-variant group-hover:text-on-surface motion-safe:transition-transform',
              !isOpen && '-rotate-90',
            )}
          >
            expand_more
          </span>
          <span className="min-w-0 flex-1 font-semibold break-words">{item.name}</span>
          <span className="flex shrink-0 justify-end text-on-surface-variant tabular-nums md:w-28">
            {item.priceLabel}
          </span>
        </span>
        {!isOpen && (
          <span className="flex h-9 items-center pl-9">
            <ClaimantAvatars
              claimants={item.claimants}
              leftLabel={item.leftLabel}
              testId={`item-claim-claimants-${item.id}`}
            />
            {item.claimants.length === 0 && (
              <span className="text-xs font-semibold text-warning">Nobody yet</span>
            )}
          </span>
        )}
      </button>
      {isOpen && (
        <div id={panelId} className="pt-1 pb-1">
          <div
            role="group"
            aria-label={`Who had ${item.name}`}
            className="grid grid-cols-2 gap-2 motion-safe:animate-rise-in sm:grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))]"
          >
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
          <div className="mt-3 flex gap-2">
            <EveryoneButton
              pressed={item.isSplitEvenly}
              testId={`item-claim-everyone-${item.id}`}
              onClick={() =>
                onCommand({
                  type: 'split-evenly',
                  personIds: item.isSplitEvenly ? [] : item.chips.map((chip) => chip.person.id),
                })
              }
            />
            <button
              type="button"
              data-testid={`item-claim-next-${item.id}`}
              onClick={onNext}
              className="h-11 flex-1 rounded-full bg-primary text-sm font-bold text-on-primary transition-opacity hover:opacity-90"
            >
              {hasNext ? 'Next item' : 'Done'}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

interface EveryoneButtonProps {
  pressed: boolean;
  testId: string;
  onClick: () => void;
}

function EveryoneButton({ pressed, testId, onClick }: EveryoneButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      data-testid={testId}
      onClick={onClick}
      className={cn(
        'flex h-11 shrink-0 items-center gap-1.5 rounded-full border-2 px-4 text-sm font-bold transition-colors',
        pressed
          ? 'border-primary bg-surface-container-high text-on-surface'
          : 'border-outline-variant text-on-surface-variant hover:text-on-surface',
      )}
    >
      <span aria-hidden className="material-symbols-outlined text-lg">
        {pressed ? 'check' : 'groups'}
      </span>
      Everyone
    </button>
  );
}
