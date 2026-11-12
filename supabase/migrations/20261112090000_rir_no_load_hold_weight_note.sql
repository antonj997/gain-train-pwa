-- RIR, load "none", weighted holds and a workout note, applied once with the
-- owner's approval. Nothing here rewrites existing rows, and every row that is
-- valid now stays valid. Until it is applied the app keeps working: a set with
-- load "none" is refused by the old trigger, so that one record waits with a
-- sync error and is sent again on the next edit or Retry; the other changes
-- already pass (unknown fields go through unchecked). This accepts and checks:
--   1. a set's load may be 'none' (no weight, no bodyweight: planks,
--      stretches, mobility work). Such a set has a null weight, and a checked
--      one needs only its reps or seconds;
--   2. a set may carry `rir`, reps in reserve: a whole number from 0 to 3
--      (3 means "3 or more"), or null;
--   3. a workout may carry `note`, a plain-text note on the whole workout: a
--      string of at most 1000 characters, or null;
--   4. a timed hold (measure 'seconds') may carry a weight: load 'weight' with
--      a weight, or bodyweight with an added weight. The trigger never tied the
--      load to the measure, so this only writes it down; the weight is checked
--      like any other set's.
-- No legacy tables are touched, so no to_regclass guard is needed. Same
-- trigger as 20261105120000 otherwise. Older app versions keep `rir` and
-- `note` as they are when they save (unknown fields are carried over), and
-- park rows with load 'none' or a weighted hold until they are updated.

create or replace function public.validate_gain_record() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare ex jsonb; s jsonb; wk jsonb; e jsonb; k text; completed_count integer := 0; n numeric; cardio boolean; f text; lim numeric;
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
        if s->>'id' is null or (s->>'load') is null or s->>'load' not in ('weight','bodyweight','assisted','none')
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
        -- Optional cardio fields: durationSec, distanceM, level, calories,
        -- inclinePct and heartRate.
        for f in select unnest(array['durationSec','distanceM','level','calories','inclinePct','heartRate']) loop
          if s ? f and s->f <> 'null'::jsonb then
            if jsonb_typeof(s->f) <> 'number' then raise exception 'Invalid cardio value'; end if;
            n := (s->>f)::numeric;
            lim := (array[86400, 1000000, 100, 100000, 100, 300])[array_position(array['durationSec','distanceM','level','calories','inclinePct','heartRate'], f)];
            if n < 0 or n > lim then raise exception 'Invalid cardio value'; end if;
          end if;
        end loop;
        -- A set with no load has no weight.
        if s->>'load' = 'none' and s->'weight' <> 'null'::jsonb then raise exception 'Invalid weight'; end if;
        -- Optional reps in reserve: a whole number, 0 to 3 (3 means "3+").
        if s ? 'rir' and s->'rir' <> 'null'::jsonb then
          if jsonb_typeof(s->'rir') <> 'number' then raise exception 'Invalid RIR'; end if;
          n := (s->>'rir')::numeric;
          if n < 0 or n > 3 or n <> trunc(n) then raise exception 'Invalid RIR'; end if;
        end if;
        -- Optional hold per rep: whole seconds, 0 to 600.
        if s ? 'holdSec' and s->'holdSec' <> 'null'::jsonb then
          if jsonb_typeof(s->'holdSec') <> 'number' then raise exception 'Invalid hold'; end if;
          n := (s->>'holdSec')::numeric;
          if n < 0 or n > 600 or n <> trunc(n) then raise exception 'Invalid hold'; end if;
        end if;
        if cardio and (s->'reps' <> 'null'::jsonb or s->'weight' <> 'null'::jsonb) then
          raise exception 'Cardio sets have no reps or weight';
        end if;
        if (s->>'done')::boolean then
          completed_count := completed_count + 1;
          if cardio then
            if coalesce((s->>'durationSec')::numeric, 0) <= 0 then raise exception 'Completed cardio sets need a duration'; end if;
          elsif coalesce((s->>'reps')::numeric, 0) <= 0 or (s->>'load' not in ('bodyweight','none') and s->>'weight' is null) then raise exception 'Completed sets need reps and load'; end if;
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
    -- Optional note on the whole workout: plain text, at most 1000 characters.
    if new.payload ? 'note' and new.payload->'note' <> 'null'::jsonb
      and (jsonb_typeof(new.payload->'note') <> 'string' or length(new.payload->>'note') > 1000) then
      raise exception 'Invalid workout note';
    end if;
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
    -- Optional cardioFields: exercise id to the fields its cardio rows show.
    -- Lenient on field names, so the client can add fields without a migration.
    if new.payload ? 'cardioFields' and new.payload->'cardioFields' <> 'null'::jsonb then
      if jsonb_typeof(new.payload->'cardioFields') <> 'object'
        or (select count(*) from jsonb_object_keys(new.payload->'cardioFields')) > 2000 then
        raise exception 'Invalid library';
      end if;
      for k, e in select key, value from jsonb_each(new.payload->'cardioFields') loop
        if length(k) not between 1 and 200 or jsonb_typeof(e) <> 'object'
          or jsonb_typeof(e->'fields') is distinct from 'array' or jsonb_array_length(e->'fields') > 20
          or (e ? 'distanceUnit' and jsonb_typeof(e->'distanceUnit') <> 'string') then
          raise exception 'Invalid library';
        end if;
      end loop;
    end if;
    -- Optional repHold: ids of exercises counted as reps + hold.
    if new.payload ? 'repHold' and new.payload->'repHold' <> 'null'::jsonb then
      if jsonb_typeof(new.payload->'repHold') <> 'array' or jsonb_array_length(new.payload->'repHold') > 2000 then
        raise exception 'Invalid library';
      end if;
      for e in select value from jsonb_array_elements(new.payload->'repHold') loop
        if jsonb_typeof(e) <> 'string' or length(e #>> '{}') not between 1 and 200 then raise exception 'Invalid library'; end if;
      end loop;
    end if;
  end if;
  new.revision := case when tg_op = 'INSERT' then 1 else old.revision + 1 end;
  new.change_seq := nextval('public.gain_change_seq');
  new.updated_at := now();
  return new;
end;
$$;
