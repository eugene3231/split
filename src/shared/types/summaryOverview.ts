import type { Person } from '@shared/types';

export interface OverviewItemRow {
  id: string;
  name: string;
  priceCents: number;
  currency: string;
  /** Only the people who had the item; everyone else is absent. */
  sharesByPerson: Record<string, number>;
  unassigned: boolean;
}

export interface OverviewChargeRow {
  kind: 'discount' | 'service' | 'gst' | 'rounding';
  label: string;
  sign: 'minus' | 'plus';
  totalCents: number;
  sharesByPerson: Record<string, number>;
}

export interface OverviewReceiptSection {
  id: string;
  title: string;
  currency: string;
  itemRows: OverviewItemRow[];
  chargeRows: OverviewChargeRow[];
  totalCents: number;
  totalByPersonCents: Record<string, number>;
}

export interface SummaryOverview {
  people: Person[];
  sections: OverviewReceiptSection[];
  currency: string;
  totalCents: number;
  totalByPersonCents: Record<string, number>;
  unassignedItemCount: number;
}
