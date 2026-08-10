import { useMemo } from 'react';
import { useShallow } from 'zustand/shallow';
import {
  applyAssignmentCommand,
  resolveAssignmentInteraction,
} from '@features/split-workspace/logic/assignmentInteraction';
import type { AssignmentCommand } from '@features/split-workspace/logic/assignmentInteraction';
import type { ItemsSubPhase } from '@features/split-workspace/types';
import { ReceiptTabs } from '@features/split-workspace/components/shared/ReceiptTabs';
import { ReceiptNameField } from '@features/split-workspace/components/shared/ReceiptNameField';
import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';
import { BASE_CURRENCY } from '@shared/constants';
import { AssignPhase } from './AssignPhase';
import { ReviewPhase } from './ReviewPhase';

type Props = {
  itemsSubPhase: ItemsSubPhase;
  activeItemIndex: number;
  onActiveItemIndexChange: (index: number) => void;
  onItemsSubPhaseChange: (phase: ItemsSubPhase) => void;
};

export function AssignStep({
  itemsSubPhase,
  activeItemIndex,
  onActiveItemIndexChange,
  onItemsSubPhaseChange,
}: Props) {
  const {
    receipts,
    activeReceiptId,
    items,
    people,
    setActiveReceiptId,
    renameReceipt,
    updateItem,
    splitUnassignedItemsEquallyForActiveReceipt,
  } = useReceiptStore(
    useShallow((state) => {
      const activeReceipt =
        state.receipts.find((receipt) => receipt.id === state.activeReceiptId) ?? state.receipts[0];
      return {
        receipts: state.receipts,
        activeReceiptId: state.activeReceiptId,
        items: activeReceipt?.items ?? [],
        people: state.people,
        setActiveReceiptId: state.setActiveReceiptId,
        renameReceipt: state.renameReceipt,
        updateItem: state.updateItem,
        splitUnassignedItemsEquallyForActiveReceipt:
          state.splitUnassignedItemsEquallyForActiveReceipt,
      };
    }),
  );
  const activeReceipt = receipts.find((r) => r.id === activeReceiptId);
  const activeCurrency = activeReceipt?.currency ?? BASE_CURRENCY;
  const interaction = useMemo(
    () =>
      resolveAssignmentInteraction({
        items,
        receipts,
        people,
        phase: itemsSubPhase,
        activeItemIndex,
        currency: activeCurrency,
      }),
    [activeCurrency, activeItemIndex, items, itemsSubPhase, people, receipts],
  );

  const applyCommand = (command: AssignmentCommand) => {
    const result = applyAssignmentCommand({
      command,
      item: items[activeItemIndex] ?? null,
      people,
    });

    if (result.type === 'item-updated') {
      updateItem(result.itemId, () => result.item);
    }
  };

  return (
    <div>
      {/* Header — desktop */}
      <div className="mb-6 hidden md:block">
        <h1 className="font-headline mb-2 text-4xl font-extrabold tracking-tight text-on-surface md:text-5xl">
          Assign Items
        </h1>
        <p className="text-lg text-on-surface-variant">
          Assign each item to the people who ordered it.
        </p>
      </div>

      {/* Header — mobile */}
      <div className="mb-4 md:hidden">
        <h1 className="font-headline text-xl font-extrabold tracking-tight text-on-surface">
          Assign Items
        </h1>
        <p className="mt-0.5 text-xs text-on-surface-variant">
          Assign each item to the people who ordered it.
        </p>
      </div>

      <ReceiptTabs
        receipts={receipts}
        activeReceiptId={itemsSubPhase === 'review' ? '' : activeReceiptId}
        onSelect={(id) => {
          setActiveReceiptId(id);
          onItemsSubPhaseChange('assign');
        }}
        onRename={renameReceipt}
        appendTab={{
          icon: 'assignment_turned_in',
          label: 'Review All',
          isActive: itemsSubPhase === 'review',
          onClick: () => onItemsSubPhaseChange('review'),
        }}
      />

      {itemsSubPhase === 'assign' && activeReceipt && (
        <div className="mt-3 mb-1 flex items-center gap-2 px-1">
          <span className="material-symbols-outlined text-sm text-outline">receipt_long</span>
          <ReceiptNameField
            key={activeReceiptId}
            name={activeReceipt.name}
            onRename={(name) => renameReceipt(activeReceiptId, name)}
          />
        </div>
      )}

      {itemsSubPhase === 'assign' ? (
        <AssignPhase
          model={interaction.assign}
          activeItemIndex={activeItemIndex}
          itemCount={items.length}
          currency={activeCurrency}
          onActiveItemIndexChange={onActiveItemIndexChange}
          onItemsSubPhaseChange={onItemsSubPhaseChange}
          onCommand={applyCommand}
          onSplitUnassignedItemsEqually={splitUnassignedItemsEquallyForActiveReceipt}
        />
      ) : (
        <ReviewPhase
          rows={interaction.review.rows}
          itemCount={interaction.review.itemCount}
          onEditItem={(row) => {
            const receipt = receipts.find((r) => r.id === row.receiptId);
            const localIndex = receipt?.items.findIndex((item) => item.id === row.itemId) ?? -1;
            if (receipt) setActiveReceiptId(receipt.id);
            onActiveItemIndexChange(Math.max(0, localIndex));
            onItemsSubPhaseChange('assign');
          }}
        />
      )}
    </div>
  );
}
