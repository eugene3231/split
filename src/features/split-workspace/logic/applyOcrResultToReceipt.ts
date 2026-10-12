import { applyChargeDetection } from '@features/split-workspace/logic/split/charges';
import type { EditableItem, OcrResponse, Receipt } from '@shared/types';
import { createId } from '@shared/logic/core/id';
import { NOBODY } from '@features/split-workspace/logic/assignment';
import {
  defaultDiscountState,
  defaultGstState,
  defaultServiceChargeState,
} from '@features/split-workspace/constants';

export type ReceiptOcrReplacement = Pick<
  Receipt,
  'items' | 'discount' | 'serviceCharge' | 'gst' | 'receiptTotalInput' | 'roundingInput'
>;

/** A scanned line starts with nobody on it, like an item typed in by hand. */
function createItemFromOcr(item: OcrResponse['items'][number]): EditableItem {
  return {
    id: createId(),
    name: item.description,
    amountInput: item.amount.toFixed(2),
    discountPercentInput: '',
    assignment: NOBODY,
  };
}

export function buildReceiptOcrReplacement(payload: OcrResponse): ReceiptOcrReplacement {
  return {
    items: payload.items.map(createItemFromOcr),
    discount: { ...defaultDiscountState },
    serviceCharge: applyChargeDetection(defaultServiceChargeState, payload.detected.serviceCharge),
    gst: applyChargeDetection(defaultGstState, payload.detected.gst),
    receiptTotalInput: payload.total !== null ? payload.total.toFixed(2) : '',
    roundingInput: '',
  };
}
