# PERISCOPE V3.8.4 — Clinical Mapping + PAC Persistence Fixes

Changes in this build:
- Uploaded document demographics now recognize forms such as `52 year old female` / `52-year-old female` and populate Age and Sex when the patient profile fields are blank.
- PAC data is persisted to Supabase in the patient `data.pac` object.
- Save Draft, Save & Continue, Submit for Review, Return for Reassessment, and Finalize now save PAC state to Supabase.
- Moving between PAC sections also persists the current PAC state.
- PAC Comorbidities seeds Hypertension and Diabetes from documented patient history; Other Relevant Medical History is no longer auto-filled with the same history.
- PAC Investigations auto-populate documented results where a matching field exists, with remaining documented investigations placed in Notes / Remarks.
- Removed PAC fields requested by the user: Breath Holding Time, Pre-Anaesthesia Evaluation History, Fever, and Anaemia Management dropdown/remarks.
- Existing Firebase authentication and Supabase Storage/Postgres architecture is unchanged.

Keep your existing `backend/.env` and `backend/serviceAccountKey.json` when replacing the project.
