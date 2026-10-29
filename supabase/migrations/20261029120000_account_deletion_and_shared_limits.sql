-- Server fixes from the code review, applied once with the owner's approval.
--   1. Account deletion removes the pre-September-2026 tables' rows too (I5).
--      `workout_templates` and `workout_sessions` had a bare user_id with no
--      foreign key, so deleting the auth user left them, and their child rows in
--      `template_exercises` and `workout_sets`, behind.
--   2. `shared_exercises` limits what anyone who signs up can publish (I6):
--      aliases of 1-100 characters, at most 20 of them; at most 20 rows a day
--      and 200 in all per person.
--   3. The owner of a shared row is no longer readable by everyone (I6). The app
--      reads `shared_exercise_feed()`, which says only whether a row is mine.
--   4. Owners can update their own shared rows (I7), so renaming a shared
--      exercise can update its published copy instead of leaving it stale.
-- Nothing here touches gain_records. Step 1 deletes legacy rows whose user no
-- longer exists: the account they belonged to was already deleted.

-- 1. Legacy tables follow their user out.
delete from public.workout_sessions s
  where not exists (select 1 from auth.users u where u.id = s.user_id);
delete from public.workout_templates t
  where not exists (select 1 from auth.users u where u.id = t.user_id);
alter table public.workout_sessions
  drop constraint if exists workout_sessions_user_id_fkey,
  add constraint workout_sessions_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.workout_templates
  drop constraint if exists workout_templates_user_id_fkey,
  add constraint workout_templates_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade;
-- template_exercises and workout_sets already cascade from their parents, and
-- exercises.user_id already references auth.users on delete cascade.

-- 2a. Aliases: each 1-100 characters, at most 20 (the app's own limits).
create or replace function public.shared_aliases_ok(aliases text[])
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(cardinality(aliases), 0) <= 20
    and not exists (
      select 1 from unnest(aliases) a
      where a is null or length(btrim(a)) = 0 or length(a) > 100
    );
$$;
-- Rows published before this limit keep only the aliases that fit it.
update public.shared_exercises
  set aliases = array(
    select a from unnest(aliases) with ordinality as x(a, n)
    where a is not null and length(btrim(a)) > 0 and length(a) <= 100
    order by n limit 20
  )
  where not public.shared_aliases_ok(aliases);
alter table public.shared_exercises
  drop constraint if exists shared_exercises_aliases_check,
  add constraint shared_exercises_aliases_check
    check (public.shared_aliases_ok(aliases));

-- 2b. Publishing limits per person. Security definer so it can count rows even
-- though the owner column is no longer readable (step 3).
create or replace function public.limit_shared_exercises() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('shared:' || new.owner::text, 0));
  if (select count(*) from public.shared_exercises
      where owner = new.owner and created_at > now() - interval '1 day') >= 20 then
    raise exception 'You can share up to 20 exercises a day. Try again tomorrow.'
      using errcode = 'P0001';
  end if;
  if (select count(*) from public.shared_exercises where owner = new.owner) >= 200 then
    raise exception 'You can share up to 200 exercises. Stop sharing some first.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.limit_shared_exercises() from public, anon, authenticated;
drop trigger if exists shared_exercises_limit on public.shared_exercises;
create trigger shared_exercises_limit before insert on public.shared_exercises
  for each row execute function public.limit_shared_exercises();

-- 3. Hide who shared what. Reading a row no longer exposes `owner`; the RLS
-- policies still use it, as they are not limited by column privileges.
revoke select on public.shared_exercises from authenticated;
grant select (id, name, category, equipment, aliases, load, measure, created_at)
  on public.shared_exercises to authenticated;
create or replace function public.shared_exercise_feed()
returns table (
  id uuid, name text, category text, equipment text, aliases text[],
  load text, measure text, mine boolean
)
language sql stable security definer set search_path = '' as $$
  select e.id, e.name, e.category, e.equipment, e.aliases, e.load, e.measure,
         e.owner = (select auth.uid()) as mine
  from public.shared_exercises e
  where (select auth.uid()) is not null
  order by e.name
  limit 1000;
$$;
revoke all on function public.shared_exercise_feed() from public, anon;
grant execute on function public.shared_exercise_feed() to authenticated;

-- 4. Owners may update the published details of their own rows.
drop policy if exists shared_exercises_update on public.shared_exercises;
create policy shared_exercises_update on public.shared_exercises for update to authenticated
  using ((select auth.uid()) = owner) with check ((select auth.uid()) = owner);
grant update (name, category, equipment, aliases, load, measure)
  on public.shared_exercises to authenticated;
