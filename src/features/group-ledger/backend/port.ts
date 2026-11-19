import type {
  ConfirmedOp,
  GroupId,
  InviteCode,
  OpId,
  UserId,
} from '@features/group-ledger/domain/types';

// The seam between the sync engine and a server. The fake and Supabase adapters both implement
// it and one contract suite runs against both. Nothing outside `backend/` imports supabase-js or
// knows a table name.

export type Account = { kind: 'anonymous' } | { kind: 'linked'; email: string };

export interface Session {
  userId: UserId;
  account: Account;
}

/** Expected outcomes are values. A dropped connection is routine, so it is a value too. */
export type BackendFailure =
  | { kind: 'offline' }
  /** This session is not in the group. The engine rejoins with its invite code and retries once. */
  | { kind: 'not-a-member' }
  | { kind: 'invite-not-found' }
  /** A bug or an outage. The engine retries slowly and shows it. */
  | { kind: 'failed'; message: string };

export type Result<T> = { ok: true; value: T } | { ok: false; failure: BackendFailure };

/**
 * An op on its way to the server. `change` is whatever the phone stored: the server never reads
 * it, so a change this version of Split cannot read is sent like any other.
 */
export interface OutgoingOp {
  id: OpId;
  at: string;
  change: unknown;
}

export interface PushOutcome {
  /** Every op now in the group's log, whether this call put it there or an earlier one did. */
  accepted: OpId[];
  /** Ops the server will never take (too large, or the id is used in another group). Not retried. */
  rejected: OpId[];
}

export interface Pulled {
  /** `seq > afterSeq`, ascending, gapless. */
  ops: ConfirmedOp[];
  /** More remain; the engine pulls again at once. */
  more: boolean;
}

export interface JoinedGroup {
  groupId: GroupId;
  inviteCode: InviteCode;
}

export interface LedgerBackend {
  /** Signs in anonymously the first time, then answers from the stored session. */
  session(): Promise<Result<Session>>;

  /**
   * Sends a sign-in code to the email. When the email is new it is attached to the current
   * identity, so the user id and every group stay as they are. When it already has an account,
   * verifying signs this device in to that account instead, and the engine rejoins its groups.
   */
  startEmailSignIn(email: string): Promise<Result<{ mode: 'link' | 'sign-in' }>>;
  verifyEmailCode(email: string, code: string): Promise<Result<Session>>;
  signOut(): Promise<Result<void>>;

  /** Groups this identity has joined, on any device. */
  myGroups(): Promise<Result<JoinedGroup[]>>;

  /**
   * Creates the group with `firstOp`, its `group.created`, at `seq` 1, and makes the caller a
   * member, all in one step: a friend who joins the moment the group exists can never write
   * ahead of the op that creates it. Safe to call again with the same ids.
   */
  publishGroup(group: JoinedGroup, firstOp: OutgoingOp): Promise<Result<void>>;

  /** Makes the caller a member of the group the code opens. Safe to call again. */
  joinGroup(inviteCode: InviteCode): Promise<Result<JoinedGroup>>;

  /** Appends ops in order. An op id the log already holds is left alone and reported accepted. */
  push(groupId: GroupId, ops: readonly OutgoingOp[]): Promise<Result<PushOutcome>>;

  pull(groupId: GroupId, afterSeq: number): Promise<Result<Pulled>>;

  /** Calls `onPoke` when the group may have new ops. Carries no data: pull is the one way in. */
  subscribe(groupId: GroupId, onPoke: () => void): () => void;
}
