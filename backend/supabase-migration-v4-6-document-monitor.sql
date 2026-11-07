-- PERISCOPE v4.6: Document Processing Monitor
-- Run ONCE in the Supabase SQL Editor. Safe to re-run.
-- Adds columns that record how each OCR / extraction job went, so Admins can
-- inspect errors and see processing duration. Existing rows are left untouched
-- (their new columns stay empty and the monitor shows them as "not recorded").

alter table if exists documents add column if not exists ocr_error       text;
alter table if exists documents add column if not exists ocr_engine      text;
alter table if exists documents add column if not exists processing_ms   integer;
alter table if exists documents add column if not exists ocr_attempts    integer default 0;
alter table if exists documents add column if not exists ocr_started_at  timestamptz;
alter table if exists documents add column if not exists processed_at    timestamptz;

create index if not exists idx_documents_ocr_status_created
  on documents(ocr_status, created_at desc);
