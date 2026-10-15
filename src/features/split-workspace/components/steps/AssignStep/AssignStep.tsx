import { useShallow } from 'zustand/shallow';
import { applyAssignmentCommand } from '@features/split-workspace/logic/assignmentInteraction';
import type { AssignmentCommand } from '@features/split-workspace/logic/assignmentInteraction';
import { resolveClaimView, resolveItemClaimView } from '@features/split-workspace/logic/claim';
import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';
import { useSplits } from '@features/split-workspace/hooks/useSplits';
import { centsByPerson } from '@features/split-workspace/logic/split/amounts';
import { useSlideDirection } from '@features/split-workspace/hooks/useSlideDirection';
import type { AssignMode } from '@features/split-workspace/types';
import { BASE_CURRENCY } from '@shared/constants';
import { StepHeader } from '@features/split-workspace/components/shared/StepHeader';
import { SlideIn } from '@features/split-workspace/components/shared/SlideIn';
import { SegmentedToggle } from '@features/split-workspace/components/shared/SegmentedToggle';
import { ClaimPeopleRail } from './ClaimPeopleRail';
import { ItemClaimList } from './ItemClaimList';
import { PersonClaimList } from './PersonClaimList';

const MODE_OPTIONS = [
  { value: 'person', label: 'By person' },
  { value: 'item', label: 'By item' },
] as const;

interface Props {
  mode: AssignMode;
  onModeChange: (mode: AssignMode) => void;
  activePersonId: string;
  onSelectPerson: (personId: string) => void;
}

export function AssignStep({ mode, onModeChange, activePersonId, onSelectPerson }: Props) {
  const { receipts, people, updateItem } = useReceiptStore(
    useShallow((state) => ({
      receipts: state.receipts,
      people: state.people,
      updateItem: state.updateItem,
    })),
  );
  const { consolidated } = useSplits();

  const args = {
    receipts,
    people,
    totalByPersonCents: centsByPerson(consolidated, 'total'),
    totalsCurrency: BASE_CURRENCY,
  };
  const view =
    mode === 'item' ? resolveItemClaimView(args) : resolveClaimView({ ...args, activePersonId });
  // By item sits to the right of every person, as it does in the toggle.
  const direction = useSlideDirection(
    view.mode === 'item' ? view.people.length : view.people.findIndex((person) => person.isActive),
  );

  const applyCommand = (receiptId: string, itemId: string, command: AssignmentCommand) =>
    updateItem(receiptId, itemId, (item) => applyAssignmentCommand(item, command));

  const content =
    view.mode === 'item'
      ? {
          key: 'item',
          title: 'Who had each item?',
          description: 'Tap everyone who shared it.',
          list: (
            <ItemClaimList
              sections={view.sections.filter((section) => section.items.length > 0)}
              onCommand={applyCommand}
            />
          ),
        }
      : view.activePerson && {
          key: view.activePerson.id,
          title: `What did ${view.activePerson.firstName} have?`,
          description: 'Select the items they had, including anything shared.',
          list: (
            <PersonClaimList
              sections={view.sections.filter((section) => section.items.length > 0)}
              activePerson={view.activePerson}
              people={view.people}
              onCommand={applyCommand}
            />
          ),
        };
  if (!content) {
    return null;
  }

  return (
    <div className="mx-auto max-w-5xl lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-10">
      <div className="min-w-0">
        <header className="-mx-6 -mt-4 bg-surface-container-low px-6 pt-5 pb-5 md:mx-0 md:mt-0 md:rounded-3xl md:px-8 md:pt-6 md:pb-6">
          <SegmentedToggle
            label="Assign items"
            options={MODE_OPTIONS}
            value={mode}
            onValueChange={onModeChange}
            className="mb-5"
          />
          <ClaimPeopleRail
            people={view.people}
            onSelect={onSelectPerson}
            layout="row"
            currency={view.totalsCurrency}
            className="-mx-6 overflow-x-auto px-6 pb-1 md:-mx-8 md:px-8 lg:hidden"
          />
          <SlideIn key={content.key} direction={direction} className="mt-6 lg:mt-0">
            <StepHeader title={content.title} description={content.description} />
          </SlideIn>
        </header>

        <SlideIn key={view.mode} direction={direction}>
          {content.list}
        </SlideIn>
      </div>

      <aside className="hidden lg:sticky lg:top-[calc(var(--app-bar-height)+1.5rem)] lg:block lg:self-start">
        <h2 className="mb-3 text-xs font-bold tracking-widest text-on-surface-variant uppercase">
          Who had what
        </h2>
        <ClaimPeopleRail
          people={view.people}
          onSelect={onSelectPerson}
          layout="column"
          currency={view.totalsCurrency}
          className="max-h-[calc(100vh-17rem)] overflow-y-auto p-1"
        />
      </aside>
    </div>
  );
}
