import type { ChargeKind, Person } from '@shared/types';
import type { CurrencyCode } from '@shared/constants';

export interface BreakdownExchangeRate {
  rate: number;
  fromCurrency: CurrencyCode;
  toCurrency: CurrencyCode;
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
  currency: CurrencyCode;
}

export interface BreakdownChargeRow {
  kind: ChargeKind;
  label: string;
  amountCents: number;
  sign: 'minus' | 'plus';
  currency: CurrencyCode;
}

export interface ReceiptBreakdownTotal {
  id: string;
  label: string;
  totalCents: number;
  currency: CurrencyCode;
}

export interface ReceiptBreakdownSection {
  id: string;
  title: string;
  totalCents: number;
  currency: CurrencyCode;
  conversion?: BreakdownConversion;
  itemRows: BreakdownItemRow[];
  chargeRows: BreakdownChargeRow[];
  emptyMessage?: string;
}

export interface PersonBreakdown {
  person: Person;
  colorIndex: number;
  /** Which receipts the person's total covers: "Total · 3 receipts" or "Total · this receipt". */
  headerLabel: string;
  totalCents: number;
  currency: CurrencyCode;
  conversion?: BreakdownConversion;
  qrDataUrl?: string;
  collapsedReceiptTotals: ReceiptBreakdownTotal[];
  sections: ReceiptBreakdownSection[];
  emptyMessage?: string;
}

export interface SummaryBreakdown {
  /** Names the grand total: "Total · 3 receipts" on the combined tab, else "Total". */
  totalLabel: string;
  totalCents: number;
  currency: CurrencyCode;
  personBreakdowns: PersonBreakdown[];
  /** The one rate every person's header converts at, when there is one. */
  exchangeRate?: BreakdownExchangeRate;
}
