import type { CurrencyCode } from '@shared/constants';

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

export const CHARGE_KINDS = ['discount', 'service', 'gst', 'rounding'] as const;

/** What changes a subtotal into a total, in the order it is applied. */
export type ChargeKind = (typeof CHARGE_KINDS)[number];

/** What a receipt, or one person's part of it, comes to. */
export interface Amounts {
  subtotalCents: number;
  /** The discount comes off the subtotal; the other charges are added to it. */
  chargeCents: Record<ChargeKind, number>;
  totalCents: number;
}

export interface SplitLine {
  itemId: string;
  name: string;
  /** The person's share of the item after its own discount. Null when they had none of it. */
  amountCents: number | null;
}

export interface PersonSplit extends Amounts {
  /** Every item on the receipt that somebody has, in receipt order. */
  lines: SplitLine[];
}

export interface SplitResult {
  /** The sum of everyone's amounts. */
  totals: Amounts;
  byPerson: Record<string, PersonSplit>;
}

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
  currency: CurrencyCode;
  exchangeRateOverride: number | null;
};

/** A receipt with its split, so the two never have to be matched up by position. */
export interface ReceiptSplit {
  receipt: Receipt;
  split: SplitResult;
}
