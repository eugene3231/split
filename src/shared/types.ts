export type ChargeMode = 'amount' | 'percent';

export type Person = {
  id: string;
  name: string;
};

/** Share weights for the people on an item. A person missing from `shares` is not on it. */
export type ItemAssignment = {
  shares: Record<string, number>;
  /** Share weight nobody has taken yet, on the same scale as `shares`. */
  unassignedShare: number;
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
  subtotalByPersonCents: Record<string, number>;
  discountByPersonCents: Record<string, number>;
  serviceByPersonCents: Record<string, number>;
  gstByPersonCents: Record<string, number>;
  roundingByPersonCents: Record<string, number>;
  totalByPersonCents: Record<string, number>;
  subtotalCents: number;
  discountCents: number;
  serviceChargeCents: number;
  gstCents: number;
  roundingCents: number;
  grandTotalCents: number;
  unassignedItemCount: number;
};

export type PersonReceiptLineItem = {
  itemId: string;
  name: string;
  /** The person's share of the item after its own discount. Zero when they had none of it. */
  assignedAmountCents: number;
  involved: boolean;
};

export type Receipt = {
  id: string;
  name: string;
  items: EditableItem[];
  discount: ChargeState;
  serviceCharge: ChargeState;
  gst: ChargeState;
  receiptTotalInput: string;
  /** A fixed amount the store added to reach its printed total, split evenly and never taxed. */
  roundingInput: string;
  receiptFile?: File | null;
  currency: string;
  exchangeRateOverride: number | null;
};
