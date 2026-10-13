import { useEffect, useState } from 'react';
import type { Person } from '@shared/types';
import type { SummaryDetail } from '@features/split-workspace/summary/breakdown/types';
import { useCurrencyStore } from '@features/split-workspace/stores/currencyStore';
import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';
import { generatePaynowQrDataUrls, normalizeMobile } from '@features/payments';
import { resolveSummaryBreakdown } from '@features/split-workspace/summary/breakdown/summaryBreakdown';
import { resolveSummaryOverview } from '@features/split-workspace/summary/overview/summaryOverview';
import { resolveSummaryView, soleReceipt } from '@features/split-workspace/summary/summaryView';
import { useSplits } from '@features/split-workspace/hooks/useSplits';
import { centsByPerson } from '@features/split-workspace/logic/split/amounts';
import {
  resolveReconciliation,
  type Reconciliation,
} from '@features/split-workspace/logic/reconciliation';

/** The combined tab checks no printed total: each receipt has its own. */
const NOTHING_TO_RECONCILE: Reconciliation = { cents: null, fix: null };

export type PayNowStatus = 'empty' | 'invalid' | 'generating' | 'ready' | 'unavailable' | 'failed';

function useQrDataUrls(
  people: Person[],
  /** What each person owes, in the base currency PayNow is paid in. */
  owedCents: Record<string, number>,
  payerMobile: string,
): { urls: Record<string, string>; status: PayNowStatus } {
  const [qrResult, setQrResult] = useState<{
    key: string;
    urls: Record<string, string>;
  } | null>(null);

  const qrKey = JSON.stringify([
    payerMobile,
    people.map((person) => [person.id, owedCents[person.id]]),
  ]);
  const completedQrKey = qrResult?.key;

  useEffect(() => {
    if (completedQrKey === qrKey) return;
    let cancelled = false;
    generatePaynowQrDataUrls(people, owedCents, payerMobile).then(
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
  }, [completedQrKey, payerMobile, people, qrKey, owedCents]);

  const completed = qrResult?.key === qrKey;
  const urls = completed ? qrResult.urls : {};
  const recipients = people.filter((person) => owedCents[person.id] > 0);
  if (!payerMobile.trim()) return { urls, status: 'empty' };
  if (!normalizeMobile(payerMobile)) return { urls, status: 'invalid' };
  if (recipients.length === 0) return { urls, status: 'unavailable' };
  if (!completed) return { urls, status: 'generating' };
  return { urls, status: recipients.every((person) => urls[person.id]) ? 'ready' : 'failed' };
}

type UseSummaryModelProps = {
  activeTab: string;
  showBaseCurrency: boolean;
  /** How much each person's card spells out. */
  detail?: SummaryDetail;
};

export type SummaryModel = ReturnType<typeof useSummaryModel>;

export function useSummaryModel({
  activeTab,
  showBaseCurrency,
  detail = 'their-items',
}: UseSummaryModelProps) {
  const people = useReceiptStore((s) => s.people);
  const receipts = useReceiptStore((s) => s.receipts);
  const renameReceipt = useReceiptStore((s) => s.renameReceipt);
  const payerMobile = useReceiptStore((s) => s.payerMobile);
  const exchangeRates = useCurrencyStore((s) => s.exchangeRates);
  const { receiptSplits, consolidated } = useSplits();

  const view = resolveSummaryView({
    receiptSplits,
    consolidated,
    exchangeRates,
    activeTab,
    showBaseCurrency,
  });
  const receipt = soleReceipt(view);
  const reconciliation = receipt ? resolveReconciliation(receipt, people) : NOTHING_TO_RECONCILE;

  const { urls: qrDataUrls, status: payNowStatus } = useQrDataUrls(
    people,
    centsByPerson(view.total.baseSplit, 'total'),
    payerMobile,
  );
  const summaryBreakdown = resolveSummaryBreakdown({ people, view, qrDataUrls, detail });
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
