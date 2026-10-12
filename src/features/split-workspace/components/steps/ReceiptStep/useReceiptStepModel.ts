import { useShallow } from 'zustand/shallow';
import { useReceiptSplit } from '@features/split-workspace/hooks/useReceiptSplit';
import {
  selectActiveReceipt,
  useReceiptStore,
} from '@features/split-workspace/stores/receiptStore';

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
    setRoundingInput,
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
      setRoundingInput: state.setRoundingInput,
      setActiveReceiptId: state.setActiveReceiptId,
      removeReceipt: state.removeReceipt,
      renameReceipt: state.renameReceipt,
      setReceiptCurrency: state.setReceiptCurrency,
    })),
  );
  const { active, reconciliation } = useReceiptSplit();

  const activeReceipt = useReceiptStore(selectActiveReceipt);
  const { items, discount, serviceCharge, gst, receiptTotalInput } = activeReceipt;
  const activeCurrency = activeReceipt.currency;

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
    activeSplit: active.receiptTotals,
    reconciliation,
    addItem,
    removeItem,
    updateItem,
    setDiscount,
    setServiceCharge,
    setGst,
    setReceiptTotalInput,
    removeRounding: () => setRoundingInput(''),
    setActiveReceiptId,
    removeReceipt,
    renameReceipt,
    setReceiptCurrency,
  };
}
