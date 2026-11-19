import { PGlite } from '@electric-sql/pglite';
import type { SupabaseClient } from '@supabase/supabase-js';
import { newUuid } from '@features/group-ledger/logic/ids';

const migrations = import.meta.glob<string>('/supabase/migrations/*.sql', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const SUPABASE_BASELINE = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema auth, public to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant execute on functions to anon, authenticated;
  create publication supabase_realtime;
`;

type Role = 'anon' | 'authenticated';
type RpcShape = 'nothing' | 'value' | 'rows';

const RPC_SHAPES: Record<string, RpcShape> = {
  create_group: 'nothing',
  join_group: 'value',
  append_ops: 'value',
  my_groups: 'rows',
};

interface Reply {
  data: unknown;
  error: { message: string; code: string } | null;
}

function literal(value: unknown): string {
  if (typeof value === 'number') return String(value);
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return `'${text.replaceAll("'", "''")}'`;
}

export interface PgliteProject {
  client(): Promise<{ userId: string; client: SupabaseClient }>;
  sql(userId: string, role: Role, query: string): Promise<Reply>;
  deleteUser(userId: string): Promise<void>;
  close(): Promise<void>;
}

export async function createPgliteProject(): Promise<PgliteProject> {
  const db = new PGlite();
  await db.exec(SUPABASE_BASELINE);
  for (const path of Object.keys(migrations).sort()) {
    await db.exec(migrations[path]);
  }

  async function sql(userId: string, role: Role, query: string): Promise<Reply> {
    try {
      const data = await db.transaction(async (tx) => {
        await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [userId]);
        await tx.exec(`set local role ${role}`);
        const result = await tx.query<{ data: unknown }>(query);
        return result.rows[0]?.data ?? null;
      });
      return { data, error: null };
    } catch (error) {
      const { message, code } = error as { message: string; code?: string };
      return { data: null, error: { message, code: code ?? '' } };
    }
  }

  function rpc(userId: string, name: string, args: Record<string, unknown>): Promise<Reply> {
    const call = `public.${name}(${Object.entries(args)
      .map(([key, value]) => `${key} => ${literal(value)}`)
      .join(', ')})`;
    const query = {
      nothing: `select null as data from (select ${call}) done`,
      value: `select to_jsonb(${call}) as data`,
      rows: `select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) as data from ${call} r`,
    }[RPC_SHAPES[name]];
    return sql(userId, 'authenticated', query);
  }

  function select(userId: string, table: string, columns: string) {
    const where: string[] = [];
    let tail = '';
    const builder = {
      eq(column: string, value: unknown) {
        where.push(`${column} = ${literal(value)}`);
        return builder;
      },
      gt(column: string, value: unknown) {
        where.push(`${column} > ${literal(value)}`);
        return builder;
      },
      order(column: string) {
        tail += ` order by ${column}`;
        return builder;
      },
      limit(count: number) {
        tail += ` limit ${count}`;
        return builder;
      },
      then<T>(resolve: (reply: Reply) => T) {
        const rows = `select ${columns} from public.${table} where ${where.join(' and ') || 'true'}${tail}`;
        return sql(
          userId,
          'authenticated',
          `select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) as data from (${rows}) t`,
        ).then(resolve);
      },
    };
    return builder;
  }

  return {
    async client() {
      const userId = newUuid();
      await db.query('insert into auth.users (id) values ($1)', [userId]);
      const user = { id: userId, is_anonymous: true };
      const client = {
        auth: { getSession: async () => ({ data: { session: { user } }, error: null }) },
        rpc: (name: string, args: Record<string, unknown>) => rpc(userId, name, args),
        from: (table: string) => ({
          select: (columns: string) => select(userId, table, columns),
        }),
      };
      return { userId, client: client as unknown as SupabaseClient };
    },
    sql,
    async deleteUser(userId) {
      await db.query('delete from auth.users where id = $1', [userId]);
    },
    close: () => db.close(),
  };
}
