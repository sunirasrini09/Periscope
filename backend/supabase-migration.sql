-- PERISCOPE V3 migration for the schema already created in Supabase.
-- Run this ONCE in Supabase SQL Editor before starting the new backend.

alter table if exists patients
  add column if not exists data jsonb default '{}'::jsonb;

alter table if exists documents
  add column if not exists custom_category text;

create index if not exists idx_patients_uid_code
  on patients(firebase_uid, patient_code);

-- Keep the document bucket private. The Node backend uses the Supabase
-- service-role key server-side and creates short-lived signed download URLs.
