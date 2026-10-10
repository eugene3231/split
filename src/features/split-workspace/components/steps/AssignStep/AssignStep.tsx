import { useState } from 'react';
import type { ReactNode } from 'react';
import { useShallow } from 'zustand/shallow';
import { applyAssignmentCommand } from '@features/split-workspace/logic/assignmentInteraction';
import type { AssignmentCommand } from '@features/split-workspace/logic/assignmentInteraction';
import { formatItemCount, resolveClaimView } from '@features/split-workspace/logic/claim';
import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';
import { useReceiptSplit } from '@features/split-workspace/hooks/useReceiptSplit';
import { BASE_CURRENCY } from '@shared/constants';
import { cn } from '@shared/utils/cn';
import { StepHeader } from '@features/split-workspace/components/shared/StepHeader';
import { ClaimItemRow } from './ClaimItemRow';
import { ClaimPeopleRail } from './ClaimPeopleRail';

interface Props {
  activePersonId: string;
  onActivePersonChange: (personId: string) => void;
}

export function AssignStep({ activePersonId, onActivePersonChange }: Props) {
  const { receipts, people, updateReceiptItem } = useReceiptStore(
    useShallow((state) => ({
      receipts: state.receipts,
      people: state.people,
      updateReceiptItem: state.updateReceiptItem,
    })),
  );
  const { consolidated } = useReceiptSplit();
  const [showLeftOnly, setShowLeftOnly] = useState(false);

  const view = resolveClaimView({
    receipts,
    people,
    activePersonId,
    totalByPersonCents: consolidated.split.totalByPersonCents,
    totalsCurrency: BASE_CURRENCY,
  });
  const filtering = showLeftOnly && view.leftCount > 0;
  const sections = view.sections
    .map((section) => ({
      ...section,
      items: filtering ? section.items.filter((item) => item.isLeft) : section.items,
    }))
    .filter((section) => section.items.length > 0);
  const hasSeveralReceipts = view.sections.length > 1;

  const applyCommand = (receiptId: string, itemId: string, command: AssignmentCommand) =>
    updateReceiptItem(receiptId, itemId, (item) => applyAssignmentCommand(item, command));

  const { activePerson } = view;
  if (!activePerson) {
    return null;
  }

  return (
    <div className="mx-auto max-w-5xl lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-10">
      <div className="min-w-0">
        <header className="-mx-6 -mt-4 bg-surface-container-low px-6 pt-5 pb-6 md:mx-0 md:mt-0 md:rounded-3xl md:px-8 md:pt-6 md:pb-7">
          <p data-testid="claim-person-summary" className="text-sm font-semibold">
            {activePerson.firstName} · {formatItemCount(view.activeItemCount)} ·{' '}
            {activePerson.totalLabel}
          </p>
          <ClaimPeopleRail
            people={view.people}
            onSelect={onActivePersonChange}
            layout="row"
            className="-mx-6 mt-4 overflow-x-auto px-6 pb-1 md:-mx-8 md:px-8 lg:hidden"
          />
          <StepHeader
            title={`What did ${activePerson.firstName} have?`}
            description="Tap everything they had. Shared items split automatically."
            className="mt-6"
          />
          {view.leftCount > 0 && (
            <div className="mt-4 flex">
              <Chip
                testId="claim-left-filter"
                pressed={filtering}
                onClick={() => setShowLeftOnly(!filtering)}
              >
                {formatItemCount(view.leftCount)} left
              </Chip>
            </div>
          )}
        </header>

        {sections.map((section) => (
          <section
            key={section.receiptId}
            aria-label={section.name}
            data-testid={`claim-section-${section.receiptId}`}
          >
            {hasSeveralReceipts && (
              <h2 className="sticky top-15 z-10 -mx-6 flex items-baseline justify-between gap-3 border-b border-surface-container-high bg-surface px-6 pt-6 pb-2 text-lg font-bold md:top-22 md:mx-0 md:px-1">
                <span className="min-w-0 truncate">{section.name}</span>
                <span
                  className={cn(
                    'shrink-0 text-sm font-semibold',
                    section.leftCount > 0 ? 'text-warning' : 'text-on-surface-variant',
                  )}
                >
                  {section.leftCount > 0 ? `${section.leftCount} left` : 'Done'}
                </span>
              </h2>
            )}
            <ul className="divide-y divide-surface-container-high">
              {section.items.map((item) => (
                <ClaimItemRow
                  key={item.id}
                  item={item}
                  personName={activePerson.firstName}
                  onToggle={() =>
                    applyCommand(section.receiptId, item.id, {
                      type: 'toggle-person',
                      personId: activePerson.id,
                      checked: !item.claimedByActive,
                    })
                  }
                  onStepShare={(step) =>
                    applyCommand(section.receiptId, item.id, {
                      type: 'step-share',
                      personId: activePerson.id,
                      step,
                    })
                  }
                  onSetShare={(input) =>
                    applyCommand(section.receiptId, item.id, {
                      type: 'set-share',
                      personId: activePerson.id,
                      input,
                    })
                  }
                  onSplitEvenly={() =>
                    applyCommand(section.receiptId, item.id, {
                      type: 'split-evenly',
                      personIds: view.people.map((person) => person.id),
                    })
                  }
                  onTakeAlone={() =>
                    applyCommand(section.receiptId, item.id, {
                      type: 'only-person',
                      personId: activePerson.id,
                    })
                  }
                />
              ))}
            </ul>
          </section>
        ))}
      </div>

      <aside className="hidden lg:sticky lg:top-24 lg:block lg:self-start">
        <h2 className="mb-3 text-xs font-bold tracking-widest text-on-surface-variant uppercase">
          Who had what
        </h2>
        <ClaimPeopleRail
          people={view.people}
          onSelect={onActivePersonChange}
          layout="column"
          className="max-h-[calc(100vh-17rem)] overflow-y-auto p-1"
        />
      </aside>
    </div>
  );
}

interface ChipProps {
  testId: string;
  pressed?: boolean;
  onClick: () => void;
  children: ReactNode;
}

function Chip({ testId, pressed, onClick, children }: ChipProps) {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
        pressed
          ? 'border-primary bg-primary text-on-primary'
          : 'border-outline-variant bg-surface-container-lowest hover:bg-surface-container',
      )}
    >
      {children}
    </button>
  );
}
