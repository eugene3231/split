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

/** An item the person had a share of; items they had no part in are left out. */
export interface BreakdownItemRow {
  id: string;
  label: string;
  amountCents: number;
  currency: string;
}

export interface BreakdownChargeRow {
  kind: 'discount' | 'service' | 'gst';
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
  headerLabel: 'Total Due' | 'Grand Total Due';
  totalCents: number;
  currency: string;
  conversion?: BreakdownConversion;
  qrDataUrl?: string;
  collapsedReceiptTotals: ReceiptBreakdownTotal[];
  sections: ReceiptBreakdownSection[];
  emptyMessage?: string;
}

export interface SummaryBreakdown {
  personBreakdowns: PersonBreakdown[];
  /** The one rate every person's header converts at, when there is one. */
  exchangeRate?: BreakdownExchangeRate;
  emptyPeopleMessage?: string;
  unassignedItemCount: number;
}
