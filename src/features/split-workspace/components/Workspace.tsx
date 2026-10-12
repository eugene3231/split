import { useShallow } from 'zustand/shallow';
import {
  selectActiveReceipt,
  useReceiptStore,
} from '@features/split-workspace/stores/receiptStore';
import { useSplits } from '@features/split-workspace/hooks/useSplits';
import { useWizard } from '@features/split-workspace/hooks/useWizard';
import { useSlideDirection } from '@features/split-workspace/hooks/useSlideDirection';
import { useReceiptSplitterController } from '@features/split-workspace/hooks/useReceiptSplitterController';
import { useAllAssignedMoment } from '@features/split-workspace/hooks/useAllAssignedMoment';
import { countItemsLeft, firstName } from '@features/split-workspace/logic/claim';
import { computeReceiptTotals } from '@features/split-workspace/logic/reconciliation';
import { TopAppBar } from '@features/split-workspace/components/TopAppBar';
import { WorkspaceMenu } from '@features/split-workspace/components/WorkspaceMenu';
import { BottomNav, BottomNavStatus } from '@features/split-workspace/components/BottomNav';
import { AppFooter } from '@features/split-workspace/components/AppFooter';
import { SlideIn } from '@features/split-workspace/components/shared/SlideIn';
import { ClaimStatusReel } from '@features/split-workspace/components/ClaimStatusReel';
import { PeopleStep } from '@features/split-workspace/components/steps/PeopleStep/PeopleStep';
import { ReceiptStep } from '@features/split-workspace/components/steps/ReceiptStep/ReceiptStep';
import { AssignStep } from '@features/split-workspace/components/steps/AssignStep/AssignStep';
import { SummaryStep } from '@features/split-workspace/components/steps/SummaryStep/SummaryStep';
import { formatCurrencyFromCents } from '@shared/logic/core/money';
import { BASE_CURRENCY, type CurrencyCode } from '@shared/constants';
import type { Person } from '@shared/types';
import { WIZARD_STEPS, type WizardStep } from '@features/split-workspace/types';

export function Workspace() {
  useReceiptSplitterController();

  const { people, receipts } = useReceiptStore(
    useShallow((state) => ({ people: state.people, receipts: state.receipts })),
  );
  const activeReceipt = useReceiptStore(selectActiveReceipt);
  const { consolidated } = useSplits();

  const {
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
    handleResetSplit,
    handleLoadWorkspace,
  } = useWizard(activeReceipt.items, people, receipts);

  const activePerson = people.find((person) => person.id === activePersonId);
  const stepDirection = useSlideDirection(WIZARD_STEPS.indexOf(activeStep));

  const withScrollToTop =
    <Args extends unknown[]>(action: (...args: Args) => void) =>
    (...args: Args) => {
      action(...args);
      window.scrollTo({ top: 0, behavior: 'instant' });
    };

  return (
    <div
      className="flex min-h-dvh flex-col overflow-x-clip bg-surface font-body text-on-surface"
      data-testid="workspace"
    >
      <TopAppBar
        activeStep={activeStep}
        stepReachability={stepReachability}
        onStepSelect={withScrollToTop(handleStepSelect)}
        actions={<WorkspaceMenu onLoadWorkspace={withScrollToTop(handleLoadWorkspace)} />}
      />

      <main className="mx-auto w-full max-w-7xl flex-grow px-6 pt-4 pb-6 md:px-8 md:pt-10 md:pb-10">
        <SlideIn key={activeStep} direction={stepDirection} data-testid="wizard-step-panel">
          {activeStep === 'people' && <PeopleStep />}

          {activeStep === 'receipt' && <ReceiptStep onAddReceipt={handleAddReceipt} />}

          {activeStep === 'items' && (
            <AssignStep activePersonId={activePersonId} onActivePersonChange={setActivePersonId} />
          )}

          {activeStep === 'final' && (
            <SummaryStep
              onAddReceipt={handleAddReceipt}
              onResetSplit={withScrollToTop(handleResetSplit)}
            />
          )}
        </SlideIn>
      </main>

      <BottomNav
        activeStep={activeStep}
        continueLabel={continueLabel}
        canContinue={canContinue}
        onBack={withScrollToTop(handleBack)}
        onNext={withScrollToTop(handleNext)}
        status={
          <WorkspaceNavStatus
            key={activeStep}
            leftCount={countItemsLeft(receipts, people)}
            activeStep={activeStep}
            activePerson={activePerson}
            activePersonTotalCents={
              activePerson ? consolidated.byPerson[activePerson.id].totalCents : 0
            }
            receiptTotalCents={computeReceiptTotals(activeReceipt, people).totalCents}
            receiptCurrency={activeReceipt.currency}
          />
        }
      />

      <AppFooter />
    </div>
  );
}

interface WorkspaceNavStatusProps {
  leftCount: number;
  activeStep: WizardStep;
  activePerson: Person | undefined;
  activePersonTotalCents: number;
  receiptTotalCents: number;
  receiptCurrency: CurrencyCode;
}

function WorkspaceNavStatus({
  leftCount,
  activeStep,
  activePerson,
  activePersonTotalCents,
  receiptTotalCents,
  receiptCurrency,
}: WorkspaceNavStatusProps) {
  const justFinished = useAllAssignedMoment(leftCount);
  if (activeStep === 'items' && activePerson) {
    return (
      <ClaimStatusReel
        label={`${firstName(activePerson.name)} owes`}
        cents={activePersonTotalCents}
        currency={BASE_CURRENCY}
        complete={justFinished}
      />
    );
  }

  if (activeStep === 'receipt' && receiptTotalCents > 0) {
    return (
      <BottomNavStatus
        label="Receipt total"
        value={formatCurrencyFromCents(receiptTotalCents, receiptCurrency)}
        className="hidden md:block"
      />
    );
  }

  if (activeStep === 'people') {
    return (
      <p className="hidden truncate text-sm text-white/60 md:block">
        Add at least one person to continue
      </p>
    );
  }

  return null;
}
