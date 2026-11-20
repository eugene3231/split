import { z } from 'zod';
import { CURRENCY_CODES } from '@shared/constants';
import type { ChargeState, EditableItem } from '@shared/types';
import type {
  Change,
  ConfirmedOp,
  Entry,
  EntryId,
  ExpenseBasis,
  GroupId,
  GroupLog,
  InviteCode,
  LocalDate,
  Member,
  MemberId,
  OpId,
  Payment,
  PendingOp,
  StoredReceipt,
  UserId,
} from '@features/group-ledger/domain/types';

function brandedId<Id extends string>() {
  return z
    .string()
    .min(1)
    .transform((value) => value as Id);
}

const memberId = brandedId<MemberId>();
const entryId = brandedId<EntryId>();
const opId = brandedId<OpId>();
const userId = brandedId<UserId>();
const groupId = brandedId<GroupId>();
const inviteCode = brandedId<InviteCode>();

const localDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .transform((value) => value as LocalDate);

const currency = z.enum(CURRENCY_CODES);
const cents = z.number().int();

function byMember<Value>(value: z.ZodType<Value>) {
  return z
    .record(z.string().min(1), value)
    .transform((record) => record as Record<MemberId, Value>);
}

const memberSchema: z.ZodType<Member> = z.strictObject({
  id: memberId,
  name: z.string(),
  paynowMobile: z.string().nullable(),
  archived: z.boolean(),
});

const paymentSchema: z.ZodType<Payment> = z
  .strictObject({ payer: memberId, others: byMember(cents.positive()) })
  .refine((payment) => !Object.hasOwn(payment.others, payment.payer));

const chargeSchema: z.ZodType<ChargeState> = z.strictObject({
  enabled: z.boolean(),
  mode: z.enum(['amount', 'percent']),
  amountInput: z.string(),
  percentInput: z.string(),
  detectedConfidence: z.number().nullable(),
  detectedSource: z.string().nullable(),
});

const itemSchema: z.ZodType<EditableItem> = z.strictObject({
  id: z.string().min(1),
  name: z.string(),
  amountInput: z.string(),
  discountPercentInput: z.string(),
  assignment: z.strictObject({
    shares: z.record(z.string().min(1), z.number().nonnegative()),
    unassignedShare: z.number().nonnegative(),
  }),
});

const receiptSchema: z.ZodType<StoredReceipt> = z.strictObject({
  id: z.string().min(1),
  name: z.string(),
  items: z.array(itemSchema),
  discount: chargeSchema,
  serviceCharge: chargeSchema,
  gst: chargeSchema,
  receiptTotalInput: z.string(),
  roundingInput: z.string(),
  currency,
  exchangeRateOverride: z.number().positive().nullable(),
});

const basisSchema: z.ZodType<ExpenseBasis> = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('weights'), weights: byMember(z.number().nonnegative()) }),
  z.strictObject({ kind: z.literal('amounts') }),
  z.strictObject({ kind: z.literal('receipt'), receipt: receiptSchema }),
]);

const expenseSchema = z.strictObject({
  kind: z.literal('expense'),
  id: entryId,
  title: z.string(),
  date: localDate,
  currency,
  rate: z.number().positive(),
  owed: byMember(cents.nonnegative()).refine((owed) =>
    Object.values(owed).some((value) => value > 0),
  ),
  payment: paymentSchema,
  basis: basisSchema,
});

const transferSchema = z.strictObject({
  kind: z.literal('transfer'),
  id: entryId,
  date: localDate,
  from: memberId,
  to: memberId,
  cents: cents.nonnegative(),
});

const entrySchema: z.ZodType<Entry> = z.discriminatedUnion('kind', [expenseSchema, transferSchema]);

export const changeSchema: z.ZodType<Change> = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('group.created'), name: z.string(), currency }),
  z.strictObject({ kind: z.literal('group.renamed'), name: z.string() }),
  z.strictObject({ kind: z.literal('member.put'), member: memberSchema }),
  z.strictObject({ kind: z.literal('member.merged'), from: memberId, into: memberId }),
  z.strictObject({ kind: z.literal('member.claimed'), memberId: memberId.nullable() }),
  z.strictObject({ kind: z.literal('entry.put'), entry: entrySchema, base: opId.nullable() }),
  z.strictObject({ kind: z.literal('entry.removed'), entryId, base: opId }),
]);

/** Null for a change this version of Split cannot read. Never throws. */
export function parseChange(payload: unknown): Change | null {
  const result = changeSchema.safeParse(payload);
  return result.success ? result.data : null;
}

export const pendingOpSchema: z.ZodType<PendingOp> = z.object({
  id: opId,
  order: z.number().int().nonnegative(),
  at: z.string(),
  change: changeSchema,
});

/** An op whose change cannot be read still parses, with `change: null`, so `seq` keeps no gaps. */
export const confirmedOpSchema: z.ZodType<ConfirmedOp> = z.object({
  id: opId,
  seq: z.number().int().positive(),
  at: z.string(),
  change: z.unknown().transform(parseChange),
  userId,
});

export const groupLogSchema: z.ZodType<GroupLog> = z.object({
  groupId,
  inviteCode,
  confirmed: z.array(confirmedOpSchema),
  pending: z.array(pendingOpSchema),
});

export const idSchemas = { groupId, inviteCode, opId, userId };
