import { BASE_CURRENCY } from '@shared/constants';
import { CHARGE_KINDS } from '@shared/types';
import type { Person, PersonSplit, SplitLine } from '@shared/types';
import {
  resolveChargeLabel,
  type ReceiptCharges,
} from '@features/split-workspace/logic/chargeLabels';
import { CHARGE_SIGN } from '@features/split-workspace/logic/split/amounts';
import type { SummaryView, TotalTabView } from '@features/split-workspace/logic/summaryView';

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
    totalLabel: view.kind === 'total' ? allReceiptsLabel(view) : 'Total',
    totalCents: view.displaySplit.totals.totalCents,
    currency: view.displayCurrency,
    personBreakdowns: resolvePersonBreakdowns({ people, view, qrDataUrls, showAllItems }),
    exchangeRate: resolveHeaderRate(view),
  };
}

function resolvePersonBreakdowns({
  people,
  view,
  qrDataUrls,
  showAllItems,
}: Required<ResolveSummaryBreakdownInput>): PersonBreakdown[] {
  const headerRate = resolveHeaderRate(view);
  return people.map((person, colorIndex) => {
    const sections =
      view.kind === 'total'
        ? view.receiptBreakdowns.flatMap((entry) => {
            const itemRows = buildItemRows(
              entry.split.byPerson[person.id].lines,
              entry.currency,
              showAllItems,
            );
            if (itemRows.length === 0) return [];
            return buildReceiptSection({
              id: entry.receipt.id,
              title: entry.name,
              charges: entry.receipt,
              person: entry.split.byPerson[person.id],
              currency: entry.currency,
              conversion:
                entry.effectiveRate !== undefined
                  ? buildConversion(
                      entry.baseSplit.byPerson[person.id].totalCents,
                      { rate: entry.effectiveRate, fromCurrency: entry.currency },
                      !isSameRate(headerRate, entry.effectiveRate, entry.currency),
                    )
                  : undefined,
              itemRows,
            });
          })
        : [
            buildReceiptSection({
              id: view.receipt.id,
              title: view.receipt.name,
              charges: view.receipt,
              person: view.displaySplit.byPerson[person.id],
              currency: view.displayCurrency,
              itemRows: buildItemRows(
                view.displaySplit.byPerson[person.id].lines,
                view.displayCurrency,
                showAllItems,
              ),
            }),
          ];

    return {
      person,
      colorIndex,
      headerLabel: view.kind === 'total' ? allReceiptsLabel(view) : 'Total · this receipt',
      totalCents: view.displaySplit.byPerson[person.id].totalCents,
      currency: view.displayCurrency,
      conversion: headerRate
        ? buildConversion(view.baseSplit.byPerson[person.id].totalCents, headerRate, true)
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

function allReceiptsLabel(view: TotalTabView): string {
  return `Total · ${view.receiptBreakdowns.length} receipts`;
}

function resolveHeaderRate(view: SummaryView): BreakdownExchangeRate | undefined {
  if (view.displayCurrency === BASE_CURRENCY) return undefined;
  const rate = view.kind === 'receipt' ? view.effectiveRate : view.billedRate;
  if (rate === null) return undefined;
  return { rate, fromCurrency: view.displayCurrency, toCurrency: BASE_CURRENCY };
}

function isSameRate(
  headerRate: BreakdownExchangeRate | undefined,
  rate: number,
  fromCurrency: string,
): boolean {
  return headerRate?.rate === rate && headerRate.fromCurrency === fromCurrency;
}

interface BuildReceiptSectionInput {
  id: string;
  title: string;
  charges: ReceiptCharges;
  /** The person's part of the receipt, in the section's currency. */
  person: PersonSplit;
  currency: string;
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
  currency: string,
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
  currency: string,
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
  { rate, fromCurrency }: Pick<BreakdownExchangeRate, 'rate' | 'fromCurrency'>,
  showRate: boolean,
): BreakdownConversion {
  return {
    amountCents,
    rate,
    fromCurrency,
    toCurrency: BASE_CURRENCY,
    showRate,
  };
}
