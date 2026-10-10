import { useShallow } from 'zustand/shallow';
import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';
import { useReceiptSplit } from '@features/split-workspace/hooks/useReceiptSplit';
import { useWizard } from '@features/split-workspace/hooks/useWizard';
import { useReceiptSplitterController } from '@features/split-workspace/hooks/useReceiptSplitterController';
import { firstName, resolveClaimProgress } from '@features/split-workspace/logic/claim';
import { TopAppBar } from '@features/split-workspace/components/TopAppBar';
import { BottomNav, BottomNavStatus } from '@features/split-workspace/components/BottomNav';
import { AppFooter } from '@features/split-workspace/components/AppFooter';
import { PeopleStep } from '@features/split-workspace/components/steps/PeopleStep';
import { ReceiptStep } from '@features/split-workspace/components/steps/ReceiptStep/ReceiptStep';
import { AssignStep } from '@features/split-workspace/components/steps/AssignStep/AssignStep';
import { SummaryStep } from '@features/split-workspace/components/steps/SummaryStep/SummaryStep';
import { formatCurrencyFromCents } from '@shared/logic/core/money';
import { BASE_CURRENCY } from '@shared/constants';
import type { Person } from '@shared/types';
import type { WizardStep } from '@features/split-workspace/types';

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
  const { consolidated } = useReceiptSplit();
  const totalByPersonCents = consolidated.split.totalByPersonCents;

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
  } = useWizard(items, people, normalizeItems, receipts);

  const claimProgress = resolveClaimProgress(receipts, people);
  const activePerson = people.find((person) => person.id === activePersonId);

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
      className="flex min-h-screen flex-col bg-surface font-body text-on-surface"
      data-testid="workspace"
    >
      <TopAppBar
        activeStep={activeStep}
        claimedItemCount={claimProgress.claimed}
        detectedItemsCount={claimProgress.total}
        stepReachability={stepReachability}
        onStepSelect={withScrollToTop(handleStepSelect)}
      />

      <main className="mx-auto w-full max-w-7xl flex-grow px-6 pt-4 pb-28 md:px-8 md:pt-10 md:pb-32">
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
      </main>

      <AppFooter />

      <BottomNav
        activeStep={activeStep}
        continueLabel={continueLabel}
        canContinue={canContinue}
        onBack={withScrollToTop(handleBack)}
        onNext={withScrollToTop(handleNext)}
        status={
          <WorkspaceNavStatus
            activeStep={activeStep}
            activePerson={activePerson}
            totalByPersonCents={totalByPersonCents}
          />
        }
      />
    </div>
  );
}

interface WorkspaceNavStatusProps {
  activeStep: WizardStep;
  activePerson: Person | undefined;
  totalByPersonCents: Record<string, number>;
}

function WorkspaceNavStatus({
  activeStep,
  activePerson,
  totalByPersonCents,
}: WorkspaceNavStatusProps) {
  const format = (cents: number) => formatCurrencyFromCents(cents, BASE_CURRENCY);

  if (activeStep === 'items' && activePerson) {
    return (
      <BottomNavStatus
        label={`${firstName(activePerson.name)} owes`}
        value={format(totalByPersonCents[activePerson.id] ?? 0)}
      />
    );
  }

  if (activeStep === 'receipt') {
    const grandTotalCents = Object.values(totalByPersonCents).reduce((sum, v) => sum + v, 0);
    if (grandTotalCents === 0) return null;
    return (
      <BottomNavStatus
        label="Grand total"
        value={format(grandTotalCents)}
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
