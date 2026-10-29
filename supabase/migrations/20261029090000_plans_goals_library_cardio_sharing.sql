-- Batch B/D/C server support, applied once with the owner's approval:
--   1. record kinds `plan`, `goal` and `library` (synced training plans, goals and
--      the per-user list of hidden exercises);
--   2. cardio sets (`measure = 'cardio'` with durationSec, distanceM, level and
--      calories) in workout and routine payloads;
--   3. the `shared_exercises` table behind "Share to library".
-- Nothing here rewrites existing rows. Older app versions that meet the new kinds
-- park those rows (they do not know the kind) and read them after an update.

alter table public.gain_records drop constraint if exists gain_records_kind_check;
alter table public.gain_records
  add constraint gain_records_kind_check
  check (kind in ('workout', 'routine', 'exercise', 'plan', 'goal', 'library'));

-- Same trigger as before with these changes only:
--   * a name is required for workout, routine, exercise and plan records, not for
--     goal and library records, which have none;
--   * sets may carry cardio fields, checked when present; a cardio set keeps
--     reps and weight null and is complete once durationSec is above zero;
--   * validation for the plan, goal and library kinds (lenient on purpose, so the
--     client can add fields without another migration).
create or replace function public.validate_gain_record() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare ex jsonb; s jsonb; wk jsonb; e jsonb; completed_count integer := 0; n numeric; cardio boolean; f text; lim numeric;
begin
  -- Hold through commit: no late transaction can publish a lower cursor.
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));
  if tg_op = 'UPDATE' and (new.user_id <> old.user_id or new.id <> old.id or new.kind <> old.kind) then
    raise exception 'Record identity cannot change';
  end if;
  if jsonb_typeof(new.payload) is distinct from 'object' or pg_column_size(new.payload) > 524288 then
    raise exception 'Invalid record name or size';
  end if;
  if new.kind in ('workout', 'routine', 'exercise', 'plan')
     and (jsonb_typeof(new.payload->'name') is distinct from 'string'
          or length(btrim(new.payload->>'name')) not between 1 and 100) then
    raise exception 'Invalid record name or size';
  end if;
  if new.kind in ('workout', 'routine') then
    if jsonb_typeof(new.payload->'exercises') is distinct from 'array' or jsonb_array_length(new.payload->'exercises') > 100 then
      raise exception 'Invalid exercises';
    end if;
    for ex in select value from jsonb_array_elements(new.payload->'exercises') loop
      perform (ex->>'id')::uuid;
      if ex->>'id' is null or length(ex->>'exerciseId') is null or length(ex->>'exerciseId') not between 1 and 200
        or jsonb_typeof(ex->'name') is distinct from 'string' or length(btrim(ex->>'name')) not between 1 and 100
        or jsonb_typeof(ex->'sets') is distinct from 'array' or jsonb_array_length(ex->'sets') > 100 then raise exception 'Invalid exercise'; end if;
      for s in select value from jsonb_array_elements(ex->'sets') loop
        perform (s->>'id')::uuid;
        if s->>'id' is null or (s->>'load') is null or s->>'load' not in ('weight','bodyweight','assisted')
          or s->>'section' is null or s->>'section' not in ('working','warmup','winddown')
          or jsonb_typeof(s->'done') is distinct from 'boolean'
          or not (s ? 'reps' and s ? 'weight') then raise exception 'Invalid set'; end if;
        if s ? 'measure' and s->'measure' <> 'null'::jsonb and jsonb_typeof(s->'measure') <> 'string' then
          raise exception 'Invalid measure';
        end if;
        cardio := coalesce(s->>'measure' = 'cardio', false);
        if s->'reps' <> 'null'::jsonb then
          if jsonb_typeof(s->'reps') <> 'number' then raise exception 'Invalid reps'; end if;
          n := (s->>'reps')::numeric;
          if n < 0 or n > 10000 or n <> trunc(n) then raise exception 'Invalid reps'; end if;
        end if;
        if s->'weight' <> 'null'::jsonb then
          if jsonb_typeof(s->'weight') <> 'number' then raise exception 'Invalid weight'; end if;
          n := (s->>'weight')::numeric;
          if n < 0 or n > 10000 then raise exception 'Invalid weight'; end if;
        end if;
        -- Optional cardio fields: durationSec, distanceM, level, calories.
        for f in select unnest(array['durationSec','distanceM','level','calories']) loop
          if s ? f and s->f <> 'null'::jsonb then
            if jsonb_typeof(s->f) <> 'number' then raise exception 'Invalid cardio value'; end if;
            n := (s->>f)::numeric;
            lim := (array[86400, 1000000, 100, 100000])[array_position(array['durationSec','distanceM','level','calories'], f)];
            if n < 0 or n > lim then raise exception 'Invalid cardio value'; end if;
          end if;
        end loop;
        if cardio and (s->'reps' <> 'null'::jsonb or s->'weight' <> 'null'::jsonb) then
          raise exception 'Cardio sets have no reps or weight';
        end if;
        if (s->>'done')::boolean then
          completed_count := completed_count + 1;
          if cardio then
            if coalesce((s->>'durationSec')::numeric, 0) <= 0 then raise exception 'Completed cardio sets need a duration'; end if;
          elsif coalesce((s->>'reps')::numeric, 0) <= 0 or (s->>'load' <> 'bodyweight' and s->>'weight' is null) then raise exception 'Completed sets need reps and load'; end if;
        end if;
      end loop;
    end loop;
  end if;
  if new.kind = 'workout' then
    if new.payload->>'status' is null or new.payload->>'status' not in ('draft','completed')
      or new.payload->>'date' is null or new.payload->>'date' !~ '^\d{4}-\d{2}-\d{2}$'
      or to_char((new.payload->>'date')::date,'YYYY-MM-DD') <> new.payload->>'date'
      or not (new.payload ? 'duration' and new.payload ? 'startedAt') then raise exception 'Invalid workout'; end if;
    if new.payload->'duration' <> 'null'::jsonb then
      n := (new.payload->>'duration')::numeric;
      if jsonb_typeof(new.payload->'duration') <> 'number' or n < 0 or n > 1440 or n <> trunc(n) then raise exception 'Invalid duration'; end if;
    end if;
    if new.payload->'startedAt' <> 'null'::jsonb and jsonb_typeof(new.payload->'startedAt') <> 'number' then raise exception 'Invalid start time'; end if;
    if new.payload->>'status' = 'completed' and completed_count = 0 then raise exception 'Complete at least one set'; end if;
  elsif new.kind = 'exercise' then
    if jsonb_typeof(new.payload->'category') is distinct from 'string' or length(new.payload->>'category') > 50
      or jsonb_typeof(new.payload->'note') is distinct from 'string' or length(new.payload->>'note') > 1000
      or jsonb_typeof(new.payload->'favourite') is distinct from 'boolean' then raise exception 'Invalid custom exercise'; end if;
  elsif new.kind = 'plan' then
    if new.payload->>'startDate' is null or new.payload->>'startDate' !~ '^\d{4}-\d{2}-\d{2}$'
      or to_char((new.payload->>'startDate')::date,'YYYY-MM-DD') <> new.payload->>'startDate'
      or new.payload->>'endDate' is null or new.payload->>'endDate' !~ '^\d{4}-\d{2}-\d{2}$'
      or to_char((new.payload->>'endDate')::date,'YYYY-MM-DD') <> new.payload->>'endDate'
      or new.payload->>'endDate' < new.payload->>'startDate' then raise exception 'Invalid plan dates'; end if;
    if jsonb_typeof(new.payload->'cycleWeeks') is distinct from 'number' then raise exception 'Invalid plan cycle'; end if;
    n := (new.payload->>'cycleWeeks')::numeric;
    if n < 1 or n > 6 or n <> trunc(n) then raise exception 'Invalid plan cycle'; end if;
    if jsonb_typeof(new.payload->'template') is distinct from 'array' or jsonb_array_length(new.payload->'template') <> n then
      raise exception 'Invalid plan template';
    end if;
    for wk in select value from jsonb_array_elements(new.payload->'template') loop
      if jsonb_typeof(wk) is distinct from 'array' or jsonb_array_length(wk) <> 7 then raise exception 'Invalid plan template'; end if;
    end loop;
    if jsonb_typeof(new.payload->'overrides') is distinct from 'object' then raise exception 'Invalid plan overrides'; end if;
    if new.payload ? 'goalIds' and (jsonb_typeof(new.payload->'goalIds') <> 'array' or jsonb_array_length(new.payload->'goalIds') > 50) then
      raise exception 'Invalid plan goals';
    end if;
  elsif new.kind = 'goal' then
    if new.payload->>'kind' is null or new.payload->>'kind' not in ('bodyweight','lift')
      or jsonb_typeof(new.payload->'targetKg') is distinct from 'number'
      or (new.payload->>'targetKg')::numeric <= 0 or (new.payload->>'targetKg')::numeric > 10000
      or new.payload->>'byDate' is null or new.payload->>'byDate' !~ '^\d{4}-\d{2}-\d{2}$'
      or to_char((new.payload->>'byDate')::date,'YYYY-MM-DD') <> new.payload->>'byDate'
      or jsonb_typeof(new.payload->'createdAt') is distinct from 'number' then raise exception 'Invalid goal'; end if;
    if new.payload->>'kind' = 'lift' and (jsonb_typeof(new.payload->'exerciseId') is distinct from 'string'
      or length(new.payload->>'exerciseId') not between 1 and 200) then raise exception 'Invalid goal'; end if;
  elsif new.kind = 'library' then
    if jsonb_typeof(new.payload->'hiddenExerciseIds') is distinct from 'array' or jsonb_array_length(new.payload->'hiddenExerciseIds') > 5000 then
      raise exception 'Invalid library';
    end if;
    for e in select value from jsonb_array_elements(new.payload->'hiddenExerciseIds') loop
      if jsonb_typeof(e) <> 'string' or length(e #>> '{}') not between 1 and 200 then raise exception 'Invalid library'; end if;
    end loop;
  end if;
  new.revision := case when tg_op = 'INSERT' then 1 else old.revision + 1 end;
  new.change_seq := nextval('public.gain_change_seq');
  new.updated_at := now();
  return new;
end;
$$;

-- Exercises people choose to share. Anyone signed in can read; only the owner
-- publishes or removes their own rows.
create table public.shared_exercises (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null check (length(btrim(name)) between 1 and 100),
  category text not null check (length(category) <= 50),
  equipment text check (length(equipment) <= 50),
  aliases text[] not null default '{}' check (cardinality(aliases) <= 20),
  load text check (load in ('weight','bodyweight','assisted')),
  measure text check (length(measure) <= 20),
  created_at timestamptz not null default now()
);
create index shared_exercises_owner on public.shared_exercises(owner);
alter table public.shared_exercises enable row level security;
create policy shared_exercises_read on public.shared_exercises for select to authenticated using (true);
create policy shared_exercises_insert on public.shared_exercises for insert to authenticated with check ((select auth.uid()) = owner);
create policy shared_exercises_delete on public.shared_exercises for delete to authenticated using ((select auth.uid()) = owner);
revoke all on public.shared_exercises from anon, authenticated;
grant select, insert, delete on public.shared_exercises to authenticated;
