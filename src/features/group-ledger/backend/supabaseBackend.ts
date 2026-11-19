import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { z } from 'zod';
import type { UserId } from '@features/group-ledger/domain/types';
import { PULL_PAGE_SIZE } from '@features/group-ledger/backend/limits';
import type {
  BackendFailure,
  LedgerBackend,
  Result,
  Session,
} from '@features/group-ledger/backend/port';
import { confirmedOpSchema, idSchemas } from '@features/group-ledger/logic/codec';

// The only file that imports supabase-js or names a table. `createBackend` loads it on demand,
// so a build without the env vars ships none of it. Tables and functions:
// supabase/migrations/*_group_ledger.sql.

type EmailMode = 'link' | 'sign-in';

/** What supabase-js hands back when a call fails, from PostgREST or from Auth. */
interface ServerError {
  message: string;
  name?: string;
  code?: string;
  status?: number;
}

function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

function fail(failure: BackendFailure): { ok: false; failure: BackendFailure } {
  return { ok: false, failure };
}

const UNREADABLE = fail({
  kind: 'failed',
  message: 'The server sent a reply that could not be read.',
});

/** supabase-js reports a dropped connection as an error value whose text is the fetch error. */
function isNetworkError(error: ServerError): boolean {
  return (
    error.name === 'AuthRetryableFetchError' ||
    error.status === 0 ||
    /failed to fetch|fetch failed|networkerror|load failed|network request failed/i.test(
      error.message,
    )
  );
}

/** The SQL functions raise these names; see the migration. */
function toFailure(error: ServerError): BackendFailure {
  if (isNetworkError(error)) return { kind: 'offline' };
  if (error.message.includes('not_a_member')) return { kind: 'not-a-member' };
  if (error.message.includes('invite_not_found')) return { kind: 'invite-not-found' };
  return { kind: 'failed', message: error.message };
}

function thrown(error: unknown): { ok: false; failure: BackendFailure } {
  return fail(toFailure({ message: error instanceof Error ? error.message : String(error) }));
}

function toSession(user: User): Session {
  return {
    userId: user.id as UserId,
    account:
      user.is_anonymous || !user.email
        ? { kind: 'anonymous' }
        : { kind: 'linked', email: user.email },
  };
}

const pushReplySchema = z.object({
  accepted: z.array(idSchemas.opId),
  // An op sent without an id comes back as null. This app never sends one.
  rejected: z.array(z.string().nullable()).transform((ids) =>
    ids.flatMap((id) => {
      const parsed = idSchemas.opId.safeParse(id);
      return parsed.success ? [parsed.data] : [];
    }),
  ),
});

const myGroupsReplySchema = z.array(
  z
    .object({ group_id: idSchemas.groupId, invite_code: idSchemas.inviteCode })
    .transform((row) => ({ groupId: row.group_id, inviteCode: row.invite_code })),
);

/** A row of `ops` as PostgREST sends it, renamed to the domain's field names. */
const opRowsSchema = z.array(
  z.preprocess((row) => (isRecord(row) ? { ...row, userId: row.user_id } : row), confirmedOpSchema),
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function createSupabaseBackend(client: SupabaseClient): LedgerBackend {
  // Which code the last `startEmailSignIn` sent for an email. Lost on a reload, and then
  // `verifyEmailCode` tries both.
  const emailModes = new Map<string, EmailMode>();
  let loadingSession: Promise<Result<Session>> | null = null;

  async function loadSession(): Promise<Result<Session>> {
    try {
      const stored = await client.auth.getSession();
      if (stored.error) return fail(toFailure(stored.error));
      if (stored.data.session) return ok(toSession(stored.data.session.user));

      const signedIn = await client.auth.signInAnonymously();
      if (signedIn.error) return fail(toFailure(signedIn.error));
      return signedIn.data.user ? ok(toSession(signedIn.data.user)) : UNREADABLE;
    } catch (error) {
      return thrown(error);
    }
  }

  /** Callers that arrive together share one answer, so a new phone signs in once, not twice. */
  function session(): Promise<Result<Session>> {
    loadingSession ??= loadSession().finally(() => {
      loadingSession = null;
    });
    return loadingSession;
  }

  async function rpc<T>(
    name: string,
    args: Record<string, unknown>,
    reply: z.ZodType<T>,
  ): Promise<Result<T>> {
    const signedIn = await session();
    if (!signedIn.ok) return signedIn;
    try {
      const { data, error } = await client.rpc(name, args);
      if (error) return fail(toFailure(error));
      const parsed = reply.safeParse(data);
      return parsed.success ? ok(parsed.data) : UNREADABLE;
    } catch (error) {
      return thrown(error);
    }
  }

  return {
    session,

    async startEmailSignIn(email) {
      const signedIn = await session();
      if (!signedIn.ok) return signedIn;
      try {
        // Auth has no "is this email taken" call that an anonymous user may make. Attaching the
        // email answers it: `email_exists` means it already has an account, so sign in to that.
        if (signedIn.value.account.kind === 'anonymous') {
          const linked = await client.auth.updateUser({ email });
          if (!linked.error) {
            emailModes.set(email, 'link');
            return ok({ mode: 'link' });
          }
          if (linked.error.code !== 'email_exists') return fail(toFailure(linked.error));
        }
        const sent = await client.auth.signInWithOtp({
          email,
          options: { shouldCreateUser: false },
        });
        if (sent.error) return fail(toFailure(sent.error));
        emailModes.set(email, 'sign-in');
        return ok({ mode: 'sign-in' });
      } catch (error) {
        return thrown(error);
      }
    },

    async verifyEmailCode(email, code) {
      const mode = emailModes.get(email);
      const types =
        mode === 'link'
          ? (['email_change'] as const)
          : mode === 'sign-in'
            ? (['email'] as const)
            : (['email_change', 'email'] as const);
      let failure: BackendFailure = { kind: 'failed', message: 'That code is not right.' };
      try {
        for (const type of types) {
          const verified = await client.auth.verifyOtp({ email, token: code, type });
          if (!verified.error && verified.data.user) {
            emailModes.delete(email);
            return ok(toSession(verified.data.user));
          }
          if (verified.error) failure = toFailure(verified.error);
          if (failure.kind === 'offline') break;
        }
        return fail(failure);
      } catch (error) {
        return thrown(error);
      }
    },

    async signOut() {
      try {
        const { error } = await client.auth.signOut({ scope: 'local' });
        return error ? fail(toFailure(error)) : ok(undefined);
      } catch (error) {
        return thrown(error);
      }
    },

    myGroups: () => rpc('my_groups', {}, myGroupsReplySchema),

    async publishGroup(group) {
      const created = await rpc(
        'create_group',
        { p_group_id: group.groupId, p_invite_code: group.inviteCode },
        z.unknown(),
      );
      return created.ok ? ok(undefined) : created;
    },

    async joinGroup(inviteCode) {
      const groupId = await rpc('join_group', { p_invite_code: inviteCode }, idSchemas.groupId);
      return groupId.ok ? ok({ groupId: groupId.value, inviteCode }) : groupId;
    },

    push: (groupId, ops) =>
      rpc(
        'append_ops',
        { p_group_id: groupId, p_ops: ops.map(({ id, at, change }) => ({ id, at, change })) },
        pushReplySchema,
      ),

    async pull(groupId, afterSeq) {
      const signedIn = await session();
      if (!signedIn.ok) return signedIn;
      try {
        // Row level security returns no rows, and no error, to someone outside the group.
        const { data, error } = await client
          .from('ops')
          .select('id, seq, at, change, user_id')
          .eq('group_id', groupId)
          .gt('seq', afterSeq)
          .order('seq', { ascending: true })
          .limit(PULL_PAGE_SIZE + 1);
        if (error) return fail(toFailure(error));
        const rows = opRowsSchema.safeParse(data);
        if (!rows.success) return UNREADABLE;
        return ok({
          ops: rows.data.slice(0, PULL_PAGE_SIZE),
          more: rows.data.length > PULL_PAGE_SIZE,
        });
      } catch (error) {
        return thrown(error);
      }
    },

    subscribe(groupId, onPoke) {
      const channel = client
        .channel(`ops:${groupId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'ops', filter: `group_id=eq.${groupId}` },
          () => onPoke(),
        );
      let stopped = false;
      // Joined only once signed in, so the channel carries this user's token. Every (re)join
      // pokes, because inserts made while the socket was down were never delivered.
      void session().then(() => {
        if (stopped) return;
        channel.subscribe((status) => {
          if (status === 'SUBSCRIBED') onPoke();
        });
      });
      return () => {
        stopped = true;
        void client.removeChannel(channel);
      };
    },
  };
}

export function connectSupabaseBackend(url: string, anonKey: string): LedgerBackend {
  return createSupabaseBackend(
    createClient(url, anonKey, {
      // The app never lands on an auth link: every sign-in is a typed code.
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    }),
  );
}
