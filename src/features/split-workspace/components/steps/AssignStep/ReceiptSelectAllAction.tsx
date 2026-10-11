import { useState } from 'react';
import { Checkbox } from 'radix-ui';
import type { ClaimSection } from '@features/split-workspace/logic/claim';
import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';
import { ConfirmDialog } from '@features/split-workspace/components/shared/ConfirmDialog';
import { ClaimCheckMark } from './ClaimCheckMark';

interface Props {
  section: ClaimSection;
  personId: string;
  personName: string;
}

export function ReceiptSelectAllAction({ section, personId, personName }: Props) {
  const setPersonOnReceiptItems = useReceiptStore((state) => state.setPersonOnReceiptItems);
  const [confirming, setConfirming] = useState(false);
  const checked =
    section.activeSelection === 'some' ? 'indeterminate' : section.activeSelection === 'all';

  const deselectAll = () => {
    setPersonOnReceiptItems(section.receiptId, personId, false);
    setConfirming(false);
  };

  return (
    <>
      <Checkbox.Root
        aria-label={`Select all items on ${section.name}`}
        checked={checked}
        onCheckedChange={(next) => {
          if (next === true) setPersonOnReceiptItems(section.receiptId, personId, true);
          else if (section.activeHasCustomShare) setConfirming(true);
          else deselectAll();
        }}
        className="-mr-0.5 -ml-1.5 flex h-9 w-9 shrink-0 items-center justify-center md:-ml-2.5"
      >
        <ClaimCheckMark checked={checked} />
      </Checkbox.Root>
      {confirming && (
        <ConfirmDialog
          title="Deselect all items?"
          confirmLabel="Deselect all"
          onCancel={() => setConfirming(false)}
          onConfirm={deselectAll}
        >
          This removes {personName} from every item on {section.name}, including the shares you set
          for them.
        </ConfirmDialog>
      )}
    </>
  );
}
