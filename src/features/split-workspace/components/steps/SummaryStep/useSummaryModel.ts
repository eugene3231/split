import { useEffect, useState } from 'react';
import type { Person, Receipt, SplitResult } from '@shared/types';
import { useCurrencyStore } from '@features/split-workspace/stores/currencyStore';
import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';
import { generatePaynowQrDataUrls, normalizeMobile } from '@features/payments';
import { resolveSummaryBreakdown } from '@features/split-workspace/logic/summaryBreakdown';
import type { SummaryBreakdown } from '@shared/types/summaryBreakdown';
import { resolveSummaryOverview } from '@features/split-workspace/logic/summaryOverview';
import type { SummaryOverview } from '@shared/types/summaryOverview';
import { resolveSummaryView } from '@features/split-workspace/logic/summaryView';
import type { SummaryView } from '@features/split-workspace/logic/summaryView';
import {
  defaultDiscountState,
  defaultGstState,
  defaultServiceChargeState,
} from '@features/split-workspace/constants';
import { useReceiptSplit } from '@features/split-workspace/hooks/useReceiptSplit';
import { useReconciliation } from '@features/split-workspace/hooks/useReconciliation';
import { computeReceiptTotals } from '@features/split-workspace/logic/reconciliation';

export type { SummaryView };

export type PayNowStatus = 'empty' | 'invalid' | 'generating' | 'ready' | 'unavailable' | 'failed';

function useQrDataUrls(
  people: Person[],
  sgdSplit: SplitResult,
  payerMobile: string,
): { urls: Record<string, string>; status: PayNowStatus } {
  const [qrResult, setQrResult] = useState<{
    key: string;
    urls: Record<string, string>;
  } | null>(null);

  const qrKey = JSON.stringify([
    payerMobile,
    people.map((person) => [person.id, sgdSplit.totalByPersonCents[person.id] ?? 0]),
  ]);
  const completedQrKey = qrResult?.key;

  useEffect(() => {
    if (completedQrKey === qrKey) return;
    let cancelled = false;
    generatePaynowQrDataUrls(people, sgdSplit, payerMobile).then(
      (urls) => {
        if (!cancelled) setQrResult({ key: qrKey, urls });
      },
      () => {
        if (!cancelled) setQrResult({ key: qrKey, urls: {} });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [completedQrKey, payerMobile, people, qrKey, sgdSplit]);

  const completed = qrResult?.key === qrKey;
  const urls = completed ? qrResult.urls : {};
  const recipients = people.filter((person) => (sgdSplit.totalByPersonCents[person.id] ?? 0) > 0);
  if (!payerMobile.trim()) return { urls, status: 'empty' };
  if (!normalizeMobile(payerMobile)) return { urls, status: 'invalid' };
  if (recipients.length === 0) return { urls, status: 'unavailable' };
  if (!completed) return { urls, status: 'generating' };
  return { urls, status: recipients.every((person) => urls[person.id]) ? 'ready' : 'failed' };
}

type UseSummaryModelProps = {
  activeTab: string;
  showBaseCurrency: boolean;
  showAllItems?: boolean;
};

export type SummaryModel = {
  people: Person[];
  receipts: Receipt[];
  activeSummaryReceipt: Receipt | null;
  renameReceipt: (receiptId: string, name: string) => void;
  payerMobile: string;
  splitByReceipt: SplitResult[];
  reconciliation: {
    cents: number | null;
    applyCorrectiveDiscount: () => void;
    addRounding: () => void;
  };
  view: SummaryView;
  qrDataUrls: Record<string, string>;
  payNowStatus: PayNowStatus;
  summaryBreakdown: SummaryBreakdown;
  summaryOverview: SummaryOverview;
};

export function useSummaryModel({
  activeTab,
  showBaseCurrency,
  showAllItems = false,
}: UseSummaryModelProps) {
  const people = useReceiptStore((s) => s.people);
  const receipts = useReceiptStore((s) => s.receipts);
  const renameReceipt = useReceiptStore((s) => s.renameReceipt);
  const patchReceipt = useReceiptStore((s) => s.patchReceipt);
  const payerMobile = useReceiptStore((s) => s.payerMobile);
  const exchangeRates = useCurrencyStore((s) => s.exchangeRates);
  const { active, consolidated } = useReceiptSplit();
  const activeSummaryReceipt =
    activeTab === 'total' ? null : (receipts.find((receipt) => receipt.id === activeTab) ?? null);
  const { reconciliationCents, handleApplyReconciliationDiscount, handleAddRounding } =
    useReconciliation({
      split: activeSummaryReceipt
        ? computeReceiptTotals(activeSummaryReceipt, people)
        : active.receiptTotals,
      discount: activeSummaryReceipt?.discount ?? defaultDiscountState,
      serviceCharge: activeSummaryReceipt?.serviceCharge ?? defaultServiceChargeState,
      gst: activeSummaryReceipt?.gst ?? defaultGstState,
      setDiscount: (discount) => {
        if (activeSummaryReceipt) patchReceipt(activeSummaryReceipt.id, { discount });
      },
      setRoundingInput: (roundingInput) => {
        if (activeSummaryReceipt) patchReceipt(activeSummaryReceipt.id, { roundingInput });
      },
      receiptTotalInput: activeSummaryReceipt?.receiptTotalInput ?? '',
    });

  const view = resolveSummaryView({
    people,
    receipts,
    splitByReceipt: consolidated.splitByReceipt,
    consolidatedSplit: consolidated.split,
    fallbackSplit: active.split,
    discount: activeSummaryReceipt?.discount ?? defaultDiscountState,
    serviceCharge: activeSummaryReceipt?.serviceCharge ?? defaultServiceChargeState,
    gst: activeSummaryReceipt?.gst ?? defaultGstState,
    exchangeRates,
    activeTab,
    showBaseCurrency,
  });

  const { urls: qrDataUrls, status: payNowStatus } = useQrDataUrls(
    people,
    view.sgdSplit,
    payerMobile,
  );
  const summaryBreakdown = resolveSummaryBreakdown({ people, view, qrDataUrls, showAllItems });
  const summaryOverview = resolveSummaryOverview({ people, receipts, view });

  return {
    people,
    receipts,
    activeSummaryReceipt,
    renameReceipt,
    payerMobile,
    splitByReceipt: consolidated.splitByReceipt,
    reconciliation: {
      cents: reconciliationCents,
      applyCorrectiveDiscount: handleApplyReconciliationDiscount,
      addRounding: handleAddRounding,
    },
    view,
    qrDataUrls,
    payNowStatus,
    summaryBreakdown,
    summaryOverview,
  };
}
