-- Whole workout documents make a workout + all of its sets one atomic write.
-- Soft deletion and a monotonic cursor let intermittently connected phones catch up.
create sequence public.gain_change_seq;
create table public.gain_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  id uuid not null,
  kind text not null check (kind in ('workout', 'routine', 'exercise')),
  payload jsonb not null,
  deleted boolean not null default false,
  revision bigint not null default 1,
  change_seq bigint not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index gain_records_changes on public.gain_records(user_id, change_seq);
create table public.gain_sync_receipts (
  user_id uuid not null references auth.users(id) on delete cascade,
  op_id uuid not null,
  request text not null,
  response jsonb not null,
  primary key(user_id, op_id)
);
alter table public.gain_records enable row level security;
alter table public.gain_sync_receipts enable row level security;
create policy gain_records_read on public.gain_records for select to authenticated using ((select auth.uid()) = user_id);
create policy gain_records_insert on public.gain_records for insert to authenticated with check ((select auth.uid()) = user_id);
create policy gain_records_update on public.gain_records for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy gain_receipts_read on public.gain_sync_receipts for select to authenticated using ((select auth.uid()) = user_id);
create policy gain_receipts_insert on public.gain_sync_receipts for insert to authenticated with check ((select auth.uid()) = user_id);
revoke all on public.gain_records, public.gain_sync_receipts from anon, authenticated;
grant select, insert, update on public.gain_records to authenticated;
grant select, insert on public.gain_sync_receipts to authenticated;
grant usage on sequence public.gain_change_seq to authenticated;

create function public.validate_gain_record() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare ex jsonb; s jsonb; completed_count integer := 0; n numeric;
begin
  -- Hold through commit: no late transaction can publish a lower cursor.
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));
  if tg_op = 'UPDATE' and (new.user_id <> old.user_id or new.id <> old.id or new.kind <> old.kind) then
    raise exception 'Record identity cannot change';
  end if;
  if jsonb_typeof(new.payload) is distinct from 'object' or pg_column_size(new.payload) > 524288
     or jsonb_typeof(new.payload->'name') is distinct from 'string'
     or length(btrim(new.payload->>'name')) not between 1 and 100 then
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
        if (s->>'done')::boolean then
          completed_count := completed_count + 1;
          if coalesce((s->>'reps')::numeric, 0) <= 0 or (s->>'load' <> 'bodyweight' and s->>'weight' is null) then raise exception 'Completed sets need reps and load'; end if;
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
  end if;
  new.revision := case when tg_op = 'INSERT' then 1 else old.revision + 1 end;
  new.change_seq := nextval('public.gain_change_seq');
  new.updated_at := now();
  return new;
end;
$$;
create trigger gain_record_validation before insert or update on public.gain_records for each row execute function public.validate_gain_record();
revoke all on function public.validate_gain_record() from public, anon;

create function public.sync_gain_record(p_id uuid, p_kind text, p_payload jsonb, p_deleted boolean, p_base_revision bigint, p_op_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare uid uuid := auth.uid(); current_record public.gain_records; receipt public.gain_sync_receipts; request_body text; result jsonb;
begin
  if uid is null then raise exception 'Sign in to sync' using errcode = '42501'; end if;
  if p_base_revision is null or p_base_revision < 0 then raise exception 'Invalid revision'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 0));
  request_body := md5(jsonb_build_object('id',p_id,'kind',p_kind,'payload',p_payload,'deleted',p_deleted,'revision',p_base_revision)::text);
  select * into receipt from public.gain_sync_receipts where user_id=uid and op_id=p_op_id;
  if found then
    if receipt.request <> request_body then raise exception 'Operation ID already used'; end if;
    return receipt.response;
  end if;
  select * into current_record from public.gain_records where user_id=uid and id=p_id for update;
  if found and current_record.revision <> p_base_revision then
    return jsonb_build_object('conflict',true,'record',to_jsonb(current_record) - 'user_id' - 'updated_at');
  end if;
  if current_record.id is null then
    if p_base_revision <> 0 then raise exception 'Record missing; restore a backup'; end if;
    insert into public.gain_records(user_id,id,kind,payload,deleted,change_seq) values(uid,p_id,p_kind,p_payload,p_deleted,0) returning * into current_record;
  else
    update public.gain_records set payload=p_payload, deleted=p_deleted where user_id=uid and id=p_id returning * into current_record;
  end if;
  result := jsonb_build_object('record',to_jsonb(current_record) - 'user_id' - 'updated_at');
  insert into public.gain_sync_receipts(user_id,op_id,request,response) values(uid,p_op_id,request_body,jsonb_build_object('record',jsonb_build_object('id',current_record.id,'revision',current_record.revision)));
  return result;
end;
$$;
revoke all on function public.sync_gain_record(uuid,text,jsonb,boolean,bigint,uuid) from public, anon;
grant execute on function public.sync_gain_record(uuid,text,jsonb,boolean,bigint,uuid) to authenticated;

