import type { ChargeKind, Person } from '@shared/types';
import type { CurrencyCode } from '@shared/constants';

export interface OverviewItemRow {
  id: string;
  name: string;
  priceCents: number;
  currency: CurrencyCode;
  /** Only the people who had the item; everyone else is absent. */
  sharesByPerson: Record<string, number>;
}

export interface OverviewChargeRow {
  kind: ChargeKind;
  label: string;
  sign: 'minus' | 'plus';
  totalCents: number;
  sharesByPerson: Record<string, number>;
}

export interface OverviewReceiptSection {
  id: string;
  title: string;
  currency: CurrencyCode;
  itemRows: OverviewItemRow[];
  chargeRows: OverviewChargeRow[];
  totalCents: number;
  totalByPersonCents: Record<string, number>;
}

export interface SummaryOverview {
  people: Person[];
  sections: OverviewReceiptSection[];
  currency: CurrencyCode;
  totalCents: number;
  totalByPersonCents: Record<string, number>;
}
