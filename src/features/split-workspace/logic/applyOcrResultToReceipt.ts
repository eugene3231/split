import { applyChargeDetection } from '@features/split-workspace/logic/split/charges';
import type { OcrResponse, Receipt } from '@shared/types';
import { createItemFromOcr } from '@features/receipt-scanner/logic/itemMapper';
import {
  defaultDiscountState,
  defaultGstState,
  defaultServiceChargeState,
} from '@features/split-workspace/constants';

export type ReceiptOcrReplacement = Pick<
  Receipt,
  'items' | 'discount' | 'serviceCharge' | 'gst' | 'receiptTotalInput'
>;

export function buildReceiptOcrReplacement(payload: OcrResponse): ReceiptOcrReplacement {
  return {
    items: payload.items.map((item) => createItemFromOcr(item)),
    discount: { ...defaultDiscountState },
    serviceCharge: applyChargeDetection(defaultServiceChargeState, payload.detected.serviceCharge),
    gst: applyChargeDetection(defaultGstState, payload.detected.gst),
    receiptTotalInput: payload.total !== null ? payload.total.toFixed(2) : '',
  };
}
