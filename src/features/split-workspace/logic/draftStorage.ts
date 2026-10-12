import { z } from 'zod';
import type { SessionDraft, WorkspaceState } from '@features/split-workspace/types';
import { BASE_CURRENCY } from '@shared/constants';
import {
  LOCAL_STORAGE_DRAFT_KEY,
  defaultDiscountState,
  defaultGstState,
  defaultServiceChargeState,
} from '@features/split-workspace/constants';
import type { ChargeState, ItemAssignment, Person, Receipt } from '@shared/types';
import {
  createDefaultItem,
  equalShares,
  makeAssignment,
} from '@features/split-workspace/logic/assignment';
import { jsonStorage, lenientArray, parseJson } from '@features/split-workspace/logic/jsonStorage';
import { isNonEmpty, mapNonEmpty } from '@features/split-workspace/logic/nonEmpty';
import { toNullableNumber } from '@shared/logic/core/money';
import { createId } from '@shared/logic/core/id';

// A draft is forgiving field by field: a bad value falls back to its default, and only a draft
// with no usable receipt is rejected.

const text = z.string().catch('');

/** Rounded positive weights; any other entry is dropped. */
const weightsSchema = z
  .record(z.string(), z.unknown())
  .transform((weights) =>
    Object.fromEntries(
      Object.entries(weights).flatMap(([id, weight]) =>
        typeof weight === 'number' && Number.isFinite(weight) && weight > 0
          ? [[id, Math.round(weight)]]
          : [],
      ),
    ),
  );

const unassignedSchema = z
  .number()
  .catch(0)
  .transform((weight) => (Number.isFinite(weight) && weight > 0 ? Math.round(weight) : 0));

// `shares` has no fallback: it is what tells this shape from the version 2 one below.
const assignmentSchema = z
  .object({ shares: weightsSchema, unassignedShare: unassignedSchema })
  .transform(({ shares, unassignedShare }) => makeAssignment(shares, unassignedShare));

/**
 * Version 2 listed the people on an item and kept weights beside them, where a missing weight
 * meant 1. Its `single` mode named one person as a placeholder for "not assigned yet".
 */
const legacyAssignmentSchema = z
  .object({
    mode: z.literal('equal'),
    personIds: lenientArray(z.string()),
    weights: weightsSchema.catch({}),
    unassignedWeight: unassignedSchema,
  })
  .transform(({ personIds, weights, unassignedWeight }) =>
    makeAssignment(
      Object.fromEntries(personIds.map((id) => [id, weights[id] ?? 1])),
      unassignedWeight,
    ),
  );

const itemSchema = z.object({
  id: z
    .string()
    .min(1)
    .catch(() => createId()),
  name: text,
  amountInput: text,
  discountPercentInput: text,
  // Null for a version 2 `single` item, or an assignment that cannot be read.
  assignment: z.union([assignmentSchema, legacyAssignmentSchema]).nullable().catch(null),
});

function chargeSchema(fallback: ChargeState) {
  return z
    .object({
      enabled: z.boolean().catch(false),
      mode: z.enum(['amount', 'percent']).catch('percent'),
      amountInput: text,
      percentInput: z.string().catch(fallback.percentInput),
      detectedConfidence: z
        .unknown()
        .transform(toNullableNumber)
        .catch(() => null),
      detectedSource: z.string().nullable().catch(null),
    })
    .catch(() => ({ ...fallback }));
}

const receiptSchema = z.object({
  id: z
    .string()
    .min(1)
    .catch(() => createId()),
  name: z.string().trim().catch(''),
  items: lenientArray(itemSchema),
  discount: chargeSchema(defaultDiscountState),
  serviceCharge: chargeSchema(defaultServiceChargeState),
  gst: chargeSchema(defaultGstState),
  receiptTotalInput: text,
  roundingInput: text,
  currency: z.string().min(1).catch(BASE_CURRENCY),
  exchangeRateOverride: z.number().positive().nullable().catch(null),
});

const personSchema = z.object({ id: z.string().min(1), name: z.string().trim().min(1) });

const draftSchema: z.ZodType<SessionDraft> = z
  .object({
    version: z.union([z.literal(2), z.literal(3)]),
    people: lenientArray(personSchema),
    receipts: z.array(z.unknown()).catch([]),
    activeReceiptId: text,
    payerMobile: text,
    savedAt: z.string().catch(() => new Date().toISOString()),
  })
  .transform((draft, context) => {
    const receipts = draft.receipts.flatMap((value, index) => {
      const parsed = receiptSchema.safeParse(value);
      return parsed.success ? [finishReceipt(parsed.data, index, draft.people)] : [];
    });
    if (!isNonEmpty(receipts)) {
      context.addIssue({ code: 'custom', message: 'A draft needs at least one receipt.' });
      return z.NEVER;
    }

    return {
      ...draft,
      version: 3 as const,
      receipts,
      activeReceiptId: receipts.some((receipt) => receipt.id === draft.activeReceiptId)
        ? draft.activeReceiptId
        : receipts[0].id,
    };
  });

function finishReceipt(
  receipt: z.infer<typeof receiptSchema>,
  index: number,
  people: Person[],
): Receipt {
  // An item saved without a readable assignment is shared by everyone, as it always has been.
  const everyone: ItemAssignment = equalShares(people.map((person) => person.id));
  const items = receipt.items.map((item) => ({
    ...item,
    assignment: item.assignment ?? everyone,
  }));

  return {
    ...receipt,
    name: receipt.name || `Receipt ${index + 1}`,
    items: items.length > 0 ? items : [createDefaultItem()],
  };
}

const draftStorage = jsonStorage('localStorage', LOCAL_STORAGE_DRAFT_KEY, draftSchema);

export function exportDraftToJson(state: WorkspaceState): string {
  const draft: SessionDraft = {
    version: 3,
    people: state.people,
    // A picked receipt photo is a File, which JSON can't carry.
    receipts: mapNonEmpty(state.receipts, (receipt) => ({ ...receipt, receiptFile: undefined })),
    activeReceiptId: state.activeReceiptId,
    payerMobile: state.payerMobile,
    savedAt: new Date().toISOString(),
  };
  return JSON.stringify(draft, null, 2);
}

export function importDraftFromJson(raw: string): SessionDraft | null {
  return parseJson(raw, draftSchema);
}

export function savePersistedDraft(draft: SessionDraft): void {
  draftStorage.save(draft);
}

export function loadPersistedDraft(): SessionDraft | null {
  return draftStorage.load();
}
