-- Receipts make retried uploads idempotent. A phone retries an operation until it
-- gets an answer, so a receipt only needs to outlive a long offline stretch.
-- Without pruning the table grows by one row for every upload, forever.
alter table public.gain_sync_receipts
  add column created_at timestamptz not null default now();
create index gain_sync_receipts_age on public.gain_sync_receipts (user_id, created_at);
grant delete on public.gain_sync_receipts to authenticated;
create policy gain_receipts_delete on public.gain_sync_receipts for delete to authenticated using ((select auth.uid()) = user_id);

-- Same as before, plus pruning this user's receipts older than 90 days.
create or replace function public.sync_gain_record(p_id uuid, p_kind text, p_payload jsonb, p_deleted boolean, p_base_revision bigint, p_op_id uuid)
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
  delete from public.gain_sync_receipts where user_id=uid and created_at < now() - interval '90 days';
  return result;
end;
$$;
