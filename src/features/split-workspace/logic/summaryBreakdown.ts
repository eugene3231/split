import { BASE_CURRENCY } from '@shared/constants';
import type { ChargeState, Person, PersonReceiptLineItem } from '@shared/types';
import { buildChargeLabel } from '@features/split-workspace/logic/chargeLabels';
import type { SummaryView } from '@features/split-workspace/logic/summaryView';

export interface BreakdownConversion {
  amountCents: number;
  rate: number;
  fromCurrency: string;
  toCurrency: string;
}

export interface BreakdownItemRow {
  id: string;
  label: string;
  amountCents: number | null;
  involved: boolean;
  currency: string;
}

export interface BreakdownChargeRow {
  kind: 'discount' | 'service' | 'gst';
  label: string;
  amountCents: number;
  sign: 'minus' | 'plus';
  currency: string;
}

export interface ReceiptBreakdownTotal {
  id: string;
  label: string;
  subtotalCents: number;
  currency: string;
}

export interface ReceiptBreakdownSection {
  id: string;
  title: string;
  subtotalCents: number;
  currency: string;
  conversion?: BreakdownConversion;
  itemRows: BreakdownItemRow[];
  chargeRows: BreakdownChargeRow[];
  emptyMessage?: string;
}

export interface PersonBreakdown {
  person: Person;
  colorIndex: number;
  headerLabel: 'Total Due' | 'Grand Total Due';
  totalCents: number;
  currency: string;
  conversion?: BreakdownConversion;
  qrDataUrl?: string;
  collapsedReceiptTotals: ReceiptBreakdownTotal[];
  sections: ReceiptBreakdownSection[];
  emptyMessage?: string;
}

export interface SummaryBreakdown {
  personBreakdowns: PersonBreakdown[];
  emptyPeopleMessage?: string;
  unassignedItemCount: number;
}

export type ResolveSummaryBreakdownInput = {
  people: Person[];
  view: SummaryView;
  qrDataUrls?: Record<string, string>;
};

export function resolveSummaryBreakdown({
  people,
  view,
  qrDataUrls = {},
}: ResolveSummaryBreakdownInput): SummaryBreakdown {
  return {
    personBreakdowns: resolvePersonBreakdowns({ people, view, qrDataUrls }),
    emptyPeopleMessage: people.length === 0 ? 'Add people to see the breakdown.' : undefined,
    unassignedItemCount: view.displaySplit.unassignedItemCount,
  };
}

export function resolvePersonBreakdowns({
  people,
  view,
  qrDataUrls = {},
}: ResolveSummaryBreakdownInput): PersonBreakdown[] {
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
                conversionRate: entry.effectiveRate,
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
              conversionRate: undefined,
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
      conversion:
        view.kind === 'receipt' && view.isForeign && view.effectiveRate !== null
          ? buildConversion(totalCents, view.effectiveRate, view.nativeCurrency)
          : undefined,
      qrDataUrl: qrDataUrls[person.id],
      collapsedReceiptTotals:
        view.kind === 'total'
          ? view.receiptBreakdowns
              .map((entry, index) => {
                const rows = entry.split.lineItemsByPerson[person.id] ?? [];
                if (rows.length === 0) {
                  return null;
                }
                return {
                  id: `${index}:${entry.name}`,
                  label: entry.name,
                  subtotalCents: sumInvolvedLineAmounts(rows),
                  currency: entry.currency,
                };
              })
              .filter((total): total is ReceiptBreakdownTotal => total !== null)
          : [],
      sections,
      emptyMessage: sections.length === 0 ? 'No items assigned.' : undefined,
    };
  });
}

type BuildReceiptSectionInput = {
  id: string;
  title: string;
  personId: string;
  currency: string;
  split: SummaryView['displaySplit'];
  discount: ChargeState;
  serviceCharge: ChargeState;
  gst: ChargeState;
  conversionRate: number | undefined;
  itemRows: BreakdownItemRow[];
};

function buildReceiptSection({
  id,
  title,
  personId,
  currency,
  split,
  discount,
  serviceCharge,
  gst,
  conversionRate,
  itemRows,
}: BuildReceiptSectionInput): ReceiptBreakdownSection {
  const subtotalCents = sumInvolvedLineAmounts(split.lineItemsByPerson[personId] ?? []);
  return {
    id,
    title,
    subtotalCents,
    currency,
    conversion:
      conversionRate !== undefined
        ? buildConversion(subtotalCents, conversionRate, currency)
        : undefined,
    itemRows,
    chargeRows: buildChargeRows({
      personId,
      currency,
      discount,
      serviceCharge,
      gst,
      discountCents: split.discountByPersonCents[personId] ?? 0,
      serviceCents: split.serviceByPersonCents[personId] ?? 0,
      gstCents: split.gstByPersonCents[personId] ?? 0,
    }),
    emptyMessage: itemRows.length === 0 ? 'No items assigned.' : undefined,
  };
}

function buildItemRows(lines: PersonReceiptLineItem[], currency: string): BreakdownItemRow[] {
  return lines.map((line, index) => ({
    id: `${line.itemId}:${index}`,
    label: line.name,
    amountCents: line.involved ? line.assignedAmountCents : null,
    involved: line.involved,
    currency,
  }));
}

type BuildChargeRowsInput = {
  personId: string;
  currency: string;
  discount: ChargeState;
  serviceCharge: ChargeState;
  gst: ChargeState;
  discountCents: number;
  serviceCents: number;
  gstCents: number;
};

function buildChargeRows({
  currency,
  discount,
  serviceCharge,
  gst,
  discountCents,
  serviceCents,
  gstCents,
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
  return rows;
}

function buildConversion(
  amountCents: number,
  rate: number,
  fromCurrency: string,
): BreakdownConversion {
  return {
    amountCents: Math.round(amountCents * rate),
    rate,
    fromCurrency,
    toCurrency: BASE_CURRENCY,
  };
}

function sumInvolvedLineAmounts(lines: PersonReceiptLineItem[]): number {
  return lines.reduce((sum, line) => (line.involved ? sum + line.assignedAmountCents : sum), 0);
}
