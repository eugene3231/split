import { BASE_CURRENCY, type CurrencyCode } from '@shared/constants';
import { CHARGE_KINDS } from '@shared/types';
import type { Person, PersonSplit, SplitLine } from '@shared/types';
import {
  resolveChargeLabel,
  type ReceiptCharges,
} from '@features/split-workspace/logic/chargeLabels';
import { CHARGE_SIGN } from '@features/split-workspace/logic/split/amounts';
import type {
  ReceiptView,
  SummaryView,
  ViewAmounts,
} from '@features/split-workspace/summary/summaryView';

import type {
  BreakdownChargeRow,
  BreakdownExchangeRate,
  BreakdownItemRow,
  PersonBreakdownBody,
  ReceiptBreakdownSection,
  SummaryBreakdown,
  SummaryDetail,
} from '@features/split-workspace/summary/breakdown/types';

const NO_ITEMS = 'No items assigned.';

export interface ResolveSummaryBreakdownInput {
  people: Person[];
  view: SummaryView;
  qrDataUrls?: Record<string, string>;
  detail?: SummaryDetail;
}

/**
 * Decides everything a person's card contains and in what order. The card on screen and the
 * card in the exported image both walk this, so they cannot show different rows.
 */
export function resolveSummaryBreakdown({
  people,
  view,
  qrDataUrls = {},
  detail = 'their-items',
}: ResolveSummaryBreakdownInput): SummaryBreakdown {
  const allReceiptsLabel = `Total · ${view.receipts.length} receipts`;
  const headerRate = resolveShownRate(view.total);

  return {
    totalLabel: view.scope === 'all' ? allReceiptsLabel : 'Total',
    totalCents: view.total.split.totals.totalCents,
    currency: view.total.currency,
    personBreakdowns: people.map((person, colorIndex) => ({
      person,
      colorIndex,
      headerLabel: view.scope === 'all' ? allReceiptsLabel : 'Total · this receipt',
      totalCents: view.total.split.byPerson[person.id].totalCents,
      currency: view.total.currency,
      conversion: headerRate && {
        ...headerRate,
        amountCents: view.total.baseSplit.byPerson[person.id].totalCents,
        showRate: true,
      },
      body: resolveBody(person, view, detail, headerRate),
      // Someone who owes nothing has an empty code.
      qrDataUrl: qrDataUrls[person.id] || undefined,
    })),
    exchangeRate: headerRate,
  };
}

function resolveBody(
  person: Person,
  view: SummaryView,
  detail: SummaryDetail,
  headerRate: BreakdownExchangeRate | undefined,
): PersonBreakdownBody {
  if (detail === 'totals') {
    return {
      kind: 'receiptTotals',
      totals: view.receipts.flatMap((entry) => {
        const { lines, totalCents } = entry.split.byPerson[person.id];
        if (lines.every((line) => line.amountCents === null)) return [];
        return [{ id: entry.receipt.id, label: entry.name, totalCents, currency: entry.currency }];
      }),
    };
  }

  const sections = view.receipts.flatMap((entry) => {
    const itemRows = buildItemRows(
      entry.split.byPerson[person.id].lines,
      entry.currency,
      detail === 'all-items',
    );
    // The combined tab leaves out a receipt the person had nothing on.
    if (view.scope === 'all' && itemRows.length === 0) return [];
    return [buildSection(person, entry, itemRows, view.scope, headerRate)];
  });
  return sections.length > 0
    ? { kind: 'sections', sections }
    : { kind: 'empty', message: NO_ITEMS };
}

function buildSection(
  person: Person,
  entry: ReceiptView,
  itemRows: BreakdownItemRow[],
  scope: SummaryView['scope'],
  headerRate: BreakdownExchangeRate | undefined,
): ReceiptBreakdownSection {
  const personSplit = entry.split.byPerson[person.id];
  const chargeRows = buildChargeRows(personSplit, entry.receipt, entry.currency);
  // A receipt on its own tab is converted once, in the person's header.
  const rate = scope === 'all' ? resolveShownRate(entry) : undefined;

  return {
    id: entry.receipt.id,
    title: entry.name,
    totalCents: personSplit.totalCents,
    currency: entry.currency,
    conversion: rate && {
      ...rate,
      amountCents: entry.baseSplit.byPerson[person.id].totalCents,
      showRate: !isSameRate(headerRate, rate),
    },
    rows: [
      ...(itemRows.length > 0 ? itemRows : [{ kind: 'empty' as const, message: NO_ITEMS }]),
      ...(chargeRows.length > 0 ? [{ kind: 'rule' as const }, ...chargeRows] : []),
    ],
  };
}

/** The rate to show beside amounts, unless they are already in the base currency. */
function resolveShownRate({ currency, rate }: ViewAmounts): BreakdownExchangeRate | undefined {
  if (currency === BASE_CURRENCY || rate === null) return undefined;
  return { rate, fromCurrency: currency, toCurrency: BASE_CURRENCY };
}

function isSameRate(
  headerRate: BreakdownExchangeRate | undefined,
  sectionRate: BreakdownExchangeRate,
): boolean {
  return (
    headerRate?.rate === sectionRate.rate && headerRate.fromCurrency === sectionRate.fromCurrency
  );
}

function buildItemRows(
  lines: SplitLine[],
  currency: CurrencyCode,
  showAllItems: boolean,
): BreakdownItemRow[] {
  return lines.flatMap((line, index): BreakdownItemRow[] =>
    line.amountCents !== null || showAllItems
      ? [
          {
            kind: 'item',
            id: `${line.itemId}:${index}`,
            label: line.name,
            amountCents: line.amountCents,
            currency,
          },
        ]
      : [],
  );
}

/** A charge gets a row only when it costs this person something. */
function buildChargeRows(
  person: PersonSplit,
  charges: ReceiptCharges,
  currency: CurrencyCode,
): BreakdownChargeRow[] {
  return CHARGE_KINDS.filter((kind) => person.chargeCents[kind] > 0).map((kind) => ({
    kind: 'charge',
    charge: kind,
    label: resolveChargeLabel(kind, charges),
    amountCents: person.chargeCents[kind],
    sign: CHARGE_SIGN[kind],
    currency,
  }));
}
