import { useState } from 'react';
import { useWorkspaceWizard } from '@features/split-workspace/hooks/useWizard';
import { useReceiptSplitterController } from '@features/split-workspace/hooks/useReceiptSplitterController';
import { WizardLayout } from '@features/split-workspace/components/WizardLayout';
import { WorkspaceMenu } from '@features/split-workspace/components/WorkspaceMenu';
import { AppFooter } from '@features/split-workspace/components/AppFooter';
import { withScrollToTop } from '@features/split-workspace/components/shared/scrollToTop';
import { PeopleStep } from '@features/split-workspace/components/steps/PeopleStep/PeopleStep';
import { ReceiptStep } from '@features/split-workspace/components/steps/ReceiptStep/ReceiptStep';
import { AssignStep } from '@features/split-workspace/components/steps/AssignStep/AssignStep';
import { SummaryStep } from '@features/split-workspace/summary/SummaryStep';

/** The quick split: everyone, every receipt, and a summary to save or share. */
export function Workspace() {
  useReceiptSplitterController();
  const [finalActionSlot, setFinalActionSlot] = useState<HTMLDivElement | null>(null);
  const wizard = useWorkspaceWizard();
  const { activeStep } = wizard;

  return (
    <WizardLayout
      wizard={wizard}
      actions={<WorkspaceMenu onLoadWorkspace={withScrollToTop(wizard.handleLoadWorkspace)} />}
      finalActionRef={setFinalActionSlot}
      footer={<AppFooter />}
    >
      {activeStep === 'people' && <PeopleStep />}

      {activeStep === 'receipt' && <ReceiptStep onAddReceipt={wizard.handleAddReceipt} />}

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
          onAddReceipt={wizard.handleAddReceipt}
          onResetSplit={withScrollToTop(wizard.handleResetSplit)}
        />
      )}
    </WizardLayout>
  );
}
