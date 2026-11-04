import { useShallow } from 'zustand/shallow';
import { applyAssignmentCommand } from '@features/split-workspace/logic/assignmentInteraction';
import type { AssignmentCommand } from '@features/split-workspace/logic/assignmentInteraction';
import {
  resolveClaimView,
  resolveItemClaimView,
  type ClaimView,
  type ItemClaimView,
} from '@features/split-workspace/logic/claim';
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

function slidePosition(view: ClaimView | ItemClaimView): number {
  if (view.mode === 'item') return view.people.length;
  return view.people.findIndex((person) => person.isActive);
}

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
  const direction = useSlideDirection(slidePosition(view));

  const applyCommand = (receiptId: string, itemId: string, command: AssignmentCommand) =>
    updateItem(receiptId, itemId, (item) => applyAssignmentCommand(item, command));

  const content =
    view.mode === 'item'
      ? {
          key: 'item',
          title: 'Who had each item?',
          description: 'Tap an item, then everyone who had it.',
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
          description: 'Tap every item they had, even shared ones.',
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
    <div className="lg:grid lg:grid-cols-12 lg:gap-8">
      <div className="min-w-0 lg:col-span-8">
        <header className="mb-4 md:mb-6">
          <SegmentedToggle
            label="Assign items"
            options={MODE_OPTIONS}
            value={mode}
            onValueChange={onModeChange}
            className="mb-4 md:mb-6"
          />
          <ClaimPeopleRail
            people={view.people}
            onSelect={onSelectPerson}
            layout="row"
            currency={view.totalsCurrency}
            className="-mx-6 overflow-x-auto mask-r-from-[calc(100%-2rem)] px-6 py-1 md:-mx-8 md:px-8 lg:hidden"
          />
          <SlideIn key={content.key} direction={direction} className="mt-5 lg:mt-0">
            <StepHeader title={content.title} description={content.description} />
          </SlideIn>
        </header>

        <SlideIn key={view.mode} direction={direction} className="space-y-4">
          {content.list}
        </SlideIn>
      </div>

      <aside className="hidden surface-card p-2 lg:sticky lg:top-[calc(var(--app-bar-height)+1.5rem)] lg:col-span-4 lg:block lg:self-start">
        <h2 className="px-2 pt-2 pb-3 section-label">Who had what</h2>
        <ClaimPeopleRail
          people={view.people}
          onSelect={onSelectPerson}
          layout="column"
          currency={view.totalsCurrency}
          className="max-h-[calc(100vh-17rem)] overflow-y-auto"
        />
      </aside>
    </div>
  );
}
