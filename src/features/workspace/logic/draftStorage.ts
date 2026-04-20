import { BASE_CURRENCY } from '@shared/constants';
import {
  LOCAL_STORAGE_DRAFT_KEY,
  defaultDiscountState,
  defaultGstState,
  defaultServiceChargeState,
} from '@features/workspace/constants';
import type {
  ChargeMode,
  ChargeState,
  EditableItem,
  ItemAssignment,
  Person,
  Receipt,
  SessionDraft,
} from '@shared/types';
import { createEmptyItem } from '@shared/logic/assignment/items';
import { toNullableNumber } from '@shared/logic/core/money';
import { isRecord } from '@shared/logic/core/guards';
import { createId } from '@shared/logic/core/id';
function getBrowserStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function exportDraftToJson(state: {
  people: Person[];
  receipts: Receipt[];
  activeReceiptId: string;
  payerMobile: string;
}): string {
  const draft: SessionDraft = {
    version: 2,
    people: state.people,
    receipts: state.receipts,
    activeReceiptId: state.activeReceiptId,
    payerMobile: state.payerMobile,
    savedAt: new Date().toISOString(),
  };
  return JSON.stringify(draft, null, 2);
}

export function importDraftFromJson(raw: string): SessionDraft | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;

    if (parsed.version === 2) {
      return normalizeSessionDraft(parsed);
    }

    return null;
  } catch {
    return null;
  }
}

export function savePersistedDraft(draft: SessionDraft): void {
  const storage = getBrowserStorage();
  if (!storage) {
    return;
  }

  try {
    storage.setItem(LOCAL_STORAGE_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Ignore storage write failures.
  }
}

export function loadPersistedDraft(): SessionDraft | null {
  const storage = getBrowserStorage();
  if (!storage) {
    return null;
  }

  try {
    const raw = storage.getItem(LOCAL_STORAGE_DRAFT_KEY);
    if (!raw) {
      return null;
    }

    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;

    if (parsed.version === 2) {
      return normalizeSessionDraft(parsed);
    }

    return null;
  } catch {
    return null;
  }
}

export function clearPersistedDraft(): void {
  const storage = getBrowserStorage();
  if (!storage) {
    return;
  }

  try {
    storage.removeItem(LOCAL_STORAGE_DRAFT_KEY);
  } catch {
    // Ignore storage remove failures.
  }
}

// ---------------------------------------------------------------------------
// Normalization: v2 SessionDraft
// ---------------------------------------------------------------------------

function normalizeSessionDraft(parsed: Record<string, unknown>): SessionDraft | null {
  const people = normalizeDraftPeople(parsed.people);
  const receipts = normalizeDraftReceipts(parsed.receipts, people);
  if (receipts.length === 0) return null;

  const activeReceiptId =
    typeof parsed.activeReceiptId === 'string' &&
    receipts.some((r) => r.id === parsed.activeReceiptId)
      ? parsed.activeReceiptId
      : receipts[0].id;

  return {
    version: 2,
    people,
    receipts,
    activeReceiptId,
    payerMobile: typeof parsed.payerMobile === 'string' ? parsed.payerMobile : '',
    savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : new Date().toISOString(),
  };
}

function normalizeDraftReceipts(value: unknown, people: Person[]): Receipt[] {
  if (!Array.isArray(value)) return [];

  const receipts = value
    .map((r, index) => normalizeDraftReceipt(r, people, index + 1))
    .filter((r): r is Receipt => r !== null);

  return receipts;
}

function normalizeDraftReceipt(
  value: unknown,
  people: Person[],
  fallbackIndex: number,
): Receipt | null {
  if (!isRecord(value)) return null;

  const id = typeof value.id === 'string' && value.id ? value.id : createId();
  const name =
    typeof value.name === 'string' && value.name.trim()
      ? value.name.trim()
      : `Receipt ${fallbackIndex}`;
  const items = normalizeDraftItems(value.items, people);

  return {
    id,
    name,
    items,
    discount: normalizeDraftChargeState(value.discount, defaultDiscountState),
    serviceCharge: normalizeDraftChargeState(value.serviceCharge, defaultServiceChargeState),
    gst: normalizeDraftChargeState(value.gst, defaultGstState),
    receiptTotalInput: typeof value.receiptTotalInput === 'string' ? value.receiptTotalInput : '',
    currency: typeof value.currency === 'string' && value.currency ? value.currency : BASE_CURRENCY,
    exchangeRateOverride:
      typeof value.exchangeRateOverride === 'number' && value.exchangeRateOverride > 0
        ? value.exchangeRateOverride
        : null,
  };
}

function normalizeDraftPeople(value: unknown): Person[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const nextPeople: Person[] = [];

  for (const candidate of value) {
    if (!isRecord(candidate)) {
      continue;
    }

    const id = typeof candidate.id === 'string' ? candidate.id : '';
    const name = typeof candidate.name === 'string' ? candidate.name.trim() : '';

    if (!id || !name) {
      continue;
    }

    nextPeople.push({ id, name });
  }

  return nextPeople;
}

function normalizeDraftItems(value: unknown, people: Person[]): EditableItem[] {
  if (!Array.isArray(value)) {
    return [createEmptyItem(people)];
  }

  const nextItems = value
    .map((item) => normalizeDraftItem(item, people))
    .filter((item): item is EditableItem => item !== null);

  return nextItems.length > 0 ? nextItems : [createEmptyItem(people)];
}

function normalizeDraftItem(value: unknown, people: Person[]): EditableItem | null {
  if (!isRecord(value)) {
    return null;
  }

  const assignment = normalizeDraftAssignment(value.assignment);

  return {
    id: typeof value.id === 'string' && value.id ? value.id : createId(),
    name: typeof value.name === 'string' ? value.name : '',
    amountInput: typeof value.amountInput === 'string' ? value.amountInput : '',
    discountPercentInput:
      typeof value.discountPercentInput === 'string' ? value.discountPercentInput : '',
    assignment: assignment ?? {
      mode: 'single',
      personId: people[0]?.id ?? '',
      personIds: people.map((person) => person.id),
    },
  };
}

function normalizeDraftAssignment(value: unknown): ItemAssignment | null {
  if (!isRecord(value)) {
    return null;
  }

  const mode = value.mode === 'equal' ? 'equal' : 'single';
  const personId = typeof value.personId === 'string' ? value.personId : '';
  const personIds = Array.isArray(value.personIds)
    ? value.personIds.filter((id): id is string => typeof id === 'string')
    : [];
  const uniquePersonIds = Array.from(new Set(personIds));

  return {
    mode,
    personId,
    personIds: uniquePersonIds,
  };
}

function normalizeDraftChargeState(value: unknown, fallback: ChargeState): ChargeState {
  if (!isRecord(value)) {
    return { ...fallback };
  }

  const mode: ChargeMode = value.mode === 'amount' ? 'amount' : 'percent';
  const detectedConfidence = toNullableNumber(value.detectedConfidence);

  return {
    enabled: value.enabled === true,
    mode,
    amountInput: typeof value.amountInput === 'string' ? value.amountInput : '',
    percentInput:
      typeof value.percentInput === 'string' ? value.percentInput : fallback.percentInput,
    detectedConfidence,
    detectedSource: typeof value.detectedSource === 'string' ? value.detectedSource : null,
  };
}
