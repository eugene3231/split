import type {
  ChargeState,
  EditableItem,
  Person,
  Receipt,
  SplitLine,
  SplitResult,
} from '@shared/types';
import { DEFAULT_GEMINI_MODEL } from '@features/receipt-scanner/constants';
import { loadSavedWorkspace, useReceiptStore } from '@features/split-workspace/stores/receiptStore';
import { isNonEmpty } from '@features/split-workspace/logic/nonEmpty';
import { useCurrencyStore } from '@features/split-workspace/stores/currencyStore';
import { useScanStore } from '@features/receipt-scanner/stores/scanStore';
import { useGeminiStore } from '@features/split-workspace/stores/geminiStore';
import { NOBODY } from '@features/split-workspace/logic/assignment';
import { sumAmounts } from '@features/split-workspace/logic/split/amounts';

export const disabledCharge: ChargeState = {
  enabled: false,
  mode: 'percent',
  amountInput: '',
  percentInput: '',
  detectedConfidence: null,
  detectedSource: null,
};

export function percentCharge(percent: string): ChargeState {
  return {
    enabled: true,
    mode: 'percent',
    amountInput: '',
    percentInput: percent,
    detectedConfidence: null,
    detectedSource: null,
  };
}

export function amountCharge(amount: string): ChargeState {
  return {
    enabled: true,
    mode: 'amount',
    amountInput: amount,
    percentInput: '',
    detectedConfidence: null,
    detectedSource: null,
  };
}

let personIdCounter = 0;

export function makePerson(name?: string): Person {
  personIdCounter += 1;
  return { id: `p${personIdCounter}`, name: name ?? `Person ${personIdCounter}` };
}

export function makeItem(overrides: Partial<EditableItem> & { id?: string }): EditableItem {
  return {
    id: overrides.id ?? `i-${Math.random().toString(36).slice(2, 8)}`,
    name: overrides.name ?? 'Item',
    amountInput: overrides.amountInput ?? '10.00',
    discountPercentInput: overrides.discountPercentInput ?? '',
    assignment: overrides.assignment ?? NOBODY,
  };
}

export function makeReceipt(overrides: Partial<Receipt> & { id?: string }): Receipt {
  return {
    id: overrides.id ?? `r-${Math.random().toString(36).slice(2, 8)}`,
    name: overrides.name ?? 'Receipt 1',
    items: overrides.items ?? [],
    discount: overrides.discount ?? { ...disabledCharge },
    serviceCharge: overrides.serviceCharge ?? { ...disabledCharge },
    gst: overrides.gst ?? { ...disabledCharge },
    tip: overrides.tip ?? { ...disabledCharge },
    receiptTotalInput: overrides.receiptTotalInput ?? '',
    roundingInput: overrides.roundingInput ?? '',
    currency: overrides.currency ?? 'SGD',
    exchangeRateOverride: overrides.exchangeRateOverride ?? null,
  };
}

interface PersonSplitInput {
  subtotalCents?: number;
  discount?: number;
  service?: number;
  gst?: number;
  rounding?: number;
  tip?: number;
  /** Left out, it is the subtotal less the discount plus the other charges. */
  totalCents?: number;
  lines?: SplitLine[];
}

/** A split written out by hand, one entry per person. The receipt totals are their sum. */
export function makeSplit(people: Record<string, PersonSplitInput>): SplitResult {
  const byPerson = Object.fromEntries(
    Object.entries(people).map(([personId, person]) => {
      const subtotalCents = person.subtotalCents ?? 0;
      const chargeCents = {
        discount: person.discount ?? 0,
        service: person.service ?? 0,
        gst: person.gst ?? 0,
        rounding: person.rounding ?? 0,
        tip: person.tip ?? 0,
      };
      const totalCents =
        person.totalCents ??
        subtotalCents -
          chargeCents.discount +
          chargeCents.service +
          chargeCents.gst +
          chargeCents.rounding +
          chargeCents.tip;
      return [personId, { subtotalCents, chargeCents, totalCents, lines: person.lines ?? [] }];
    }),
  );
  return { totals: sumAmounts(Object.values(byPerson)), byPerson };
}

export function resetAllStores() {
  useReceiptStore.getState().resetSplit();
  useCurrencyStore.setState({
    exchangeRates: { SGD: 1 },
    exchangeRatesLastFetched: null,
  });
  useScanStore.setState({ scanStateByReceipt: {} });
  useGeminiStore.setState({
    geminiApiKeyInput: '',
    geminiModel: DEFAULT_GEMINI_MODEL,
    showApiKeyModal: false,
  });
  personIdCounter = 0;
}

export function seedStore(
  people: Person[],
  receipts: Receipt[],
  options?: { activeReceiptId?: string; exchangeRates?: Record<string, number> },
) {
  if (!isNonEmpty(receipts)) throw new Error('A workspace needs at least one receipt');
  useReceiptStore.setState({
    people,
    receipts,
    activeReceiptId: options?.activeReceiptId ?? receipts[0].id,
    payerMobile: '',
  });
  if (options?.exchangeRates) {
    useCurrencyStore.setState({ exchangeRates: options.exchangeRates });
  }
}

/** What reloading the page does: the store starts again from what the browser has saved. */
export function reloadWorkspace() {
  useReceiptStore.setState(loadSavedWorkspace());
}

export function sumValues(record: Record<string, number>): number {
  return Object.values(record).reduce((sum, v) => sum + v, 0);
}
