import { useMemo } from 'react';
import { useShallow } from 'zustand/shallow';
import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';
import { useReceiptSplit } from '@features/split-workspace/hooks/useReceiptSplit';
import {
  getAssignedItemsCount,
  getDetectedItemsCount,
} from '@features/split-workspace/logic/wizardValidation';
import { useWizard } from '@features/split-workspace/hooks/useWizard';
import { useReceiptSplitterController } from '@features/split-workspace/hooks/useReceiptSplitterController';
import { TopAppBar } from '@features/split-workspace/components/TopAppBar';
import { BottomNav } from '@features/split-workspace/components/BottomNav';
import { PeopleStep } from '@features/split-workspace/components/steps/PeopleStep';
import { ReceiptStep } from '@features/split-workspace/components/steps/ReceiptStep/ReceiptStep';
import { AssignStep } from '@features/split-workspace/components/steps/AssignStep/AssignStep';
import { SummaryStep } from '@features/split-workspace/components/steps/SummaryStep/SummaryStep';

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function Workspace() {
  useReceiptSplitterController();

  const { people, receipts, activeReceiptId, normalizeItems, setActiveReceiptId } = useReceiptStore(
    useShallow((state) => ({
      people: state.people,
      receipts: state.receipts,
      activeReceiptId: state.activeReceiptId,
      normalizeItems: state.normalizeItems,
      setActiveReceiptId: state.setActiveReceiptId,
    })),
  );

  const activeReceipt = receipts.find((r) => r.id === activeReceiptId) ?? receipts[0];
  const items = useMemo(() => activeReceipt?.items ?? [], [activeReceipt]);
  const { active, consolidated } = useReceiptSplit();

  const {
    activeStep,
    itemsSubPhase,
    safeActiveItemIndex,
    setActiveItemIndex,
    setItemsSubPhase,
    canContinue,
    stepReachability,
    handleNext,
    handleBack,
    handleStepSelect,
    handleAddReceipt,
  } = useWizard(items, people, normalizeItems, receipts, activeReceiptId, setActiveReceiptId);

  const detectedItemsCount = useMemo(() => getDetectedItemsCount(items), [items]);
  const assignedItemCount = useMemo(() => getAssignedItemsCount(items, people), [items, people]);

  const grandTotalCents = useMemo(
    () =>
      Object.values(
        consolidated.split?.totalByPersonCents ?? active.split?.totalByPersonCents ?? {},
      ).reduce((sum, v) => sum + v, 0),
    [consolidated.split, active.split],
  );
  const grandTotalFormatted = grandTotalCents > 0 ? formatCents(grandTotalCents) : undefined;

  const handleNextWithScroll = () => {
    handleNext();
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const handleBackWithScroll = () => {
    handleBack();
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const handleStepSelectWithScroll = (step: Parameters<typeof handleStepSelect>[0]) => {
    handleStepSelect(step);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  if (!activeReceipt) {
    return null;
  }

  return (
    <div
      className="font-body flex min-h-screen flex-col bg-surface text-on-surface"
      data-testid="workspace"
    >
      <TopAppBar
        activeStep={activeStep}
        itemsSubPhase={itemsSubPhase}
        assignedItemCount={assignedItemCount}
        detectedItemsCount={detectedItemsCount}
        stepReachability={stepReachability}
        onStepSelect={handleStepSelectWithScroll}
      />

      <main className="mx-auto w-full max-w-7xl flex-grow px-6 pt-4 pb-48 md:px-8 md:pt-10">
        {activeStep === 'people' && <PeopleStep />}

        {activeStep === 'receipt' && <ReceiptStep onAddReceipt={handleAddReceipt} />}

        {activeStep === 'items' && (
          <AssignStep
            itemsSubPhase={itemsSubPhase}
            activeItemIndex={safeActiveItemIndex}
            onActiveItemIndexChange={setActiveItemIndex}
            onItemsSubPhaseChange={setItemsSubPhase}
          />
        )}

        {activeStep === 'final' && <SummaryStep onAddReceipt={handleAddReceipt} />}
      </main>

      <BottomNav
        activeStep={activeStep}
        itemsSubPhase={itemsSubPhase}
        isLastAssignableItem={
          safeActiveItemIndex >= items.length - 1 &&
          activeReceiptId === receipts[receipts.length - 1]?.id
        }
        canContinue={canContinue}
        onBack={handleBackWithScroll}
        onNext={handleNextWithScroll}
        grandTotalFormatted={grandTotalFormatted}
      />
    </div>
  );
}
