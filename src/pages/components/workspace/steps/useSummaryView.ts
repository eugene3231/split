import { useEffect, useState } from 'react';
import type { ChargeState, Person, Receipt, SplitResult } from '@shared/types';
import { useCurrencyStore } from '@shared/stores/currencyStore';
import { useReceiptStore } from '@shared/stores/receiptStore';
import { generatePaynowQrDataUrls } from '@shared/logic/core/paynowQr';
import { resolveSummaryView } from '@pages/logic/summaryView';
import type { SummaryView } from '@pages/logic/summaryView';

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

type Props = {
  people: Person[];
  receipts: Receipt[];
  split: SplitResult;
  consolidatedSplit: SplitResult;
  splitByReceipt: SplitResult[];
  discount: ChargeState;
  serviceCharge: ChargeState;
  gst: ChargeState;
  activeTab: string;
  showBaseCurrency: boolean;
};

export function useSummaryView({
  people,
  receipts,
  split,
  consolidatedSplit,
  splitByReceipt,
  discount,
  serviceCharge,
  gst,
  activeTab,
  showBaseCurrency,
}: Props) {
  const payerMobile = useReceiptStore((s) => s.payerMobile);
  const exchangeRates = useCurrencyStore((s) => s.exchangeRates);

  const view = resolveSummaryView({
    receipts,
    splitByReceipt,
    consolidatedSplit,
    fallbackSplit: split,
    discount,
    serviceCharge,
    gst,
    exchangeRates,
    activeTab,
    showBaseCurrency,
  });

  const qrDataUrls = useQrDataUrls(people, view.sgdSplit, payerMobile);

  return { view, qrDataUrls };
}
