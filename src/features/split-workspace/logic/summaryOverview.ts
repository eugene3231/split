import { CHARGE_KINDS } from '@shared/types';
import type { Person, SplitResult } from '@shared/types';
import {
  resolveChargeLabel,
  type ReceiptCharges,
} from '@features/split-workspace/logic/chargeLabels';
import { CHARGE_SIGN, centsByPerson } from '@features/split-workspace/logic/split/amounts';
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
  charges: ReceiptCharges;
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
    totalCents: view.displaySplit.totals.totalCents,
    totalByPersonCents: centsByPerson(view.displaySplit, 'total'),
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
        charges: view.receipt,
      },
    ];
  }

  return view.receiptBreakdowns.map((entry) => ({
    id: entry.receipt.id,
    title: entry.name,
    currency: entry.currency,
    split: entry.split,
    charges: entry.receipt,
  }));
}

function buildSection(people: Person[], source: SectionSource): OverviewReceiptSection {
  return {
    id: source.id,
    title: source.title,
    currency: source.currency,
    itemRows: buildItemRows(people, source),
    chargeRows: buildChargeRows(source),
    totalCents: source.split.totals.totalCents,
    totalByPersonCents: centsByPerson(source.split, 'total'),
  };
}

/**
 * One row per priced item, in receipt order. The wizard opens the summary only once every
 * priced item is assigned, so each of them has a line in the split.
 */
function buildItemRows(people: Person[], { split, currency }: SectionSource): OverviewItemRow[] {
  const rows = new Map<string, OverviewItemRow>();
  for (const person of people) {
    for (const line of split.byPerson[person.id].lines) {
      const row = rows.get(line.itemId) ?? {
        id: line.itemId,
        name: line.name,
        priceCents: 0,
        currency,
        sharesByPerson: {},
      };
      if (line.amountCents !== null) {
        row.sharesByPerson[person.id] = line.amountCents;
        row.priceCents += line.amountCents;
      }
      rows.set(line.itemId, row);
    }
  }
  return Array.from(rows.values());
}

/** A charge gets a row when the receipt has any of it, listing only the people it touched. */
function buildChargeRows({ split, charges }: SectionSource): OverviewChargeRow[] {
  return CHARGE_KINDS.filter((kind) => split.totals.chargeCents[kind] > 0).map((kind) => ({
    kind,
    label: resolveChargeLabel(kind, charges),
    sign: CHARGE_SIGN[kind],
    totalCents: split.totals.chargeCents[kind],
    sharesByPerson: Object.fromEntries(
      Object.entries(centsByPerson(split, kind)).filter(([, cents]) => cents !== 0),
    ),
  }));
}
