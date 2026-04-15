import { useEffect, useLayoutEffect } from 'react';
import { useShallow } from 'zustand/shallow';
import { useDraftPersistence } from '@shared/hooks/useDraftPersistence';
import { useReceiptStore } from '@shared/stores/receiptStore';
import { useLoadingTicker } from '@features/receipt-scanner';

export function useReceiptSplitterController() {
  const {
    isScanning,
    advanceLoadingMessage,
    initialized,
    people,
    receipts,
    activeReceiptId,
    initialize,
    reset,
    fetchAndSetExchangeRates,
  } = useReceiptStore(
    useShallow((state) => ({
      isScanning: Object.values(state.scanStateByReceipt).some((s) => s.isScanning),
      advanceLoadingMessage: state.advanceLoadingMessage,
      initialized: state.initialized,
      people: state.people,
      receipts: state.receipts,
      activeReceiptId: state.activeReceiptId,
      initialize: state.initialize,
      reset: state.reset,
      fetchAndSetExchangeRates: state.fetchAndSetExchangeRates,
    })),
  );

  useLayoutEffect(() => {
    if (!initialized) {
      initialize();
    }
  }, []);

  useEffect(() => {
    fetchAndSetExchangeRates();
  }, []);

  useEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);

  useDraftPersistence({ initialized, people, receipts, activeReceiptId });
  useLoadingTicker({ isActive: isScanning, onTick: advanceLoadingMessage });
}
