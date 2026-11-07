-- PERISCOPE V4.2 migration: source hospital / institution is stored PER DOCUMENT.
-- Run this ONCE in the Supabase SQL Editor. It is safe to run again.
-- Existing documents and patients are untouched (existing documents simply have no source hospital).

alter table if exists documents
  add column if not exists source_hospital text;

-- Make PostgREST pick up the new column immediately (avoids "column not found in the schema cache").
notify pgrst, 'reload schema';
