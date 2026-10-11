import { useShallow } from 'zustand/shallow';
import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';
import { useReceiptSplit } from '@features/split-workspace/hooks/useReceiptSplit';
import { useWizard } from '@features/split-workspace/hooks/useWizard';
import { useSlideDirection } from '@features/split-workspace/hooks/useSlideDirection';
import { useReceiptSplitterController } from '@features/split-workspace/hooks/useReceiptSplitterController';
import { useAllAssignedMoment } from '@features/split-workspace/hooks/useAllAssignedMoment';
import { countItemsLeft, firstName } from '@features/split-workspace/logic/claim';
import { TopAppBar } from '@features/split-workspace/components/TopAppBar';
import { WorkspaceMenu } from '@features/split-workspace/components/WorkspaceMenu';
import { BottomNav, BottomNavStatus } from '@features/split-workspace/components/BottomNav';
import { AppFooter } from '@features/split-workspace/components/AppFooter';
import { SlideIn } from '@features/split-workspace/components/shared/SlideIn';
import { CountUpAmount } from '@features/split-workspace/components/shared/CountUpAmount';
import { PeopleStep } from '@features/split-workspace/components/steps/PeopleStep';
import { ReceiptStep } from '@features/split-workspace/components/steps/ReceiptStep/ReceiptStep';
import { AssignStep } from '@features/split-workspace/components/steps/AssignStep/AssignStep';
import { SummaryStep } from '@features/split-workspace/components/steps/SummaryStep/SummaryStep';
import { formatCurrencyFromCents } from '@shared/logic/core/money';
import { BASE_CURRENCY } from '@shared/constants';
import type { Person } from '@shared/types';
import { WIZARD_STEPS, type WizardStep } from '@features/split-workspace/types';

export function Workspace() {
  useReceiptSplitterController();

  const { people, receipts, activeReceiptId, normalizeItems } = useReceiptStore(
    useShallow((state) => ({
      people: state.people,
      receipts: state.receipts,
      activeReceiptId: state.activeReceiptId,
      normalizeItems: state.normalizeItems,
    })),
  );

  const activeReceipt = receipts.find((r) => r.id === activeReceiptId) ?? receipts[0];
  const items = activeReceipt?.items ?? [];
  const { active, consolidated } = useReceiptSplit();

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
  } = useWizard(items, people, normalizeItems, receipts);

  const activePerson = people.find((person) => person.id === activePersonId);
  const stepDirection = useSlideDirection(WIZARD_STEPS.indexOf(activeStep));

  const withScrollToTop =
    <Args extends unknown[]>(action: (...args: Args) => void) =>
    (...args: Args) => {
      action(...args);
      window.scrollTo({ top: 0, behavior: 'instant' });
    };

  if (!activeReceipt) {
    return null;
  }

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
            activePersonTotalCents={consolidated.split.totalByPersonCents[activePersonId] ?? 0}
            receiptTotalCents={active.receiptTotals.grandTotalCents}
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
  receiptCurrency: string;
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
      <BottomNavStatus
        label={
          justFinished ? (
            <span
              key="complete"
              data-testid="claim-all-assigned"
              className="inline-flex items-center gap-1 text-white motion-safe:animate-status-flash"
            >
              <span aria-hidden className="material-symbols-outlined text-sm">
                check
              </span>
              All assigned
            </span>
          ) : (
            `${firstName(activePerson.name)} owes`
          )
        }
        value={<CountUpAmount cents={activePersonTotalCents} currency={BASE_CURRENCY} />}
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
