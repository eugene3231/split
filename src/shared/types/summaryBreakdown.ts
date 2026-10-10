import type { Person } from '@shared/types';

export interface BreakdownConversion {
  amountCents: number;
  rate: number;
  fromCurrency: string;
  toCurrency: string;
}

export interface BreakdownItemRow {
  id: string;
  label: string;
  /** Short tag kept visible next to the label, such as "Alex's treat". */
  note?: string;
  amountCents: number | null;
  involved: boolean;
  currency: string;
}

export interface BreakdownChargeRow {
  kind: 'discount' | 'service' | 'gst' | 'tip';
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
  emptyPeopleMessage?: string;
  unassignedItemCount: number;
}
