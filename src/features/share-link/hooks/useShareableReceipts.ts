import { useLayoutEffect } from 'react';
import { useShallow } from 'zustand/shallow';
import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';
import { resolveDiscountedAmountCents } from '@shared/logic/split/pricing';
import { SAMPLE_PEOPLE, SAMPLE_RECEIPT } from '../logic/sampleReceipt';

/** Workspace receipts with priced items, or a sample receipt when there are none. */
export function useShareableReceipts() {
  const { initialize, people, receipts, payerMobile } = useReceiptStore(
    useShallow((state) => ({
      initialize: state.initialize,
      people: state.people,
      receipts: state.receipts,
      payerMobile: state.payerMobile,
    })),
  );

  useLayoutEffect(() => {
    initialize();
  }, [initialize]);

  const priced = receipts.filter((r) => r.items.some((item) => resolveDiscountedAmountCents(item)));

  if (priced.length === 0 || people.length === 0) {
    return { receipts: [SAMPLE_RECEIPT], people: SAMPLE_PEOPLE, payerMobile: '', isSample: true };
  }
  return { receipts: priced, people: people.map((p) => p.name), payerMobile, isSample: false };
}
