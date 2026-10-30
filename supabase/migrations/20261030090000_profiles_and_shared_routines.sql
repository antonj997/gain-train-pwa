-- Display names and shared routines, applied once with the owner's approval:
--   1. `profiles`: a display name per account, readable and writable only by
--      its owner. Other people see a name only through the feed functions
--      below, as "by <name>" on what that person shared.
--   2. `shared_routines`: routines people choose to share. Like
--      `shared_exercises`, the owner column is hidden from clients, owners
--      update and delete their own rows, and each person has publishing limits.
--   3. `shared_routine_feed()`: every shared routine with whether it is mine
--      and its sharer's display name.
--   4. `shared_exercise_feed()` also returns the sharer's display name
--      (`by_name`). Its return type changes, so it is dropped and recreated with
--      the same grants. Older app versions ignore the new column.
-- Nothing here touches gain_records: a routine's `sharedId` and `sharedFrom`
-- are extra payload fields the routine validation already allows. Both new
-- tables cascade from auth.users, so deleting an account removes their rows.

-- 1. Display names.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  display_name text check (
    display_name is null or (
      display_name = btrim(display_name)
      and length(display_name) between 1 and 40
      and display_name !~ '[[:cntrl:]]'
    )
  ),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy profiles_select_own on public.profiles for select to authenticated
  using ((select auth.uid()) = id);
create policy profiles_insert_own on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);
create policy profiles_update_own on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
-- The app saves with an upsert, which names `id` in its update too; the
-- policies keep it the caller's own.
grant insert (id, display_name), update (id, display_name)
  on public.profiles to authenticated;

create or replace function public.touch_updated_at() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.touch_updated_at() from public, anon, authenticated;
create trigger profiles_touch before insert or update on public.profiles
  for each row execute function public.touch_updated_at();

-- 2. Shared routines. The payload holds the routine's exercises with their
-- planned sets and, for the sharer's own exercises, their definitions. The
-- app checks every field when someone adds a routine; the server keeps the
-- shape and size in bounds.
create or replace function public.shared_routine_payload_ok(payload jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select jsonb_typeof(payload) = 'object'
    and pg_column_size(payload) <= 65536
    and jsonb_typeof(payload->'exercises') = 'array'
    and jsonb_array_length(payload->'exercises') between 1 and 40
    and not exists (
      select 1 from jsonb_array_elements(payload->'exercises') ex
      where jsonb_typeof(ex) <> 'object'
        or jsonb_typeof(ex->'name') is distinct from 'string'
        or length(btrim(ex->>'name')) not between 1 and 100
        or jsonb_typeof(ex->'sets') is distinct from 'array'
        or jsonb_array_length(ex->'sets') > 100
    );
$$;

create table public.shared_routines (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users(id) on delete cascade default auth.uid(),
  -- Routine names may be up to 100 characters in the app.
  name text not null check (length(btrim(name)) between 1 and 100),
  note text check (length(note) <= 500),
  payload jsonb not null check (public.shared_routine_payload_ok(payload)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index shared_routines_owner on public.shared_routines(owner);
alter table public.shared_routines enable row level security;
create policy shared_routines_read on public.shared_routines for select to authenticated
  using (true);
create policy shared_routines_insert on public.shared_routines for insert to authenticated
  with check ((select auth.uid()) = owner);
create policy shared_routines_update on public.shared_routines for update to authenticated
  using ((select auth.uid()) = owner) with check ((select auth.uid()) = owner);
create policy shared_routines_delete on public.shared_routines for delete to authenticated
  using ((select auth.uid()) = owner);
revoke all on public.shared_routines from anon, authenticated;
-- Reading a row never exposes `owner`; the app reads shared_routine_feed().
grant select (id, name, note, payload, created_at, updated_at)
  on public.shared_routines to authenticated;
grant insert (name, note, payload) on public.shared_routines to authenticated;
grant update (name, note, payload) on public.shared_routines to authenticated;
grant delete on public.shared_routines to authenticated;
create trigger shared_routines_touch before update on public.shared_routines
  for each row execute function public.touch_updated_at();

-- Publishing limits per person. Security definer so it can count rows even
-- though the owner column is not readable.
create or replace function public.limit_shared_routines() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('shared-routines:' || new.owner::text, 0));
  if (select count(*) from public.shared_routines
      where owner = new.owner and created_at > now() - interval '1 day') >= 20 then
    raise exception 'You can share up to 20 routines a day. Try again tomorrow.'
      using errcode = 'P0001';
  end if;
  if (select count(*) from public.shared_routines where owner = new.owner) >= 100 then
    raise exception 'You can share up to 100 routines. Stop sharing some first.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.limit_shared_routines() from public, anon, authenticated;
create trigger shared_routines_limit before insert on public.shared_routines
  for each row execute function public.limit_shared_routines();

-- 3. The shared routine feed: whether each row is mine, and who shared it by
-- display name (null when they set none).
create or replace function public.shared_routine_feed()
returns table (
  id uuid, name text, note text, payload jsonb, created_at timestamptz,
  mine boolean, by_name text
)
language sql stable security definer set search_path = '' as $$
  select r.id, r.name, r.note, r.payload, r.created_at,
         r.owner = (select auth.uid()) as mine,
         p.display_name as by_name
  from public.shared_routines r
  left join public.profiles p on p.id = r.owner
  where (select auth.uid()) is not null
  order by r.name
  limit 500;
$$;
revoke all on function public.shared_routine_feed() from public, anon;
grant execute on function public.shared_routine_feed() to authenticated;

-- 4. The shared exercise feed with the sharer's display name.
drop function if exists public.shared_exercise_feed();
create function public.shared_exercise_feed()
returns table (
  id uuid, name text, category text, equipment text, aliases text[],
  load text, measure text, mine boolean, by_name text
)
language sql stable security definer set search_path = '' as $$
  select e.id, e.name, e.category, e.equipment, e.aliases, e.load, e.measure,
         e.owner = (select auth.uid()) as mine,
         p.display_name as by_name
  from public.shared_exercises e
  left join public.profiles p on p.id = e.owner
  where (select auth.uid()) is not null
  order by e.name
  limit 1000;
$$;
revoke all on function public.shared_exercise_feed() from public, anon;
grant execute on function public.shared_exercise_feed() to authenticated;
