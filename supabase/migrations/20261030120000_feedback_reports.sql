-- Bug reports and feature ideas with an admin inbox, applied once with the
-- owner's approval:
--   1. `app_admins`: who is an admin. No client can read or change it; the app
--      asks `is_admin()`. Seeded with the owner's account.
--   2. `feedback_reports`: what people send from Settings → Send feedback. A
--      reporter inserts and reads their own; admins read all, set the status
--      and a note, and delete. Reports outlive a deleted account: `reporter`
--      becomes null. At most 10 reports a day per person.
--   3. `admin_feedback_feed()`: every report with the reporter's display name
--      and email, for admins only.
--   4. A private storage bucket `feedback` for the attached images, at
--      `<uid>/<report id>/<n>.jpg`. People upload into their own folder (40 a
--      day), read it, and remove uploads no report uses yet (a failed send
--      cleans up after itself). Admins read and delete everything.
-- Supabase refuses to delete an auth user who owns storage objects, so the
-- delete-account edge function removes the user's `feedback` images first.
-- Nothing here touches gain_records.

-- 1. Admins.
create table public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.app_admins enable row level security;
revoke all on public.app_admins from anon, authenticated;

insert into public.app_admins (user_id)
  select id from auth.users where lower(email) = 'anton.jonsson99@gmail.com'
  on conflict do nothing;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.app_admins where user_id = (select auth.uid())
  );
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- 2. Reports. Image paths must sit in the reporter's folder for this report,
-- so a report can only point at its own uploads.
create or replace function public.feedback_images_ok(
  images text[], reporter uuid, report uuid
) returns boolean language sql immutable set search_path = '' as $$
  select coalesce(cardinality(images), 0) <= 4
    and not exists (
      select 1 from unnest(images) p
      where p is null
        or p !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9]{1,2}\.(jpg|png|webp)$'
        or (reporter is not null
            and p not like reporter::text || '/' || report::text || '/%')
    );
$$;

create table public.feedback_reports (
  id uuid primary key default gen_random_uuid(),
  -- Null once the reporter deleted their account.
  reporter uuid default auth.uid() references auth.users(id) on delete set null,
  kind text not null check (kind in ('bug', 'feature')),
  title text not null check (
    title = btrim(title) and length(title) between 1 and 120
  ),
  description text not null default '' check (length(description) <= 5000),
  images text[] not null default '{}',
  -- App version, language, user agent, screen size and the last crash.
  details jsonb check (
    details is null or (
      jsonb_typeof(details) = 'object' and octet_length(details::text) <= 16384
    )
  ),
  status text not null default 'open'
    check (status in ('open', 'planned', 'done', 'wontfix')),
  admin_note text check (admin_note is null or length(admin_note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint feedback_reports_images_check
    check (public.feedback_images_ok(images, reporter, id))
);
create index feedback_reports_reporter on public.feedback_reports(reporter, created_at);
create index feedback_reports_status on public.feedback_reports(status, created_at);
alter table public.feedback_reports enable row level security;
create policy feedback_reports_insert_own on public.feedback_reports
  for insert to authenticated
  with check (
    (select auth.uid()) = reporter and status = 'open' and admin_note is null
  );
create policy feedback_reports_select_own on public.feedback_reports
  for select to authenticated using ((select auth.uid()) = reporter);
create policy feedback_reports_select_admin on public.feedback_reports
  for select to authenticated using ((select public.is_admin()));
create policy feedback_reports_update_admin on public.feedback_reports
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy feedback_reports_delete_admin on public.feedback_reports
  for delete to authenticated using ((select public.is_admin()));
revoke all on public.feedback_reports from anon, authenticated;
grant select on public.feedback_reports to authenticated;
-- The app chooses the id, so the images can be uploaded under it first. The
-- reporter, status and note are never the reporter's to set.
grant insert (id, kind, title, description, images, details)
  on public.feedback_reports to authenticated;
grant update (status, admin_note) on public.feedback_reports to authenticated;
grant delete on public.feedback_reports to authenticated;
create trigger feedback_reports_touch before update on public.feedback_reports
  for each row execute function public.touch_updated_at();

create or replace function public.limit_feedback_reports() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('feedback:' || new.reporter::text, 0));
  if (select count(*) from public.feedback_reports
      where reporter = new.reporter and created_at > now() - interval '1 day') >= 10 then
    raise exception 'You can send up to 10 reports a day. Try again tomorrow.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.limit_feedback_reports() from public, anon, authenticated;
create trigger feedback_reports_limit before insert on public.feedback_reports
  for each row execute function public.limit_feedback_reports();

-- 3. The admin inbox.
create or replace function public.admin_feedback_feed()
returns table (
  id uuid, kind text, title text, description text, images text[],
  details jsonb, status text, admin_note text, created_at timestamptz,
  updated_at timestamptz, reporter uuid, reporter_name text,
  reporter_email text
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Not available' using errcode = '42501';
  end if;
  return query
    select r.id, r.kind, r.title, r.description, r.images, r.details,
           r.status, r.admin_note, r.created_at, r.updated_at, r.reporter,
           p.display_name, u.email::text
    from public.feedback_reports r
    left join public.profiles p on p.id = r.reporter
    left join auth.users u on u.id = r.reporter
    order by r.created_at desc
    limit 1000;
end;
$$;
revoke all on function public.admin_feedback_feed() from public, anon;
grant execute on function public.admin_feedback_feed() to authenticated;

-- 4. Images. Private: read through signed URLs only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('feedback', 'feedback', false, 5242880,
          array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do update set
    public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Uploads per person per day: four images on each of the day's ten reports.
create or replace function public.feedback_upload_allowed()
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and (
    select count(*) from storage.objects
    where bucket_id = 'feedback'
      and name like (select auth.uid())::text || '/%'
      and created_at > now() - interval '1 day'
  ) < 40;
$$;
revoke all on function public.feedback_upload_allowed() from public, anon;
grant execute on function public.feedback_upload_allowed() to authenticated;

drop policy if exists feedback_images_insert_own on storage.objects;
create policy feedback_images_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'feedback'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.feedback_upload_allowed()
  );
drop policy if exists feedback_images_select on storage.objects;
create policy feedback_images_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'feedback' and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (select public.is_admin())
    )
  );
-- A reporter may remove their uploads only while no report refers to them,
-- which is how a failed send cleans up. Sent reports keep their images.
drop policy if exists feedback_images_delete on storage.objects;
create policy feedback_images_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'feedback' and (
      (select public.is_admin())
      or (
        (storage.foldername(name))[1] = (select auth.uid())::text
        and not exists (
          select 1 from public.feedback_reports r
          where r.id::text = (storage.foldername(name))[2]
        )
      )
    )
  );
-- No update policy: an uploaded image is never replaced.
