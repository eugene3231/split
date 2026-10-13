import { BASE_CURRENCY, type CurrencyCode } from '@shared/constants';
import { CHARGE_KINDS } from '@shared/types';
import type { Person, PersonSplit, SplitLine } from '@shared/types';
import {
  resolveChargeLabel,
  type ReceiptCharges,
} from '@features/split-workspace/logic/chargeLabels';
import { CHARGE_SIGN } from '@features/split-workspace/logic/split/amounts';
import type { SummaryView, ViewAmounts } from '@features/split-workspace/logic/summaryView';

import type {
  BreakdownConversion,
  BreakdownExchangeRate,
  BreakdownItemRow,
  BreakdownChargeRow,
  ReceiptBreakdownSection,
  PersonBreakdown,
  SummaryBreakdown,
} from '@shared/types/summaryBreakdown';

export interface ResolveSummaryBreakdownInput {
  people: Person[];
  view: SummaryView;
  qrDataUrls?: Record<string, string>;
  /** Also list the items each person had no share of. */
  showAllItems?: boolean;
}

export function resolveSummaryBreakdown({
  people,
  view,
  qrDataUrls = {},
  showAllItems = false,
}: ResolveSummaryBreakdownInput): SummaryBreakdown {
  return {
    totalLabel: view.scope === 'all' ? allReceiptsLabel(view) : 'Total',
    totalCents: view.total.split.totals.totalCents,
    currency: view.total.currency,
    personBreakdowns: resolvePersonBreakdowns({ people, view, qrDataUrls, showAllItems }),
    exchangeRate: resolveShownRate(view.total),
  };
}

function resolvePersonBreakdowns({
  people,
  view,
  qrDataUrls,
  showAllItems,
}: Required<ResolveSummaryBreakdownInput>): PersonBreakdown[] {
  const headerRate = resolveShownRate(view.total);
  return people.map((person, colorIndex) => {
    const sections = view.receipts.flatMap((entry) => {
      const itemRows = buildItemRows(
        entry.split.byPerson[person.id].lines,
        entry.currency,
        showAllItems,
      );
      // The combined tab leaves out a receipt the person had nothing on.
      if (view.scope === 'all' && itemRows.length === 0) return [];
      // A receipt on its own tab is converted once, in the person's header.
      const sectionRate = view.scope === 'all' ? resolveShownRate(entry) : undefined;
      return buildReceiptSection({
        id: entry.receipt.id,
        title: entry.name,
        charges: entry.receipt,
        person: entry.split.byPerson[person.id],
        currency: entry.currency,
        conversion: sectionRate
          ? buildConversion(
              entry.baseSplit.byPerson[person.id].totalCents,
              sectionRate,
              !isSameRate(headerRate, sectionRate),
            )
          : undefined,
        itemRows,
      });
    });

    return {
      person,
      colorIndex,
      headerLabel: view.scope === 'all' ? allReceiptsLabel(view) : 'Total · this receipt',
      totalCents: view.total.split.byPerson[person.id].totalCents,
      currency: view.total.currency,
      conversion: headerRate
        ? buildConversion(view.total.baseSplit.byPerson[person.id].totalCents, headerRate, true)
        : undefined,
      qrDataUrl: qrDataUrls[person.id],
      collapsedReceiptTotals: sections
        .filter((section) => !section.emptyMessage)
        .map((section) => ({
          id: section.id,
          label: section.title,
          totalCents: section.totalCents,
          currency: section.currency,
        })),
      sections,
      emptyMessage: sections.length === 0 ? 'No items assigned.' : undefined,
    };
  });
}

function allReceiptsLabel(view: SummaryView): string {
  return `Total · ${view.receipts.length} receipts`;
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

interface BuildReceiptSectionInput {
  id: string;
  title: string;
  charges: ReceiptCharges;
  /** The person's part of the receipt, in the section's currency. */
  person: PersonSplit;
  currency: CurrencyCode;
  conversion?: BreakdownConversion;
  itemRows: BreakdownItemRow[];
}

function buildReceiptSection({
  id,
  title,
  charges,
  person,
  currency,
  conversion,
  itemRows,
}: BuildReceiptSectionInput): ReceiptBreakdownSection {
  return {
    id,
    title,
    totalCents: person.totalCents,
    currency,
    conversion,
    itemRows,
    chargeRows: buildChargeRows(person, charges, currency),
    emptyMessage: itemRows.length === 0 ? 'No items assigned.' : undefined,
  };
}

function buildItemRows(
  lines: SplitLine[],
  currency: CurrencyCode,
  showAllItems: boolean,
): BreakdownItemRow[] {
  return lines.flatMap((line, index) =>
    line.amountCents !== null || showAllItems
      ? [
          {
            id: `${line.itemId}:${index}`,
            label: line.name,
            amountCents: line.amountCents,
            involved: line.amountCents !== null,
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
    kind,
    label: resolveChargeLabel(kind, charges),
    amountCents: person.chargeCents[kind],
    sign: CHARGE_SIGN[kind],
    currency,
  }));
}

function buildConversion(
  amountCents: number,
  rate: BreakdownExchangeRate,
  showRate: boolean,
): BreakdownConversion {
  return { ...rate, amountCents, showRate };
}
