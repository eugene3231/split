import type { ChargeKind, Person } from '@shared/types';
import type { CurrencyCode } from '@shared/constants';

/** How much of each receipt a person's card spells out. */
export type SummaryDetail = 'totals' | 'their-items' | 'all-items';

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

export interface BreakdownItemRow {
  kind: 'item';
  id: string;
  label: string;
  /** Null for an item the person had no share of, which is listed only under "All items". */
  amountCents: number | null;
  currency: CurrencyCode;
}

/** The line between a section's items and its charges. */
export interface BreakdownRuleRow {
  kind: 'rule';
}

export interface BreakdownChargeRow {
  kind: 'charge';
  charge: ChargeKind;
  label: string;
  amountCents: number;
  sign: 'minus' | 'plus';
  currency: CurrencyCode;
}

export interface BreakdownEmptyRow {
  kind: 'empty';
  message: string;
}

/** One line of a receipt section. A section's rows are shown in the order they are listed. */
export type BreakdownRow =
  BreakdownItemRow | BreakdownRuleRow | BreakdownChargeRow | BreakdownEmptyRow;

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
  rows: BreakdownRow[];
}

/** What a person's card shows under its header: one of these, never a mix. */
export type PersonBreakdownBody =
  | { kind: 'receiptTotals'; totals: ReceiptBreakdownTotal[] }
  | { kind: 'sections'; sections: ReceiptBreakdownSection[] }
  | { kind: 'empty'; message: string };

export interface PersonBreakdown {
  person: Person;
  colorIndex: number;
  /** Which receipts the person's total covers: "Total · 3 receipts" or "Total · this receipt". */
  headerLabel: string;
  totalCents: number;
  currency: CurrencyCode;
  conversion?: BreakdownConversion;
  body: PersonBreakdownBody;
  /** Goes last in the card, so paying comes after checking the items. */
  qrDataUrl?: string;
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
