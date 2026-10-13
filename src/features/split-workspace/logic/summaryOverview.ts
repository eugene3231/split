import { CHARGE_KINDS } from '@shared/types';
import type { Person } from '@shared/types';
import { resolveChargeLabel } from '@features/split-workspace/logic/chargeLabels';
import { CHARGE_SIGN, centsByPerson } from '@features/split-workspace/logic/split/amounts';
import type { ReceiptView, SummaryView } from '@features/split-workspace/logic/summaryView';
import type {
  OverviewChargeRow,
  OverviewItemRow,
  OverviewSectionTotalRow,
  SummaryOverview,
} from '@shared/types/summaryOverview';

export interface ResolveSummaryOverviewInput {
  people: Person[];
  view: SummaryView;
}

/**
 * Decides every row of the who-had-what table and its order. The table on screen and the
 * table in the exported image both walk this, so they cannot show different rows.
 */
export function resolveSummaryOverview({
  people,
  view,
}: ResolveSummaryOverviewInput): SummaryOverview {
  // A receipt is headed and totalled only when there is another to tell it from.
  const severalReceipts = view.receipts.length > 1;

  return {
    people,
    sections: view.receipts.map((entry) => ({
      id: entry.receipt.id,
      rows: [
        ...(severalReceipts ? [{ kind: 'heading' as const, title: entry.name }] : []),
        ...buildItemRows(people, entry),
        ...buildChargeRows(entry),
        ...(severalReceipts ? [buildSectionTotal(entry)] : []),
      ],
    })),
    currency: view.total.currency,
    totalCents: view.total.split.totals.totalCents,
    totalByPersonCents: centsByPerson(view.total.split, 'total'),
  };
}

function buildSectionTotal(entry: ReceiptView): OverviewSectionTotalRow {
  return {
    kind: 'sectionTotal',
    label: `${entry.name} total`,
    totalCents: entry.split.totals.totalCents,
    currency: entry.currency,
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
        kind: 'item',
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
function buildChargeRows({ split, receipt, currency }: ReceiptView): OverviewChargeRow[] {
  return CHARGE_KINDS.filter((kind) => split.totals.chargeCents[kind] > 0).map((kind) => ({
    kind: 'charge',
    charge: kind,
    label: resolveChargeLabel(kind, receipt),
    sign: CHARGE_SIGN[kind],
    totalCents: split.totals.chargeCents[kind],
    currency,
    sharesByPerson: Object.fromEntries(
      Object.entries(centsByPerson(split, kind)).filter(([, cents]) => cents !== 0),
    ),
  }));
}
