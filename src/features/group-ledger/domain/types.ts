import type { CurrencyCode } from '@shared/constants';
import type { Receipt } from '@shared/types';

declare const brand: unique symbol;
type Brand<T, Name extends string> = T & { readonly [brand]: Name };

export type GroupId = Brand<string, 'GroupId'>;
export type MemberId = Brand<string, 'MemberId'>;
export type EntryId = Brand<string, 'EntryId'>;
/** Made on the device. It is the server's idempotency key and the id of the revision it wrote. */
export type OpId = Brand<string, 'OpId'>;
export type UserId = Brand<string, 'UserId'>;
/** 128 random bits, base64url. Holding it is the only way into a group. */
export type InviteCode = Brand<string, 'InviteCode'>;
/** `YYYY-MM-DD` in the author's time zone. For people to read, never for ordering. */
export type LocalDate = Brand<string, 'LocalDate'>;
/** Integer hundredths of the currency named beside it. */
export type Cents = number;

export interface Member {
  id: MemberId;
  name: string;
  /** Where to PayNow them. Only offered when the group's currency is SGD. */
  paynowMobile: string | null;
  /** Hidden from pickers. Their entries and balance stay, so a member is never deleted. */
  archived: boolean;
}

/**
 * Who paid. `payer` covers the total less what `others` put in, so what was paid always adds up
 * to the total and nothing has to check it. One payer is `others: {}`.
 */
export interface Payment {
  payer: MemberId;
  /** Positive cents, never including `payer`. */
  others: Record<MemberId, Cents>;
}

/** A receipt as an op carries it: the wizard's receipt without the photo, which JSON can't hold. */
export type StoredReceipt = Omit<Receipt, 'receiptFile'>;

/** How `owed` was worked out, kept so the entry reopens in the form that made it. Balances never read it. */
export type ExpenseBasis =
  /** Share weights (CONTEXT.md). "Split between everyone" is a weight of 1 each. */
  | { kind: 'weights'; weights: Record<MemberId, number> }
  /** Amounts were typed per person; `owed` is the source. Also how an opening balance comes in. */
  | { kind: 'amounts' }
  /** An itemised receipt. Its assignment shares are keyed by member id. */
  | { kind: 'receipt'; receipt: StoredReceipt };

/**
 * A posted expense in its own currency. `owed` is worked out once, when the entry is built by
 * `postWeights`, `postAmounts` or `postReceipt` (the only constructors), so every phone and every
 * app version reads the same cents without running the split engine again. The total is the sum
 * of `owed` and is not stored.
 */
export interface ExpenseEntry {
  kind: 'expense';
  id: EntryId;
  title: string;
  date: LocalDate;
  currency: CurrencyCode;
  /** Group-currency units per one unit of `currency`, frozen when saved. 1 when they match. */
  rate: number;
  /** Non-negative cents per member; at least one is positive. */
  owed: Record<MemberId, Cents>;
  payment: Payment;
  basis: ExpenseBasis;
}

/** Money handed over to settle up ("Mark paid"). Always in the group's currency. */
export interface TransferEntry {
  kind: 'transfer';
  id: EntryId;
  date: LocalDate;
  from: MemberId;
  to: MemberId;
  cents: Cents;
}

export type Entry = ExpenseEntry | TransferEntry;

/**
 * Everything anyone can do to a group. An entry is always written whole, because its fields
 * depend on each other: merging two edits field by field could post an entry nobody wrote.
 * The server stores the change as jsonb and never reads it, so a new kind needs no migration.
 */
export type Change =
  | { kind: 'group.created'; name: string; currency: CurrencyCode }
  | { kind: 'group.renamed'; name: string }
  | { kind: 'member.put'; member: Member }
  /** Two phones added the same friend offline. Every reference to `from` reads as `into`. */
  | { kind: 'member.merged'; from: MemberId; into: MemberId }
  /**
   * "This device is that member." Null steps back to nobody. The latest per user wins, except
   * that a claim on a member another user holds is ignored: the first to claim keeps the member.
   */
  | { kind: 'member.claimed'; memberId: MemberId | null }
  /** `base` is the revision the author was looking at; null for a new entry. */
  | { kind: 'entry.put'; entry: Entry; base: OpId | null }
  | { kind: 'entry.removed'; entryId: EntryId; base: OpId };

export type ChangeKind = Change['kind'];

/** A change made on this device that the server has not taken yet. */
export interface PendingOp {
  id: OpId;
  /** Counts up per device, so a clock change can never put a remove before its put. */
  order: number;
  /** This device's clock. Shown as "2 h ago"; never used to order anything. */
  at: string;
  change: Change;
}

/**
 * A change queued on this device that this version of Split cannot read, because another
 * version wrote it before the app was updated. It is still sent as it was stored.
 */
export interface UnreadablePendingOp {
  id: OpId;
  order: number;
  at: string;
}

/** A change the server has taken. `seq` runs 1, 2, 3… per group with no gaps. */
export interface ConfirmedOp {
  id: OpId;
  seq: number;
  at: string;
  /** Null when this version of Split can't read it (written by a newer version). Kept so `seq` stays gapless. */
  change: Change | null;
  /** Stamped by the server from the session, so it can't be forged. */
  userId: UserId;
}

/** This device's copy of one group. The only canonical client state; everything else is derived. */
export interface GroupLog {
  groupId: GroupId;
  inviteCode: InviteCode;
  /** In `seq` order. */
  confirmed: ConfirmedOp[];
  /** In `order` order. An op that is also confirmed is ignored. */
  pending: PendingOp[];
  /** Queued here too, and ordered with `pending` by `order`. Left out when there are none. */
  unreadablePending?: UnreadablePendingOp[];
}

export interface PostedEntry {
  entry: Entry;
  /**
   * What the entry does to each member's balance, in group cents. Worked out from the entry as it
   * was written and only then moved onto the members it merged into, so a merge never rounds a
   * foreign-currency entry again and moves a cent onto someone outside it.
   */
  effect: Record<MemberId, Cents>;
  /** The op that wrote this revision. Pass it as `base` when editing or removing. */
  rev: OpId;
  pending: boolean;
}

export type ActivityWhat =
  | { kind: 'group-created'; name: string }
  | { kind: 'group-renamed'; from: string; to: string }
  | { kind: 'member-added'; member: Member }
  | { kind: 'member-changed'; before: Member; after: Member }
  | { kind: 'member-merged'; from: Member; into: Member }
  | { kind: 'member-claimed'; member: Member | null }
  | { kind: 'entry-added'; entry: Entry }
  | { kind: 'entry-changed'; before: Entry; after: Entry }
  | { kind: 'entry-removed'; entry: Entry }
  | { kind: 'entry-restored'; entry: Entry }
  | { kind: 'unknown' };

export interface Activity {
  opId: OpId;
  at: string;
  /** The member the author had claimed when they wrote it; null if nobody yet. */
  by: MemberId | null;
  pending: boolean;
  what: ActivityWhat;
  /**
   * Set when this op replaced a version its author never saw: two phones changed the same entry
   * apart from each other and this one landed later. Holds the version it replaced.
   */
  replaced: Entry | null;
  /** The change that puts things back as they were before this op; null when there is none. */
  undo: Change | null;
}

export interface Ledger {
  groupId: GroupId;
  name: string;
  currency: CurrencyCode;
  /** In the order they were added, archived ones included, merged-away ones left out. */
  members: Member[];
  /** Live entries, newest date first, then newest in the log. Merged-away ids already read as the member they became. */
  entries: PostedEntry[];
  /** The member this device has claimed; null means "ask who they are". */
  me: MemberId | null;
  /** Members some device holds, so the picker can show who is already taken. */
  claimed: ReadonlySet<MemberId>;
  /** Newest first. */
  activity: Activity[];
}

/** A ledger on a phone that has said which member it is, as every screen behind the gate sees it. */
export interface MyLedger extends Ledger {
  me: MemberId;
}

/** One payment that helps settle the group, in the group's currency. */
export interface Transfer {
  from: MemberId;
  to: MemberId;
  cents: Cents;
}
