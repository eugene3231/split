import { BASE_CURRENCY } from '@shared/constants';
import { resolveDiscountedAmountCents } from '@features/split-workspace/logic/split/pricing';
import type { ChargeState, EditableItem, Person, Receipt, SplitResult } from '@shared/types';
import { buildChargeLabel } from '@features/split-workspace/logic/chargeLabels';
import type { SummaryView } from '@features/split-workspace/logic/summaryView';

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

export interface ResolveSummaryOverviewInput {
  people: Person[];
  receipts: Receipt[];
  view: SummaryView;
}

interface SectionSource {
  id: string;
  title: string;
  currency: string;
  split: SplitResult;
  receipt: Receipt | null;
  discount: ChargeState;
  serviceCharge: ChargeState;
  gst: ChargeState;
}

export function resolveSummaryOverview({
  people,
  receipts,
  view,
}: ResolveSummaryOverviewInput): SummaryOverview {
  const sections = resolveSectionSources({ receipts, view }).map((source) =>
    buildSection(people, source),
  );

  return {
    people,
    sections,
    currency: view.displayCurrency,
    totalCents: view.grandTotal,
    totalByPersonCents: Object.fromEntries(
      people.map((person) => [person.id, view.displaySplit.totalByPersonCents[person.id] ?? 0]),
    ),
    unassignedItemCount: sections.reduce(
      (count, section) => count + section.itemRows.filter((row) => row.unassigned).length,
      0,
    ),
  };
}

function resolveSectionSources({
  receipts,
  view,
}: Omit<ResolveSummaryOverviewInput, 'people'>): SectionSource[] {
  if (view.kind === 'receipt') {
    return [
      {
        id: view.receipt?.id ?? 'receipt',
        title: view.receipt?.name || 'Receipt',
        currency: view.displayCurrency,
        split: view.displaySplit,
        receipt: view.receipt,
        discount: view.discount,
        serviceCharge: view.serviceCharge,
        gst: view.gst,
      },
    ];
  }

  return view.receiptBreakdowns.map((entry, index) => ({
    id: receipts[index]?.id ?? `receipt-${index}`,
    title: entry.name,
    currency: entry.currency,
    split: entry.split,
    receipt: receipts[index] ?? null,
    discount: entry.discount,
    serviceCharge: entry.serviceCharge,
    gst: entry.gst,
  }));
}

function buildSection(people: Person[], source: SectionSource): OverviewReceiptSection {
  return {
    id: source.id,
    title: source.title,
    currency: source.currency,
    itemRows: buildItemRows(people, source),
    chargeRows: buildChargeRows(people, source),
    totalCents: source.split.grandTotalCents,
    totalByPersonCents: Object.fromEntries(
      people.map((person) => [person.id, source.split.totalByPersonCents[person.id] ?? 0]),
    ),
  };
}

function buildItemRows(people: Person[], source: SectionSource): OverviewItemRow[] {
  const assignedRows = collectAssignedRows(people, source);
  if (!source.receipt) return Array.from(assignedRows.values());

  // An unassigned item never enters the split, so it is never converted: show it as billed.
  const billedCurrency = source.receipt.currency ?? BASE_CURRENCY;
  return source.receipt.items.flatMap((item) => {
    const assigned = assignedRows.get(item.id);
    if (assigned) return [assigned];
    const unassigned = buildUnassignedRow(item, billedCurrency);
    return unassigned ? [unassigned] : [];
  });
}

/** Keyed by item id, in receipt order; the split omits unassigned and zero-priced items. */
function collectAssignedRows(
  people: Person[],
  { split, currency }: SectionSource,
): Map<string, OverviewItemRow> {
  const rows = new Map<string, OverviewItemRow>();
  for (const person of people) {
    for (const line of split.lineItemsByPerson[person.id] ?? []) {
      const row = rows.get(line.itemId) ?? {
        id: line.itemId,
        name: line.name,
        priceCents: 0,
        currency,
        sharesByPerson: {},
        unassigned: false,
      };
      if (line.involved) {
        row.sharesByPerson[person.id] = line.assignedAmountCents;
        row.priceCents += line.assignedAmountCents;
      }
      rows.set(line.itemId, row);
    }
  }
  return rows;
}

function buildUnassignedRow(item: EditableItem, currency: string): OverviewItemRow | null {
  const priceCents = resolveDiscountedAmountCents(item);
  if (!priceCents) return null;
  return {
    id: item.id,
    name: item.name.trim() || 'Untitled item',
    priceCents,
    currency,
    sharesByPerson: {},
    unassigned: true,
  };
}

function buildChargeRows(people: Person[], source: SectionSource): OverviewChargeRow[] {
  const { split } = source;
  const candidates: OverviewChargeRow[] = [
    {
      kind: 'discount',
      label: buildChargeLabel('Discount', source.discount),
      sign: 'minus',
      totalCents: split.discountCents,
      sharesByPerson: nonZeroShares(people, split.discountByPersonCents),
    },
    {
      kind: 'service',
      label: buildChargeLabel('Service Charge', source.serviceCharge),
      sign: 'plus',
      totalCents: split.serviceChargeCents,
      sharesByPerson: nonZeroShares(people, split.serviceByPersonCents),
    },
    {
      kind: 'gst',
      label: buildChargeLabel('GST / Tax', source.gst),
      sign: 'plus',
      totalCents: split.gstCents,
      sharesByPerson: nonZeroShares(people, split.gstByPersonCents),
    },
    {
      kind: 'rounding',
      label: 'Rounding',
      sign: 'plus',
      totalCents: split.roundingCents,
      sharesByPerson: nonZeroShares(people, split.roundingByPersonCents),
    },
  ];
  return candidates.filter((row) => row.totalCents > 0);
}

function nonZeroShares(
  people: Person[],
  byPersonCents: Record<string, number>,
): Record<string, number> {
  return Object.fromEntries(
    people
      .map((person) => [person.id, byPersonCents[person.id] ?? 0] as const)
      .filter(([, cents]) => cents !== 0),
  );
}
