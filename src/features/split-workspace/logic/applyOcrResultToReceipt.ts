import { applyChargeDetection } from '@shared/logic/split/charges';
import { normalizeItemAssignments } from '@features/split-workspace/logic/simpleAssignments';
import type { OcrResponse, Person, Receipt } from '@shared/types';
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

export function buildReceiptOcrReplacement(
  payload: OcrResponse,
  people: Person[],
): ReceiptOcrReplacement {
  return {
    items: normalizeItemAssignments(
      payload.items.map((item) => createItemFromOcr(item, people)),
      people,
    ),
    discount: { ...defaultDiscountState },
    serviceCharge: applyChargeDetection(defaultServiceChargeState, payload.detected.serviceCharge),
    gst: applyChargeDetection(defaultGstState, payload.detected.gst),
    receiptTotalInput: payload.total !== null ? payload.total.toFixed(2) : '',
  };
}
