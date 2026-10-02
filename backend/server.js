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
    const ok = /pdf|officedocument\.wordprocessingml\.document|text\/plain|image\/(png|jpeg|jpg)/i.test(file.mimetype)
      || /\.(pdf|docx|txt|png|jpg|jpeg)$/i.test(name);
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
  const diagnosis = String(data.diagnosis ?? data.dx ?? "").trim();
  const plannedSurgery = String(data.planned_surgery ?? data.surg ?? "").trim();
  const surgeryDate = String(data.surgery_date ?? data.date ?? "").trim();
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
    medical_history: String(data.medical_history ?? data.hist ?? "").trim(),
    status: String(data.status || "Awaiting Review").trim()
  };
}

async function findPatient(uid, patientCode) {
  const { data, error } = await supabase.from("patients").select("*").eq("patient_code", patientCode).maybeSingle();
  if (error) throw error;
  return data;
}

async function audit(uid, patientRow, action, entity = "", oldValue = "", newValue = "") {
  const { error } = await supabase.from("audit_logs").insert({
    firebase_uid: uid, patient_id: patientRow?.id || null, action, entity,
    old_value: oldValue === "" ? null : { value: oldValue },
    new_value: newValue === "" ? null : { value: newValue }
  });
  if (error) console.warn("Audit log failed:", error.message);
}

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

  const sourceNameLocal = d => String(d?.file_name || d?.category || 'Uploaded document');
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
      if (m) ages.push(Number(m[1]));
      if (!m) {
        m = line.match(/\b(\d{1,3})\s*(?:years?|yrs?)\s*\/\s*(male|female|m|f)\b/i);
        if (m) ages.push(Number(m[1]));
        if (!m) {
          m = line.match(/\b(\d{1,3})\s*[- ]?year[- ]?old\s+(male|female|m|f)\b/i);
          if (m) ages.push(Number(m[1]));
        }
      }
      m = line.match(/\b(?:sex|gender)\s*[:\-]\s*(male|female|m|f)\b/i);
      if (m) sexes.push(/^f/i.test(m[1]) ? 'Female' : 'Male');
      m = line.match(/\b(?:\d{1,3})\s*[- ]?year[- ]?old\s+(male|female|m|f)\b/i);
      if (m) sexes.push(/^f/i.test(m[1]) ? 'Female' : 'Male');
    }

    // Section-aware extraction. This is what makes a discharge summary populate the right PERISCOPE fields.
    let section = '';
    for (let i = 0; i < ls.length; i++) {
      const line = ls[i];
      const l = line.toLowerCase();
      const dt = dateFromLine(line, fallback);

      const isSectionHeading = /^\s*(?:\d+\.\s*)?(final diagnosis|diagnosis|reason for admission|relevant history|investigations?(?: during admission)?|procedure performed|postoperative course|post-operative course|histopathology|medications? on discharge|medications?|wound and drain care|diet and activity|follow[- ]?up plan|discharge condition|important pending information|pending (?:investigations?|information))\s*:?$/i.test(line);
      if (isSectionHeading) {
        section = l.replace(/^\s*\d+\.\s*/, '').replace(/:.*$/,'').trim();
      }

      // Diagnosis.
      if (/^\s*clinical stage\s*:/i.test(line)) { const sv=line.split(':').slice(1).join(':').trim().split(/,|pending/i)[0].trim(); if(sv) stages.push(sv); }
      if (/^(primary diagnosis|final diagnosis)\s*:/i.test(line)) {
        const v = line.split(':').slice(1).join(':').trim();
        if (v) diagnoses.push(v);
      } else if (/\binvasive ductal carcinoma\b/i.test(line)) {
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
        const medItem = parseMedication(line, src);
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
          docInv.push({d:dt,t:title,r:line,src,st:'U'});
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

      // Timeline events.
      if (!isSectionHeading && /\b(admitted|admission)\b/i.test(line)) add(tl,{d:dt,e:line,c:'Clinical Event',src,pg:1,st:'U'});
      if (!isSectionHeading && !/^hospital discharge summary$/i.test(line) && /\b(discharged|discharge)\b/i.test(line)) add(tl,{d:dt,e:line,c:'Clinical Event',src,pg:1,st:'U'});
      if (!isSectionHeading && /\b(modified radical mastectomy|axillary lymph node dissection|underwent|operation|operative|surgery|procedure)\b/i.test(line)) add(tl,{d:dt,e:line,c:'Surgery',src,pg:1,st:'U'});
      if (/\b(chemotherapy|chemo|cycle\s*\d+)\b/i.test(line)) add(tl,{d:dt,e:line,c:'Chemotherapy',src,pg:1,st:'U'});
      if (/\b(radiotherapy|radiation therapy|radiation)\b/i.test(line)) add(tl,{d:dt,e:line,c:'Radiotherapy',src,pg:1,st:'U'});
      if (/\b(immunotherapy|immuno-?therapy)\b/i.test(line)) add(tl,{d:dt,e:line,c:'Immunotherapy',src,pg:1,st:'U'});
      if (/\b(targeted therapy|targeted treatment)\b/i.test(line)) add(tl,{d:dt,e:line,c:'Targeted Therapy',src,pg:1,st:'U'});
      if (/\b(follow[- ]?up|review)\b/i.test(line)) add(tl,{d:dt,e:line,c:'Clinical Event',src,pg:1,st:'U'});

      if (/\b(general anaesthesia|general anesthesia|spinal anaesthesia|spinal anesthesia|epidural|sedation|intubat|airway|mallampati)\b/i.test(line)) {
        an.push({d:dt,s:'',a:/general/i.test(line)?'General anaesthesia':/spinal/i.test(line)?'Spinal anaesthesia':/epidural/i.test(line)?'Epidural anaesthesia':'Anaesthesia information',ev:line,src:`${src} p1`,st:'U'});
      }
    }

    const diagnosis = uniq(diagnoses, x => String(x).toLowerCase())[0] || '';
    const history = uniq(histories.map(x => String(x).replace(/^associated conditions\s*:\s*/i,'')), x => x.toLowerCase()).join('; ');
    const allergy = uniq(docAllergies, x => x.toLowerCase())[0] || '';
    const surgery = uniq(surgeries, x => x.toLowerCase())[0] || '';
    const surgDate = uniq(surgeryDates, x => x)[0] || '';

    sourceFacts.push({src,facts:{ages:uniq(ages,x=>x),sexes:uniq(sexes,x=>x),stages:uniq(stages,x=>x),diagnoses:diagnosis?[diagnosis]:[],surgeries:surgery?[surgery]:[],surgeryDates:surgDate?[surgDate]:[],allergies:allergy?[allergy]:[],histories:history?[history]:[],comorbidities:uniq(comorbidities,x=>String(x).toLowerCase())}});
    med.push(...docMeds);
    inv.push(...docInv);
    allergyStatements.push(...docAllergies.map(value=>({value,src:`${src} p1`})));
    for (const p of pending) allMissing.push({...p,st:'Missing'});
  }

  const facts = sourceFacts;
  const ages = uniq(facts.flatMap(x=>x.facts.ages.map(v=>({v,src:x.src}))),x=>x.v);
  const sexes = uniq(facts.flatMap(x=>x.facts.sexes.map(v=>({v,src:x.src}))),x=>x.v);
  const allergyUnique = uniq(allergyStatements,x=>String(x.value).toLowerCase());
  const allSurgeryDates = uniq(facts.flatMap(x=>x.facts.surgeryDates.map(v=>({v,src:x.src}))),x=>x.v);
  const cf=[];

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
  const factSex = sexes.length===1 ? sexes[0].v : '';

  if (factAge && patient.age && Number(patient.age)!==Number(factAge)) cf.push({f:'Age',a:String(patient.age),sa:'Patient profile',b:String(factAge),sb:sourceFacts.find(x=>x.facts.ages.includes(factAge))?.src||'Document',st:'Open'});
  if (factSex && patient.sex && String(patient.sex).toLowerCase()!==String(factSex).toLowerCase()) cf.push({f:'Sex',a:String(patient.sex),sa:'Patient profile',b:factSex,sb:sourceFacts.find(x=>x.facts.sexes.includes(factSex))?.src||'Document',st:'Open'});

  if (an.length===0 && patient.planned_surgery) allMissing.push({i:'Anaesthesia history',r:'No anaesthesia information was found in the uploaded documents.',st:'Missing'});
  if (!patient.diagnosis && !factDx) allMissing.push({i:'Diagnosis',r:'No diagnosis statement was identified in the uploaded documents.',st:'Missing'});
  if (!allergyUnique.length) allMissing.push({i:'Allergy status',r:'No allergy statement was identified in the uploaded documents. PERISCOPE will not infer absence of allergy.',st:'Missing'});
  if (!factAge) allMissing.push({i:'Age',r:'Age was not identified in the uploaded documents.',st:'Missing'});
  if (!factSex) allMissing.push({i:'Sex',r:'Sex was not identified in the uploaded documents.',st:'Missing'});

  const missing = uniq(allMissing,x=>x.i);
  const qs = uniq([...allQuestions, ...cf.map(x=>({q:`Verify conflicting ${x.f.toLowerCase()}: ${x.a} (${x.sa}) vs ${x.b} (${x.sb}).`,st:'Open'})), ...missing.filter(x=>/pending|final|receptor|treatment plan/i.test(x.i)).map(x=>({q:`Obtain or verify ${x.i.toLowerCase()}.`,st:'Open'}))],x=>`${x.q}|${x.st}`);

  return {
    facts:{
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
    tl:uniq(tl,x=>`${x.d}|${x.e}|${x.c}|${x.src}`).sort((a,b)=>String(b.d||'').localeCompare(String(a.d||''))),
    an:uniq(an,x=>`${x.d}|${x.ev}|${x.src}`),
    med:uniq(med,x=>`${x.m}|${x.dose}|${x.freq}|${x.src}`),
    inv:uniq(inv,x=>`${x.d}|${x.t}|${x.r}|${x.src}`).sort((a,b)=>String(b.d||'').localeCompare(String(a.d||''))),
    cf:uniq(cf,x=>`${x.f}|${x.a}|${x.b}|${x.sa}|${x.sb}`),
    ms:missing,
    qs
  };
}

async function rebuildClinicalView(uid, patientRow) {
  const { data: docs, error } = await supabase.from('documents').select('file_name,category,created_at,extracted_text,ocr_status').eq('patient_id',patientRow.id).eq('ocr_status','completed');
  if (error) throw error;
  const derived = clinicalFromDocuments(patientRow, docs || []);
  const base = (patientRow.data && typeof patientRow.data === 'object') ? patientRow.data : {};
  const merged = {...base, tl:derived.tl, an:derived.an, med:derived.med, inv:derived.inv, cf:derived.cf, ms:derived.ms, qs:derived.qs, comorbidities:derived.facts.comorbidities || '', hist:derived.facts.medical_history || '', medical_history:derived.facts.medical_history || '', historySource:derived.facts.historySource || '', stage:derived.facts.stage || base.stage || ''};
  const patch={data:merged,updated_at:new Date().toISOString()};
  const f=derived.facts;
  // Fill profile fields from documents only when the profile is blank. Conflicting values are retained and surfaced in Conflicts.
  if(!patientRow.age && f.age) patch.age=Number(f.age);
  if(!patientRow.sex && f.sex) patch.sex=f.sex;
  if(!patientRow.diagnosis && f.diagnosis) patch.diagnosis=f.diagnosis;
  if(!patientRow.planned_surgery && f.planned_surgery) patch.planned_surgery=f.planned_surgery;
  if(!patientRow.surgery_date && f.surgery_date) patch.surgery_date=f.surgery_date;
  if(!patientRow.allergy && f.allergy) patch.allergy=f.allergy;
  if(!patientRow.medical_history && f.medical_history) patch.medical_history=f.medical_history;
  if(!patientRow.stage && f.stage) patch.stage=f.stage;
  const { data: updated, error: updateError } = await supabase.from('patients').update(patch).eq('id',patientRow.id).select('*').single();
  if(updateError) throw updateError;
  return updated;
}

async function extractText(file) {
  const name = file.originalname.toLowerCase();
  if (/\.docx$/.test(name) || file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    let text = String(result.value || "").replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    // Mammoth extracts real DOCX text. If the document contains only embedded images,
    // there is no text to return; do not pretend OCR succeeded.
    return text;
  }
  if (/\.txt$/.test(name) || file.mimetype === "text/plain") return file.buffer.toString("utf8");

  if (/\.pdf$/.test(name) || file.mimetype === "application/pdf") {
    let nativePdfProblem = '';
    try {
      const parsed = await pdfParse(file.buffer);
      const native = String(parsed.text || '').trim();
      if (native.length >= 40) return native;
      nativePdfProblem = 'No usable text layer was found';
    } catch (e) {
      nativePdfProblem = e.message || 'PDF text layer could not be parsed';
    }

    // Some PDFs have malformed/non-standard cross-reference (XRef) tables.
    // That does not prevent PERISCOPE from processing them: use local OCR as
    // the recovery path and report the fallback as a successful processing mode.
    if (/\.pdf$/.test(name) && nativePdfProblem) {
      console.info(`PDF native text layer unavailable; using local OCR fallback (${nativePdfProblem}).`);
    }
  }

  if (/\.(pdf|png|jpg|jpeg)$/.test(name) || /^image\//.test(file.mimetype)) {
    const ext = name.endsWith('.pdf') ? '.pdf' : name.endsWith('.png') ? '.png' : name.endsWith('.jpeg') ? '.jpeg' : '.jpg';
    const tempPath = path.join(os.tmpdir(), `periscope_${crypto.randomUUID()}${ext}`);
    await fs.writeFile(tempPath, file.buffer);
    try {
      const mod = await import('scribe.js-ocr');
      const scribe = mod.default || mod;
      const text = await scribe.extractText([tempPath], ['eng'], 'txt');
      await scribe.terminate();
      return typeof text === 'string' ? text : Buffer.from(text).toString('utf8');
    } finally {
      await fs.unlink(tempPath).catch(() => {});
    }
  }
  throw new Error('Unsupported file type');
}

app.get("/api/health", async (req, res) => {
  try {
    const { error } = await supabase.from("profiles").select("firebase_uid", { head: true, count: "exact" });
    if (error) throw error;
    res.json({ success: true, message: "PERISCOPE backend is running", firebaseAuth: true, supabase: true, storageBucket: BUCKET, ocr: "local" });
  } catch (e) {
    res.status(500).json({ success: false, message: "Backend is running but Supabase is not configured correctly", error: e.message });
  }
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
    res.json({ success: true, user: { uid: req.user.uid, name: profile.name, email: profile.email, role: profile.role, dept: profile.department } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.put("/api/me", async (req, res) => {
  const patch = {};
  if (req.body.name !== undefined) patch.name = String(req.body.name).trim();
  if (req.body.dept !== undefined) patch.department = String(req.body.dept).trim();
  const { error } = await supabase.from("profiles").upsert({ firebase_uid: req.user.uid, ...patch }, { onConflict: "firebase_uid" });
  if (error) return res.status(500).json({ success: false, message: error.message });
  res.json({ success: true });
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
  if (error) return res.status(500).json({ success: false, message: error.message });
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
  if (error) { console.error("Patient update failed:", error.message); return res.status(500).json({ success: false, message: error.message }); }
  await audit(req.user.uid, row, "Patient Updated", "patient");
  res.json({ success: true, patient: await patientWithDocs(req.user.uid, req.params.id) });
});

app.delete("/api/patients/:id", async (req, res) => {
  try {
    const uid = req.user.uid;
    const profile = await attachProfile(req);
    if (!["Doctor", "Admin"].includes(profile.role)) return res.status(403).json({ success: false, message: "Clinical Assistants cannot delete patients" });
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
      await supabase.from("audit_logs").delete().eq("patient_id", row.id);
      ({ error } = await removePatient());
    }
    if (error) return res.status(500).json({ success: false, message: error.message });

    // 4. record the deletion (not linked to the patient row, which no longer exists)
    await audit(uid, null, "Patient Deleted", `patient ${req.params.id}`, row.name || "", "");
    res.json({ success: true });
  } catch (e) {
    console.error("Delete patient error:", e);
    res.status(500).json({ success: false, message: e.message || "Failed to delete patient" });
  }
});

app.get("/api/patients/:id/audit", async (req, res) => {
  const row = await findPatient(req.user.uid, req.params.id);
  if (!row) return res.status(404).json({ success: false, message: "Patient not found" });
  const { data, error } = await supabase.from("audit_logs").select("*").eq("patient_id", row.id).order("created_at", { ascending: false }).limit(200);
  if (error) return res.status(500).json({ success: false, message: error.message });
  res.json({ success: true, audit: (data || []).map(x => ({ id:x.id, patientId:req.params.id, action:x.action, entity:x.entity, oldValue:x.old_value?.value || "", newValue:x.new_value?.value || "", at:x.created_at })) });
});

app.post("/api/patients/:id/documents", upload.single("document"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "No document uploaded" });
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
    let ocrStatus = "completed";
    try {
      text = String(await extractText(req.file) || "").trim();
      if (!text) ocrStatus = "failed";
    } catch (ocrError) {
      ocrStatus = "failed";
      console.error("OCR/extraction error:", ocrError);
    }

    const { data: row, error: insertError } = await supabase.from("documents").insert({
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
    }).select("*").single();
    if (insertError) {
      await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => {});
      throw insertError;
    }

    const refreshedPatientRow = await rebuildClinicalView(req.user.uid, patient);
    await audit(req.user.uid, refreshedPatientRow, "Document Uploaded", "document", "", req.file.originalname);
    const refreshedPatient = patientFromRow(refreshedPatientRow);
    refreshedPatient.docs = await listDocuments(req.user.uid, refreshedPatientRow.id);
    res.status(201).json({ success: true, document: documentFromRow(row), text, patient: refreshedPatient });
  } catch (e) {
    console.error("Document processing error:", e);
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
  res.json({ success: true, document: documentFromRow(data) });
});

app.delete("/api/patients/:id/documents/:docId", async (req, res) => {
  const patient = await findPatient(req.user.uid, req.params.id);
  if (!patient) return res.status(404).json({ success: false, message: "Patient not found" });
  const { data, error } = await supabase.from("documents").select("*").eq("id", req.params.docId).eq("patient_id", patient.id).maybeSingle();
  if (error) return res.status(500).json({ success: false, message: error.message });
  if (!data) return res.status(404).json({ success: false, message: "Document not found" });
  await supabase.storage.from(BUCKET).remove([data.storage_path]).catch(() => {});
  const { error: delError } = await supabase.from("documents").delete().eq("id", data.id);
  if (delError) return res.status(500).json({ success:false, message:delError.message });
  await supabase.from("patients").update({ updated_at: new Date().toISOString() }).eq("id", patient.id);
  await audit(req.user.uid, patient, "Document Deleted", "document", data.file_name || "", "");
  res.json({ success: true });
});

app.get("/api/patients/:id/brief", async (req, res) => {
  const p = await patientWithDocs(req.user.uid, req.params.id);
  if (!p) return res.status(404).json({ success: false, message: "Patient not found" });
  const brief = {
    generatedAt: new Date().toISOString(),
    patient: { id:p.id, name:p.name, age:p.age, sex:p.sex, diagnosis:p.dx, stage:p.stage, plannedSurgery:p.surg, surgeryDate:p.date, allergies:p.allergy, history:p.hist },
    documents:(p.docs||[]).map(d=>({name:d.n,category:d.cat,date:d.dt,status:d.p})),
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

const server = app.listen(PORT, () => console.log(`PERISCOPE running at http://localhost:${PORT}`));
process.on("SIGINT",()=>server.close(()=>process.exit(0)));
process.on("SIGTERM",()=>server.close(()=>process.exit(0)));
