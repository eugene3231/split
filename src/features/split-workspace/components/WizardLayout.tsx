import type { ReactNode } from 'react';
import { useShallow } from 'zustand/shallow';
import {
  selectActiveReceipt,
  useReceiptStore,
} from '@features/split-workspace/stores/receiptStore';
import { useSplits } from '@features/split-workspace/hooks/useSplits';
import type { Wizard } from '@features/split-workspace/hooks/useWizard';
import { useSlideDirection } from '@features/split-workspace/hooks/useSlideDirection';
import { useAllAssignedMoment } from '@features/split-workspace/hooks/useAllAssignedMoment';
import { countItems, countItemsLeft, firstName } from '@features/split-workspace/logic/claim';
import { computeReceiptTotals } from '@features/split-workspace/logic/reconciliation';
import { TopAppBar } from '@features/split-workspace/components/TopAppBar';
import { BottomNav, BottomNavStatus } from '@features/split-workspace/components/BottomNav';
import { SlideIn } from '@features/split-workspace/components/shared/SlideIn';
import { withScrollToTop } from '@features/split-workspace/components/shared/scrollToTop';
import { ClaimStatusReel } from '@features/split-workspace/components/ClaimStatusReel';
import { CountUpAmount } from '@features/split-workspace/components/shared/CountUpAmount';
import { SplitLeftoversDialog } from '@features/split-workspace/components/steps/AssignStep/SplitLeftoversDialog';
import { formatCurrencyFromCents } from '@shared/logic/core/money';
import { BASE_CURRENCY, type CurrencyCode } from '@shared/constants';
import type { Person } from '@shared/types';
import type { AssignMode, WizardStep } from '@features/split-workspace/types';

interface WizardLayoutProps {
  wizard: Wizard;
  /** Beside the steps in the top bar. */
  actions: ReactNode;
  /** The summary renders its primary action into this element of the bottom bar. */
  finalActionRef: (element: HTMLDivElement | null) => void;
  /** The active step. */
  children: ReactNode;
  footer?: ReactNode;
}

/** The wizard's frame: the step bar on top, the active step, and the bar that moves between them. */
export function WizardLayout({
  wizard,
  actions,
  finalActionRef,
  children,
  footer,
}: WizardLayoutProps) {
  const { people, receipts } = useReceiptStore(
    useShallow((state) => ({ people: state.people, receipts: state.receipts })),
  );
  const activeReceipt = useReceiptStore(selectActiveReceipt);
  const { consolidated } = useSplits();
  const { steps, activeStep, activePersonId, assignMode, leftoversToSplit } = wizard;

  const activePerson = people.find((person) => person.id === activePersonId);
  const stepDirection = useSlideDirection(steps.indexOf(activeStep));

  return (
    <div
      className="flex min-h-dvh flex-col overflow-x-clip bg-surface font-body text-on-surface"
      data-testid="workspace"
    >
      <TopAppBar
        steps={steps}
        activeStep={activeStep}
        stepReachability={wizard.stepReachability}
        onStepSelect={withScrollToTop(wizard.handleStepSelect)}
        actions={actions}
      />

      <main className="mx-auto w-full max-w-7xl flex-grow px-6 pt-4 pb-6 md:px-8 md:pt-10 md:pb-10">
        <SlideIn key={activeStep} direction={stepDirection} data-testid="wizard-step-panel">
          {children}
        </SlideIn>
      </main>

      <BottomNav
        activeStep={activeStep}
        isFirstStep={wizard.isFirstStep}
        continueLabel={wizard.continueLabel}
        canContinue={wizard.canContinue}
        onBack={withScrollToTop(wizard.handleBack)}
        onNext={withScrollToTop(wizard.handleNext)}
        finalActionRef={finalActionRef}
        status={
          <WorkspaceNavStatus
            key={activeStep}
            itemCount={countItems(receipts)}
            leftCount={countItemsLeft(receipts, people)}
            activeStep={activeStep}
            assignMode={assignMode}
            activePerson={activePerson}
            activePersonTotalCents={
              activePerson ? consolidated.byPerson[activePerson.id].totalCents : 0
            }
            receiptTotalCents={computeReceiptTotals(activeReceipt, people).totalCents}
            receiptCurrency={activeReceipt.currency}
            peopleCount={people.length}
          />
        }
      />

      {leftoversToSplit && (
        <SplitLeftoversDialog
          items={leftoversToSplit}
          peopleCount={people.length}
          onCancel={wizard.cancelSplitLeftovers}
          onConfirm={withScrollToTop(wizard.confirmSplitLeftovers)}
        />
      )}

      {footer}
    </div>
  );
}

interface WorkspaceNavStatusProps {
  itemCount: number;
  leftCount: number;
  activeStep: WizardStep;
  assignMode: AssignMode;
  activePerson: Person | undefined;
  activePersonTotalCents: number;
  receiptTotalCents: number;
  receiptCurrency: CurrencyCode;
  peopleCount: number;
}

function WorkspaceNavStatus({
  itemCount,
  leftCount,
  activeStep,
  assignMode,
  activePerson,
  activePersonTotalCents,
  receiptTotalCents,
  receiptCurrency,
  peopleCount,
}: WorkspaceNavStatusProps) {
  const justFinished = useAllAssignedMoment(leftCount);
  if (activeStep === 'items' && assignMode === 'item') {
    return (
      <ClaimStatusReel
        label="Assigned"
        value={`${itemCount - leftCount} of ${itemCount}`}
        complete={justFinished}
      />
    );
  }

  if (activeStep === 'items' && activePerson) {
    return (
      <ClaimStatusReel
        label={`${firstName(activePerson.name)} owes`}
        value={<CountUpAmount cents={activePersonTotalCents} currency={BASE_CURRENCY} />}
        complete={justFinished}
      />
    );
  }

  if (activeStep === 'receipt' && receiptTotalCents > 0) {
    return (
      <BottomNavStatus
        label="Receipt total"
        value={formatCurrencyFromCents(receiptTotalCents, receiptCurrency)}
      />
    );
  }

  if (activeStep === 'people') {
    if (peopleCount === 0) {
      return <p className="truncate text-sm text-white/60">Add someone first</p>;
    }
    return (
      <BottomNavStatus
        label="Splitting between"
        value={peopleCount === 1 ? '1 person' : `${peopleCount} people`}
      />
    );
  }

  return null;
}
