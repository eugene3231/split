import { useEffect, useState } from 'react';
import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';
import { useGeminiStore } from '@features/split-workspace/stores/geminiStore';
import type { EditableItem, Person, Receipt } from '@shared/types';
import type { SessionDraft, WizardStep } from '@features/split-workspace/types';
import { loadWizardState, saveWizardState } from '@features/split-workspace/logic/persistence';
import { resolveWizardStep } from '@features/split-workspace/logic/wizardState';
import { getContinueLabel } from '@features/split-workspace/logic/wizardSteps';
import { isStepValid } from '@features/split-workspace/logic/wizardValidation';
import {
  resolveActivePersonId,
  countItemsLeft,
  resolveClaimContinue,
  resolvePreviousPersonId,
} from '@features/split-workspace/logic/claim';
import { useScanStore } from '@features/receipt-scanner/stores/scanStore';

export function useWizard(
  items: EditableItem[],
  people: Person[],
  normalizeItems: () => void,
  receipts: Receipt[],
) {
  const geminiApiKeyInput = useGeminiStore((state) => state.geminiApiKeyInput);
  const setShowApiKeyModal = useGeminiStore((state) => state.setShowApiKeyModal);
  const addReceipt = useReceiptStore((state) => state.addReceipt);
  const resetSplit = useReceiptStore((state) => state.resetSplit);
  const loadWorkspace = useReceiptStore((state) => state.loadWorkspace);
  const splitUnassignedItemsEqually = useReceiptStore((state) => state.splitUnassignedItemsEqually);
  const splitEveryItemEvenly = useReceiptStore((state) => state.splitEveryItemEvenly);

  const [initialWizardState] = useState(() => loadWizardState());
  const [activeStepState, setActiveStep] = useState<WizardStep>(
    initialWizardState?.step ?? 'people',
  );
  const [activePersonIdState, setActivePersonId] = useState(
    initialWizardState?.activePersonId ?? '',
  );

  const allReceiptItems = receipts.flatMap((receipt) => receipt.items);
  const allItemsAssigned = isStepValid('items', { items: allReceiptItems, people });

  const activeStep = resolveWizardStep(activeStepState, items, allReceiptItems, people);
  const activePersonId = resolveActivePersonId(activePersonIdState, people);
  const claimContinue = resolveClaimContinue(
    people,
    activePersonId,
    countItemsLeft(receipts, people),
  );

  useEffect(() => {
    saveWizardState({ step: activeStep, activePersonId });
  }, [activeStep, activePersonId]);

  const canContinue = activeStep === 'items' || isStepValid(activeStep, { items, people });
  const continueLabel = getContinueLabel(activeStep, claimContinue.label);

  const canReachReceipt = isStepValid('people', { items, people });
  const canReachItems = canReachReceipt && isStepValid('receipt', { items, people });
  const canReachFinal = canReachItems && allItemsAssigned;

  const stepReachability: Record<WizardStep, boolean> = {
    people: true,
    receipt: canReachReceipt,
    items: canReachItems,
    final: canReachFinal,
  };

  const startClaiming = () => {
    normalizeItems();
    setActivePersonId(people[0]?.id ?? '');
    setActiveStep('items');
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
      startClaiming();
      return;
    }

    normalizeItems();
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
      startClaiming();
      return;
    }

    if (activeStep !== 'items') return;

    if (claimContinue.kind === 'next-person') {
      setActivePersonId(claimContinue.personId);
      return;
    }
    if (claimContinue.kind === 'split-leftovers') splitUnassignedItemsEqually();
    setActiveStep('final');
  };

  const handleBack = () => {
    if (activeStep === 'final') {
      setActiveStep('items');
      return;
    }

    if (activeStep === 'items') {
      const previousPersonId = resolvePreviousPersonId(people, activePersonId);
      if (previousPersonId) setActivePersonId(previousPersonId);
      else setActiveStep('receipt');
      return;
    }

    if (activeStep === 'receipt') {
      setActiveStep('people');
    }
  };

  const handleSplitEvenly = () => {
    normalizeItems();
    splitEveryItemEvenly();
    setActiveStep('final');
  };

  const handleAddReceipt = () => {
    addReceipt();
    setActiveStep('receipt');
    if (!geminiApiKeyInput.trim()) setShowApiKeyModal(true);
  };

  const restartWizard = (step: WizardStep) => {
    useScanStore.getState().resetScanStates();
    setShowApiKeyModal(false);
    setActivePersonId('');
    setActiveStep(step);
  };

  const handleResetSplit = () => {
    resetSplit();
    restartWizard('people');
  };

  // Lands on Items so the loaded splits are visible; resolveWizardStep falls back
  // to an earlier step when the workspace has no people or items yet.
  const handleLoadWorkspace = (draft: SessionDraft) => {
    loadWorkspace(draft);
    restartWizard('items');
  };

  return {
    activeStep,
    activePersonId,
    setActivePersonId,
    canContinue,
    continueLabel,
    stepReachability,
    handleNext,
    handleBack,
    handleStepSelect,
    handleAddReceipt,
    handleSplitEvenly,
    handleResetSplit,
    handleLoadWorkspace,
  };
}
