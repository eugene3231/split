create table public.groups (
  id uuid primary key,
  invite_hash bytea not null unique,
  invite_code text not null,
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
  id uuid not null unique,
  change jsonb not null,
  user_id uuid not null,
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

-- Puts one op at `p_seq` of a group's log. `p_op` is {id, at, change}, where `change` is the
-- change's JSON as a string. It comes as text so its size is the size the phone sent: the
-- UTF-8 bytes of that text, which the phone can count before it sends (`changeBytes` in
-- backend/limits.ts). The text of a jsonb value is spaced differently and would not match.
create function public.insert_op(p_group_id uuid, p_user uuid, p_seq bigint, p_op jsonb)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_id_text text;
  v_id uuid;
  v_at timestamptz;
  v_change jsonb;
  v_owner uuid;
begin
  if jsonb_typeof(p_op) is distinct from 'object' then
    return 'rejected';
  end if;

  v_id_text := p_op ->> 'id';
  begin
    v_at := (p_op ->> 'at')::timestamptz;
  exception when others then
    v_at := null;
  end;
  if jsonb_typeof(p_op -> 'change') = 'string'
    and octet_length(convert_to(p_op ->> 'change', 'UTF8')) <= 65536
  then
    begin
      v_change := (p_op ->> 'change')::jsonb;
    exception when others then
      v_change := null;
    end;
  end if;

  if v_id_text is null
    or v_id_text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or v_at is null
    or v_change is null
    or jsonb_typeof(v_change) is distinct from 'object'
  then
    return 'rejected';
  end if;

  v_id := v_id_text::uuid;
  select o.group_id into v_owner from public.ops o where o.id = v_id;
  if found then
    return case when v_owner = p_group_id then 'held' else 'rejected' end;
  end if;

  insert into public.ops (group_id, seq, id, change, user_id, at)
  values (p_group_id, p_seq, v_id, v_change, p_user, v_at)
  on conflict (id) do nothing;
  return case when found then 'inserted' else 'rejected' end;
end;
$$;

-- Creates the group with its first op, the `group.created`, at `seq` 1, and makes the caller a
-- member, in one transaction. A group never exists with an empty log, so a friend who joins the
-- moment it appears cannot write ahead of the op that creates it. Calling it again with the same
-- id and code is the same call. Knowing only the id of a group that exists gets nothing: the
-- code must match. A first op that `insert_op` rejects creates nothing.
create function public.create_group(p_group_id uuid, p_invite_code text, p_first_op jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_hash bytea;
  v_existing bytea;
  v_head bigint;
begin
  if v_user is null then
    raise exception 'not_signed_in';
  end if;
  if p_group_id is null or p_invite_code is null or p_invite_code !~ '^[A-Za-z0-9_-]{22,64}$' then
    raise exception 'invalid_invite_code';
  end if;

  v_hash := sha256(convert_to(p_invite_code, 'UTF8'));

  insert into public.groups (id, invite_hash, invite_code, created_by)
  values (p_group_id, v_hash, p_invite_code, v_user)
  on conflict do nothing;

  select g.invite_hash, g.head into v_existing, v_head
  from public.groups g
  where g.id = p_group_id
  for update;
  if v_existing is distinct from v_hash then
    raise exception 'group_exists';
  end if;

  insert into public.memberships (group_id, user_id)
  values (p_group_id, v_user)
  on conflict do nothing;

  if v_head = 0 then
    if public.insert_op(p_group_id, v_user, 1, p_first_op) <> 'inserted' then
      raise exception 'invalid_first_op';
    end if;
    update public.groups g set head = 1 where g.id = p_group_id;
  end if;
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

-- Appends ops in the order given: `p_ops` is a JSON array of the ops `insert_op` takes.
-- Returns {"accepted": [id], "rejected": [id]}.
--   accepted: the op is in this group's log, whether this call put it there or an earlier one.
--   rejected: the op will never be taken, so the phone stops sending it.
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
  v_id jsonb;
  v_result text;
  v_accepted jsonb := '[]'::jsonb;
  v_rejected jsonb := '[]'::jsonb;
begin
  if v_user is null then
    raise exception 'not_signed_in';
  end if;
  if jsonb_typeof(p_ops) is distinct from 'array' then
    raise exception 'invalid_ops';
  end if;
  if not public.is_member(p_group_id) then
    raise exception 'not_a_member';
  end if;

  select g.head into v_head from public.groups g where g.id = p_group_id for update;

  for v_op in
    select e.value from jsonb_array_elements(p_ops) with ordinality as e (value, position)
    order by e.position
  loop
    v_result := public.insert_op(p_group_id, v_user, v_head + 1, v_op);
    v_id := case
      when jsonb_typeof(v_op) = 'object' then coalesce(to_jsonb(v_op ->> 'id'), 'null'::jsonb)
      else 'null'::jsonb
    end;
    if v_result = 'rejected' then
      v_rejected := v_rejected || v_id;
    else
      v_accepted := v_accepted || v_id;
    end if;
    if v_result = 'inserted' then
      v_head := v_head + 1;
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
  public.insert_op(uuid, uuid, bigint, jsonb),
  public.create_group(uuid, text, jsonb),
  public.join_group(text),
  public.append_ops(uuid, jsonb),
  public.my_groups()
from public, anon, authenticated;

grant execute on function
  public.is_member(uuid),
  public.create_group(uuid, text, jsonb),
  public.join_group(text),
  public.append_ops(uuid, jsonb),
  public.my_groups()
to authenticated;

-- A phone hears about new ops and pulls. Realtime applies the select policy above.
alter publication supabase_realtime add table public.ops;
