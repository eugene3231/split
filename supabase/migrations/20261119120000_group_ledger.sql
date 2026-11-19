-- Group ledger: groups, memberships and the op log. Design: docs/GROUP-LEDGER.md.
--
-- How to run it, once per Supabase project:
--   1. Authentication > Sign In / Providers: turn on "Allow anonymous sign-ins" and keep Email on.
--   2. Authentication > Emails: put {{ .Token }} in the "Magic Link" and "Change Email Address"
--      templates, so both send a six-digit code. The app has no page for a link to land on.
--   3. SQL Editor: paste this whole file and run it. Or, with the CLI: `supabase db push`.
--   4. Copy the project URL and anon key into VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
--
-- What it guarantees:
--   - Clients read through row level security and only the groups they are in.
--   - Clients write only through the functions below. No table has an insert, update or delete
--     policy or grant, so a client can never choose a `seq` or a `user_id`.
--   - `seq` runs 1, 2, 3 per group with no gaps and in commit order, because `append_ops` holds
--     the group's row lock while it numbers and inserts.
--
-- `src/features/group-ledger/backend/fakeServer.ts` states the same rules in TypeScript, and
-- `sqlContract.test.ts` runs one contract suite against both. Change them together.

create table public.groups (
  id uuid primary key,
  -- sha256 of the invite code. `join_group` finds the group by it.
  invite_hash bytea not null unique,
  -- The code itself, readable by members only, so a member who signs in on a new phone can
  -- still share the link and rejoin. Anyone who can read it already holds it.
  invite_code text not null,
  -- The highest `seq` given out. Only `append_ops` moves it, under this row's lock.
  head bigint not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.memberships (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index memberships_user_id_idx on public.memberships (user_id);

create table public.ops (
  group_id uuid not null references public.groups (id) on delete cascade,
  seq bigint not null,
  -- Made on the phone. Unique across every group, so it is the idempotency key.
  id uuid not null unique,
  -- Never read here. A new kind of change needs no migration.
  change jsonb not null,
  -- No foreign key: an op outlives the account that wrote it, or the log would get gaps.
  user_id uuid not null,
  -- The author's clock, for display only.
  at timestamptz not null,
  server_at timestamptz not null default now(),
  primary key (group_id, seq)
);

alter table public.groups enable row level security;
alter table public.memberships enable row level security;
alter table public.ops enable row level security;

-- Supabase grants everything on new public tables to these roles by default, truncate included.
revoke all on table public.groups, public.memberships, public.ops from public, anon, authenticated;
grant select on table public.groups, public.ops to authenticated;

-- Security definer so the policies below can ask about memberships, which nobody may select.
create function public.is_member(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    where m.group_id = p_group_id
      and m.user_id = (select auth.uid())
  );
$$;

create policy groups_select_member on public.groups
  for select to authenticated
  using (public.is_member(id));

create policy ops_select_member on public.ops
  for select to authenticated
  using (public.is_member(group_id));

-- Creates the group and makes the caller a member. Calling it again with the same id and code
-- is the same call. Knowing only the id of a group that exists gets nothing: the code must match.
create function public.create_group(p_group_id uuid, p_invite_code text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_hash bytea;
  v_existing bytea;
begin
  if v_user is null then
    raise exception 'not_signed_in';
  end if;
  if p_group_id is null or p_invite_code is null or p_invite_code !~ '^[A-Za-z0-9_-]{22,64}$' then
    raise exception 'invalid_invite_code';
  end if;

  v_hash := sha256(convert_to(p_invite_code, 'UTF8'));

  -- Does nothing when the id is taken, or when another group already has this code.
  insert into public.groups (id, invite_hash, invite_code, created_by)
  values (p_group_id, v_hash, p_invite_code, v_user)
  on conflict do nothing;

  select g.invite_hash into v_existing from public.groups g where g.id = p_group_id;
  if v_existing is distinct from v_hash then
    raise exception 'group_exists';
  end if;

  insert into public.memberships (group_id, user_id)
  values (p_group_id, v_user)
  on conflict do nothing;
end;
$$;

-- Makes the caller a member of the group the code opens, and says which group that is.
create function public.join_group(p_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_group uuid;
begin
  if v_user is null then
    raise exception 'not_signed_in';
  end if;

  select g.id into v_group
  from public.groups g
  where g.invite_hash = sha256(convert_to(coalesce(p_invite_code, ''), 'UTF8'));
  if v_group is null then
    raise exception 'invite_not_found';
  end if;

  insert into public.memberships (group_id, user_id)
  values (v_group, v_user)
  on conflict do nothing;

  return v_group;
end;
$$;

-- Appends ops in the order given: `p_ops` is a JSON array of {id, at, change}.
-- Returns {"accepted": [id], "rejected": [id]}.
--   accepted: the op is in this group's log, whether this call put it there or an earlier one.
--   rejected: the op will never be taken, so the phone stops sending it. The id is not a
--             lowercase uuid, `at` is not a time, `change` is not an object or is over 64 KB,
--             or the id is already used in another group.
-- One bad op never stops the ops around it.
create function public.append_ops(p_group_id uuid, p_ops jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_head bigint;
  v_op jsonb;
  v_id_text text;
  v_id uuid;
  v_at timestamptz;
  v_owner uuid;
  v_accepted jsonb := '[]'::jsonb;
  v_rejected jsonb := '[]'::jsonb;
begin
  if v_user is null then
    raise exception 'not_signed_in';
  end if;
  if jsonb_typeof(p_ops) is distinct from 'array' then
    raise exception 'invalid_ops';
  end if;
  -- Before the lock, so someone outside the group cannot hold it. Also covers a group that
  -- does not exist, without saying which of the two it was.
  if not public.is_member(p_group_id) then
    raise exception 'not_a_member';
  end if;

  select g.head into v_head from public.groups g where g.id = p_group_id for update;

  for v_op in
    select e.value from jsonb_array_elements(p_ops) with ordinality as e (value, position)
    order by e.position
  loop
    v_id_text := v_op ->> 'id';
    v_at := null;
    begin
      v_at := (v_op ->> 'at')::timestamptz;
    exception when others then
      v_at := null;
    end;

    if v_id_text is null
      or v_id_text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or v_at is null
      or jsonb_typeof(v_op -> 'change') is distinct from 'object'
      or octet_length((v_op -> 'change')::text) > 65536
    then
      v_rejected := v_rejected || coalesce(to_jsonb(v_id_text), 'null'::jsonb);
      continue;
    end if;

    v_id := v_id_text::uuid;
    select o.group_id into v_owner from public.ops o where o.id = v_id;
    if found then
      if v_owner = p_group_id then
        v_accepted := v_accepted || to_jsonb(v_id_text);
      else
        v_rejected := v_rejected || to_jsonb(v_id_text);
      end if;
      continue;
    end if;

    insert into public.ops (group_id, seq, id, change, user_id, at)
    values (p_group_id, v_head + 1, v_id, v_op -> 'change', v_user, v_at)
    on conflict (id) do nothing;
    if found then
      v_head := v_head + 1;
      v_accepted := v_accepted || to_jsonb(v_id_text);
    else
      -- Another group took this id between the check and the insert.
      v_rejected := v_rejected || to_jsonb(v_id_text);
    end if;
  end loop;

  update public.groups g set head = v_head where g.id = p_group_id;

  return jsonb_build_object('accepted', v_accepted, 'rejected', v_rejected);
end;
$$;

-- The groups the caller is in, on any device, with the code that opens each.
create function public.my_groups()
returns table (group_id uuid, invite_code text)
language sql
stable
security definer
set search_path = ''
as $$
  select g.id, g.invite_code
  from public.memberships m
  join public.groups g on g.id = m.group_id
  where m.user_id = (select auth.uid())
  order by m.joined_at, g.id;
$$;

-- Postgres lets everyone execute a new function, and Supabase grants it to anon as well.
revoke execute on function
  public.is_member(uuid),
  public.create_group(uuid, text),
  public.join_group(text),
  public.append_ops(uuid, jsonb),
  public.my_groups()
from public, anon;

grant execute on function
  public.is_member(uuid),
  public.create_group(uuid, text),
  public.join_group(text),
  public.append_ops(uuid, jsonb),
  public.my_groups()
to authenticated;

-- A phone hears about new ops and pulls. Realtime applies the select policy above.
alter publication supabase_realtime add table public.ops;
