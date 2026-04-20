import { applyChargeDetection } from '@shared/logic/computation/charges';
import { convertItemsToSimpleEqualMode } from '@shared/logic/assignment/simpleAssignments';
import type { OcrResponse, Person, Receipt } from '@shared/types';
import { createItemFromOcr } from '@features/receipt-scanner/logic/itemMapper';

export type ReceiptOcrPatch = Pick<
  Receipt,
  'items' | 'serviceCharge' | 'gst' | 'receiptTotalInput'
>;

export function buildReceiptOcrPatch(
  receipt: Receipt,
  payload: OcrResponse,
  people: Person[],
): ReceiptOcrPatch {
  const nextItems =
    payload.items.length > 0
      ? convertItemsToSimpleEqualMode(
          payload.items.map((item) => createItemFromOcr(item, people)),
          people,
        )
      : receipt.items;

  return {
    items: nextItems,
    serviceCharge: applyChargeDetection(receipt.serviceCharge, payload.detected.serviceCharge),
    gst: applyChargeDetection(receipt.gst, payload.detected.gst),
    receiptTotalInput:
      payload.total !== null ? payload.total.toFixed(2) : receipt.receiptTotalInput,
  };
}
