import { useShallow } from 'zustand/shallow';
import { useReceiptSplit } from '@features/split-workspace/hooks/useReceiptSplit';
import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';
import { BASE_CURRENCY } from '@shared/constants';

export function useReceiptStepModel() {
  const {
    receipts,
    activeReceiptId,
    addItem,
    removeItem,
    updateItem,
    setDiscount,
    setServiceCharge,
    setGst,
    setReceiptTotalInput,
    setActiveReceiptId,
    removeReceipt,
    renameReceipt,
    setReceiptCurrency,
  } = useReceiptStore(
    useShallow((state) => ({
      receipts: state.receipts,
      activeReceiptId: state.activeReceiptId,
      addItem: state.addItem,
      removeItem: state.removeItem,
      updateItem: state.updateItem,
      setDiscount: state.setDiscount,
      setServiceCharge: state.setServiceCharge,
      setGst: state.setGst,
      setReceiptTotalInput: state.setReceiptTotalInput,
      setActiveReceiptId: state.setActiveReceiptId,
      removeReceipt: state.removeReceipt,
      renameReceipt: state.renameReceipt,
      setReceiptCurrency: state.setReceiptCurrency,
    })),
  );
  const { active, reconciliation } = useReceiptSplit();

  const activeReceipt = receipts.find((receipt) => receipt.id === activeReceiptId) ?? receipts[0];
  const items = activeReceipt?.items ?? [];
  const discount = activeReceipt?.discount;
  const serviceCharge = activeReceipt?.serviceCharge;
  const gst = activeReceipt?.gst;
  const receiptTotalInput = activeReceipt?.receiptTotalInput ?? '';
  const activeCurrency = activeReceipt?.currency ?? BASE_CURRENCY;

  return {
    receipts,
    activeReceiptId,
    activeReceipt,
    items,
    discount,
    serviceCharge,
    gst,
    receiptTotalInput,
    activeCurrency,
    hasItems: items.length > 0,
    activeSplit: active.split,
    reconciliation,
    addItem,
    removeItem,
    updateItem,
    setDiscount,
    setServiceCharge,
    setGst,
    setReceiptTotalInput,
    setActiveReceiptId,
    removeReceipt,
    renameReceipt,
    setReceiptCurrency,
  };
}
