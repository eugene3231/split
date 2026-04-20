import type { ChargeState, EditableItem, Person, Receipt } from '@shared/types';
import { DEFAULT_GEMINI_MODEL } from '@features/receipt-scanner/constants';
import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';
import { useCurrencyStore } from '@features/split-workspace/stores/currencyStore';
import { useScanStore } from '@features/receipt-scanner/stores/scanStore';
import { useGeminiStore } from '@features/split-workspace/stores/geminiStore';

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
    assignment: overrides.assignment ?? {
      mode: 'single',
      personId: '',
      personIds: [],
    },
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
    receiptTotalInput: overrides.receiptTotalInput ?? '',
    currency: overrides.currency ?? 'SGD',
    exchangeRateOverride: overrides.exchangeRateOverride ?? null,
  };
}

export function resetAllStores() {
  useReceiptStore.setState({
    peopleInput: '',
    initialized: false,
    people: [],
    receipts: [],
    activeReceiptId: '',
    payerMobile: '',
  });
  useCurrencyStore.setState({
    exchangeRates: { SGD: 1 },
    exchangeRatesLastFetched: null,
  });
  useScanStore.setState({ scanStateByReceipt: {} });
  useGeminiStore.setState({
    geminiApiKeyInput: '',
    rememberGeminiApiKey: false,
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
  useReceiptStore.setState({
    initialized: true,
    people,
    receipts,
    activeReceiptId: options?.activeReceiptId ?? receipts[0]?.id ?? '',
    payerMobile: '',
  });
  if (options?.exchangeRates) {
    useCurrencyStore.setState({ exchangeRates: options.exchangeRates });
  }
}

export function sumValues(record: Record<string, number>): number {
  return Object.values(record).reduce((sum, v) => sum + v, 0);
}
