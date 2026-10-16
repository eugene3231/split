import { useShallow } from 'zustand/shallow';
import { applyAssignmentCommand } from '@features/split-workspace/logic/assignmentInteraction';
import type { AssignmentCommand } from '@features/split-workspace/logic/assignmentInteraction';
import { resolveClaimView } from '@features/split-workspace/logic/claim';
import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';
import { useSplits } from '@features/split-workspace/hooks/useSplits';
import { centsByPerson } from '@features/split-workspace/logic/split/amounts';
import { useSlideDirection } from '@features/split-workspace/hooks/useSlideDirection';
import { BASE_CURRENCY } from '@shared/constants';
import { StepHeader } from '@features/split-workspace/components/shared/StepHeader';
import { SlideIn } from '@features/split-workspace/components/shared/SlideIn';
import { ClaimItemRow } from './ClaimItemRow';
import { ClaimPeopleRail } from './ClaimPeopleRail';
import { ReceiptSelectAllAction } from './ReceiptSelectAllAction';
import { ReceiptSharingAction } from './ReceiptSharingAction';

interface Props {
  activePersonId: string;
  onActivePersonChange: (personId: string) => void;
}

export function AssignStep({ activePersonId, onActivePersonChange }: Props) {
  const { receipts, people, updateItem } = useReceiptStore(
    useShallow((state) => ({
      receipts: state.receipts,
      people: state.people,
      updateItem: state.updateItem,
    })),
  );
  const { consolidated } = useSplits();

  const view = resolveClaimView({
    receipts,
    people,
    activePersonId,
    totalByPersonCents: centsByPerson(consolidated, 'total'),
    totalsCurrency: BASE_CURRENCY,
  });
  const sections = view.sections.filter((section) => section.items.length > 0);
  const personDirection = useSlideDirection(view.people.findIndex((person) => person.isActive));

  const applyCommand = (receiptId: string, itemId: string, command: AssignmentCommand) =>
    updateItem(receiptId, itemId, (item) => applyAssignmentCommand(item, command));

  const { activePerson } = view;
  if (!activePerson) {
    return null;
  }

  return (
    <div className="mx-auto max-w-5xl lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-10">
      <div className="min-w-0">
        <header className="-mx-6 -mt-4 bg-surface-container-low px-6 pt-5 pb-5 md:mx-0 md:mt-0 md:rounded-3xl md:px-8 md:pt-6 md:pb-6">
          <ClaimPeopleRail
            people={view.people}
            onSelect={onActivePersonChange}
            layout="row"
            currency={view.totalsCurrency}
            className="-mx-6 overflow-x-auto px-6 pb-1 md:-mx-8 md:px-8 lg:hidden"
          />
          <SlideIn key={activePerson.id} direction={personDirection} className="mt-6 lg:mt-0">
            <StepHeader
              title={`What did ${activePerson.firstName} have?`}
              description="Select the items they had, including anything shared."
            />
          </SlideIn>
        </header>

        {sections.map((section) => (
          <section
            key={section.receiptId}
            aria-label={section.name}
            data-testid={`claim-section-${section.receiptId}`}
          >
            <div className="sticky top-(--app-bar-height) z-10 -mx-6 flex flex-wrap items-center justify-between gap-2 border-b border-surface-container-high bg-surface px-6 pt-4 pb-2 md:mx-0 md:px-1">
              <ReceiptSelectAllAction
                section={section}
                personId={activePerson.id}
                personName={activePerson.firstName}
              />
              <h2 className="min-w-0 flex-1 truncate text-lg font-bold">{section.name}</h2>
              {section.leftCount > 0 && (
                <span
                  data-testid={`claim-section-left-${section.receiptId}`}
                  className="shrink-0 rounded-full bg-warning-container px-2.5 py-1 text-xs font-bold text-on-warning-container tabular-nums"
                >
                  {section.leftCount} left
                </span>
              )}
              <ReceiptSharingAction receiptId={section.receiptId} />
            </div>
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

      <aside className="hidden lg:sticky lg:top-[calc(var(--app-bar-height)+1.5rem)] lg:block lg:self-start">
        <h2 className="mb-3 text-xs font-bold tracking-widest text-on-surface-variant uppercase">
          Who had what
        </h2>
        <ClaimPeopleRail
          people={view.people}
          onSelect={onActivePersonChange}
          layout="column"
          currency={view.totalsCurrency}
          className="max-h-[calc(100vh-17rem)] overflow-y-auto p-1"
        />
      </aside>
    </div>
  );
}
