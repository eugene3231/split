import { useEffect } from 'react';
import { useScanStore } from '@features/receipt-scanner/stores/scanStore';
import { useCurrencyStore } from '@features/split-workspace/stores/currencyStore';
import { useLoadingTicker } from '@features/receipt-scanner';

export function useReceiptSplitterController() {
  const isScanning = useScanStore((state) =>
    Object.values(state.scanStateByReceipt).some((s) => s.isScanning),
  );
  const advanceLoadingMessage = useScanStore((state) => state.advanceLoadingMessage);
  const fetchAndSetExchangeRates = useCurrencyStore((state) => state.fetchAndSetExchangeRates);

  useEffect(() => {
    fetchAndSetExchangeRates();
  }, [fetchAndSetExchangeRates]);

  useLoadingTicker({ isActive: isScanning, onTick: advanceLoadingMessage });
}
