import { useEffect, useLayoutEffect } from 'react';
import { useShallow } from 'zustand/shallow';
import { useDraftPersistence } from '@shared/hooks/useDraftPersistence';
import { useReceiptStore } from '@shared/stores/receiptStore';
import { useScanStore } from '@shared/stores/scanStore';
import { useCurrencyStore } from '@shared/stores/currencyStore';
import { useLoadingTicker } from '@features/receipt-scanner';

export function useReceiptSplitterController() {
  const { initialized, people, receipts, activeReceiptId, initialize, reset, payerMobile } =
    useReceiptStore(
      useShallow((state) => ({
        initialized: state.initialized,
        people: state.people,
        receipts: state.receipts,
        activeReceiptId: state.activeReceiptId,
        initialize: state.initialize,
        reset: state.reset,
        payerMobile: state.payerMobile,
      })),
    );

  const isScanning = useScanStore(
    useShallow((state) => Object.values(state.scanStateByReceipt).some((s) => s.isScanning)),
  );
  const advanceLoadingMessage = useScanStore((state) => state.advanceLoadingMessage);
  const fetchAndSetExchangeRates = useCurrencyStore((state) => state.fetchAndSetExchangeRates);

  useLayoutEffect(() => {
    if (!initialized) {
      initialize();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  useEffect(() => {
    fetchAndSetExchangeRates();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  useEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);

  useDraftPersistence({ initialized, people, receipts, activeReceiptId, payerMobile });
  useLoadingTicker({ isActive: isScanning, onTick: advanceLoadingMessage });
}
