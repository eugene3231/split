import { useEffect, useState } from 'react';
import type { Person, Receipt, SplitResult } from '@shared/types';
import { useCurrencyStore } from '@features/split-workspace/stores/currencyStore';
import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';
import { generatePaynowQrDataUrls } from '@features/payments';
import { resolveSummaryBreakdown } from '@features/split-workspace/logic/summaryBreakdown';
import type { SummaryBreakdown } from '@features/split-workspace/logic/summaryBreakdown';
import { resolveSummaryView } from '@features/split-workspace/logic/summaryView';
import type { SummaryView } from '@features/split-workspace/logic/summaryView';
import {
  defaultDiscountState,
  defaultGstState,
  defaultServiceChargeState,
} from '@features/split-workspace/constants';
import { useReceiptSplit } from '@features/split-workspace/hooks/useReceiptSplit';

export type { SummaryView };

function useQrDataUrls(
  people: Person[],
  sgdSplit: SplitResult,
  payerMobile: string,
): Record<string, string> {
  const [qrDataUrls, setQrDataUrls] = useState<Record<string, string>>({});

  const qrAmountsKey = people
    .map((p) => `${p.id}:${sgdSplit.totalByPersonCents[p.id] ?? 0}`)
    .join(',');

  useEffect(() => {
    let cancelled = false;
    generatePaynowQrDataUrls(people, sgdSplit, payerMobile).then((urls) => {
      if (!cancelled) setQrDataUrls(urls);
    });
    return () => {
      cancelled = true;
    };
    // qrAmountsKey encodes every person's SGD amount, so it covers `people` and
    // `sgdSplit` transitively — no need to list them directly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payerMobile, qrAmountsKey]);

  return qrDataUrls;
}

type UseSummaryModelProps = {
  activeTab: string;
  showBaseCurrency: boolean;
};

export type SummaryModel = {
  people: Person[];
  receipts: Receipt[];
  isMultiReceipt: boolean;
  activeSummaryReceipt: Receipt | null;
  renameReceipt: (receiptId: string, name: string) => void;
  payerMobile: string;
  splitByReceipt: SplitResult[];
  reconciliation: {
    cents: number | null;
    applyCorrectiveDiscount: () => void;
  };
  view: SummaryView;
  qrDataUrls: Record<string, string>;
  summaryBreakdown: SummaryBreakdown;
};

export function useSummaryModel({ activeTab, showBaseCurrency }: UseSummaryModelProps) {
  const people = useReceiptStore((s) => s.people);
  const receipts = useReceiptStore((s) => s.receipts);
  const renameReceipt = useReceiptStore((s) => s.renameReceipt);
  const payerMobile = useReceiptStore((s) => s.payerMobile);
  const exchangeRates = useCurrencyStore((s) => s.exchangeRates);
  const { active, consolidated, reconciliation } = useReceiptSplit();
  const activeSummaryReceipt =
    activeTab === 'total'
      ? (receipts[0] ?? null)
      : (receipts.find((receipt) => receipt.id === activeTab) ?? null);

  const view = resolveSummaryView({
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

  const qrDataUrls = useQrDataUrls(people, view.sgdSplit, payerMobile);
  const summaryBreakdown = resolveSummaryBreakdown({ people, view, qrDataUrls });

  return {
    people,
    receipts,
    isMultiReceipt: receipts.length > 1,
    activeSummaryReceipt,
    renameReceipt,
    payerMobile,
    splitByReceipt: consolidated.splitByReceipt,
    reconciliation,
    view,
    qrDataUrls,
    summaryBreakdown,
  };
}
