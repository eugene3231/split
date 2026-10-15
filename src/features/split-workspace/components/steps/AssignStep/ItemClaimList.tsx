import { useState } from 'react';
import type { AssignmentCommand } from '@features/split-workspace/logic/assignmentInteraction';
import {
  resolveNextOpenItemId,
  type ItemClaimSection,
} from '@features/split-workspace/logic/claim';
import { ItemClaimRow } from './ItemClaimRow';
import { ReceiptClaimSection } from './ReceiptClaimSection';

interface OpenRow {
  itemId: string;
  reveal: boolean;
}

interface Props {
  sections: ItemClaimSection[];
  onCommand: (receiptId: string, itemId: string, command: AssignmentCommand) => void;
}

function openRow(itemId: string | null, reveal: boolean): OpenRow | null {
  return itemId === null ? null : { itemId, reveal };
}

export function ItemClaimList({ sections, onCommand }: Props) {
  const [open, setOpen] = useState(() => openRow(resolveNextOpenItemId(sections, null), false));
  const nextItemId = open && resolveNextOpenItemId(sections, open.itemId);

  return sections.map((section) => (
    <ReceiptClaimSection
      key={section.receiptId}
      receiptId={section.receiptId}
      name={section.name}
      leftCount={section.leftCount}
    >
      {section.items.map((item) => {
        const isOpen = item.id === open?.itemId;
        return (
          <ItemClaimRow
            key={item.id}
            item={item}
            isOpen={isOpen}
            reveal={isOpen && (open?.reveal ?? false)}
            hasNext={nextItemId !== null}
            onToggleOpen={() => setOpen(openRow(isOpen ? null : item.id, false))}
            onNext={() => setOpen(openRow(nextItemId, true))}
            onCommand={(command) => onCommand(section.receiptId, item.id, command)}
          />
        );
      })}
    </ReceiptClaimSection>
  ));
}
