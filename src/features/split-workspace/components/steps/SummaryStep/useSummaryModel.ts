import { useEffect, useState } from 'react';
import type { Person, SplitResult } from '@shared/types';
import { useCurrencyStore } from '@features/split-workspace/stores/currencyStore';
import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';
import { generatePaynowQrDataUrls, normalizeMobile } from '@features/payments';
import { resolveSummaryBreakdown } from '@features/split-workspace/logic/summaryBreakdown';
import { resolveSummaryOverview } from '@features/split-workspace/logic/summaryOverview';
import { resolveSummaryView } from '@features/split-workspace/logic/summaryView';
import type { SummaryView } from '@features/split-workspace/logic/summaryView';
import { useReceiptSplit } from '@features/split-workspace/hooks/useReceiptSplit';
import {
  resolveReconciliation,
  type Reconciliation,
} from '@features/split-workspace/logic/reconciliation';

export type { SummaryView };

/** The combined tab checks no printed total: each receipt has its own. */
const NOTHING_TO_RECONCILE: Reconciliation = { cents: null, fix: null };

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

export type SummaryModel = ReturnType<typeof useSummaryModel>;

export function useSummaryModel({
  activeTab,
  showBaseCurrency,
  showAllItems = false,
}: UseSummaryModelProps) {
  const people = useReceiptStore((s) => s.people);
  const receipts = useReceiptStore((s) => s.receipts);
  const renameReceipt = useReceiptStore((s) => s.renameReceipt);
  const payerMobile = useReceiptStore((s) => s.payerMobile);
  const exchangeRates = useCurrencyStore((s) => s.exchangeRates);
  const { consolidated } = useReceiptSplit();
  const activeSummaryReceipt =
    activeTab === 'total' ? null : (receipts.find((receipt) => receipt.id === activeTab) ?? null);
  const reconciliation = activeSummaryReceipt
    ? resolveReconciliation(activeSummaryReceipt, people)
    : NOTHING_TO_RECONCILE;

  const view = resolveSummaryView({
    people,
    receipts,
    splitByReceipt: consolidated.splitByReceipt,
    consolidatedSplit: consolidated.split,
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
  const summaryOverview = resolveSummaryOverview({ people, view });

  return {
    people,
    receipts,
    renameReceipt,
    reconciliation,
    view,
    payNowStatus,
    summaryBreakdown,
    summaryOverview,
  };
}
