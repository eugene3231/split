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
    <>
      {/* The header spans the page, so the People panel starts level with the first receipt. */}
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
          className="-mx-6 overflow-x-auto mask-r-from-[calc(100%-4rem)] px-6 py-1 md:-mx-8 md:px-8 xl:hidden"
        />
        <SlideIn key={content.key} direction={direction} className="mt-5 xl:mt-0">
          <StepHeader title={content.title} description={content.description} />
        </SlideIn>
      </header>

      <div className="xl:grid xl:grid-cols-12 xl:gap-8">
        <SlideIn key={view.mode} direction={direction} className="min-w-0 space-y-4 xl:col-span-8">
          {content.list}
        </SlideIn>

        <aside className="hidden surface-card p-2 xl:sticky xl:top-[calc(var(--app-bar-height)+1.5rem)] xl:col-span-4 xl:block xl:self-start">
          <h2 className="px-2 pt-2 pb-3 text-[15px] font-semibold text-on-surface">People</h2>
          <ClaimPeopleRail
            people={view.people}
            onSelect={onSelectPerson}
            layout="column"
            currency={view.totalsCurrency}
            className="max-h-[calc(100dvh-var(--app-bar-height)-7rem)] overflow-y-auto mask-b-from-[calc(100%-1rem)] pb-3"
          />
        </aside>
      </div>
    </>
  );
}
