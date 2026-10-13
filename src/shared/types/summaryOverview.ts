import type { ChargeKind, Person } from '@shared/types';
import type { CurrencyCode } from '@shared/constants';

/** Names the receipt the rows under it belong to. */
export interface OverviewHeadingRow {
  kind: 'heading';
  title: string;
}

export interface OverviewItemRow {
  kind: 'item';
  id: string;
  name: string;
  priceCents: number;
  currency: CurrencyCode;
  /** Only the people who had the item; everyone else is absent. */
  sharesByPerson: Record<string, number>;
}

export interface OverviewChargeRow {
  kind: 'charge';
  charge: ChargeKind;
  label: string;
  sign: 'minus' | 'plus';
  totalCents: number;
  currency: CurrencyCode;
  sharesByPerson: Record<string, number>;
}

/** What one receipt comes to, for it and for each person. */
export interface OverviewSectionTotalRow {
  kind: 'sectionTotal';
  label: string;
  totalCents: number;
  currency: CurrencyCode;
  totalByPersonCents: Record<string, number>;
}

/** One row of the table's body. A section's rows are shown in the order they are listed. */
export type OverviewRow =
  OverviewHeadingRow | OverviewItemRow | OverviewChargeRow | OverviewSectionTotalRow;

export interface OverviewReceiptSection {
  id: string;
  rows: OverviewRow[];
}

export interface SummaryOverview {
  people: Person[];
  sections: OverviewReceiptSection[];
  currency: CurrencyCode;
  totalCents: number;
  totalByPersonCents: Record<string, number>;
}
