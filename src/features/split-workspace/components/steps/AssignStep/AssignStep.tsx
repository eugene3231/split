import { useState } from 'react';
import { useShallow } from 'zustand/shallow';
import {
  applyAssignmentCommand,
  resolveSplitAdjustment,
} from '@features/split-workspace/logic/assignmentInteraction';
import type { AssignmentCommand } from '@features/split-workspace/logic/assignmentInteraction';
import { resolveClaimView } from '@features/split-workspace/logic/claim';
import { ReceiptTabs } from '@features/split-workspace/components/shared/ReceiptTabs';
import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';
import { useReceiptSplit } from '@features/split-workspace/hooks/useReceiptSplit';
import { BASE_CURRENCY } from '@shared/constants';
import { ClaimItemTile } from './ClaimItemTile';
import { ClaimPeopleRail } from './ClaimPeopleRail';
import { ClaimProgress } from './ClaimProgress';
import { SplitAdjustSheet } from './SplitAdjustSheet';

interface Props {
  activePersonId: string;
  onActivePersonChange: (personId: string) => void;
}

export function AssignStep({ activePersonId, onActivePersonChange }: Props) {
  const { receipts, activeReceiptId, people, setActiveReceiptId, renameReceipt, updateItem } =
    useReceiptStore(
      useShallow((state) => ({
        receipts: state.receipts,
        activeReceiptId: state.activeReceiptId,
        people: state.people,
        setActiveReceiptId: state.setActiveReceiptId,
        renameReceipt: state.renameReceipt,
        updateItem: state.updateItem,
      })),
    );
  const { consolidated } = useReceiptSplit();
  const [adjustingItemId, setAdjustingItemId] = useState<string | null>(null);

  const activeReceipt = receipts.find((r) => r.id === activeReceiptId) ?? receipts[0];
  const items = activeReceipt?.items ?? [];
  const currency = activeReceipt?.currency ?? BASE_CURRENCY;
  const view = resolveClaimView({
    receipts,
    activeReceiptId,
    people,
    activePersonId,
    totalByPersonCents: consolidated.split.totalByPersonCents,
    totalsCurrency: BASE_CURRENCY,
  });

  const adjustingItem = items.find((item) => item.id === adjustingItemId);
  const adjustment = adjustingItem
    ? resolveSplitAdjustment({ item: adjustingItem, people, currency })
    : null;

  const applyCommand = (itemId: string, command: AssignmentCommand) => {
    const result = applyAssignmentCommand({
      command,
      item: items.find((item) => item.id === itemId) ?? null,
      people,
    });
    if (result.type === 'ignored') return;
    updateItem(result.itemId, () => result.item);
    // A percent or amount commit can drop someone to zero; with one claimant left there is
    // nothing to adjust, and the sheet must not reopen when a second person claims it later.
    if (itemId === adjustingItemId && result.item.assignment.personIds.length < 2) {
      setAdjustingItemId(null);
    }
  };

  const { activePerson } = view;
  if (!activePerson) {
    return null;
  }

  return (
    <div className="mx-auto max-w-5xl lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-10">
      <div className="min-w-0">
        <header className="-mx-6 -mt-4 bg-surface-container-low px-6 pt-5 pb-6 md:mx-0 md:mt-0 md:rounded-3xl md:px-8 md:pt-6 md:pb-7">
          <ClaimProgress {...view.progress} />
          <ClaimPeopleRail
            people={view.people}
            onSelect={onActivePersonChange}
            layout="row"
            className="-mx-6 mt-5 overflow-x-auto px-6 pb-1 md:-mx-8 md:px-8 lg:hidden"
          />
          <h1 className="mt-6 font-headline text-3xl leading-tight font-extrabold tracking-tight break-words md:text-4xl">
            What did {activePerson.firstName} have?
          </h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Tap everything they had. Shared items split automatically.
          </p>
        </header>

        {receipts.length > 1 && (
          <ReceiptTabs
            receipts={receipts}
            activeReceiptId={activeReceipt.id}
            onSelect={setActiveReceiptId}
            onRename={renameReceipt}
            className="mt-5 mb-0"
          />
        )}

        <ul className="mt-4 space-y-2.5">
          {view.items.map((item) => (
            <ClaimItemTile
              key={item.id}
              item={item}
              onToggle={() =>
                applyCommand(item.id, {
                  type: 'toggle-person',
                  personId: activePerson.id,
                  checked: !item.claimedByActive,
                })
              }
              onShareWithEveryone={() => applyCommand(item.id, { type: 'select-all' })}
              onAdjustSplit={() => setAdjustingItemId(item.id)}
            />
          ))}
        </ul>
      </div>

      <aside className="hidden lg:sticky lg:top-24 lg:block lg:self-start">
        <h2 className="mb-3 text-xs font-bold tracking-widest text-on-surface-variant uppercase">
          Who's claiming
        </h2>
        <ClaimPeopleRail
          people={view.people}
          onSelect={onActivePersonChange}
          layout="column"
          className="max-h-[calc(100vh-17rem)] overflow-y-auto p-1"
        />
      </aside>

      {adjustment && (
        <SplitAdjustSheet
          adjustment={adjustment}
          currency={currency}
          onCommand={(command) => applyCommand(adjustment.itemId, command)}
          onClose={() => setAdjustingItemId(null)}
        />
      )}
    </div>
  );
}
