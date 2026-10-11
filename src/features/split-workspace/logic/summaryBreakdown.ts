import { BASE_CURRENCY } from '@shared/constants';
import type { ChargeState, Person, PersonReceiptLineItem } from '@shared/types';
import { buildChargeLabel } from '@features/split-workspace/logic/chargeLabels';
import type { SummaryView } from '@features/split-workspace/logic/summaryView';

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
}

export function resolveSummaryBreakdown({
  people,
  view,
  qrDataUrls = {},
}: ResolveSummaryBreakdownInput): SummaryBreakdown {
  return {
    personBreakdowns: resolvePersonBreakdowns({ people, view, qrDataUrls }),
    exchangeRate: resolveHeaderRate(view),
    emptyPeopleMessage: people.length === 0 ? 'Add people to see the breakdown.' : undefined,
    unassignedItemCount: view.displaySplit.unassignedItemCount,
  };
}

export function resolvePersonBreakdowns({
  people,
  view,
  qrDataUrls = {},
}: ResolveSummaryBreakdownInput): PersonBreakdown[] {
  const headerRate = resolveHeaderRate(view);
  return people.map((person, colorIndex) => {
    const totalCents = view.displaySplit.totalByPersonCents[person.id] ?? 0;
    const sections =
      view.kind === 'total'
        ? view.receiptBreakdowns
            .map((entry, index) => {
              const itemRows = buildItemRows(
                entry.split.lineItemsByPerson[person.id] ?? [],
                entry.currency,
              );
              if (itemRows.length === 0) {
                return null;
              }
              return buildReceiptSection({
                id: `${index}:${entry.name}`,
                title: entry.name,
                personId: person.id,
                currency: entry.currency,
                split: entry.split,
                discount: entry.discount,
                serviceCharge: entry.serviceCharge,
                gst: entry.gst,
                conversion:
                  entry.effectiveRate !== undefined
                    ? buildConversion(
                        entry.sgdSplit.totalByPersonCents[person.id] ?? 0,
                        { rate: entry.effectiveRate, fromCurrency: entry.currency },
                        !isSameRate(headerRate, entry.effectiveRate, entry.currency),
                      )
                    : undefined,
                itemRows,
              });
            })
            .filter((section): section is ReceiptBreakdownSection => section !== null)
        : [
            buildReceiptSection({
              id: view.receipt?.id ?? 'receipt',
              title: view.receipt?.name ?? 'Receipt',
              personId: person.id,
              currency: view.displayCurrency,
              split: view.displaySplit,
              discount: view.discount,
              serviceCharge: view.serviceCharge,
              gst: view.gst,
              itemRows: buildItemRows(
                view.displaySplit.lineItemsByPerson[person.id] ?? [],
                view.displayCurrency,
              ),
            }),
          ];

    return {
      person,
      colorIndex,
      headerLabel: view.kind === 'total' ? 'Grand Total Due' : 'Total Due',
      totalCents,
      currency: view.displayCurrency,
      conversion: headerRate
        ? buildConversion(view.sgdSplit.totalByPersonCents[person.id] ?? 0, headerRate, true)
        : undefined,
      qrDataUrl: qrDataUrls[person.id],
      collapsedReceiptTotals:
        view.kind === 'total'
          ? sections.map((section) => ({
              id: section.id,
              label: section.title,
              totalCents: section.totalCents,
              currency: section.currency,
            }))
          : [],
      sections,
      emptyMessage: sections.length === 0 ? 'No items assigned.' : undefined,
    };
  });
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
  personId: string;
  currency: string;
  split: SummaryView['displaySplit'];
  discount: ChargeState;
  serviceCharge: ChargeState;
  gst: ChargeState;
  conversion?: BreakdownConversion;
  itemRows: BreakdownItemRow[];
}

function buildReceiptSection({
  id,
  title,
  personId,
  currency,
  split,
  discount,
  serviceCharge,
  gst,
  conversion,
  itemRows,
}: BuildReceiptSectionInput): ReceiptBreakdownSection {
  const totalCents = split.totalByPersonCents[personId] ?? 0;
  return {
    id,
    title,
    totalCents,
    currency,
    conversion,
    itemRows,
    chargeRows: buildChargeRows({
      currency,
      discount,
      serviceCharge,
      gst,
      discountCents: split.discountByPersonCents[personId] ?? 0,
      serviceCents: split.serviceByPersonCents[personId] ?? 0,
      gstCents: split.gstByPersonCents[personId] ?? 0,
      roundingCents: split.roundingByPersonCents[personId] ?? 0,
    }),
    emptyMessage: itemRows.length === 0 ? 'No items assigned.' : undefined,
  };
}

// The Overview shows who had what across everyone, so a person's breakdown lists only their own items.
function buildItemRows(lines: PersonReceiptLineItem[], currency: string): BreakdownItemRow[] {
  return lines.flatMap((line, index) =>
    line.involved
      ? [
          {
            id: `${line.itemId}:${index}`,
            label: line.name,
            amountCents: line.assignedAmountCents,
            currency,
          },
        ]
      : [],
  );
}

interface BuildChargeRowsInput {
  currency: string;
  discount: ChargeState;
  serviceCharge: ChargeState;
  gst: ChargeState;
  discountCents: number;
  serviceCents: number;
  gstCents: number;
  roundingCents: number;
}

function buildChargeRows({
  currency,
  discount,
  serviceCharge,
  gst,
  discountCents,
  serviceCents,
  gstCents,
  roundingCents,
}: BuildChargeRowsInput): BreakdownChargeRow[] {
  const rows: BreakdownChargeRow[] = [];
  if (discountCents > 0) {
    rows.push({
      kind: 'discount',
      label: buildChargeLabel('Discount', discount),
      amountCents: discountCents,
      sign: 'minus',
      currency,
    });
  }
  if (serviceCents > 0) {
    rows.push({
      kind: 'service',
      label: buildChargeLabel('Service Charge', serviceCharge),
      amountCents: serviceCents,
      sign: 'plus',
      currency,
    });
  }
  if (gstCents > 0) {
    rows.push({
      kind: 'gst',
      label: buildChargeLabel('GST / Tax', gst),
      amountCents: gstCents,
      sign: 'plus',
      currency,
    });
  }
  if (roundingCents > 0) {
    rows.push({
      kind: 'rounding',
      label: 'Rounding',
      amountCents: roundingCents,
      sign: 'plus',
      currency,
    });
  }
  return rows;
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
