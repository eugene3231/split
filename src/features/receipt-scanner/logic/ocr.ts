import type { Dispatch, SetStateAction } from 'react';
import type { ChargeState, EditableItem, OcrResponse, Person } from '@shared/types';
import { applyChargeDetection } from '@shared/logic/computation/charges';
import { createItemFromOcr } from '@features/receipt-scanner/logic/itemMapper';
export {
  buildLocalMockOcrResponse,
  buildMockOcrResponse,
} from '@features/receipt-scanner/logic/ocrFixtures';

export function applyOcrPayload(
  payload: OcrResponse,
  people: Person[],
  setItems: Dispatch<SetStateAction<EditableItem[]>>,
  setServiceCharge: Dispatch<SetStateAction<ChargeState>>,
  setGst: Dispatch<SetStateAction<ChargeState>>,
  setScanWarnings: Dispatch<SetStateAction<string[]>>,
  setReceiptTotalInput: Dispatch<SetStateAction<string>>,
) {
  if (payload.items.length > 0) {
    setItems(payload.items.map((item) => createItemFromOcr(item, people)));
  }

  setServiceCharge((current) => applyChargeDetection(current, payload.detected.serviceCharge));
  setGst((current) => applyChargeDetection(current, payload.detected.gst));
  setScanWarnings(payload.warnings);

  if (payload.total !== null) {
    setReceiptTotalInput(payload.total.toFixed(2));
  }
}
