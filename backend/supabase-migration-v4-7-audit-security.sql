-- PERISCOPE v4.7: Audit Logs & Security Management
-- Run ONCE in the Supabase SQL Editor. Safe to re-run.
--
-- 1. adds a "result" column (Success / Failure) to audit_logs and backfills it
-- 2. lets failed sign-ins from unknown accounts be recorded (firebase_uid may be null)
-- 3. makes audit_logs APPEND-ONLY: UPDATE, DELETE and TRUNCATE are rejected by triggers and the
--    privileges are revoked from the API roles. Deleting a patient no longer deletes its audit rows;
--    the link is simply cleared (patient_id -> null) so the history is kept.
-- 4. enables Row Level Security: no client role can write; reads are limited to Admin (all rows)
--    and Doctor (own rows). The PERISCOPE backend uses the service-role key and enforces the same
--    rules in code, so this is defence in depth.

-- ---- 1 & 2: columns --------------------------------------------------------------------------
alter table if exists public.audit_logs add column if not exists result text;

do $$ begin
  alter table public.audit_logs alter column firebase_uid drop not null;
exception when others then null; end $$;

-- Backfill BEFORE the append-only trigger exists (a re-run finds nothing to update).
update public.audit_logs
   set result = case when action ~* '(failed|denied)$' then 'Failure' else 'Success' end
 where result is null;

alter table public.audit_logs alter column result set default 'Success';
alter table public.audit_logs alter column result set not null;

do $$ begin
  alter table public.audit_logs
    add constraint audit_logs_result_chk check (result in ('Success','Failure'));
exception when duplicate_object then null; end $$;

create index if not exists idx_audit_logs_created      on public.audit_logs (created_at desc);
create index if not exists idx_audit_logs_user_created on public.audit_logs (firebase_uid, created_at desc);
create index if not exists idx_audit_logs_action       on public.audit_logs (action, created_at desc);

-- ---- 3: append-only --------------------------------------------------------------------------
-- A patient delete must not be blocked by (or erase) its audit rows: replace any blocking foreign key
-- with ON DELETE SET NULL.
do $$
declare c record; replaced boolean := false;
begin
  for c in
    select con.conname
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_class ref on ref.oid = con.confrelid
     where con.contype = 'f' and con.confdeltype <> 'n'
       and rel.relname = 'audit_logs' and rel.relnamespace = 'public'::regnamespace
       and ref.relname = 'patients'
  loop
    execute format('alter table public.audit_logs drop constraint %I', c.conname);
    replaced := true;
  end loop;
  if replaced then
    alter table public.audit_logs
      add constraint audit_logs_patient_id_fkey
      foreign key (patient_id) references public.patients(id) on delete set null;
  end if;
end $$;

create or replace function public.audit_logs_block_mutation() returns trigger
language plpgsql as $$
begin
  -- The only permitted change: the foreign key clearing patient_id when a patient is deleted.
  if tg_op = 'UPDATE' and old.patient_id is not null and new.patient_id is null
     and (to_jsonb(new) - 'patient_id') = (to_jsonb(old) - 'patient_id') then
    return new;
  end if;
  raise exception 'audit_logs is append-only (% is not allowed)', tg_op using errcode = '42501';
end $$;

create or replace function public.audit_logs_block_truncate() returns trigger
language plpgsql as $$
begin
  raise exception 'audit_logs is append-only (TRUNCATE is not allowed)' using errcode = '42501';
end $$;

drop trigger if exists audit_logs_append_only on public.audit_logs;
create trigger audit_logs_append_only
  before update or delete on public.audit_logs
  for each row execute function public.audit_logs_block_mutation();

drop trigger if exists audit_logs_no_truncate on public.audit_logs;
create trigger audit_logs_no_truncate
  before truncate on public.audit_logs
  for each statement execute function public.audit_logs_block_truncate();

revoke update, delete, truncate on public.audit_logs from public, anon, authenticated, service_role;
revoke insert on public.audit_logs from anon, authenticated;

-- ---- 4: Row Level Security -------------------------------------------------------------------
alter table public.audit_logs enable row level security;

-- Role lookup for the signed-in user. Works when Firebase is connected to Supabase as a third-party
-- auth provider (the JWT "sub" is the Firebase uid). Without that, direct client access simply sees nothing.
create or replace function public.periscope_current_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where firebase_uid = (auth.jwt() ->> 'sub') limit 1
$$;
revoke all on function public.periscope_current_role() from public;
grant execute on function public.periscope_current_role() to authenticated;

drop policy if exists audit_logs_admin_read  on public.audit_logs;
drop policy if exists audit_logs_doctor_read on public.audit_logs;

create policy audit_logs_admin_read on public.audit_logs
  for select to authenticated
  using (public.periscope_current_role() = 'Admin');

create policy audit_logs_doctor_read on public.audit_logs
  for select to authenticated
  using (public.periscope_current_role() = 'Doctor' and firebase_uid = (auth.jwt() ->> 'sub'));

-- No INSERT / UPDATE / DELETE policies exist, so clients cannot write at all.
-- The backend (service role) is the only writer, and it can only append.
