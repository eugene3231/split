import type { AssignmentCommand } from '@features/split-workspace/logic/assignmentInteraction';
import type { ClaimPerson, ClaimSection } from '@features/split-workspace/logic/claim';
import { ClaimItemRow } from './ClaimItemRow';
import { ReceiptClaimSection } from './ReceiptClaimSection';
import { ReceiptSelectAllAction } from './ReceiptSelectAllAction';

interface Props {
  sections: ClaimSection[];
  activePerson: ClaimPerson;
  people: ClaimPerson[];
  onCommand: (receiptId: string, itemId: string, command: AssignmentCommand) => void;
}

export function PersonClaimList({ sections, activePerson, people, onCommand }: Props) {
  return sections.map((section) => (
    <ReceiptClaimSection
      key={section.receiptId}
      receiptId={section.receiptId}
      name={section.name}
      leftCount={section.leftCount}
      leading={
        <ReceiptSelectAllAction
          section={section}
          personId={activePerson.id}
          personName={activePerson.firstName}
        />
      }
    >
      {section.items.map((item) => {
        const apply = (command: AssignmentCommand) =>
          onCommand(section.receiptId, item.id, command);
        return (
          <ClaimItemRow
            key={item.id}
            item={item}
            personName={activePerson.firstName}
            onToggle={() =>
              apply({
                type: 'toggle-person',
                personId: activePerson.id,
                checked: !item.claimedByActive,
              })
            }
            onStepShare={(step) => apply({ type: 'step-share', personId: activePerson.id, step })}
            onSetShare={(input) => apply({ type: 'set-share', personId: activePerson.id, input })}
            onSplitEvenly={() =>
              apply({ type: 'split-evenly', personIds: people.map((person) => person.id) })
            }
            onTakeAlone={() => apply({ type: 'only-person', personId: activePerson.id })}
          />
        );
      })}
    </ReceiptClaimSection>
  ));
}
