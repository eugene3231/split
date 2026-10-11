import type { Person } from '@shared/types';

export interface BreakdownExchangeRate {
  rate: number;
  fromCurrency: string;
  toCurrency: string;
}

export interface BreakdownConversion extends BreakdownExchangeRate {
  amountCents: number;
  /** False on a receipt section whose rate the person's header already shows. */
  showRate: boolean;
}

/** An item on the receipt; `involved` is false for one the person had no share of. */
export interface BreakdownItemRow {
  id: string;
  label: string;
  /** Null when the person was not involved. */
  amountCents: number | null;
  involved: boolean;
  currency: string;
}

export interface BreakdownChargeRow {
  kind: 'discount' | 'service' | 'gst' | 'rounding';
  label: string;
  amountCents: number;
  sign: 'minus' | 'plus';
  currency: string;
}

export interface ReceiptBreakdownTotal {
  id: string;
  label: string;
  totalCents: number;
  currency: string;
}

export interface ReceiptBreakdownSection {
  id: string;
  title: string;
  totalCents: number;
  currency: string;
  conversion?: BreakdownConversion;
  itemRows: BreakdownItemRow[];
  chargeRows: BreakdownChargeRow[];
  emptyMessage?: string;
}

export interface PersonBreakdown {
  person: Person;
  colorIndex: number;
  /** Which receipts the person's total covers: "All 3 receipts" or "This receipt". */
  headerLabel: string;
  totalCents: number;
  currency: string;
  conversion?: BreakdownConversion;
  qrDataUrl?: string;
  collapsedReceiptTotals: ReceiptBreakdownTotal[];
  sections: ReceiptBreakdownSection[];
  emptyMessage?: string;
}

export interface SummaryBreakdown {
  /** Names the grand total: "All 3 receipts" on the combined tab, else "Total". */
  totalLabel: string;
  personBreakdowns: PersonBreakdown[];
  /** The one rate every person's header converts at, when there is one. */
  exchangeRate?: BreakdownExchangeRate;
  emptyPeopleMessage?: string;
  unassignedItemCount: number;
}
