import { useEffect, useState } from 'react';
import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';
import { useGeminiStore } from '@features/split-workspace/stores/geminiStore';
import type { EditableItem, Person, Receipt } from '@shared/types';
import type { ItemsSubPhase, WizardStep } from '@features/split-workspace/types';
import { loadWizardState, saveWizardState } from '@features/split-workspace/logic/persistence';
import {
  clampActiveItemIndex,
  resolveWizardState,
} from '@features/split-workspace/logic/wizardState';
import { isStepValid } from '@features/split-workspace/logic/wizardValidation';

export function useWizard(
  items: EditableItem[],
  people: Person[],
  normalizeItems: () => void,
  receipts: Receipt[],
  activeReceiptId: string,
  setActiveReceiptId: (id: string) => void,
) {
  const geminiApiKeyInput = useGeminiStore((state) => state.geminiApiKeyInput);
  const setShowApiKeyModal = useGeminiStore((state) => state.setShowApiKeyModal);
  const addReceipt = useReceiptStore((state) => state.addReceipt);

  const [initialWizardState] = useState(() => loadWizardState());
  const [activeStepState, setActiveStep] = useState<WizardStep>(
    initialWizardState?.step ?? 'people',
  );
  const [itemsSubPhaseState, setItemsSubPhase] = useState<ItemsSubPhase>(
    initialWizardState?.itemsSubPhase ?? 'assign',
  );
  const [activeItemIndex, setActiveItemIndex] = useState(initialWizardState?.activeItemIndex ?? 0);

  const allReceiptItems = receipts.flatMap((receipt) => receipt.items);
  const allItemsAssigned = isStepValid('items', { items: allReceiptItems, people });

  const { activeStep, itemsSubPhase } = resolveWizardState(
    activeStepState,
    itemsSubPhaseState,
    items,
    allReceiptItems,
    people,
  );
  const safeActiveItemIndex = clampActiveItemIndex(activeItemIndex, items.length);

  useEffect(() => {
    saveWizardState({
      step: activeStep,
      itemsSubPhase,
      activeItemIndex: safeActiveItemIndex,
    });
  }, [activeStep, itemsSubPhase, safeActiveItemIndex]);

  const canContinue =
    activeStep === 'items'
      ? itemsSubPhase === 'review' && allItemsAssigned
      : isStepValid(activeStep, { items, people });

  const canReachReceipt = isStepValid('people', { items, people });
  const canReachItems = canReachReceipt && isStepValid('receipt', { items, people });
  const canReachFinal = canReachItems && allItemsAssigned;

  const stepReachability: Record<WizardStep, boolean> = {
    people: true,
    receipt: canReachReceipt,
    items: canReachItems,
    final: canReachFinal,
  };

  const handleStepSelect = (targetStep: WizardStep) => {
    if (!stepReachability[targetStep]) return;

    if (targetStep === 'people') {
      setActiveStep('people');
      return;
    }

    if (targetStep === 'receipt') {
      setActiveStep('receipt');
      if (activeStep === 'people' && !geminiApiKeyInput.trim()) setShowApiKeyModal(true);
      return;
    }

    if (targetStep === 'items') {
      normalizeItems();
      setItemsSubPhase('assign');
      setActiveItemIndex(0);
      setActiveStep('items');
      return;
    }

    normalizeItems();
    setItemsSubPhase('review');
    setActiveStep('final');
  };

  const handleNext = () => {
    if (activeStep === 'people') {
      if (!isStepValid('people', { items, people })) return;
      setActiveStep('receipt');
      if (!geminiApiKeyInput.trim()) setShowApiKeyModal(true);
      return;
    }

    if (activeStep === 'receipt') {
      if (!isStepValid('receipt', { items, people })) return;
      normalizeItems();
      setItemsSubPhase('assign');
      setActiveItemIndex(0);
      setActiveStep('items');
      return;
    }

    if (activeStep === 'items') {
      if (itemsSubPhase === 'assign') {
        if (safeActiveItemIndex < items.length - 1) {
          setActiveItemIndex(safeActiveItemIndex + 1);
        } else {
          const currentReceiptIndex = receipts.findIndex((r) => r.id === activeReceiptId);
          const nextReceipt = receipts[currentReceiptIndex + 1];
          if (nextReceipt) {
            setActiveReceiptId(nextReceipt.id);
            setActiveItemIndex(0);
          } else {
            setItemsSubPhase('review');
          }
        }
        return;
      }
      if (!allItemsAssigned) return;
      setActiveStep('final');
    }
  };

  const handleBack = () => {
    if (activeStep === 'final') {
      setActiveStep('items');
      setItemsSubPhase('review');
      return;
    }

    if (activeStep === 'items') {
      if (itemsSubPhase === 'review') {
        setItemsSubPhase('assign');
        return;
      }
      setActiveStep('receipt');
      return;
    }

    if (activeStep === 'receipt') {
      setActiveStep('people');
    }
  };

  const handleAddReceipt = () => {
    addReceipt();
    setItemsSubPhase('assign');
    setActiveItemIndex(0);
    setActiveStep('receipt');
    if (!geminiApiKeyInput.trim()) setShowApiKeyModal(true);
  };

  return {
    activeStep,
    itemsSubPhase,
    safeActiveItemIndex,
    setActiveItemIndex: (index: number) => setActiveItemIndex(index),
    setItemsSubPhase: (phase: ItemsSubPhase) => setItemsSubPhase(phase),
    canContinue,
    stepReachability,
    handleNext,
    handleBack,
    handleStepSelect,
    handleAddReceipt,
  };
}
