require("dotenv").config();
const express = require("express");
const path = require("path");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs/promises");
const os = require("os");
const crypto = require("crypto");
const mammoth = require("mammoth");
const pdfParse = require("pdf-parse");
const { extractDemographics, sameName, BASIC_KEYS, BASIC_LABEL } = require("./demographics");
/* Identifiers that must never be silently chosen when two documents disagree. */
const BASIC_STRICT = ["dob","mrn","ipno","opno","bloodgroup"];
const { extractKeyDetails, normalizeOcr } = require('./keydetails');
const { buildTimeline, dedupeTimeline } = require('./timeline');
const { createClient } = require("@supabase/supabase-js");
const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

const serviceAccount = process.env.FIREBASE_PROJECT_ID
  ? {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n")
    }
  : (() => {
      try { return require("./serviceAccountKey.json"); }
      catch (_) { throw new Error("Firebase Admin credentials are missing. Put serviceAccountKey.json in backend/ or set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY in backend/.env."); }
    })();

const firebaseApp = getApps().length ? getApps()[0] : initializeApp({ credential: cert(serviceAccount) });
const firebaseAuth = getAuth(firebaseApp);

const SUPABASE_URL = String(process.env.SUPABASE_URL || "").trim();
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const BUCKET = String(process.env.SUPABASE_STORAGE_BUCKET || "periscope-documents").trim();
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Supabase configuration is missing. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env.");
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const app = express();
app.disable("x-powered-by");
const PORT = Number(process.env.PORT || 5000);
const MAX_FILE_SIZE = Number(process.env.MAX_FILE_SIZE || 50 * 1024 * 1024);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  fileFilter: (req, file, cb) => {
    const name = file.originalname.toLowerCase();
    const ok = /pdf|officedocument\.wordprocessingml\.document|text\/plain|image\/(png|jpeg|jpg|tiff|bmp|webp|heic|heif)/i.test(file.mimetype)
      || /\.(pdf|docx|txt|png|jpg|jpeg|tif|tiff|bmp|webp|heic|heif)$/i.test(name);
    cb(ok ? null : new Error("Supported files: PDF, DOCX, TXT, PNG, JPG and JPEG"), ok);
  }
});

const origins = process.env.FRONTEND_ORIGIN
  ? process.env.FRONTEND_ORIGIN.split(",").map(x => x.trim()).filter(Boolean)
  : true;
app.use(cors({ origin: origins }));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: false, limit: "2mb" }));

function clean(v) {
  if (v === undefined || v === null) return v === null ? null : undefined;
  if (Array.isArray(v)) return v.map(clean);
  if (typeof v === "object") {
    const o = {};
    for (const [k, value] of Object.entries(v)) {
      if (k === "__proto__" || k === "constructor" || k === "prototype") continue;
      o[k] = clean(value);
    }
    return o;
  }
  return v;
}
function withoutUndefined(obj) { return JSON.parse(JSON.stringify(obj, (_, v) => v === undefined ? null : v)); }
function today() { return new Date().toISOString().slice(0, 10); }
function safeName(name) { return String(name || "document").replace(/[^\w.\- ]/g, "_").slice(0, 180); }

/* Source hospital / institution is stored per document (documents.source_hospital), never on the patient. */
const MAX_HOSPITAL_LEN = 150;
function cleanHospitalName(v) {
  return String(v == null ? "" : v).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
}
const isMissingHospitalColumn = e => !!e && /source_hospital/i.test(String(e.message || e.details || ""));
const HOSPITAL_MIGRATION_MESSAGE = "The documents table has no source_hospital column yet. Run backend/supabase-migration-v4-2-source-hospital.sql once in the Supabase SQL Editor, then try again.";

/* Documents may be deleted by Doctors and Admins, and by a Clinical Assistant only for a document that same user uploaded. */
function canDeleteDocument(profile, docRow, uid) {
  const role = profile && profile.role;
  if (role === "Doctor" || role === "Admin") return true;
  if (role === "Clinical Assistant") return !!docRow && !!docRow.firebase_uid && docRow.firebase_uid === uid;
  return false;
}

async function verifyToken(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    if (!header.startsWith("Bearer ")) return res.status(401).json({ success: false, message: "Authentication required" });
    req.user = await firebaseAuth.verifyIdToken(header.slice(7));
    next();
  } catch (e) {
    console.error("Auth error:", e.message);
    return res.status(401).json({ success: false, message: "Invalid or expired authentication token" });
  }
}

async function getProfile(uid, fallbackRole = "Doctor") {
  const { data, error } = await supabase.from("profiles").select("*").eq("firebase_uid", uid).maybeSingle();
  if (error) throw error;
  if (data) return data;
  const role = ["Doctor", "Clinical Assistant"].includes(fallbackRole) ? fallbackRole : "Doctor";
  const profile = { firebase_uid: uid, name: "", email: "", role, department: "" };
  const { data: created, error: createError } = await supabase.from("profiles").insert(profile).select("*").single();
  if (createError) throw createError;
  return created;
}

async function attachProfile(req) {
  if (!req.userProfile) req.userProfile = await getProfile(req.user.uid, req.headers["x-periscope-role"] || "Doctor");
  return req.userProfile;
}
function documentFromRow(row) {
  if (!row) return null;

  return {
    id: row.id,
    patientId: row.patient_id,
    n: row.file_name || "",
    name: row.file_name || "",
    cat: row.category || "Other",
    cc: row.custom_category || "",
    dt: row.created_at
      ? new Date(row.created_at).toISOString().slice(0, 10)
      : "",
    p: row.ocr_status || "Processed",
    status: row.ocr_status || "Processed",
    v: row.verification_status || "U",
    text: row.extracted_text || "",
    extracted_text: row.extracted_text || "",
    mimeType: row.mime_type || "",
    fileSize: row.file_size || 0,
    storagePath: row.storage_path || "",
    hospital: row.source_hospital || "",
    sourceHospital: row.source_hospital || "",
    uploadedByUid: row.firebase_uid || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
function patientFromRow(row) {
  const data = (row && row.data && typeof row.data === "object") ? row.data : {};
  return {
    ...data,
    id: row.patient_code,
    uuid: row.id,
    ownerUid: row.firebase_uid,
    name: row.name ?? data.name ?? "",
    age: row.age ?? data.age ?? "",
    sex: row.sex ?? data.sex ?? "",
    diagnosis: row.diagnosis ?? data.diagnosis ?? "",
    dx: row.diagnosis ?? data.dx ?? "",
    stage: row.stage ?? data.stage ?? "",
    planned_surgery: row.planned_surgery ?? data.planned_surgery ?? "",
    surg: row.planned_surgery ?? data.surg ?? "",
    surgery_date: row.surgery_date ?? data.surgery_date ?? "",
    date: row.surgery_date ?? data.date ?? "",
    allergy: row.allergy ?? data.allergy ?? "",
    medical_history: row.medical_history ?? data.medical_history ?? "",
    hist: row.medical_history ?? data.hist ?? "",
    status: row.status ?? data.status ?? "Awaiting Review",
    upd: row.updated_at ? new Date(row.updated_at).toISOString().slice(0, 10) : (data.upd || today()),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    docs: []
  };
}

/* PAC lives in patients.data.pac. A save must never wipe PAC data that is already stored, so the incoming PAC is
   merged over the stored one: an empty/missing incoming PAC keeps the stored PAC, field maps (D, rd, rdAt) are
   merged key by key, and lists (acts, cons, revs) are taken from the incoming copy when it sends them. */
const isObj = v => v && typeof v === "object" && !Array.isArray(v);
function mergePac(oldPac, incPac) {
  if (!isObj(incPac) || !Object.keys(incPac).length) return isObj(oldPac) ? oldPac : undefined;
  if (!isObj(oldPac)) return incPac;
  const out = { ...oldPac, ...incPac };
  for (const k of ["D", "rd", "rdAt", "P"]) out[k] = { ...(isObj(oldPac[k]) ? oldPac[k] : {}), ...(isObj(incPac[k]) ? incPac[k] : {}) };
  for (const k of ["acts", "cons", "revs"]) out[k] = Array.isArray(incPac[k]) ? incPac[k] : (Array.isArray(oldPac[k]) ? oldPac[k] : []);
  return out;
}
function mergePatientData(oldData, incoming) {
  const base = isObj(oldData) ? oldData : {};
  const out = { ...base, ...(isObj(incoming) ? incoming : {}) };
  const pac = mergePac(base.pac, isObj(incoming) ? incoming.pac : undefined);
  if (pac !== undefined) out.pac = pac;
  return out;
}

function patientPayload(body) {
  const data = clean(body || {}) || {};
  const out = { ...data };
  delete out.ownerUid; delete out.createdAt; delete out.updatedAt; delete out.docs; delete out.uuid;
  /* The UI edits the short names (dx, surg, date); they are always sent current, so they win over the long database names. */
  const diagnosis = String(data.dx ?? data.diagnosis ?? "").trim();
  const plannedSurgery = String(data.surg ?? data.planned_surgery ?? "").trim();
  const surgeryDate = String(data.date ?? data.surgery_date ?? "").trim();
  out.diagnosis = diagnosis; out.dx = diagnosis; out.planned_surgery = plannedSurgery; out.surg = plannedSurgery; out.surgery_date = surgeryDate; out.date = surgeryDate;
  if (data.hist !== undefined || data.medical_history !== undefined) { const h = String(data.hist ?? data.medical_history ?? "").trim(); out.hist = h; out.medical_history = h; if (data.hist !== undefined) out.comorbidities = h; }
  const age = data.age === "" || data.age == null ? null : Number(data.age);
  return {
    data: withoutUndefined(out),
    name: String(data.name || "").trim(),
    age: Number.isFinite(age) ? age : null,
    sex: String(data.sex || "").trim(),
    diagnosis,
    stage: String(data.stage || "").trim(),
    planned_surgery: plannedSurgery,
    surgery_date: /^\d{4}-\d{2}-\d{2}$/.test(surgeryDate) ? surgeryDate : null,
    allergy: String(data.allergy || "").trim(),
    medical_history: String(data.hist ?? data.medical_history ?? "").trim(),
    status: String(data.status || "Awaiting Review").trim()
  };
}

async function findPatient(uid, patientCode) {
  const { data, error } = await supabase.from("patients").select("*").eq("patient_code", patientCode).maybeSingle();
  if (error) throw error;
  return data;
}

async function audit(uid, patientRow, action, entity = "", oldValue = "", newValue = "", result = "Success") {
  const row = {
    firebase_uid: uid || null, patient_id: patientRow?.id || null, action, entity,
    old_value: oldValue === "" ? null : { value: oldValue },
    new_value: newValue === "" ? null : { value: newValue },
    result: result === "Failure" ? "Failure" : "Success"
  };
  let { error } = await supabase.from("audit_logs").insert(row);
  if (error && isMissingResultColumn(error)) {
    // supabase-migration-v4-7-audit-security.sql not run yet: keep logging successes the old way, never record a failure as a success.
    if (row.result === "Failure") { console.warn("Audit failure event skipped: run supabase-migration-v4-7-audit-security.sql"); return; }
    const { result: _r, ...legacy } = row;
    ({ error } = await supabase.from("audit_logs").insert(legacy));
  }
  if (error) console.warn("Audit log failed:", error.message);
}
const isMissingResultColumn = e => !!e && (e.code === "PGRST204" || e.code === "42703" || /\bresult\b/i.test(String(e.message || "")));

async function listDocuments(uid, patientUuid) {
  const { data, error } = await supabase.from("documents").select("*").eq("patient_id", patientUuid).order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(documentFromRow);
}

async function patientWithDocs(uid, code) {
  const row = await findPatient(uid, code);
  if (!row) return null;
  const p = patientFromRow(row);
  p.docs = await listDocuments(uid, row.id);
  return p;
}

function clinicalFromDocuments(patient, docs) {
  const tl = [], an = [], med = [], inv = [];
  const allergyStatements = [];
  const sourceFacts = [];
  const allMissing = [];
  const allQuestions = [];

  const uniq = (arr, keyFn) => {
    const seen = new Set();
    return arr.filter(x => {
      const k = keyFn(x);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  };

  const normalizeDate = value => {
    const s = String(value || '').trim();
    if (!s) return '';
    let m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? s : d.toISOString().slice(0,10);
  };

  const dateFromLine = (line, fallback) => {
    const m = String(line || '').match(/\b(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}|\d{1,2}[\/-]\d{1,2}[\/-]\d{4}|\d{4}-\d{2}-\d{2})\b/i);
    return normalizeDate(m ? m[1] : fallback);
  };

  const sourceNameLocal = d => { const base = String(d?.file_name || d?.category || 'Uploaded document'); const h = cleanHospitalName(d?.source_hospital); return h ? `${base} — ${h}` : base; };
  const fallbackDate = d => d?.created_at ? new Date(d.created_at).toISOString().slice(0,10) : today();
  const cleanLine = x => String(x || '').replace(/\u00a0/g,' ').replace(/[ \t]+/g,' ').trim();
  const lines = text => String(text || '').split(/\r?\n/).map(cleanLine).filter(Boolean);
  const add = (arr, item) => { if (item && String(item.e || item.m || item.t || item.r || item.value || '').trim()) arr.push(item); };

  const parseMedication = (line, src) => {
    const raw = cleanLine(line).replace(/^\s*(?:\d+\.|[-•])\s*/, '');
    const doseMatch = raw.match(/\b(\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|units?))\b/i);
    if (!doseMatch) return null;
    const beforeDose = raw.slice(0, doseMatch.index).replace(/[,:;\-–—]+\s*$/,'').trim();
    if (!beforeDose || /^(dose|medication|medicines?)$/i.test(beforeDose)) return null;
    const freqMatch = raw.match(/\b(once daily|twice daily|three times daily|four times daily|daily|bid|tid|qid|od|bd|tds|qhs|at night|every\s+\d+(?:–|-)?\d*\s*hours?)\b/i);
    return { m: beforeDose, dose: doseMatch[1], freq: freqMatch ? freqMatch[1] : '', src, st:'U' };
  };

  for (const d of (docs || [])) {
    if (!d.extracted_text) continue;
    const text = String(d.extracted_text);
    const src = sourceNameLocal(d);
    const fallback = fallbackDate(d);
    const ls = lines(text);
    const lower = text.toLowerCase();

    const ages = [];
    const sexes = [];
    const diagnoses = [];
    const stages = [];
    const surgeries = [];
    const surgeryDates = [];
    const histories = [];
    const comorbidities = [];
    const pending = [];
    const docAllergies = [];
    const docMeds = [];
    const docInv = [];

    // Patient demographics.
    for (const line of ls) {
      let m = line.match(/\b(?:age|age\/sex)\s*[:\-]\s*(\d{1,3})\b/i);
      if (m && Number(m[1]) >= 0 && Number(m[1]) <= 120) ages.push(Number(m[1]));
      if (!m) {
        m = line.match(/\b(\d{1,3})\s*(?:years?|yrs?)\s*\/\s*(male|female|m|f)\b/i);
        if (m && Number(m[1]) >= 0 && Number(m[1]) <= 120) ages.push(Number(m[1]));
        if (!m) {
          m = line.match(/\b(\d{1,3})\s*[- ]?year[- ]?old\s+(male|female|m|f)\b/i);
          if (m && Number(m[1]) >= 0 && Number(m[1]) <= 120) ages.push(Number(m[1]));
        }
      }
      m = line.match(/\b(?:sex|gender)\s*[:\-]\s*(male|female|m|f)\b/i);
      if (m) sexes.push(/^f/i.test(m[1]) ? 'Female' : 'Male');
      m = line.match(/\b(?:\d{1,3})\s*[- ]?year[- ]?old\s+(male|female|m|f)\b/i);
      if (m) sexes.push(/^f/i.test(m[1]) ? 'Female' : 'Male');
    }

    // Explicitly documented identity fields (name, age, sex, hospital, current treatment) — never inferred.
    const demo = extractDemographics(text);
    for (const a of demo.ages) ages.push(a);
    for (const sx of demo.sexes) sexes.push(sx);

    // Reuse the strict, label-led extractor for fields that the timeline parser
    // may otherwise miss (for example a plain "Diagnosis:" label). It only
    // returns values explicitly found in the source text.
    const structured = extractKeyDetails(text);
    diagnoses.push(...(structured.diagnosis || []));
    stages.push(...(structured.stage || []));
    surgeries.push(...(structured.procedure || []));
    if (structured.dates?.Surgery) surgeryDates.push(normalizeDate(structured.dates.Surgery));
    docAllergies.push(...(structured.allergies || []));
    histories.push(...(structured.history || []));
    for (const item of (structured.medications || [])) {
      if (item && item.name && item.dose) {
        docMeds.push({ m: item.name, dose: item.dose, freq: item.freq || '', src, st: 'U' });
      }
    }
    for (const item of (structured.investigations || [])) {
      if (item && item.label && item.value) {
        docInv.push({ d: '', t: item.label, r: `${item.label}: ${item.value}`, src, st: 'U' });
      }
    }

    // Section-aware extraction. This is what makes a discharge summary populate the right PERISCOPE fields.
    let section = '';
    let currentPage = 1;
    for (let i = 0; i < ls.length; i++) {
      const line = ls[i];
      const pageMarker = line.match(/^\[PAGE\s+(\d+)\]$/i);
      if (pageMarker) { currentPage = Number(pageMarker[1]); continue; }
      const l = line.toLowerCase();
      // Do not substitute the upload date for a missing clinical event date.
      const dt = dateFromLine(line, '');

      const isSectionHeading = /^\s*(?:\d+\.\s*)?(final diagnosis|diagnosis|reason for admission|relevant history|investigations?(?: during admission)?|procedure performed|postoperative course|post-operative course|histopathology|medications? on discharge|medications?|wound and drain care|diet and activity|follow[- ]?up plan|discharge condition|important pending information|pending (?:investigations?|information))\s*:?$/i.test(line);
      if (isSectionHeading) {
        section = l.replace(/^\s*\d+\.\s*/, '').replace(/:.*$/,'').trim();
      }

      // Diagnosis.
      if (/^\s*clinical stage\s*:/i.test(line)) { const sv=line.split(':').slice(1).join(':').trim().split(/,|pending/i)[0].trim(); if(sv) stages.push(sv); }
      if (/^(primary diagnosis|final diagnosis)\s*:/i.test(line)) {
        const v = line.split(':').slice(1).join(':').trim();
        if (v) diagnoses.push(v);
      } else if (/\binvasive ductal carcinoma\b/i.test(line) && !/\b(?:no|without|negative for|absence of|no evidence of)\b.{0,60}\binvasive ductal carcinoma\b/i.test(line)) {
        diagnoses.push(line.replace(/^.*?(?:suggestive of|:)?\s*/i,'').trim());
      } else if (/\bcarcinoma of the\b|\bmalignancy\b/i.test(line) && /diagnos|carcinoma|malignan/i.test(section)) {
        diagnoses.push(line);
      }

      // Comorbidities / medical history.
      if (/^\s*(?:associated conditions|comorbidities|past medical history|medical history)\s*:/i.test(line)) {
        const v = line.split(':').slice(1).join(':').trim();
        if (v) histories.push(v.replace(/;\s*/g, '; '));
      }
      if (/\b(hypertension|diabetes mellitus|diabetes|asthma|copd|chronic kidney disease|ckd|coronary artery disease|hypothyroidism|hyperthyroidism|iron-deficiency anemia|anaemia|anemia)\b/i.test(line) && !/family history/i.test(line) && !/associated conditions|comorbidities|medical history/i.test(line)) {
        const terms = line.match(/\b(?:hypertension|diabetes mellitus|diabetes|asthma|COPD|chronic kidney disease|CKD|coronary artery disease|hypothyroidism|hyperthyroidism|iron[- ]deficiency anemia|iron[- ]deficiency anaemia)\b/gi) || [];
        histories.push(...terms);
        comorbidities.push(...terms);
      }
      if (/^\s*(?:comorbidities|associated conditions)\s*:/i.test(line)) {
        const v = line.split(':').slice(1).join(':').trim();
        if (v) {
          const terms = v.match(/\b(?:hypertension|diabetes mellitus|diabetes|asthma|COPD|chronic kidney disease|CKD|coronary artery disease|hypothyroidism|hyperthyroidism|iron[- ]deficiency anemia|iron[- ]deficiency anaemia)\b/gi) || [];
          comorbidities.push(...terms);
          histories.push(...terms);
        }
      }

      // Allergies are only populated when explicitly documented.
      if (/\b(no known drug allergies|no known allergies|nkda|allerg(?:y|ies)\s*[:\-])\b/i.test(line)) {
        docAllergies.push(line);
      }

      // Procedure / surgery.
      if (/^\s*(?:procedure|procedure performed)\s*:/i.test(line) || /\bmodified radical mastectomy\b/i.test(line)) {
        const v = line.includes(':') ? line.split(':').slice(1).join(':').trim() : line;
        if (v) surgeries.push(v.replace(/\.$/,''));
        const sm = line.match(/\b(?:date\s*[:\-]\s*)?(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})\b/i);
        if (sm) surgeryDates.push(normalizeDate(sm[1]));
      }
      if (/^\s*date\s*:/i.test(line) && /procedure|surgery|operative/.test(section)) { const dm=line.match(/date\s*:\s*(.+)$/i); if(dm) surgeryDates.push(normalizeDate(dm[1])); }
      if (/\bmodified radical mastectomy\b/i.test(line) || /\baxillary lymph node dissection\b/i.test(line)) {
        if (!surgeries.some(x => /modified radical mastectomy/i.test(x))) surgeries.push(line.replace(/^.*?(?:procedure\s*:\s*)?/i,''));
      }

      // Discharge medicines.
      if (/medications? on discharge|medications?/.test(section) || /^(?:\d+\.\s*)?[A-Z][A-Za-z0-9'()\- ]+\s+\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|units?)\b.*\b(?:daily|twice|once|three times|four times|every)\b/i.test(line)) {
        const medItem = parseMedication(line, `${src} p${currentPage}`);
        if (medItem) docMeds.push(medItem);
      }

      // Investigations and results.
      const invPatterns = [
        ['CBC','cbc|complete blood count|hemoglobin|haemoglobin|wbc|white blood|platelets?'],
        ['Renal Function','creatinine|urea|renal function'],
        ['Liver Function','liver function|lft|bilirubin|ast|alt'],
        ['ECG','\becg\b'],
        ['Chest X-ray','chest x[- ]?ray|chest xray'],
        ['Mammography','mammography|mammogram'],
        ['Breast Ultrasound','breast ultrasound|ultrasound'],
        ['Core Biopsy','core biopsy|biopsy'],
        ['Histopathology','histopathology|histopathology report']
      ];
      for (const [title, pattern] of invPatterns) {
        if (new RegExp(`\\b(?:${pattern})\\b`, 'i').test(line)) {
          docInv.push({d:dt,t:title,r:line,src:`${src} p${currentPage}`,st:'U'});
          break;
        }
      }

      // Pending information.
      if (/important pending information|pending (?:investigations?|information)/.test(section) && !isSectionHeading && !/^[-•]?$/.test(line)) { const clean=line.replace(/^[-•]\s*/, '').trim(); if(clean) pending.push({i:clean,r:'Listed as pending in the uploaded document.'}); }
      if (/\b(pending|to be scheduled|awaiting|not available|not received)\b/i.test(line)) {
        const clean = line.replace(/^[-•]\s*/, '').trim();
        if (/histopathology|pathology/i.test(clean)) pending.push({i:'Final histopathology report',r:clean});
        if (/er receptor|estrogen receptor/i.test(clean)) pending.push({i:'ER receptor status',r:clean});
        if (/pr receptor|progesterone receptor/i.test(clean)) pending.push({i:'PR receptor status',r:clean});
        if (/her2/i.test(clean)) pending.push({i:'HER2 receptor status',r:clean});
        if (/tnm|pathological staging|pathologic staging/i.test(clean)) pending.push({i:'Final pathological TNM staging',r:clean});
        if (/oncology treatment plan/i.test(clean)) pending.push({i:'Medical oncology treatment plan',r:clean});
      }

      // Timeline events are built once per document by timeline.js (dated, de-duplicated, concise).

      if (/\b(general anaesthesia|general anesthesia|spinal anaesthesia|spinal anesthesia|epidural|sedation|intubat|airway|mallampati)\b/i.test(line)) {
        an.push({d:dt,s:'',a:/general/i.test(line)?'General anaesthesia':/spinal/i.test(line)?'Spinal anaesthesia':/epidural/i.test(line)?'Epidural anaesthesia':'Anaesthesia information',ev:line,src:`${src} p${currentPage}`,st:'U'});
      }
    }

    tl.push(...buildTimeline(text, { src }));

    const diagnosis = uniq(diagnoses, x => String(x).toLowerCase())[0] || '';
    const history = uniq(histories.map(x => String(x).replace(/^associated conditions\s*:\s*/i,'')), x => x.toLowerCase()).join('; ');
    const allergy = uniq(docAllergies, x => x.toLowerCase())[0] || '';
    const surgery = uniq(surgeries, x => x.toLowerCase())[0] || '';
    const surgDate = uniq(surgeryDates, x => x)[0] || '';

    sourceFacts.push({src,facts:{basic:demo.basic||{},names:demo.names,hospitals:demo.hospitals,treatments:demo.treatments,ages:uniq(ages,x=>x),sexes:uniq(sexes,x=>x),stages:uniq(stages,x=>x),diagnoses:diagnosis?[diagnosis]:[],surgeries:surgery?[surgery]:[],surgeryDates:surgDate?[surgDate]:[],allergies:allergy?[allergy]:[],histories:history?[history]:[],comorbidities:uniq(comorbidities,x=>String(x).toLowerCase())}});
    med.push(...docMeds);
    inv.push(...docInv);
    allergyStatements.push(...docAllergies.map(value=>({value,src})));
    for (const p of pending) allMissing.push({...p,st:'Missing'});
  }

  const facts = sourceFacts;
  const ages = uniq(facts.flatMap(x=>x.facts.ages.map(v=>({v,src:x.src}))),x=>x.v);
  const sexes = uniq(facts.flatMap(x=>x.facts.sexes.map(v=>({v,src:x.src}))),x=>x.v);
  const allergyUnique = uniq(allergyStatements,x=>String(x.value).toLowerCase());
  const allSurgeryDates = uniq(facts.flatMap(x=>x.facts.surgeryDates.map(v=>({v,src:x.src}))),x=>x.v);
  const cf=[];

  // Patient name: group loosely-equal spellings; two genuinely different names are a conflict (possible wrong-patient document).
  const nameList = [];
  for (const x of facts) for (const n of (x.facts.names || [])) {
    const g = nameList.find(y => sameName(y.v, n));
    if (g) { if (n.length > g.v.length) g.v = n; } else nameList.push({ v: n, src: x.src });
  }
  const hospitalList = uniq(facts.flatMap(x => (x.facts.hospitals || []).map(v => ({ v, src: x.src }))), x => x.v.toLowerCase());
  const treatList = uniq(facts.flatMap(x => (x.facts.treatments || []).map(v => ({ v, src: x.src }))), x => x.v.toLowerCase());
  if (nameList.length > 1) cf.push({f:'Patient name',a:nameList[0].v,sa:nameList[0].src,b:nameList[1].v,sb:nameList[1].src,st:'Open'});
  if (nameList.length === 1 && patient.name && !sameName(patient.name, nameList[0].v)) cf.push({f:'Patient name',a:String(patient.name),sa:'Patient profile',b:nameList[0].v,sb:nameList[0].src,st:'Open'});

  if (ages.length > 1) cf.push({f:'Age',a:String(ages[0].v),sa:ages[0].src,b:String(ages[1].v),sb:ages[1].src,st:'Open'});
  if (sexes.length > 1) cf.push({f:'Sex',a:sexes[0].v,sa:sexes[0].src,b:sexes[1].v,sb:sexes[1].src,st:'Open'});
  if (allSurgeryDates.length > 1) cf.push({f:'Surgery date',a:allSurgeryDates[0].v,sa:allSurgeryDates[0].src,b:allSurgeryDates[1].v,sb:allSurgeryDates[1].src,st:'Open'});

  const medGroups={};
  for(const m of med){ const key=String(m.m).toLowerCase(); (medGroups[key] ||= []).push(m); }
  for(const [name,arr] of Object.entries(medGroups)){
    const variants=uniq(arr,x=>`${x.dose}|${x.freq}`);
    if(variants.length>1) cf.push({f:`Medication: ${name}`,a:`${variants[0].dose||'dose not stated'} ${variants[0].freq||''}`.trim(),sa:variants[0].src,b:`${variants[1].dose||'dose not stated'} ${variants[1].freq||''}`.trim(),sb:variants[1].src,st:'Open'});
  }

  const factDx = facts.flatMap(x=>x.facts.diagnoses).find(Boolean) || '';
  const factStage = facts.flatMap(x=>x.facts.stages || []).find(Boolean) || '';
  const factSurg = facts.flatMap(x=>x.facts.surgeries).find(Boolean) || '';
  const factDate = allSurgeryDates.length===1 ? allSurgeryDates[0].v : '';
  const factAllergy = allergyUnique.length===1 ? allergyUnique[0].value : '';
  const factHist = facts.flatMap(x=>x.facts.histories).find(Boolean) || '';
  const factComorbidities = uniq(facts.flatMap(x=>x.facts.comorbidities || []),x=>String(x).toLowerCase()).join('; ');
  const factAge = ages.length===1 ? ages[0].v : '';
  const factName = nameList.length===1 ? nameList[0].v : '';
  const factHospital = hospitalList.length ? hospitalList[0].v : '';
  const factTreat = treatList.length ? treatList[0].v : '';
  const srcFor = (list, v) => (list.find(x => x.v === v) || {}).src || '';
  const factSex = sexes.length===1 ? sexes[0].v : '';

  // Other basic details (identification, contact, clinical, admission): label-led values only.
  // Strict identifiers are filled only when every document agrees; a disagreement becomes a conflict instead.
  const factBasic = {}, basicSrc = {};
  for (const key of BASIC_KEYS) {
    const vals = uniq(facts.flatMap(x => ((x.facts.basic || {})[key] || []).map(v => ({ v, src: x.src }))), x => String(x.v).toLowerCase());
    if (!vals.length) continue;
    const stored = String(((patient.data && typeof patient.data === 'object') ? patient.data[key] : '') || '').trim();
    if (BASIC_STRICT.includes(key)) {
      if (vals.length > 1) { cf.push({f:BASIC_LABEL[key],a:String(vals[0].v),sa:vals[0].src,b:String(vals[1].v),sb:vals[1].src,st:'Open'}); continue; }
      if (stored && stored.toLowerCase() !== String(vals[0].v).toLowerCase()) cf.push({f:BASIC_LABEL[key],a:stored,sa:'Patient profile',b:String(vals[0].v),sb:vals[0].src,st:'Open'});
    }
    factBasic[key] = String(vals[0].v); basicSrc[key] = vals[0].src;
  }

  if (factAge && patient.age && Number(patient.age)!==Number(factAge)) cf.push({f:'Age',a:String(patient.age),sa:'Patient profile',b:String(factAge),sb:sourceFacts.find(x=>x.facts.ages.includes(factAge))?.src||'Document',st:'Open'});
  if (factSex && patient.sex && String(patient.sex).toLowerCase()!==String(factSex).toLowerCase()) cf.push({f:'Sex',a:String(patient.sex),sa:'Patient profile',b:factSex,sb:sourceFacts.find(x=>x.facts.sexes.includes(factSex))?.src||'Document',st:'Open'});

  if (an.length===0 && patient.planned_surgery) allMissing.push({i:'Anaesthesia history',r:'No anaesthesia information was found in the uploaded documents.',st:'Missing'});
  if (!patient.diagnosis && !factDx) allMissing.push({i:'Diagnosis',r:'No diagnosis statement was identified in the uploaded documents.',st:'Missing'});
  if (!allergyUnique.length) allMissing.push({i:'Allergy status',r:'No allergy statement was identified in the uploaded documents. PERISCOPE will not infer absence of allergy.',st:'Missing'});
  if (!factName && !patient.name) allMissing.push({i:'Patient name',r:'No patient name was identified in the uploaded documents.',st:'Missing'});
  if (!factAge) allMissing.push({i:'Age',r:'Age was not identified in the uploaded documents.',st:'Missing'});
  if (!factSex) allMissing.push({i:'Sex',r:'Sex was not identified in the uploaded documents.',st:'Missing'});

  const missing = uniq(allMissing,x=>x.i);
  const qs = uniq([...allQuestions, ...cf.map(x=>({q:`Verify conflicting ${x.f.toLowerCase()}: ${x.a} (${x.sa}) vs ${x.b} (${x.sb}).`,st:'Open'})), ...missing.filter(x=>/pending|final|receptor|treatment plan/i.test(x.i)).map(x=>({q:`Obtain or verify ${x.i.toLowerCase()}.`,st:'Open'}))],x=>`${x.q}|${x.st}`);

  return {
    facts:{
      name:factName,
      hospital:factHospital,
      treat:factTreat,
      basic:factBasic,
      sources:{
        ...basicSrc,
        name:srcFor(nameList,factName),
        hospital:srcFor(hospitalList,factHospital),
        treat:srcFor(treatList,factTreat),
        age:factAge!==''?(sourceFacts.find(x=>x.facts.ages.includes(factAge))||{}).src||'':'',
        sex:factSex?(sourceFacts.find(x=>x.facts.sexes.includes(factSex))||{}).src||'':'',
        diagnosis:factDx?(sourceFacts.find(x=>x.facts.diagnoses.includes(factDx))||{}).src||'':'',
        stage:factStage?(sourceFacts.find(x=>(x.facts.stages||[]).includes(factStage))||{}).src||'':'',
        planned_surgery:factSurg?(sourceFacts.find(x=>x.facts.surgeries.includes(factSurg))||{}).src||'':'',
        surgery_date:factDate?(allSurgeryDates.find(x=>x.v===factDate)||{}).src||'':'',
        allergy:factAllergy?(allergyUnique.find(x=>x.value===factAllergy)||{}).src||'':'',
        medical_history:factHist?(sourceFacts.find(x=>x.facts.histories.includes(factHist))||{}).src||'':''
      },
      age:factAge,
      sex:factSex,
      diagnosis:factDx,
      planned_surgery:factSurg,
      surgery_date:factDate,
      allergy:factAllergy,
      medical_history:factHist,
      stage:factStage,
      comorbidities:factComorbidities,
      historySource: factHist ? (sourceFacts.find(x=>x.facts.histories.includes(factHist))?.src || 'Uploaded document') : ''
    },
    tl:dedupeTimeline(tl),
    an:uniq(an,x=>`${x.d}|${x.ev}|${x.src}`),
    med:uniq(med,x=>`${x.m}|${x.dose}|${x.freq}|${x.src}`),
    inv:uniq(inv,x=>`${x.d}|${x.t}|${x.r}|${x.src}`).sort((a,b)=>String(b.d||'').localeCompare(String(a.d||''))),
    cf:uniq(cf,x=>`${x.f}|${x.a}|${x.b}|${x.sa}|${x.sb}`),
    ms:missing,
    qs
  };
}

async function rebuildClinicalView(uid, patientRow) {
  const { data: docs, error } = await supabase.from('documents').select('*').eq('patient_id',patientRow.id).eq('ocr_status','completed');
  if (error) throw error;
  const derived = clinicalFromDocuments(patientRow, docs || []);
  const base = (patientRow.data && typeof patientRow.data === 'object') ? patientRow.data : {};
  const manualTl = (Array.isArray(base.tl) ? base.tl : []).filter(x => x && x.man);
  const tlKey = x => `${x.d}|${x.c}|${String(x.e || '').toLowerCase().trim()}`;
  const reviewedTl = new Map((Array.isArray(base.tl) ? base.tl : []).filter(x => x && !x.man && (x.st === 'V' || x.st === 'C')).map(x => [tlKey(x), x.st]));
  derived.tl.forEach(x => { const st = reviewedTl.get(tlKey(x)); if (st) x.st = st; });   // keep a clinician's verification across re-uploads
  const manualOf = k => (Array.isArray(base[k]) ? base[k] : []).filter(x => x && x.man);   // clinician-entered rows are never dropped by re-processing
  /* Keep conflict resolutions across re-processing, and apply a resolved medication choice to the derived list. */
  const cfKey = x => `${x.f}|${x.a}|${x.b}|${x.sa}|${x.sb}`;
  const resolvedCf = new Map((Array.isArray(base.cf) ? base.cf : []).filter(x => x && /^Resolved/.test(x.st || '')).map(x => [cfKey(x), x]));
  derived.cf.forEach(x => { const r = resolvedCf.get(cfKey(x)); if (r) { x.st = r.st; if (r.pick) x.pick = r.pick; } });
  const medLbl = m => `${m.dose||'dose not stated'} ${m.freq||''}`.trim();
  derived.cf.filter(x => (x.pick === 1 || x.pick === 2) && /^Medication: /.test(x.f)).forEach(x => {
    const name = x.f.slice(12).trim().toLowerCase(), want = x.pick === 1 ? x.a : x.b;
    derived.med = derived.med.filter(m => String(m.m).trim().toLowerCase() !== name || medLbl(m) === want);
    derived.med.forEach(m => { if (String(m.m).trim().toLowerCase() === name) m.st = 'V'; });
  });
  const merged = {...base, tl:dedupeTimeline([...manualTl, ...derived.tl]), an:[...manualOf('an'), ...derived.an], med:[...manualOf('med'), ...derived.med], inv:derived.inv, cf:derived.cf, ms:derived.ms, qs:derived.qs, comorbidities:derived.facts.comorbidities || base.comorbidities || '', hist:derived.facts.medical_history || base.hist || '', medical_history:derived.facts.medical_history || base.medical_history || base.hist || '', historySource:derived.facts.historySource || base.historySource || '', stage:derived.facts.stage || base.stage || ''};
  const patch={data:merged,updated_at:new Date().toISOString()};
  const f=derived.facts;
  // Fill profile fields from documents only when the profile is blank. Conflicting values are retained and surfaced in Conflicts.
  const filled=[];
  const prov={...(isObj(base.autofill)?base.autofill:{})};
  const mark=(key,label,value)=>{ filled.push(label); prov[key]={value:String(value),src:(f.sources&&f.sources[key])||'Uploaded document',at:new Date().toISOString()}; };
  if(!patientRow.name && f.name){ patch.name=f.name; mark('name','Name',f.name); }
  if(!patientRow.age && f.age){ patch.age=Number(f.age); mark('age','Age',f.age); }
  if(!patientRow.sex && f.sex){ patch.sex=f.sex; mark('sex','Sex',f.sex); }
  // Hospital is NOT filled at patient level: a patient's records come from several hospitals, so each document keeps its own source hospital.
  if(!patientRow.diagnosis && f.diagnosis){ patch.diagnosis=f.diagnosis; mark('diagnosis','Diagnosis',f.diagnosis); }
  if(!patientRow.stage && f.stage){ patch.stage=f.stage; mark('stage','Stage',f.stage); }
  if(!base.treat && f.treat){ merged.treat=f.treat; mark('treat','Current treatment',f.treat); }
  if(!patientRow.planned_surgery && f.planned_surgery){ patch.planned_surgery=f.planned_surgery; mark('planned_surgery','Planned surgery',f.planned_surgery); }
  if(!patientRow.surgery_date && f.surgery_date){ patch.surgery_date=f.surgery_date; mark('surgery_date','Surgery date',f.surgery_date); }
  if(!patientRow.allergy && f.allergy){ patch.allergy=f.allergy; mark('allergy','Allergies',f.allergy); }
  if(!patientRow.medical_history && f.medical_history){ patch.medical_history=f.medical_history; mark('medical_history','Medical history',f.medical_history); }
  for(const key of BASIC_KEYS){ const v=(f.basic||{})[key]; if(v && !String(base[key]??'').trim()){ merged[key]=v; mark(key,BASIC_LABEL[key],v); } }
  merged.autofill=prov;
  const { data: updated, error: updateError } = await supabase.from('patients').update(patch).eq('id',patientRow.id).select('*').single();
  if(updateError) throw updateError;
  Object.defineProperty(updated,'_filled',{value:filled,enumerable:false});
  return updated;
}

async function callLocalOcr(file) {
  const base = String(process.env.OCR_SERVICE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
  const form = new FormData();
  form.append("file", new Blob([file.buffer], { type: file.mimetype || "application/octet-stream" }), file.originalname);
  const response = await fetch(`${base}/ocr`, {
    method: "POST", body: form,
    signal: AbortSignal.timeout(Number(process.env.OCR_TIMEOUT_MS || 600000))
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.success) {
    throw new Error(result.detail || result.message || `Local OCR service returned HTTP ${response.status}`);
  }
  return result;
}

async function callGeminiOcr(file) {
  const apiKey = String(process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) throw new Error("Gemini OCR is selected, but GEMINI_API_KEY is not configured in backend/.env.");
  const maxInlineBytes = Number(process.env.GEMINI_MAX_INLINE_BYTES || 18 * 1024 * 1024);
  if (file.buffer.length > maxInlineBytes) {
    throw new Error(`This file is too large for Gemini inline extraction (${Math.round(maxInlineBytes / 1024 / 1024)} MB limit). Select Existing OCR or upload a smaller file.`);
  }
  const mimeType = String(file.mimetype || "").toLowerCase();
  if (!/^(application\/pdf|image\/(png|jpeg))$/.test(mimeType)) {
    throw new Error("Gemini OCR supports PDF, PNG and JPG/JPEG files in this PeriScope build.");
  }
  const model = String(process.env.GEMINI_MODEL || "gemini-3.8-flash").trim();
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const prompt = [
    "Transcribe the uploaded medical document accurately and completely.",
    "Return only the recognized document text, preserving headings, dates, tables, units, medication names, doses, and page order as far as possible.",
    "Do not summarize, interpret, correct, infer, or add clinical facts that are not visibly present.",
    "Mark unreadable portions as [illegible]. Keep conflicting statements exactly as written.",
    "Separate pages with a clear page marker such as [Page 1]."
  ].join(" ");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [{ parts: [
        { text: prompt },
        { inline_data: { mime_type: mimeType, data: file.buffer.toString("base64") } }
      ] }],
      generationConfig: { temperature: 0, maxOutputTokens: Number(process.env.GEMINI_MAX_OUTPUT_TOKENS || 32768) }
    }),
    signal: AbortSignal.timeout(Number(process.env.GEMINI_TIMEOUT_MS || 180000))
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Gemini OCR failed: ${result?.error?.message || `HTTP ${response.status}`}`);
  const text = (result?.candidates?.[0]?.content?.parts || [])
    .map(part => typeof part.text === "string" ? part.text : "").join("\n").trim();
  if (!text) throw new Error("Gemini OCR returned no readable text. Try Existing OCR or a clearer scan.");
  return { text, mode: "gemini-ai", averageConfidence: null, reviewRecommended: true, processingMs: null, pages: [] };
}

async function extractText(file, requestedEngine = "tesseract") {
  const name = file.originalname.toLowerCase();
  const engine = String(requestedEngine || "tesseract").toLowerCase() === "gemini" ? "gemini" : "tesseract";
  if (/\.docx$/.test(name) || file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    return { text: String(result.value || "").replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim(), ocr: null };
  }
  if (/\.txt$/.test(name) || file.mimetype === "text/plain") {
    return { text: file.buffer.toString("utf8"), ocr: null };
  }

  // PDF/image extraction uses the selected OCR provider. Existing OCR retains
  // the current page-aware PyMuPDF/Tesseract hybrid behavior.
  if (/\.(pdf|png|jpg|jpeg|tif|tiff|bmp|webp|heic|heif)$/.test(name) || /^image\//.test(file.mimetype) || file.mimetype === "application/pdf") {
    const result = engine === "gemini" ? await callGeminiOcr(file) : await callLocalOcr(file);
    return {
      text: result.text,
      ocr: {
        mode: result.mode || "tesseract",
        engine: engine === "gemini" ? "Gemini AI OCR" : "Existing Tesseract OCR",
        averageConfidence: result.averageConfidence ?? null,
        reviewRecommended: Boolean(result.reviewRecommended),
        processingMs: result.processingMs ?? null,
        pages: (result.pages || []).map(p => ({
          page: p.page,
          mode: p.mode || "tesseract",
          confidence: p.confidence ?? null
        }))
      }
    };
  }
  throw new Error("Unsupported file type");
}

app.get("/api/health", async (req, res) => {
  try {
    const { error } = await supabase.from("profiles").select("firebase_uid", { head: true, count: "exact" });
    if (error) throw error;
    const probe = await supabase.from("documents").select("source_hospital", { head: true, count: "exact" });
    const sourceHospitalColumn = !probe.error;
    res.json({ success: true, message: "PERISCOPE backend is running", firebaseAuth: true, supabase: true, storageBucket: BUCKET, ocr: "local-tesseract-hybrid", sourceHospitalColumn,
      ...(sourceHospitalColumn ? {} : { warning: HOSPITAL_MIGRATION_MESSAGE }) });
  } catch (e) {
    res.status(500).json({ success: false, message: "Backend is running but Supabase is not configured correctly", error: e.message });
  }
});

/* ===================== AUDIT LOGS & SECURITY MANAGEMENT (v4.7) =====================
   Sign-in tracking. A successful sign-in is recorded from GET /api/me (once per Firebase session).
   A failed sign-in cannot carry a token, so it is reported by the login page to this public, rate-limited
   endpoint. It always answers the same way (no account enumeration) and never stores the typed e-mail:
   the attempt is attached to an existing account only when the e-mail matches a profile. */
const loginSeen = new Map();
function auditLogin(user) {
  try {
    const key = String(user.auth_time || user.iat || "");
    if (loginSeen.get(user.uid) === key) return;
    if (loginSeen.size > 5000) loginSeen.clear();
    loginSeen.set(user.uid, key);
    audit(user.uid, null, "User Login", "session").catch(() => {});
  } catch (_) {}
}
const failedLoginHits = new Map();
app.post("/api/audit/login-failed", async (req, res) => {
  const reply = () => res.json({ success: true });
  try {
    const now = Date.now(), ip = String(req.ip || "unknown");
    let hit = failedLoginHits.get(ip);
    if (!hit || hit.reset < now) hit = { n: 0, reset: now + 10 * 60 * 1000 };
    hit.n++; failedLoginHits.set(ip, hit);
    if (failedLoginHits.size > 5000) failedLoginHits.clear();
    if (hit.n > 20) return res.status(429).json({ success: false, message: "Too many requests" });
    const email = String(req.body?.email || "").trim().slice(0, 200);
    let uid = null;
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      const escaped = email.replace(/[\\%_]/g, c => "\\" + c);
      const { data } = await supabase.from("profiles").select("firebase_uid").ilike("email", escaped).limit(1).maybeSingle();
      uid = data?.firebase_uid || null;
    }
    await audit(uid, null, "Login Failed", "session", "", "", "Failure");
  } catch (e) { console.warn("Failed-login audit error:", e.message); }
  reply();
});

app.use("/api", verifyToken);

app.get("/api/me", async (req, res) => {
  try {
    const existing = await getProfile(req.user.uid, req.headers["x-periscope-role"] || "Doctor");
    const profile = {
      firebase_uid: req.user.uid,
      name: existing.name || req.user.name || req.user.email?.split("@")[0] || "User",
      email: req.user.email || existing.email || "",
      role: existing.role || "Doctor",
      department: existing.department || existing.dept || ""
    };
    const { error } = await supabase.from("profiles").upsert(profile, { onConflict: "firebase_uid" });
    if (error) return res.status(500).json({ success: false, message: error.message });
    auditLogin(req.user);   // one "User Login" entry per sign-in (not awaited, never blocks the response)
    res.json({ success: true, user: { uid: req.user.uid, name: profile.name, email: profile.email, role: profile.role, dept: profile.department } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.put("/api/me", async (req, res) => {
  try {
    /* Only name and department are user-editable. Email (Firebase identity), role (assigned) and uid are never taken from the request body. */
    const clean = (v) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
    const body = req.body || {};
    const patch = {};
    if (body.name !== undefined) {
      const name = clean(body.name);
      if (name.length < 2) return res.status(400).json({ success: false, message: "Full name must be at least 2 characters." });
      if (name.length > 80) return res.status(400).json({ success: false, message: "Full name must be 80 characters or fewer." });
      patch.name = name;
    }
    if (body.dept !== undefined) {
      const dept = clean(body.dept);
      if (dept.length > 100) return res.status(400).json({ success: false, message: "Hospital / Department must be 100 characters or fewer." });
      patch.department = dept;
    }
    if (!Object.keys(patch).length) return res.status(400).json({ success: false, message: "Nothing to update." });

    await getProfile(req.user.uid, req.headers["x-periscope-role"] || "Doctor"); /* makes sure the row exists */
    const { data, error } = await supabase.from("profiles").update(patch).eq("firebase_uid", req.user.uid).select("*").single();
    if (error) return res.status(500).json({ success: false, message: error.message });

    if (patch.name) {
      try { await firebaseAuth.updateUser(req.user.uid, { displayName: patch.name }); }
      catch (e) { console.warn("Firebase displayName sync failed:", e.message); }
    }
    res.json({ success: true, user: { uid: req.user.uid, name: data.name || "", email: req.user.email || data.email || "", role: data.role || "Doctor", dept: data.department || "" } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.get("/api/patients", async (req, res) => {
  try {
    const { data, error } = await supabase.from("patients").select("*").order("updated_at", { ascending: false });
    if (error) throw error;
    const patients = [];
    for (const row of data || []) {
      const p = patientFromRow(row);
      p.docs = await listDocuments(req.user.uid, row.id);
      patients.push(p);
    }
    res.json({ success: true, patients });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.post("/api/patients", async (req, res) => {
  const code = String(req.body.id || req.body.patient_code || `P${Date.now().toString().slice(-8)}`).trim();
  if (!code) return res.status(400).json({ success: false, message: "Patient ID is required" });
  const exists = await findPatient(req.user.uid, code);
  if (exists) return res.status(409).json({ success: false, message: `Patient ID ${code} already exists` });
  const payload = patientPayload(req.body);
  const { data: row, error } = await supabase.from("patients").insert({ firebase_uid: req.user.uid, patient_code: code, ...payload }).select("*").single();
  if (error) { await audit(req.user.uid, null, "Patient Created", "patient", "", "", "Failure"); return res.status(500).json({ success: false, message: error.message }); }
  await audit(req.user.uid, row, "Patient Created", "patient", "", row.name || "");
  const p = await patientWithDocs(req.user.uid, code);
  res.status(201).json({ success: true, patient: p });
});

app.get("/api/patients/:id", async (req, res) => {
  const p = await patientWithDocs(req.user.uid, req.params.id);
  if (!p) return res.status(404).json({ success: false, message: "Patient not found" });
  res.json({ success: true, patient: p });
});

app.put("/api/patients/:id", async (req, res) => {
  const old = await findPatient(req.user.uid, req.params.id);
  if (!old) return res.status(404).json({ success: false, message: "Patient not found" });
  const payload = patientPayload(req.body);
  payload.data = withoutUndefined(mergePatientData(old.data, payload.data));
  payload.updated_at = new Date().toISOString();
  const { data: row, error } = await supabase.from("patients").update(payload).eq("id", old.id).select("*").single();
  if (error) { console.error("Patient update failed:", error.message); await audit(req.user.uid, null, "Patient Updated", "patient", "", "", "Failure"); return res.status(500).json({ success: false, message: error.message }); }
  await audit(req.user.uid, row, "Patient Updated", "patient");
  res.json({ success: true, patient: await patientWithDocs(req.user.uid, req.params.id) });
});

app.delete("/api/patients/:id", async (req, res) => {
  try {
    const uid = req.user.uid;
    const profile = await attachProfile(req);
    if (!["Doctor", "Admin"].includes(profile.role)) { await audit(uid, null, "Patient Deleted", "patient", "", "", "Failure"); return res.status(403).json({ success: false, message: "Clinical Assistants cannot delete patients" }); }
    const row = await findPatient(uid, req.params.id);
    if (!row) return res.status(404).json({ success: false, message: "Patient not found" });

    // 1. uploaded files in storage
    const docs = await listDocuments(uid, row.id);
    const paths = docs.map(d => d.storagePath).filter(Boolean);
    if (paths.length) {
      const { error: storageError } = await supabase.storage.from(BUCKET).remove(paths);
      if (storageError) console.warn("Storage cleanup failed:", storageError.message);
    }

    // 2. document rows
    const { error: docError } = await supabase.from("documents").delete().eq("patient_id", row.id);
    if (docError) return res.status(500).json({ success: false, message: docError.message });

    // 3. the patient row (if audit_logs has a foreign key to it, clear those rows and retry)
    const removePatient = () => supabase.from("patients").delete().eq("id", row.id);
    let { error } = await removePatient();
    if (error && error.code === "23503") {
      // audit_logs is append-only and is never deleted. Run supabase-migration-v4-7-audit-security.sql so audit rows are kept when a patient is deleted.
      error = { message: "The patient could not be deleted because audit history references it. Run backend/supabase-migration-v4-7-audit-security.sql once in the Supabase SQL Editor, then try again." };
    }
    if (error) { await audit(uid, null, "Patient Deleted", "patient", "", "", "Failure"); return res.status(500).json({ success: false, message: error.message }); }

    // 4. record the deletion (not linked to the patient row, which no longer exists)
    await audit(uid, null, "Patient Deleted", `patient ${req.params.id}`, row.name || "", "");
    res.json({ success: true });
  } catch (e) {
    console.error("Delete patient error:", e);
    res.status(500).json({ success: false, message: e.message || "Failed to delete patient" });
  }
});

app.get("/api/patients/:id/audit", async (req, res) => {
  const profile = await attachProfile(req);
  if (profile.role !== "Admin") return res.status(403).json({ success: false, message: "The audit log is available to Admins only." });
  const row = await findPatient(req.user.uid, req.params.id);
  if (!row) return res.status(404).json({ success: false, message: "Patient not found" });
  const { data, error } = await supabase.from("audit_logs").select("*").eq("patient_id", row.id).order("created_at", { ascending: false }).limit(200);
  if (error) return res.status(500).json({ success: false, message: error.message });
  res.json({ success: true, audit: (data || []).map(x => ({ id:x.id, patientId:req.params.id, action:x.action, entity:x.entity, oldValue:x.old_value?.value || "", newValue:x.new_value?.value || "", at:x.created_at })) });
});

function buildFieldEvidence(text, keyDetails, ocr) {
  const lines = String(text || "").split(/\r?\n/);
  const flattened = [];
  let page = 1;
  for (const raw of lines) {
    const pageMatch = raw.match(/^\[PAGE\s+(\d+)\]$/i);
    if (pageMatch) { page = Number(pageMatch[1]); continue; }
    if (raw.trim()) flattened.push({ page, text: raw.trim() });
  }

  const entries = [];
  const add = (field, value, patterns) => {
    if (value === undefined || value === null || value === "" || (Array.isArray(value) && !value.length)) return;
    const values = Array.isArray(value) ? value : [value];
    for (const item of values) {
      const display = typeof item === "object"
        ? Object.values(item).filter(Boolean).join(" ")
        : String(item);
      const exact = display
        ? flattened.find(x => x.text.toLowerCase().includes(display.toLowerCase().slice(0, 50)))
        : null;
      const evidence = exact || flattened.find(x => patterns.some(re => re.test(x.text)));
      const pageInfo = evidence
        ? (ocr?.pages || []).find(x => Number(x.page) === evidence.page)
        : null;
      const confidence = pageInfo?.confidence ?? ocr?.averageConfidence ?? null;
      entries.push({
        field,
        value: item,
        sourcePage: evidence?.page ?? null,
        sourceText: evidence?.text ?? "",
        ocrConfidence: confidence,
        reviewRequired: Boolean(
          !evidence ||
          (confidence !== null && confidence !== undefined && confidence < 75) ||
          (confidence === null && Boolean(ocr?.reviewRecommended && !pageInfo))
        )
      });
    }
  };

  const p = keyDetails || {};
  add("patient.name", p.patient?.Name, [/patient\s*name|name\s*of\s*patient/i]);
  add("patient.age", p.patient?.Age, [/age\s*(?:\/\s*sex)?\s*[:\-]/i]);
  add("patient.sex", p.patient?.Sex, [/\b(?:sex|gender|age\s*\/\s*sex)\b/i]);
  add("patient.hospital", p.patient?.Hospital, [/hospital|institution|facility/i]);
  for (const [label, value] of Object.entries(p.patient || {})) {
    if (["Name","Age","Sex","Hospital","Current treatment"].includes(label)) continue;
    add("patient." + label.toLowerCase().replace(/[^a-z0-9]+/g, "_"), value, [new RegExp(label.split(/\s*\/\s*/)[0].replace(/[^A-Za-z0-9 ]/g, "").replace(/\s+/g, "\\s*"), "i")]);
  }
  add("dates.admission", p.dates?.Admission, [/date\s*of\s*admission|admission\s*date|\bdoa\b/i]);
  add("dates.discharge", p.dates?.Discharge, [/date\s*of\s*discharge|discharge\s*date|\bdod\b/i]);
  add("dates.surgery", p.dates?.Surgery, [/date\s*of\s*(?:surgery|procedure|operation)|surgery\s*date/i]);
  add("diagnosis", p.diagnosis, [/diagnosis|impression/i]);
  add("stage", p.stage, [/\bstage\b|tnm/i]);
  add("procedure", p.procedure, [/procedure|operation|surgery/i]);
  add("allergies", p.allergies, [/allerg|nkda/i]);
  add("medicalHistory", p.history, [/history|comorbid|known case/i]);
  add("medications", p.medications, [/medication|drug|tablet|capsule|injection/i]);
  add("investigations", p.investigations, [/investigation|haemoglobin|hemoglobin|creatinine|ecg|x-ray/i]);
  add("vitals", p.vitals, [/blood pressure|\bbp\b|pulse|spo2|temperature|weight|height/i]);
  add("pending", p.pending, [/pending|awaiting|to be scheduled/i]);
  return entries;
}

app.post("/api/patients/:id/documents", upload.single("document"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "No document uploaded" });
    const sourceHospital = cleanHospitalName(req.body.sourceHospital);
    if (sourceHospital.length > MAX_HOSPITAL_LEN) return res.status(400).json({ success: false, message: `Source hospital / institution must be ${MAX_HOSPITAL_LEN} characters or fewer.` });
    const patient = await findPatient(req.user.uid, req.params.id);
    if (!patient) return res.status(404).json({ success: false, message: "Patient not found" });
    const docId = crypto.randomUUID();
    const storagePath = `users/${req.user.uid}/patients/${req.params.id}/${docId}_${safeName(req.file.originalname)}`;

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, req.file.buffer, {
      contentType: req.file.mimetype || "application/octet-stream",
      upsert: false
    });
    if (uploadError) throw uploadError;

    let text = "";
    let ocrMetadata = null;
    let ocrStatus = "completed";
    let ocrErrorMessage = "";
    const requestedOcrEngine = String(req.body?.ocrEngine || "tesseract").toLowerCase();
    const ocrStartedAt = new Date();
    try {
      const extracted = await extractText(req.file, requestedOcrEngine);
      text = normalizeOcr(String(extracted.text || ""));
      ocrMetadata = extracted.ocr || null;
      if (!text) { ocrStatus = "failed"; ocrErrorMessage = "No readable text was extracted from the document."; }
    } catch (ocrError) {
      ocrStatus = "failed";
      ocrErrorMessage = ocrError.message || "OCR / extraction failed";
      console.error("OCR/extraction error:", ocrError);
    }
    // Outcome recorded for the Admin Document Processing Monitor (columns come from supabase-migration-v4-6-document-monitor.sql).
    const monitorFields = { ocr_error: ocrErrorMessage || null, ocr_engine: engineKey(req.file, requestedOcrEngine), processing_ms: Date.now() - ocrStartedAt.getTime(), ocr_attempts: 1, ocr_started_at: ocrStartedAt.toISOString(), processed_at: new Date().toISOString() };

    const docRow = {
      id: docId,
      patient_id: patient.id,
      firebase_uid: req.user.uid,
      file_name: req.file.originalname,
      category: String(req.body.category || "Other"),
      custom_category: String(req.body.customCategory || ""),
      mime_type: req.file.mimetype,
      file_size: req.file.size,
      storage_path: storagePath,
      extracted_text: text,
      ocr_status: ocrStatus
    };
    // Only sent when entered, so documents without a hospital still upload even before the migration has been run.
    if (sourceHospital) docRow.source_hospital = sourceHospital;
    let inserted = await supabase.from("documents").insert({ ...docRow, ...monitorFields }).select("*").single();
    if (inserted.error && isMissingMonitorColumn(inserted.error)) inserted = await supabase.from("documents").insert(docRow).select("*").single();
    const { data: row, error: insertError } = inserted;
    if (insertError) {
      await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => {});
      if (sourceHospital && isMissingHospitalColumn(insertError)) throw new Error(HOSPITAL_MIGRATION_MESSAGE);
      throw insertError;
    }

    const refreshedPatientRow = await rebuildClinicalView(req.user.uid, patient);
    await audit(req.user.uid, refreshedPatientRow, "Document Uploaded", "document", "", req.file.originalname + (sourceHospital ? ` (${sourceHospital})` : ""));
    const refreshedPatient = patientFromRow(refreshedPatientRow);
    refreshedPatient.docs = await listDocuments(req.user.uid, refreshedPatientRow.id);
    const keyDetails = extractKeyDetails(text);
    const fieldEvidence = buildFieldEvidence(text, keyDetails, ocrMetadata);
    res.status(201).json({ success: true, document: { ...documentFromRow(row), keyDetails }, keyDetails, fieldEvidence, text, ocr: ocrMetadata, patient: refreshedPatient, filled: refreshedPatientRow._filled || [] });
  } catch (e) {
    console.error("Document processing error:", e);
    await audit(req.user.uid, null, "Document Uploaded", "document", "", "", "Failure");
    res.status(500).json({ success: false, message: e.message || "Failed to process document" });
  }
});

app.get("/api/patients/:id/documents/:docId", async (req, res) => {
  const patient = await findPatient(req.user.uid, req.params.id);
  if (!patient) return res.status(404).json({ success: false, message: "Patient not found" });
  const { data, error } = await supabase.from("documents").select("*").eq("id", req.params.docId).eq("patient_id", patient.id).maybeSingle();
  if (error) return res.status(500).json({ success: false, message: error.message });
  if (!data) return res.status(404).json({ success: false, message: "Document not found" });
  if (req.query.download === "1") {
    const { data: signed, error: signError } = await supabase.storage.from(BUCKET).createSignedUrl(data.storage_path, 10 * 60);
    if (signError) return res.status(500).json({ success:false, message:signError.message });
    return res.json({ success:true, url:signed.signedUrl });
  }
  res.json({ success: true, document: { ...documentFromRow(data), keyDetails: extractKeyDetails(data.extracted_text) } });
});

app.delete("/api/patients/:id/documents/:docId", async (req, res) => {
  try {
    const uid = req.user.uid;
    const patient = await findPatient(uid, req.params.id);
    if (!patient) return res.status(404).json({ success: false, message: "Patient not found" });

    const { data: doc, error } = await supabase.from("documents").select("*").eq("id", req.params.docId).eq("patient_id", patient.id).maybeSingle();
    if (error) return res.status(500).json({ success: false, message: error.message });
    if (!doc) return res.status(404).json({ success: false, message: "Document not found. It may already have been deleted." });

    const profile = await attachProfile(req);
    if (!canDeleteDocument(profile, doc, uid)) {
      const msg = profile.role === "Clinical Assistant"
        ? "Clinical Assistants can delete only the documents they uploaded themselves."
        : "You do not have permission to delete this document.";
      await audit(uid, null, "Document Deleted", "document", "", "", "Failure");
      return res.status(403).json({ success: false, message: msg });
    }

    // 1. the stored file. If this fails the database row is kept, so the delete can simply be retried.
    if (doc.storage_path) {
      const { error: storageError } = await supabase.storage.from(BUCKET).remove([doc.storage_path]);
      if (storageError) {
        console.error("Document file removal failed:", storageError.message);
        return res.status(500).json({ success: false, message: `The stored file could not be removed (${storageError.message}). The document was not deleted; please try again.` });
      }
    }

    // 2. the database row
    const { error: delError } = await supabase.from("documents").delete().eq("id", doc.id);
    if (delError) return res.status(500).json({ success: false, message: delError.message });

    // 3. rebuild what was derived from the remaining documents (timeline, medications, investigations, conflicts, missing items)
    let refreshedRow = null;
    try { refreshedRow = await rebuildClinicalView(uid, patient); }
    catch (e) { console.error("Rebuild after document delete failed:", e.message); }
    await audit(uid, refreshedRow || patient, "Document Deleted", "document", doc.file_name + (doc.source_hospital ? ` (${doc.source_hospital})` : ""), "");

    const fresh = refreshedRow ? patientFromRow(refreshedRow) : patientFromRow(patient);
    fresh.docs = await listDocuments(uid, patient.id);
    res.json({ success: true, message: "Document deleted", patient: fresh, rebuilt: !!refreshedRow });
  } catch (e) {
    console.error("Delete document error:", e);
    await audit(req.user.uid, null, "Document Deleted", "document", "", "", "Failure");
    res.status(500).json({ success: false, message: e.message || "Failed to delete document" });
  }
});


/* ===================== Document Processing Monitor (Admin only) =====================
   Reads the real documents / patients / audit_logs tables and re-runs failed jobs through the
   same extractText() + normalizeOcr() + rebuildClinicalView() path the upload route uses. */
const MONITOR_COLUMNS = ["ocr_error","ocr_engine","processing_ms","ocr_attempts","ocr_started_at","processed_at"];
const isMissingMonitorColumn = e => !!e && MONITOR_COLUMNS.some(c => String(e.message || e.details || "").includes(c));
const STALE_PROCESSING_MS = 15 * 60 * 1000;
function ocrBucket(status) {
  const s = String(status || "").toLowerCase();
  if (s === "failed" || s === "error") return "failed";
  if (["processing", "pending", "queued", "running"].includes(s)) return "processing";
  return "completed";
}
function engineKey(file, requested) {
  if (/\.(docx|txt)$/i.test(file.originalname || "") || file.mimetype === "text/plain" || /wordprocessingml/.test(file.mimetype || "")) return "direct";
  return String(requested || "tesseract").toLowerCase() === "gemini" ? "gemini" : "tesseract";
}
async function requireAdmin(req, res, next) {
  try {
    const profile = await attachProfile(req);
    if (profile.role !== "Admin") return res.status(403).json({ success: false, message: "The Document Processing Monitor is available to Admins only." });
    next();
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
}
async function updateDocumentRow(id, core, monitor) {
  let r = await supabase.from("documents").update({ ...core, ...monitor }).eq("id", id).select("*").single();
  if (r.error && isMissingMonitorColumn(r.error)) r = await supabase.from("documents").update(core).eq("id", id).select("*").single();
  return r;
}

app.get("/api/admin/documents/monitor", requireAdmin, async (req, res) => {
  try {
    const status = ["completed", "processing", "failed"].includes(req.query.status) ? req.query.status : "";
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 500);
    const validDate = v => { const d = new Date(v); return v && !isNaN(d) ? d.toISOString() : ""; };
    const from = validDate(req.query.from), to = validDate(req.query.to);

    let patientRow = null;
    if (req.query.patient) {
      patientRow = await findPatient(req.user.uid, String(req.query.patient));
      if (!patientRow) return res.json({ success: true, summary: { total: 0, processing: 0, completed: 0, failed: 0 }, documents: [], matching: 0, timeline: [], migrationApplied: true });
    }

    const base = "id,patient_id,firebase_uid,file_name,category,mime_type,file_size,storage_path,ocr_status,created_at";
    const build = cols => {
      let q = supabase.from("documents").select(cols).order("created_at", { ascending: false }).range(0, 4999);
      if (from) q = q.gte("created_at", from);
      if (to) q = q.lte("created_at", to);
      if (patientRow) q = q.eq("patient_id", patientRow.id);
      return q;
    };
    let migrationApplied = true;
    let r = await build(base + "," + MONITOR_COLUMNS.join(","));
    if (r.error && isMissingMonitorColumn(r.error)) { migrationApplied = false; r = await build(base); }
    if (r.error) throw r.error;
    const rows = r.data || [];

    const summary = { total: rows.length, processing: 0, completed: 0, failed: 0 };
    rows.forEach(x => { summary[ocrBucket(x.ocr_status)]++; });
    const shown = status ? rows.filter(x => ocrBucket(x.ocr_status) === status) : rows;

    const [pats, profs] = await Promise.all([
      supabase.from("patients").select("id,patient_code,name"),
      supabase.from("profiles").select("firebase_uid,name,email")
    ]);
    if (pats.error) throw pats.error;
    const patientById = new Map((pats.data || []).map(x => [x.id, x]));
    const profileByUid = new Map((profs.data || []).map(x => [x.firebase_uid, x]));
    const now = Date.now();

    const documents = shown.slice(0, limit).map(x => {
      const pt = patientById.get(x.patient_id) || {};
      const up = profileByUid.get(x.firebase_uid) || {};
      const bucket = ocrBucket(x.ocr_status);
      const startedAt = x.ocr_started_at || null;
      return {
        id: x.id, name: x.file_name || "", category: x.category || "", mimeType: x.mime_type || "", fileSize: x.file_size || 0,
        patientId: pt.patient_code || "", patientName: pt.name || "", uploadedBy: up.name || up.email || "",
        status: bucket, rawStatus: x.ocr_status || "", uploadedAt: x.created_at,
        startedAt, processedAt: x.processed_at || null,
        durationMs: x.processing_ms != null ? Number(x.processing_ms) : null,
        error: x.ocr_error || "", engine: x.ocr_engine || "", attempts: x.ocr_attempts != null ? Number(x.ocr_attempts) : null,
        stale: bucket === "processing" && (now - new Date(startedAt || x.created_at).getTime()) > STALE_PROCESSING_MS
      };
    });

    // Activity timeline: real upload / outcome events from documents, plus retry events from audit_logs.
    const events = [];
    shown.slice(0, 200).forEach(x => {
      const pt = patientById.get(x.patient_id) || {};
      const b = ocrBucket(x.ocr_status);
      const common = { docId: x.id, name: x.file_name || "", patientId: pt.patient_code || "", patientName: pt.name || "" };
      events.push({ ...common, kind: "uploaded", at: x.created_at });
      if (b !== "processing" && x.processed_at) events.push({ ...common, kind: b, at: x.processed_at, durationMs: x.processing_ms != null ? Number(x.processing_ms) : null, error: b === "failed" ? (x.ocr_error || "") : "" });
      else if (b === "failed" || b === "completed") events.push({ ...common, kind: b, at: x.created_at, durationMs: x.processing_ms != null ? Number(x.processing_ms) : null, error: b === "failed" ? (x.ocr_error || "") : "", inferred: true });
      else events.push({ ...common, kind: "processing", at: x.ocr_started_at || x.created_at });
    });
    let al = supabase.from("audit_logs").select("*").in("action", ["OCR Retry Started", "OCR Retry Completed", "OCR Retry Failed"]).order("created_at", { ascending: false }).limit(100);
    if (from) al = al.gte("created_at", from);
    if (to) al = al.lte("created_at", to);
    if (patientRow) al = al.eq("patient_id", patientRow.id);
    const audits = await al;
    if (!audits.error) {
      const docIds = new Set(rows.map(x => x.id));
      (audits.data || []).forEach(a => {
        const pt = patientById.get(a.patient_id) || {};
        const actor = profileByUid.get(a.firebase_uid) || {};
        const val = (a.new_value && a.new_value.value) || "";
        events.push({ kind: a.action === "OCR Retry Started" ? "retry-started" : a.action === "OCR Retry Completed" ? "retry-completed" : "retry-failed",
          at: a.created_at, name: a.entity || "", patientId: pt.patient_code || "", patientName: pt.name || "", by: actor.name || actor.email || "", detail: String(val) });
      });
    }
    const rank = k => k === "uploaded" ? 0 : k === "processing" ? 1 : 2;
    events.sort((a, b) => (new Date(b.at) - new Date(a.at)) || (rank(b.kind) - rank(a.kind)));

    res.json({ success: true, summary, documents, matching: shown.length, truncated: rows.length >= 5000, timeline: events.slice(0, 80), migrationApplied });
  } catch (e) {
    console.error("Document monitor error:", e);
    res.status(500).json({ success: false, message: e.message || "Failed to load the document monitor" });
  }
});

app.post("/api/admin/documents/:docId/retry", requireAdmin, async (req, res) => {
  const docId = req.params.docId;
  try {
    const { data: doc, error } = await supabase.from("documents").select("*").eq("id", docId).maybeSingle();
    if (error) throw error;
    if (!doc) return res.status(404).json({ success: false, message: "Document not found. It may have been deleted." });
    const bucket = ocrBucket(doc.ocr_status);
    const stale = bucket === "processing" && (Date.now() - new Date(doc.ocr_started_at || doc.created_at).getTime()) > STALE_PROCESSING_MS;
    if (bucket === "completed") return res.status(409).json({ success: false, message: "This document was already processed successfully." });
    if (bucket === "processing" && !stale) return res.status(409).json({ success: false, message: "This document is still being processed." });
    if (!doc.storage_path) return res.status(422).json({ success: false, message: "The original file is not stored, so it cannot be re-processed." });
    const { data: patient, error: pErr } = await supabase.from("patients").select("*").eq("id", doc.patient_id).maybeSingle();
    if (pErr) throw pErr;
    if (!patient) return res.status(404).json({ success: false, message: "The patient for this document no longer exists." });

    const requested = ["gemini", "tesseract"].includes(String(req.body?.ocrEngine || "").toLowerCase())
      ? String(req.body.ocrEngine).toLowerCase()
      : (["gemini", "tesseract"].includes(doc.ocr_engine) ? doc.ocr_engine : "tesseract");
    const attempts = (Number(doc.ocr_attempts) || 0) + 1;
    const startedAt = new Date();
    const label = doc.file_name + (doc.source_hospital ? ` (${doc.source_hospital})` : "");

    // Mark as processing so the monitor shows the live state. If the column forbids this value the retry still runs.
    await supabase.from("documents").update({ ocr_status: "processing", ...{ ocr_started_at: startedAt.toISOString() } }).eq("id", docId)
      .then(r => { if (r.error && isMissingMonitorColumn(r.error)) return supabase.from("documents").update({ ocr_status: "processing" }).eq("id", docId); });
    await audit(req.user.uid, patient, "OCR Retry Started", doc.file_name, "", `engine: ${requested}`);

    let text = "", ocrMetadata = null, failure = "";
    try {
      const { data: blob, error: dlError } = await supabase.storage.from(BUCKET).download(doc.storage_path);
      if (dlError) throw new Error(`The stored file could not be read (${dlError.message}).`);
      const file = { buffer: Buffer.from(await blob.arrayBuffer()), originalname: doc.file_name || "document", mimetype: doc.mime_type || "application/octet-stream" };
      const extracted = await extractText(file, requested);
      text = normalizeOcr(String(extracted.text || ""));
      ocrMetadata = extracted.ocr || null;
      if (!text) failure = "No readable text was extracted from the document.";
    } catch (e) {
      failure = e.message || "OCR / extraction failed";
      console.error("OCR retry error:", e);
    }

    const durationMs = Date.now() - startedAt.getTime();
    const monitor = { ocr_error: failure || null, ocr_engine: engineKey({ originalname: doc.file_name, mimetype: doc.mime_type }, requested), processing_ms: durationMs, ocr_attempts: attempts, ocr_started_at: startedAt.toISOString(), processed_at: new Date().toISOString() };
    const core = failure ? { ocr_status: "failed" } : { ocr_status: "completed", extracted_text: text };
    const upd = await updateDocumentRow(docId, core, monitor);
    if (upd.error) throw upd.error;

    if (failure) {
      await audit(req.user.uid, patient, "OCR Retry Failed", doc.file_name, "", failure);
      return res.status(422).json({ success: false, message: `Retry failed: ${failure}` });
    }
    let refreshedRow = null;
    try { refreshedRow = await rebuildClinicalView(req.user.uid, patient); }
    catch (e) { console.error("Rebuild after OCR retry failed:", e.message); }
    await audit(req.user.uid, refreshedRow || patient, "OCR Retry Completed", doc.file_name, "", `${Math.round(durationMs / 1000)}s via ${requested}`);
    const fresh = refreshedRow ? patientFromRow(refreshedRow) : patientFromRow(patient);
    fresh.docs = await listDocuments(req.user.uid, patient.id);
    res.json({ success: true, message: `Re-processed ${label}`, ocr: ocrMetadata, patient: fresh, durationMs });
  } catch (e) {
    console.error("OCR retry error:", e);
    // Never leave a document stuck in "processing" if something unexpected broke.
    await supabase.from("documents").update({ ocr_status: "failed" }).eq("id", docId).eq("ocr_status", "processing").then(() => {}, () => {});
    res.status(500).json({ success: false, message: e.message || "Retry failed" });
  }
});

/* ---- Audit log + security overview (Admin: everything, Doctor: own activity only, others: denied) ---- */
const AUDIT_CATEGORIES = {
  Authentication: ["User Login", "Login Failed"],
  Patient: ["Patient Created", "Patient Updated", "Patient Deleted"],
  Document: ["Document Uploaded", "Document Deleted", "OCR Retry Started", "OCR Retry Completed", "OCR Retry Failed"],
  Security: ["Access Denied"]
};
const AUDIT_ACTIONS = Object.values(AUDIT_CATEGORIES).flat();
const auditCategory = a => Object.keys(AUDIT_CATEGORIES).find(k => AUDIT_CATEGORIES[k].includes(a)) || "Other";
const auditResult = r => r.result || (/(failed|denied)$/i.test(r.action || "") ? "Failure" : "Success");
/* The target is a generic label. Patient names, file names and old/new values are never returned. */
const AUDIT_TARGET = { Authentication: "Sign-in", Patient: "Patient record", Document: "Document", Security: "Restricted page" };

function requireRoles(roles, what) {
  return async (req, res, next) => {
    try {
      const profile = await attachProfile(req);
      if (!roles.includes(profile.role)) {
        await audit(req.user.uid, null, "Access Denied", what, "", "", "Failure");
        return res.status(403).json({ success: false, message: `${what} is available to ${roles.join(" and ")} accounts only.` });
      }
      req.auditScope = profile.role === "Admin" ? "all" : "own";
      next();
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  };
}

app.get("/api/audit-logs", requireRoles(["Admin", "Doctor"], "The audit log"), async (req, res) => {
  try {
    const q = req.query || {};
    const limit = Math.min(Math.max(parseInt(q.limit, 10) || 50, 1), 200);
    const validDate = v => { const d = new Date(String(v || "")); return isNaN(d) ? null : d.toISOString(); };
    const from = validDate(q.from), to = validDate(q.to);
    const activity = String(q.activity || "");
    const result = ["Success", "Failure"].includes(q.result) ? q.result : "";
    const userFilter = req.auditScope === "all" ? String(q.user || "").slice(0, 128) : req.user.uid;   // a Doctor can only ever see their own rows

    const build = (withResult) => {
      let query = supabase.from("audit_logs").select("*", { count: "exact" }).order("created_at", { ascending: false }).order("id", { ascending: false }).range(0, limit - 1);
      if (userFilter) query = query.eq("firebase_uid", userFilter);
      if (activity.startsWith("cat:")) { const list = AUDIT_CATEGORIES[activity.slice(4)]; if (list) query = query.in("action", list); }
      else if (activity && AUDIT_ACTIONS.includes(activity)) query = query.eq("action", activity);
      if (from) query = query.gte("created_at", from);
      if (to) query = query.lte("created_at", to);
      if (withResult && result) query = query.eq("result", result);
      return query;
    };
    let migrationNeeded = false;
    let r = await build(true);
    if (r.error && isMissingResultColumn(r.error)) { migrationNeeded = true; r = await build(false); }
    if (r.error) return res.status(500).json({ success: false, message: r.error.message });

    let rows = r.data || [];
    let matching = r.count ?? rows.length;
    if (migrationNeeded && result) { rows = rows.filter(x => auditResult(x) === result); matching = rows.length; }

    const uids = [...new Set(rows.map(x => x.firebase_uid).filter(Boolean))];
    const people = {};
    if (uids.length) {
      const pr = await supabase.from("profiles").select("firebase_uid,name,email,role").in("firebase_uid", uids);
      (pr.data || []).forEach(x => { people[x.firebase_uid] = x; });
    }
    const logs = rows.map(x => {
      const who = people[x.firebase_uid], cat = auditCategory(x.action);
      return {
        id: x.id, at: x.created_at,
        userName: who ? (who.name || (who.email || "").split("@")[0] || "User") : (x.firebase_uid ? "Removed user" : "Unknown account"),
        userEmail: who ? (who.email || "") : "",
        role: who ? (who.role || "") : "",
        action: x.action, category: cat, target: AUDIT_TARGET[cat] || "—", result: auditResult(x)
      };
    });
    res.json({ success: true, scope: req.auditScope, logs, matching, migrationNeeded, activities: AUDIT_CATEGORIES });
  } catch (e) {
    console.error("Audit log read error:", e);
    res.status(500).json({ success: false, message: e.message || "Could not load the audit log" });
  }
});

app.get("/api/admin/security/overview", requireRoles(["Admin"], "Security management"), async (req, res) => {
  try {
    const pr = await supabase.from("profiles").select("*").limit(1000);
    if (pr.error) return res.status(500).json({ success: false, message: pr.error.message });
    const profiles = pr.data || [];

    const DAY = 86400000, now = Date.now();
    const since = new Date(now - 30 * DAY).toISOString();
    const LIMIT = 20000;
    let ar = await supabase.from("audit_logs").select("firebase_uid,action,result,created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(LIMIT);
    let migrationNeeded = false;
    if (ar.error && isMissingResultColumn(ar.error)) {
      migrationNeeded = true;
      ar = await supabase.from("audit_logs").select("firebase_uid,action,created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(LIMIT);
    }
    if (ar.error) return res.status(500).json({ success: false, message: ar.error.message });
    const events = ar.data || [];

    // Firebase knows the true last sign-in and whether an account is disabled.
    const fb = {};
    try {
      for (let i = 0; i < profiles.length; i += 100) {
        const out = await firebaseAuth.getUsers(profiles.slice(i, i + 100).map(x => ({ uid: x.firebase_uid })));
        out.users.forEach(u => { fb[u.uid] = { lastSignIn: u.metadata?.lastSignInTime || null, createdAt: u.metadata?.creationTime || null, disabled: !!u.disabled }; });
      }
    } catch (e) { console.warn("Firebase user lookup failed:", e.message); }

    const per = {};
    const stat = uid => (per[uid] = per[uid] || { logins: 0, actions: 0, failures: 0, last: 0 });
    let logins24 = 0, failedLogins24 = 0, failures24 = 0, actions24 = 0;
    const active7 = new Set();
    for (const ev of events) {
      const t = new Date(ev.created_at).getTime(), fail = auditResult(ev) === "Failure", isLogin = ev.action === "User Login";
      if (ev.firebase_uid) {
        const st = stat(ev.firebase_uid);
        if (isLogin) st.logins++; else if (ev.action !== "Login Failed") st.actions++;
        if (fail) st.failures++;
        if (t > st.last) st.last = t;
        if (now - t <= 7 * DAY && !fail) active7.add(ev.firebase_uid);
      }
      if (now - t <= DAY) {
        if (isLogin) logins24++;
        if (ev.action === "Login Failed") failedLogins24++;
        if (fail) failures24++;
        if (!isLogin && ev.action !== "Login Failed") actions24++;
      }
    }

    const ROLES = ["Admin", "Doctor", "Clinical Assistant"];
    const roles = ROLES.map(r => ({ role: r, count: profiles.filter(x => x.role === r).length }));
    const other = profiles.filter(x => !ROLES.includes(x.role)).length;
    if (other) roles.push({ role: "Other", count: other });

    const users = profiles.map(x => {
      const st = per[x.firebase_uid] || { logins: 0, actions: 0, failures: 0, last: 0 }, f = fb[x.firebase_uid] || {};
      return {
        uid: x.firebase_uid, name: x.name || (x.email || "").split("@")[0] || "User", email: x.email || "", role: x.role || "Doctor",
        lastLogin: f.lastSignIn || null, createdAt: f.createdAt || x.created_at || null, disabled: !!f.disabled,
        logins30d: st.logins, actions30d: st.actions, failures30d: st.failures, lastActivity: st.last ? new Date(st.last).toISOString() : null
      };
    }).sort((a, b) => String(b.lastActivity || b.lastLogin || "").localeCompare(String(a.lastActivity || a.lastLogin || "")));

    res.json({
      success: true, migrationNeeded, truncated: events.length >= LIMIT,
      summary: { totalUsers: profiles.length, active7d: active7.size, logins24h: logins24, failedLogins24h: failedLogins24, failures24h: failures24, actions24h: actions24 },
      roles, users
    });
  } catch (e) {
    console.error("Security overview error:", e);
    res.status(500).json({ success: false, message: e.message || "Could not load security overview" });
  }
});

/* ---- Admin user management: live Firebase Auth + Supabase profile operations ---- */
app.get("/api/admin/users", requireRoles(["Admin"], "User management"), async (req, res) => {
  try {
    const pr = await supabase.from("profiles").select("firebase_uid,name,email,role,department,created_at").order("created_at", { ascending: false }).limit(1000);
    if (pr.error) return res.status(500).json({ success: false, message: pr.error.message });
    const profiles = pr.data || [], authUsers = {};
    for (let i = 0; i < profiles.length; i += 100) {
      const batch = await firebaseAuth.getUsers(profiles.slice(i, i + 100).map(x => ({ uid: x.firebase_uid })));
      batch.users.forEach(u => { authUsers[u.uid] = u; });
    }
    const users = profiles.map(x => {
      const a = authUsers[x.firebase_uid];
      return { uid: x.firebase_uid, name: x.name || "", email: x.email || a?.email || "", role: x.role || "Doctor", department: x.department || "", disabled: !!a?.disabled, lastLogin: a?.metadata?.lastSignInTime || null, createdAt: a?.metadata?.creationTime || x.created_at || null };
    });
    res.json({ success: true, users });
  } catch (e) { res.status(500).json({ success: false, message: e.message || "Could not load users" }); }
});

app.put("/api/admin/users/:uid", requireRoles(["Admin"], "User management"), async (req, res) => {
  try {
    const uid = String(req.params.uid || "");
    if (!uid || uid.length > 128) return res.status(400).json({ success: false, message: "Invalid user ID." });
    const body = req.body || {}, cleanText = v => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
    const patch = {}, authPatch = {};
    if (body.name !== undefined) { const v = cleanText(body.name); if (v.length < 2 || v.length > 80) return res.status(400).json({ success: false, message: "Name must be 2–80 characters." }); patch.name = v; authPatch.displayName = v; }
    if (body.email !== undefined) { const v = cleanText(body.email).toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return res.status(400).json({ success: false, message: "Enter a valid email address." }); patch.email = v; authPatch.email = v; authPatch.emailVerified = false; }
    if (body.role !== undefined) { if (!["Admin", "Doctor", "Clinical Assistant"].includes(body.role)) return res.status(400).json({ success: false, message: "Select a valid role." }); if (uid === req.user.uid && body.role !== "Admin") return res.status(400).json({ success: false, message: "You cannot remove your own Admin role." }); patch.role = body.role; }
    if (body.department !== undefined) { const v = cleanText(body.department); if (v.length > 100) return res.status(400).json({ success: false, message: "Department must be 100 characters or fewer." }); patch.department = v; }
    if (!Object.keys(patch).length) return res.status(400).json({ success: false, message: "No changes were provided." });
    const existing = await supabase.from("profiles").select("firebase_uid").eq("firebase_uid", uid).maybeSingle();
    if (existing.error) throw existing.error;
    if (!existing.data) return res.status(404).json({ success: false, message: "User profile not found." });
    if (Object.keys(authPatch).length) await firebaseAuth.updateUser(uid, authPatch);
    const updated = await supabase.from("profiles").update(patch).eq("firebase_uid", uid).select("firebase_uid,name,email,role,department").single();
    if (updated.error) throw updated.error;
    res.json({ success: true, user: { uid: updated.data.firebase_uid, name: updated.data.name || "", email: updated.data.email || "", role: updated.data.role || "Doctor", department: updated.data.department || "" } });
  } catch (e) { res.status(500).json({ success: false, message: e.message || "Could not update user" }); }
});

app.delete("/api/admin/users/:uid", requireRoles(["Admin"], "User management"), async (req, res) => {
  try {
    const uid = String(req.params.uid || "");
    if (!uid || uid.length > 128) return res.status(400).json({ success: false, message: "Invalid user ID." });
    if (uid === req.user.uid) return res.status(400).json({ success: false, message: "You cannot delete your own account while signed in." });
    const profile = await supabase.from("profiles").select("firebase_uid").eq("firebase_uid", uid).maybeSingle();
    if (profile.error) throw profile.error;
    if (!profile.data) return res.status(404).json({ success: false, message: "User profile not found." });
    await firebaseAuth.deleteUser(uid);
    const removed = await supabase.from("profiles").delete().eq("firebase_uid", uid);
    if (removed.error) throw removed.error;
    res.json({ success: true, message: "User account and profile deleted." });
  } catch (e) { res.status(500).json({ success: false, message: e.message || "Could not delete user" }); }
});

/* ===================== REPORTS & ANALYTICS (v4.8, Admin only) =====================
   Every number is computed from the live patients, documents and audit_logs tables on each request.
   Deleted patients/documents are physically removed by the app, so they are never counted.
   Responses hold aggregates only: no patient names, IDs, file names or record contents. */
async function fetchAllRows(make, cap = 50000) {
  const rows = [];
  for (let from = 0; from < cap; from += 1000) {
    const r = await make().range(from, from + 999);
    if (r.error) return { error: r.error, rows, truncated: false };
    const batch = r.data || [];
    rows.push(...batch);
    if (batch.length < 1000) return { rows, truncated: false };
  }
  return { rows, truncated: true };
}
const median = a => { if (!a.length) return null; const b = [...a].sort((x, y) => x - y), m = b.length >> 1; return b.length % 2 ? b[m] : Math.round((b[m - 1] + b[m]) / 2); };

app.get("/api/admin/reports", requireRoles(["Admin"], "Reports & Analytics"), async (req, res) => {
  try {
    const DAY = 86400000, now = Date.now();
    const tz = Math.max(-840, Math.min(840, parseInt(req.query.tz, 10) || 0));            // minutes east of UTC, so days follow the admin's calendar
    const dayKey = t => new Date(t + tz * 60000).toISOString().slice(0, 10);
    let to = new Date(String(req.query.to || "")); if (isNaN(to)) to = new Date(now);
    if (to.getTime() > now) to = new Date(now);
    let from = new Date(String(req.query.from || "")); if (isNaN(from)) from = new Date(to.getTime() - 29 * DAY);
    if (from > to) return res.status(400).json({ success: false, message: "The start date is after the end date." });
    if (to - from > 366 * DAY) return res.status(400).json({ success: false, message: "Choose a range of 366 days or less." });
    const fromIso = from.toISOString(), toIso = to.toISOString();
    const span = to.getTime() - from.getTime() + 1, prevFromIso = new Date(from.getTime() - span).toISOString();

    const series = {}, order = [];
    for (let t = from.getTime(); dayKey(t) <= dayKey(to.getTime()); t += DAY) {
      const k = dayKey(t); if (series[k]) continue;
      series[k] = { date: k, patients: 0, uploaded: 0, completed: 0, failed: 0, processing: 0, msSum: 0, msN: 0, logins: 0, actions: 0, failures: 0, users: new Set() };
      order.push(k);
    }

    // ---- patients (existing records only)
    const pr = await fetchAllRows(() => supabase.from("patients").select("id,created_at").gte("created_at", fromIso).lte("created_at", toIso).order("created_at").order("id"));
    if (pr.error) return res.status(500).json({ success: false, message: pr.error.message });
    pr.rows.forEach(x => { const d = series[dayKey(new Date(x.created_at).getTime())]; if (d) d.patients++; });

    // ---- documents (existing records only)
    const docQuery = cols => () => supabase.from("documents").select(cols).gte("created_at", fromIso).lte("created_at", toIso).order("created_at").order("id");
    let monitorColumns = true;
    let dr = await fetchAllRows(docQuery("id,created_at,ocr_status,category,ocr_engine,processing_ms"));
    if (dr.error && isMissingMonitorColumn(dr.error)) { monitorColumns = false; dr = await fetchAllRows(docQuery("id,created_at,ocr_status,category")); }
    if (dr.error) return res.status(500).json({ success: false, message: dr.error.message });

    const docs = { total: dr.rows.length, completed: 0, failed: 0, processing: 0 };
    const engines = {}, cats = {}, times = [];
    const engineLabel = e => ({ tesseract: "Tesseract OCR", gemini: "Gemini OCR", direct: "Direct text (DOCX/TXT)" }[e] || "Not recorded");
    dr.rows.forEach(x => {
      const b = ocrBucket(x.ocr_status), d = series[dayKey(new Date(x.created_at).getTime())];
      docs[b]++;
      if (d) { d.uploaded++; d[b]++; }
      const c = String(x.category || "Other").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 40) || "Other";
      cats[c] = (cats[c] || 0) + 1;
      const key = x.ocr_engine || "unknown", en = engines[key] = engines[key] || { engine: engineLabel(key), documents: 0, completed: 0, failed: 0, msSum: 0, msN: 0 };
      en.documents++; if (b === "completed") en.completed++; if (b === "failed") en.failed++;
      const ms = Number(x.processing_ms);
      if (monitorColumns && Number.isFinite(ms) && ms > 0) { times.push(ms); en.msSum += ms; en.msN++; if (d) { d.msSum += ms; d.msN++; } }
    });
    const finished = docs.completed + docs.failed;

    // ---- user activity (audit_logs)
    let migrationNeeded = false;
    const auditQuery = cols => () => supabase.from("audit_logs").select(cols).gte("created_at", fromIso).lte("created_at", toIso).order("created_at").order("id");
    let ar = await fetchAllRows(auditQuery("id,firebase_uid,action,result,created_at"));
    if (ar.error && isMissingResultColumn(ar.error)) { migrationNeeded = true; ar = await fetchAllRows(auditQuery("id,firebase_uid,action,created_at")); }
    if (ar.error) return res.status(500).json({ success: false, message: ar.error.message });
    const act = { logins: 0, failedLogins: 0, actions: 0, failures: 0 }, users = new Set(), byCat = {};
    ar.rows.forEach(x => {
      const d = series[dayKey(new Date(x.created_at).getTime())], fail = auditResult(x) === "Failure";
      if (x.action === "User Login") { act.logins++; if (d) d.logins++; }
      else if (x.action === "Login Failed") act.failedLogins++;
      else if (x.action !== "Access Denied") { act.actions++; if (d) d.actions++; const c = auditCategory(x.action); byCat[c] = (byCat[c] || 0) + 1; }
      if (fail) { act.failures++; if (d) d.failures++; }
      if (x.firebase_uid && !fail) { users.add(x.firebase_uid); if (d) d.users.add(x.firebase_uid); }
    });

    // ---- totals and previous-period comparison (head counts, no rows transferred)
    const count = async (table, a, b) => {
      let q = supabase.from(table).select("id", { count: "exact", head: true });
      if (a) q = q.gte("created_at", a).lt("created_at", b);
      const r = await q; return r.error ? null : r.count;
    };
    const [patientsTotal, documentsTotal, prevPatients, prevDocs] = await Promise.all([
      count("patients"), count("documents"), count("patients", prevFromIso, fromIso), count("documents", prevFromIso, fromIso)
    ]);

    const top = (obj, n) => { const e = Object.entries(obj).sort((a, b) => b[1] - a[1]); const head = e.slice(0, n).map(([name, count]) => ({ name, count })); const rest = e.slice(n).reduce((a, [, c]) => a + c, 0); if (rest) head.push({ name: "Other", count: rest }); return head; };
    const sum = times.reduce((a, b) => a + b, 0);
    res.json({
      success: true, generatedAt: new Date().toISOString(), range: { from: fromIso, to: toIso, days: order.length }, tz,
      truncated: !!(pr.truncated || dr.truncated || ar.truncated), monitorColumns, migrationNeeded,
      series: order.map(k => { const d = series[k]; return { date: k, patients: d.patients, uploaded: d.uploaded, completed: d.completed, failed: d.failed, processing: d.processing, avgMs: d.msN ? Math.round(d.msSum / d.msN) : null, logins: d.logins, actions: d.actions, failures: d.failures, activeUsers: d.users.size }; }),
      patients: { registered: pr.rows.length, previous: prevPatients, total: patientsTotal },
      documents: { ...docs, previous: prevDocs, total_all: documentsTotal, byCategory: top(cats, 8) },
      ocr: { completed: docs.completed, failed: docs.failed, processing: docs.processing, successRate: finished ? Math.round(docs.completed * 1000 / finished) / 10 : null, failureRate: finished ? Math.round(docs.failed * 1000 / finished) / 10 : null,
        byEngine: Object.values(engines).map(e => ({ engine: e.engine, documents: e.documents, completed: e.completed, failed: e.failed, successRate: (e.completed + e.failed) ? Math.round(e.completed * 1000 / (e.completed + e.failed)) / 10 : null, avgMs: e.msN ? Math.round(e.msSum / e.msN) : null })).sort((a, b) => b.documents - a.documents) },
      processing: { samples: times.length, avgMs: times.length ? Math.round(sum / times.length) : null, medianMs: median(times), maxMs: times.length ? Math.max(...times) : null },
      activity: { ...act, activeUsers: users.size, byCategory: Object.entries(byCat).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count) }
    });
  } catch (e) {
    console.error("Reports error:", e);
    res.status(500).json({ success: false, message: e.message || "Could not build the report" });
  }
});

app.get("/api/patients/:id/brief", async (req, res) => {
  const p = await patientWithDocs(req.user.uid, req.params.id);
  if (!p) return res.status(404).json({ success: false, message: "Patient not found" });
  const brief = {
    generatedAt: new Date().toISOString(),
    patient: { id:p.id, name:p.name, age:p.age, sex:p.sex, diagnosis:p.dx, stage:p.stage, plannedSurgery:p.surg, surgeryDate:p.date, allergies:p.allergy, history:p.hist },
    documents:(p.docs||[]).map(d=>({name:d.n,category:d.cat,sourceHospital:d.hospital||"",date:d.dt,status:d.p})),
    timeline:p.tl||[], anaesthesia:p.an||[], medications:p.med||[], investigations:p.inv||[], conflicts:p.cf||[], missing:p.ms||[], questions:p.qs||[]
  };
  res.json({ success:true, brief });
});

app.use((err, req, res, next) => {
  console.error(err);
  if (err instanceof multer.MulterError) return res.status(400).json({ success:false, message: err.code === "LIMIT_FILE_SIZE" ? `File is too large. Maximum is ${Math.round(MAX_FILE_SIZE/1024/1024)} MB.` : err.message });
  if (err && /Supported files/.test(err.message || "")) return res.status(400).json({ success:false, message:err.message });
  res.status(500).json({ success:false, message:err.message || "Internal server error" });
});

const frontendRoot = path.resolve(__dirname, "..");
app.use(express.static(frontendRoot, { index:"index.html" }));
app.use((req,res,next)=>{ if(req.path.startsWith("/api/")) return next(); res.sendFile(path.join(frontendRoot,"index.html")); });

const server = app.listen(PORT, () => {
  console.log(`PERISCOPE running at http://localhost:${PORT}`);
  supabase.from("documents").select("source_hospital", { head: true, count: "exact" })
    .then(({ error }) => { if (error) console.warn("\n[PERISCOPE] " + HOSPITAL_MIGRATION_MESSAGE + "\n"); })
    .catch(() => {});
});
process.on("SIGINT",()=>server.close(()=>process.exit(0)));
process.on("SIGTERM",()=>server.close(()=>process.exit(0)));
