# PERISCOPE V3.2 — Firebase Auth + Supabase Storage/Postgres + Local OCR

This cleaned build removes Firebase Firestore and Firebase Storage completely.

## Architecture
- Firebase Authentication: login/signup/password reset only.
- Firebase Admin SDK: verifies the Firebase ID token on the PERISCOPE server.
- Supabase Postgres: patients, profiles, documents metadata and audit logs.
- Supabase Storage: private `periscope-documents` bucket for original files.
- Scribe.js: local OCR/text extraction for PDFs and images; Mammoth for DOCX; plain text for TXT.

## 1. Supabase setup
You already created the private bucket `periscope-documents` and the required tables/`data` JSON column. **No additional Supabase setup is required for this build.**

## 2. Firebase setup
Firebase is AUTH ONLY. Enable Email/Password under Authentication → Sign-in method.
Do not enable Firestore or Firebase Storage for this app.
Keep your Firebase web config in `js/firebase-init.js`; it contains no storage/database connection.

Download the Firebase Admin service-account JSON and place it at:
`backend/serviceAccountKey.json`

Never commit or upload that file.

## 3. Backend environment
Copy `backend/.env.example` to `backend/.env` and fill in:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET=periscope-documents`
- Firebase service-account path if you are not using the JSON file method.

Do NOT paste the service-role key into the frontend. It must stay in `backend/.env`.

## 4. Install and run (Windows PowerShell)
```powershell
cd path\to\PERISCOPE_V3
npm run install:backend
npm start
```

Then open:
`http://localhost:5000`

Do not use Live Server for the normal full-stack flow.

## 5. Verify
Open `http://localhost:5000/api/health`.
It should report Firebase Auth verification, Supabase and local OCR.
Then sign in, create a patient and upload a PDF/DOCX/TXT/PNG/JPG.

## 6. Security notes
- The Storage bucket must remain private.
- The Supabase service-role key is server-side only.
- Original files are stored under `users/<firebaseUid>/patients/<patientCode>/...`.
- Downloads use short-lived signed URLs.
- For development, use synthetic/de-identified records until your security, privacy and regulatory requirements are reviewed.
- Scribe.js is AGPL-3.0; review its license before using this OCR component in a distributed/commercial product.


## Document processing

Uploaded PDF/DOCX/TXT/PNG/JPG files are stored in the private Supabase bucket. Text-native PDFs are parsed locally first; scanned PDFs and images fall back to local Scribe.js OCR. The extracted text is saved in `documents.extracted_text`. PERISCOPE then rebuilds the patient clinical view from the uploaded records (timeline, anaesthesia, medications, investigations, conflicts, missing information and questions) and stores that structured view in `patients.data`.

Firebase is used only to authenticate the user and verify Firebase ID tokens on the backend. No Firestore or Firebase Storage is used.


## V3.3 document handling
- Firebase is authentication only.
- Supabase Storage stores private originals.
- Supabase Postgres stores metadata and extracted text.
- DOCX files are extracted with Mammoth.
- Text PDFs are parsed with pdf-parse.
- Scanned PDFs and images use local Scribe.js OCR.
- Uploaded document text can be opened from the Documents tab.
- No demo patients are included.
- Keep `backend/.env` and `backend/serviceAccountKey.json` from your existing setup.


## V3.4 upload interaction fix
The document picker now captures selected files immediately, validates PDF/DOCX/TXT/PNG/JPG/JPEG and 50 MB size, renders the queued file, and prevents duplicate queue entries. Browser cache is busted for app.js.


## V3.7 UX and PDF fallback
- The left sidebar is now global only: Dashboard, Patients, Add Patient, Profile (plus Admin tools). Patient clinical sections live once, inside the selected patient's workspace tabs.
- Patient quick actions are reduced to Edit Patient, Upload Records and Generate Brief to avoid duplicate navigation.
- PDF files with malformed/non-standard XRef tables use local OCR fallback; the terminal reports this as an informational fallback rather than an extraction failure when OCR succeeds.
- Added `Clinical Summary` as a document category.


## V3.8 shared patients and role handling
- Firebase Authentication remains login/authentication only.
- Doctor and Clinical Assistant accounts can see the shared patient list.
- Clinical Assistants can add and edit patient information and upload records.
- Patient deletion remains restricted to Doctor/Admin.
- Patient documents, derived clinical views and audit history are shared for the patient.
- Admin is provisioned manually rather than through public signup.
- Login no longer trusts a role selected by the user; the role is read from the Supabase `profiles` record.
