import type { ChargeState, Person, SplitResult } from '@shared/types';
import { buildChargeLabel } from '@features/split-workspace/logic/chargeLabels';
import type { SummaryView } from '@features/split-workspace/logic/summaryView';
import type {
  OverviewChargeRow,
  OverviewItemRow,
  OverviewReceiptSection,
  SummaryOverview,
} from '@shared/types/summaryOverview';

export interface ResolveSummaryOverviewInput {
  people: Person[];
  view: SummaryView;
}

interface SectionSource {
  id: string;
  title: string;
  currency: string;
  split: SplitResult;
  discount: ChargeState;
  serviceCharge: ChargeState;
  gst: ChargeState;
}

export function resolveSummaryOverview({
  people,
  view,
}: ResolveSummaryOverviewInput): SummaryOverview {
  const sections = resolveSectionSources(view).map((source) => buildSection(people, source));

  return {
    people,
    sections,
    currency: view.displayCurrency,
    totalCents: view.grandTotal,
    totalByPersonCents: Object.fromEntries(
      people.map((person) => [person.id, view.displaySplit.totalByPersonCents[person.id] ?? 0]),
    ),
  };
}

function resolveSectionSources(view: SummaryView): SectionSource[] {
  if (view.kind === 'receipt') {
    return [
      {
        id: view.receipt.id,
        title: view.receipt.name || 'Receipt',
        currency: view.displayCurrency,
        split: view.displaySplit,
        discount: view.receipt.discount,
        serviceCharge: view.receipt.serviceCharge,
        gst: view.receipt.gst,
      },
    ];
  }

  return view.receiptBreakdowns.map((entry) => ({
    id: entry.id,
    title: entry.name,
    currency: entry.currency,
    split: entry.split,
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

/**
 * One row per priced item, in receipt order. The wizard opens the summary only once every
 * priced item is assigned, so each of them has a line in the split.
 */
function buildItemRows(people: Person[], { split, currency }: SectionSource): OverviewItemRow[] {
  const rows = new Map<string, OverviewItemRow>();
  for (const person of people) {
    for (const line of split.lineItemsByPerson[person.id] ?? []) {
      const row = rows.get(line.itemId) ?? {
        id: line.itemId,
        name: line.name,
        priceCents: 0,
        currency,
        sharesByPerson: {},
      };
      if (line.involved) {
        row.sharesByPerson[person.id] = line.assignedAmountCents;
        row.priceCents += line.assignedAmountCents;
      }
      rows.set(line.itemId, row);
    }
  }
  return Array.from(rows.values());
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
