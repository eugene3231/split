import { useState, type ReactNode } from 'react';
import {
  createWorkspaceStore,
  selectActiveReceipt,
  useReceiptStore,
} from '@features/split-workspace/stores/receiptStore';
import { WorkspaceStoreProvider } from '@features/split-workspace/stores/WorkspaceStoreProvider';
import { useWorkspaceWizard } from '@features/split-workspace/hooks/useWizard';
import { useSplits } from '@features/split-workspace/hooks/useSplits';
import { useReceiptSplitterController } from '@features/split-workspace/hooks/useReceiptSplitterController';
import { WizardLayout } from '@features/split-workspace/components/WizardLayout';
import { GeminiApiKeyModal } from '@features/split-workspace/components/GeminiApiKeyModal';
import { ReceiptStep } from '@features/split-workspace/components/steps/ReceiptStep/ReceiptStep';
import { AssignStep } from '@features/split-workspace/components/steps/AssignStep/AssignStep';
import { SummaryStep } from '@features/split-workspace/summary/SummaryStep';
import type { Person, Receipt, SplitResult } from '@shared/types';
import type { WizardStep } from '@features/split-workspace/types';

/** A receipt as it is kept: the photo it was scanned from stays on this device. */
export type SavedReceipt = Omit<Receipt, 'receiptFile'>;

const RECEIPT_EDITOR_STEPS: readonly WizardStep[] = ['receipt', 'items', 'final'];

interface ReceiptEditorProps {
  /** Everyone the receipt can be split between. They are fixed: the editor has no people step. */
  people: Person[];
  /** The receipt to start from when nothing is saved under `draftKey`. */
  initial?: SavedReceipt;
  /** Where the editor keeps its work in progress. Give each receipt being edited its own key. */
  draftKey: string;
  /** The review step's primary action, given the receipt and its split as they stand. */
  renderSave: (receipt: SavedReceipt, split: SplitResult) => ReactNode;
  onCancel: () => void;
}

/** The receipt wizard for one receipt between people already known: receipt, items, review. */
export function ReceiptEditor({
  people,
  initial,
  draftKey,
  renderSave,
  onCancel,
}: ReceiptEditorProps) {
  const [store] = useState(() =>
    createWorkspaceStore({
      draftKey,
      wizardKey: `${draftKey}:wizard`,
      initial: initial && {
        people,
        receipts: [initial],
        activeReceiptId: initial.id,
        payerMobile: '',
      },
      people,
    }),
  );

  return (
    <WorkspaceStoreProvider store={store}>
      <ReceiptEditorWorkspace renderSave={renderSave} onCancel={onCancel} />
      <GeminiApiKeyModal />
    </WorkspaceStoreProvider>
  );
}

type ReceiptEditorWorkspaceProps = Pick<ReceiptEditorProps, 'renderSave' | 'onCancel'>;

function ReceiptEditorWorkspace({ renderSave, onCancel }: ReceiptEditorWorkspaceProps) {
  useReceiptSplitterController();
  const [finalActionSlot, setFinalActionSlot] = useState<HTMLDivElement | null>(null);
  const wizard = useWorkspaceWizard(RECEIPT_EDITOR_STEPS);
  const receipt = useReceiptStore(selectActiveReceipt);
  const { receiptSplits } = useSplits();
  const { activeStep } = wizard;

  return (
    <WizardLayout
      wizard={wizard}
      actions={
        <button
          type="button"
          data-testid="receipt-editor-cancel-btn"
          onClick={onCancel}
          className="flex h-9 items-center rounded-xl px-3 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface active:scale-95"
        >
          Cancel
        </button>
      }
      finalActionRef={setFinalActionSlot}
    >
      {activeStep === 'receipt' && <ReceiptStep />}

      {activeStep === 'items' && (
        <AssignStep
          mode={wizard.assignMode}
          onModeChange={wizard.setAssignMode}
          activePersonId={wizard.activePersonId}
          onSelectPerson={wizard.selectPerson}
        />
      )}

      {activeStep === 'final' && (
        <SummaryStep
          actionSlot={finalActionSlot}
          primaryAction={renderSave(withoutFile(receipt), receiptSplits[0].split)}
        />
      )}
    </WizardLayout>
  );
}

function withoutFile(receipt: Receipt): SavedReceipt {
  const saved = { ...receipt };
  delete saved.receiptFile;
  return saved;
}
