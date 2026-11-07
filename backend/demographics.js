/* PERISCOPE — patient demographics extraction.
   Pulls explicitly documented identity fields (name, age, sex, hospital, current treatment) out of raw document text.
   Nothing is inferred: a value is returned only when the document states it (labelled field or an explicit
   "52-year-old female" style sentence). Titles such as "Mrs." are NOT used to infer sex. */

const NOT_A_VALUE = /^(?:n\/?a|nil|none|unknown|not\s+(?:documented|available|stated|recorded|provided|known)|pending|-+|_+|\.+)$/i;
const TITLE = /^(?:mr|mrs|ms|miss|mx|smt|shri|sri|master|baby|baby of|dr|prof)\.?\s+/i;
const NEXT_LABEL = /\s+(?:age|sex|gender|dob|d\.o\.b|date\s+of\s+birth|mrn|uhid|ip\s*no|op\s*no|reg(?:istration)?\s*(?:no|number)|ward|bed|ref(?:erred)?|consultant|unit|height|weight|blood\s+group|phone|mobile|address|date|diagnosis)\b\s*(?:[:\-\/]|$)|\s+hospital\s*[:\-]/i;

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

function cleanText(text) {
  return String(text || '').replace(/\u00a0/g, ' ').replace(/\r/g, '').split('\n')
    .map(l => l.replace(/\t+/g, '   ').replace(/[ ]{4,}/g, '   ').trim()).filter(Boolean);
}

function cut(value) {
  let v = String(value || '');
  v = v.split(/\s{3,}/)[0];                 // table-style gaps
  const m = v.match(NEXT_LABEL);
  if (m) v = v.slice(0, m.index);           // "Name: Jane Doe Age: 52"
  return v.replace(/\s*[|;]+.*$/, '').trim();
}

function titleCase(s) {
  return s.split(/\s+/).map(w => (w.length > 1 && w === w.toUpperCase()) || w === w.toLowerCase()
    ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w).join(' ');
}

function cleanName(raw) {
  let v = cut(raw);
  v = v.replace(/\(.*?\)/g, ' ').replace(/[,;:]+\s*$/, '').replace(/\s+/g, ' ').trim();
  if (/^dr\.?\s/i.test(v)) return '';                 // a clinician, not the patient
  v = v.replace(TITLE, '').trim();
  if (!v || NOT_A_VALUE.test(v)) return '';
  if (/[0-9@/\\]/.test(v)) return '';
  if (!/^[\p{L}][\p{L}\s.'’\-]{1,58}$/u.test(v)) return '';
  const words = v.split(/\s+/);
  if (words.length > 6 || words.join('').replace(/[^\p{L}]/gu, '').length < 2) return '';
  if (/\b(?:hospital|department|summary|discharge|report|information|details|record|patient|clinic|centre|center)\b/i.test(v)) return '';
  return titleCase(v);
}

function sexOf(token) {
  if (!token) return '';
  const t = token.toLowerCase();
  if (/^(?:f|female|woman|lady|girl)$/.test(t)) return 'Female';
  if (/^(?:m|male|man|gentleman|boy)$/.test(t)) return 'Male';
  return '';
}

function parseDob(s) {
  s = String(s || '').trim();
  let m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/);
  if (m) return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  m = s.match(/^(\d{1,2})(?:st|nd|rd|th)?[\s\-]+([A-Za-z]{3,9})\.?,?[\s\-]+(\d{4})$/);
  if (m && MONTHS[m[2].slice(0, 3).toLowerCase()] !== undefined) return new Date(Date.UTC(+m[3], MONTHS[m[2].slice(0, 3).toLowerCase()], +m[1]));
  return null;
}

function ageFromDob(d, now = new Date()) {
  if (!d || Number.isNaN(d.getTime())) return null;
  let a = now.getUTCFullYear() - d.getUTCFullYear();
  const md = now.getUTCMonth() - d.getUTCMonth();
  if (md < 0 || (md === 0 && now.getUTCDate() < d.getUTCDate())) a--;
  return a >= 0 && a <= 120 ? a : null;
}

const okAge = n => Number.isFinite(n) && n >= 0 && n <= 120;

const HOSP_WORD = /\b(?:hospital|hospitals|medical\s+(?:college|centre|center|institute)|institute\s+of|cancer\s+(?:centre|center|institute|hospital)|clinic|healthcare|health\s+care|nursing\s+home|medicity|sanatorium)\b/i;
const HOSP_REJECT = /\b(?:discharge\s+summary|summary|report|department|dept|division|unit|ward|referr|consult|patient|admitted|discharged|follow[- ]?up|the\s+hospital|to\s+hospital|from\s+hospital)\b/i;

function cleanHospital(raw) {
  let v = cut(raw).replace(/\s+/g, ' ').trim();
  if (!v || NOT_A_VALUE.test(v)) return '';
  // pick the segment that actually names the institution (e.g. "Dept. of Surgery, Apollo Hospital, Chennai")
  const segs = v.split(/\s*[,|–—·]\s*/).filter(Boolean);
  const hit = segs.find(s => HOSP_WORD.test(s) && !HOSP_REJECT.test(s));
  v = hit || (segs.length === 1 && !HOSP_REJECT.test(v) ? v : '');
  if (!v || v.length > 80 || v.split(/\s+/).length > 9 || /[0-9]{4,}/.test(v)) return '';
  v = v.replace(/[.:;]+$/, '').trim();
  return v === v.toUpperCase() ? titleCase(v) : v;
}


/* ---------- other basic details (identification, contact, clinical, admission) ----------
   Only label-led values are taken ("Phone: 98xxxxxx"). Nothing is inferred, and a value that fails its
   format check is dropped rather than guessed. */
const BASIC_LABELS = [
  ['emergency', String.raw`emergency\s+contact(?:\s*(?:name|no\.?|number|person|phone))?|next\s+of\s+kin|attender|guardian`],
  ['dob', String.raw`date\s+of\s+birth|d\.?\s?o\.?\s?b\.?`],
  ['ipno', String.raw`ip\s*(?:no\.?|number|id)|in-?patient\s*(?:no\.?|number)|admission\s+(?:no\.?|number)|adm\.?\s*no\.?`],
  ['opno', String.raw`op\s*(?:no\.?|number|id)|out-?patient\s*(?:no\.?|number)`],
  ['mrn', String.raw`mrn|u\.?h\.?i\.?d\.?|medical\s+record\s*(?:no\.?|number)|reg(?:istration)?\.?\s*(?:no\.?|number|id)|hospital\s*(?:no\.?|number|id)|patient\s+id|cr\s*no\.?`],
  ['phone', String.raw`phone(?:\s*(?:no\.?|number))?|mobile(?:\s*(?:no\.?|number))?|contact(?:\s*(?:no\.?|number))?|tel(?:ephone)?(?:\s*(?:no\.?|number))?|cell(?:\s*(?:no\.?|number))?`],
  ['email', String.raw`e-?mail(?:\s*(?:id|address))?`],
  ['address', String.raw`(?:permanent\s+|residential\s+|current\s+|home\s+|patient\s+)?address|residence`],
  ['bloodgroup', String.raw`blood\s+(?:group|type)`],
  ['height', String.raw`height|ht\.?`],
  ['weight', String.raw`(?:body\s+)?weight|wt\.?`],
  ['bmi', String.raw`bmi|body\s+mass\s+index`],
  ['ward', String.raw`ward`],
  ['bed', String.raw`bed(?:\s*(?:no\.?|number))?`],
  ['consultant', String.raw`consultant(?:\s+name)?|treating\s+(?:doctor|physician|consultant|surgeon)|attending\s+(?:doctor|physician|surgeon)|primary\s+(?:doctor|physician)|doctor(?:\s+name)?`],
  ['referredby', String.raw`referred\s+by|referring\s+(?:doctor|physician|hospital)|ref\.?\s*by`],
  ['dept', String.raw`department|dept\.?|speciality|specialty|unit`],
  ['admdate', String.raw`date\s+of\s+admission|admission\s+date|admitted\s+on|d\.?o\.?a\.?`],
  ['dischdate', String.raw`date\s+of\s+discharge|discharge\s+date|discharged\s+on|d\.?o\.?d\.?`]
];
const BASIC_LABEL = {dob:"Date of birth",mrn:"MRN / UHID",ipno:"IP number",opno:"OP number",phone:"Phone",email:"Email",address:"Address",emergency:"Emergency contact",bloodgroup:"Blood group",height:"Height",weight:"Weight",bmi:"BMI",ward:"Ward",bed:"Bed",consultant:"Consultant",referredby:"Referred by",dept:"Department",admdate:"Admission date",dischdate:"Discharge date"};
const BASIC_KEYS = BASIC_LABELS.map(x => x[0]);
const BASIC_RE = new RegExp(
  String.raw`(?<![\p{L}\p{N}])(` + BASIC_LABELS.map(([k, re]) => `(?<${k}>${re})`).join('|') + String.raw`)\s*(?:\(\s*(?<unit>cm|kg|m)\s*\))?\s*[:：]`, 'giu');

const iso = d => (d && !Number.isNaN(d.getTime())) ? d.toISOString().slice(0, 10) : '';
const oneLine = v => String(v || '').split(/\s{3,}|\s*\|\s*/)[0].replace(/\s+/g, ' ').replace(/[\s,;:.\-–]+$/, '').trim();

function cleanBasic(key, raw, unit) {
  let v = oneLine(raw);
  if (!v || NOT_A_VALUE.test(v)) return '';
  switch (key) {
    case 'dob': case 'admdate': case 'dischdate': return iso(parseDob(v.replace(/\s*\(.*$/, '')));
    case 'mrn': case 'ipno': case 'opno': {
      const t = v.match(/^[A-Za-z0-9][A-Za-z0-9\-\/._]{2,24}/);
      return t && /\d/.test(t[0]) ? t[0].replace(/[.\-\/_]+$/, '') : '';
    }
    case 'phone': {
      const m = v.match(/(?:\+?\d[\d\s\-().]{5,18}\d)/);
      const digits = m ? m[0].replace(/\D/g, '') : '';
      return m && digits.length >= 7 && digits.length <= 15 ? m[0].replace(/\s+/g, ' ').trim() : '';
    }
    case 'email': { const m = v.match(/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/); return m ? m[0] : ''; }
    case 'bloodgroup': {
      const m = v.match(/^(AB|A|B|O)\s*(\+ve|-ve|\+|-|−|pos(?:itive)?|neg(?:ative)?)?\b/i);
      if (!m) return '';
      const sign = m[2] ? (/^(\+|pos)/i.test(m[2]) ? '+' : '-') : '';
      return m[1].toUpperCase() + sign;            // Rh factor is never assumed when it is not written
    }
    case 'height': {
      const m = v.match(/^(\d{1,3}(?:\.\d+)?)\s*(cm|m|metres?|meters?)?\b/i);
      if (!m) return '';
      const u = (m[2] || unit || '').toLowerCase();
      const n = parseFloat(m[1]);
      if (u === 'cm') return n >= 30 && n <= 260 ? `${m[1]} cm` : '';
      if (/^m/.test(u)) return n >= 0.3 && n <= 2.6 ? `${m[1]} m` : '';
      return '';                                      // no unit written → not guessed
    }
    case 'weight': {
      const m = v.match(/^(\d{1,3}(?:\.\d+)?)\s*(kgs?|kilograms?|lbs?)?\b/i);
      if (!m) return '';
      const u = (m[2] || unit || '').toLowerCase();
      const n = parseFloat(m[1]);
      if (/^k/.test(u)) return n >= 1 && n <= 400 ? `${m[1]} kg` : '';
      if (/^lb/.test(u)) return n >= 2 && n <= 900 ? `${m[1]} lb` : '';
      return '';
    }
    case 'bmi': { const m = v.match(/^(\d{1,2}(?:\.\d+)?)/); return m && +m[1] >= 8 && +m[1] <= 80 ? m[1] : ''; }
    case 'ward': case 'bed': return v.length <= 30 && v.split(/\s+/).length <= 4 && /[\p{L}\p{N}]/u.test(v) ? v : '';
    case 'consultant': case 'referredby': {
      v = v.replace(/\(.*?\)/g, ' ').replace(/\s+/g, ' ').trim();
      if (!/^[\p{L}][\p{L}\s.'’\-]{2,58}$/u.test(v) || /\b(?:hospital|department|clinic|centre|center)\b/i.test(v) && key === 'consultant') return '';
      return titleCase(v);
    }
    case 'dept': return /\p{L}{3}/u.test(v) && v.length <= 60 && !/^\d+$/.test(v) ? v : '';
    case 'emergency': return /[\p{L}\p{N}]{3}/u.test(v) && v.length <= 90 ? v : '';
    case 'address': return /\p{L}/u.test(v) && v.length >= 6 && v.length <= 220 ? v : '';
    default: return v;
  }
}

function extractBasicDetails(text) {
  const ls = cleanText(text);
  const out = {};
  const push = (k, v) => { if (v) (out[k] ||= []).includes(v) || out[k].push(v); };
  ls.forEach((line, idx) => {
    const hits = [...line.matchAll(BASIC_RE)];
    hits.forEach((h, i) => {
      const key = BASIC_KEYS.find(k => h.groups[k] !== undefined);
      if (!key) return;
      const end = h.index + h[0].length;
      let raw = line.slice(end, i + 1 < hits.length ? hits[i + 1].index : undefined);
      if (key === 'address') raw = raw.replace(/\s*[|]\s*.*$/, '');   // addresses keep their commas
      else raw = raw.replace(/\s*[;]\s*.*$/, '');
      // an address written on the line below its label
      if (key === 'address' && !oneLine(raw) && ls[idx + 1] && !BASIC_RE.test(ls[idx + 1])) raw = ls[idx + 1];
      BASIC_RE.lastIndex = 0;
      push(key, cleanBasic(key, key === 'address' ? raw.split(/\s{3,}/)[0] : raw, h.groups.unit));
    });
  });
  return out;
}

function extractDemographics(text, now = new Date()) {
  const ls = cleanText(text);
  const out = { names: [], ages: [], sexes: [], hospitals: [], treatments: [] };
  const push = (arr, v) => { if (v !== '' && v !== null && v !== undefined && !arr.includes(v)) arr.push(v); };
  let dobAge = null;

  ls.forEach((line, idx) => {
    let m;

    // ---- name ----
    m = line.match(/^(?:patient(?:['’]s)?\s*name|name\s+of\s+(?:the\s+)?patient|pt\.?\s*name|patient|name)\s*[:\-–]\s*(.+)$/i);
    if (m) push(out.names, cleanName(m[1]));
    m = line.match(/\b(?:Mr|Mrs|Ms|Miss|Smt|Shri|Master)\.?\s+([A-Z][\p{L}'’\-]+(?:\s+[A-Z][\p{L}'’\-]+){0,3})\b[^.\n]{0,45}?\b\d{1,3}\s*(?:[- ]?(?:[Yy]ear|[Yy]r)s?[- ]?old\b|(?:[Yy]|[Yy]rs?|[Yy]ears?)\s*[\/,]\s*(?:[Mm]ale|[Ff]emale|[MmFf])\b)/u);
    if (m) push(out.names, cleanName(m[1]));

    // ---- age / sex ----
    m = line.match(/\bage\s*(?:\/\s*sex)?\s*[:\-]\s*(\d{1,3})\s*(?:years?|yrs?|y)?\b\.?\s*(?:[\/,]\s*|\s+)?(male|female|m|f)?\b/i);
    if (m && okAge(+m[1])) { push(out.ages, +m[1]); push(out.sexes, sexOf(m[2])); }
    m = line.match(/\b(\d{1,3})\s*(?:years?|yrs?|y)\s*[\/,]?\s*(male|female|m|f)\b/i);
    if (m && okAge(+m[1])) { push(out.ages, +m[1]); push(out.sexes, sexOf(m[2])); }
    m = line.match(/\b(\d{1,3})\s*[- ]?(?:year|yr)s?[- ]?old\s*,?\s*(?:(male|female|man|woman|lady|gentleman|boy|girl)\b)?/i);
    if (m && okAge(+m[1])) { push(out.ages, +m[1]); push(out.sexes, sexOf(m[2])); }
    m = line.match(/\b(male|female|man|woman|lady)\s*,?\s*(?:aged?|age)\s*[:\-]?\s*(\d{1,3})\b/i);
    if (m && okAge(+m[2])) { push(out.ages, +m[2]); push(out.sexes, sexOf(m[1])); }
    m = line.match(/\baged\s+(\d{1,3})\b/i);
    if (m && okAge(+m[1])) push(out.ages, +m[1]);
    m = line.match(/\b(?:sex|gender)\s*[:\-]\s*(male|female|m|f)\b/i);
    if (m) push(out.sexes, sexOf(m[1]));

    m = line.match(/\b(?:dob|d\.o\.b\.?|date\s+of\s+birth)\s*[:\-]\s*([0-9A-Za-z ,./\-]{6,24})/i);
    if (m && dobAge === null) dobAge = ageFromDob(parseDob(cut(m[1])), now);

    // ---- hospital ----
    m = line.match(/^(?:hospital(?:\s+name)?|name\s+of\s+(?:the\s+)?hospital|institution|facility|treating\s+hospital|centre|center)\s*[:\-–]\s*(.+)$/i);
    if (m) push(out.hospitals, cleanHospital(m[1]));
    else if (idx < 14 && HOSP_WORD.test(line) && line.length <= 110 && !/[:]/.test(line.slice(0, 18))) push(out.hospitals, cleanHospital(line));

    // ---- current treatment (labelled only) ----
    m = line.match(/^(?:current|ongoing)\s+(?:treatment|therapy|regimen)\s*[:\-–]\s*(.+)$/i);
    if (m) { const v = cut(m[1]).replace(/\s+/g, ' ').trim(); if (v && !NOT_A_VALUE.test(v) && v.length <= 160) push(out.treatments, v); }
  });

  if (!out.ages.length && dobAge !== null) out.ages.push(dobAge);
  out.basic = extractBasicDetails(text);
  return out;
}

/* Loose identity comparison for conflict detection: ignores case, titles, punctuation and word order. */
function sameName(a, b) {
  const tok = s => String(s || '').toLowerCase().replace(TITLE, '').replace(/[^\p{L}\s]/gu, ' ').split(/\s+/).filter(w => w.length > 1);
  const A = tok(a), B = tok(b);
  if (!A.length || !B.length) return true;
  const [small, big] = A.length <= B.length ? [A, B] : [B, A];
  return small.every(w => big.some(x => x === w || (w.length === 1 && x.startsWith(w)) || x.startsWith(w) || w.startsWith(x)));
}

module.exports = { extractDemographics, extractBasicDetails, BASIC_KEYS, BASIC_LABEL, sameName, cleanName, cleanHospital };
