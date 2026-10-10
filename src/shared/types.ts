export type AssignmentMode = 'single' | 'equal';
export type ChargeMode = 'amount' | 'percent';

export type Person = {
  id: string;
  name: string;
};

export type ItemAssignment = {
  mode: AssignmentMode;
  personId: string;
  personIds: string[];
  weights?: Record<string, number>;
  /** Share weight nobody has taken yet, on the same scale as `weights`. */
  unassignedWeight?: number;
  /** The person covering the whole item for everyone; locks it to them. */
  treatedBy?: string;
};

export type EditableItem = {
  id: string;
  name: string;
  amountInput: string;
  discountPercentInput: string;
  assignment: ItemAssignment;
};

export type ChargeState = {
  enabled: boolean;
  mode: ChargeMode;
  amountInput: string;
  percentInput: string;
  detectedConfidence: number | null;
  detectedSource: string | null;
};

export type ChargeDetection = {
  enabled: boolean;
  amount: number | null;
  percent: number | null;
  confidence: number | null;
  source: string;
};

export type OcrResponse = {
  items: Array<{ description: string; amount: number }>;
  subtotal: number | null;
  total: number | null;
  detected: {
    gst: ChargeDetection;
    serviceCharge: ChargeDetection;
  };
  warnings: string[];
};

export type SplitResult = {
  lineItemsByPerson: Record<string, PersonReceiptLineItem[]>;
  involvedCountByPerson: Record<string, number>;
  subtotalByPersonCents: Record<string, number>;
  discountByPersonCents: Record<string, number>;
  serviceByPersonCents: Record<string, number>;
  gstByPersonCents: Record<string, number>;
  tipByPersonCents: Record<string, number>;
  totalByPersonCents: Record<string, number>;
  subtotalCents: number;
  discountCents: number;
  serviceChargeCents: number;
  gstCents: number;
  tipCents: number;
  grandTotalCents: number;
  unassignedItemCount: number;
};

export type PersonReceiptLineItem = {
  itemId: string;
  name: string;
  grossAmountCents: number;
  discountPercent: number;
  discountAmountCents: number;
  netAmountCents: number;
  assignedAmountCents: number;
  splitCount: number;
  involved: boolean;
  treatedBy?: string;
};

export type Receipt = {
  id: string;
  name: string;
  items: EditableItem[];
  discount: ChargeState;
  serviceCharge: ChargeState;
  gst: ChargeState;
  /** Added after GST and never taxed, so it stays off the printed receipt total. */
  tip: ChargeState;
  receiptTotalInput: string;
  receiptFile?: File | null;
  currency: string;
  exchangeRateOverride: number | null;
};
