import { CHARGE_KINDS } from '@shared/types';
import type { Person } from '@shared/types';
import { resolveChargeLabel } from '@features/split-workspace/logic/chargeLabels';
import { CHARGE_SIGN, centsByPerson } from '@features/split-workspace/logic/split/amounts';
import type { ReceiptView, SummaryView } from '@features/split-workspace/logic/summaryView';
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

export function resolveSummaryOverview({
  people,
  view,
}: ResolveSummaryOverviewInput): SummaryOverview {
  return {
    people,
    sections: view.receipts.map((entry) => buildSection(people, entry)),
    currency: view.total.currency,
    totalCents: view.total.split.totals.totalCents,
    totalByPersonCents: centsByPerson(view.total.split, 'total'),
  };
}

function buildSection(people: Person[], entry: ReceiptView): OverviewReceiptSection {
  return {
    id: entry.receipt.id,
    title: entry.name,
    currency: entry.currency,
    itemRows: buildItemRows(people, entry),
    chargeRows: buildChargeRows(entry),
    totalCents: entry.split.totals.totalCents,
    totalByPersonCents: centsByPerson(entry.split, 'total'),
  };
}

/**
 * One row per priced item, in receipt order. The wizard opens the summary only once every
 * priced item is assigned, so each of them has a line in the split.
 */
function buildItemRows(people: Person[], { split, currency }: ReceiptView): OverviewItemRow[] {
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
function buildChargeRows({ split, receipt }: ReceiptView): OverviewChargeRow[] {
  return CHARGE_KINDS.filter((kind) => split.totals.chargeCents[kind] > 0).map((kind) => ({
    kind,
    label: resolveChargeLabel(kind, receipt),
    sign: CHARGE_SIGN[kind],
    totalCents: split.totals.chargeCents[kind],
    sharesByPerson: Object.fromEntries(
      Object.entries(centsByPerson(split, kind)).filter(([, cents]) => cents !== 0),
    ),
  }));
}
