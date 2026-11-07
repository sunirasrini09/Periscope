/* PERISCOPE — key details extraction.
   Turns raw OCR/document text into a short list of the important, explicitly documented facts.
   Nothing is inferred or guessed: a value is returned only when the document states it.
   Pure functions, no dependencies other than demographics.js. */

const { extractDemographics, BASIC_LABEL } = require('./demographics');

/* ---------- OCR clean-up (safe fixes only) ---------- */
function normalizeOcr(text) {
  return String(text || '')
    .replace(/\r/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"')
    .replace(/\ufb01/g, 'fi').replace(/\ufb02/g, 'fl').replace(/\ufb00/g, 'ff')
    .replace(/(\p{L})-\n(\p{Ll})/gu, '$1$2')          // re-join words split by a line-break hyphen
    .replace(/\bHb\s?A[1lI|][cC]\b/g, 'HbA1c')               // HbAlc / HbAIc → HbA1c (common OCR confusion)
    .replace(/\b([cpyr]?T[0-4xX][a-c]?\s*N[0-3xX][a-c]?\s*M)[Oo]\b/g, '$10') // TNM "MO" → "M0"
    .replace(/^[|¦!]\s+/gm, '')                       // stray table-border characters at line start
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/* ---------- helpers ---------- */
const NOT_A_VALUE = /^(?:n\/?a|nil|none|unknown|not\s+(?:documented|available|stated|recorded|provided|known)|-+|_+|\.+)$/i;
const clean = s => String(s || '').replace(/\s+/g, ' ').replace(/^[\s:\-–•*]+|[\s;,]+$/g, '').trim();
const uniq = arr => { const seen = new Set(); return arr.filter(x => { const k = JSON.stringify(x).toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }); };
const lineList = text => String(text || '').split('\n').map(l => l.replace(/[ \t]+/g, ' ').trim()).filter(Boolean);

const HEADING = /^(?:\d+[.)]\s*)?([A-Za-z][A-Za-z /&()\-]{2,48}?)\s*:?\s*$/;
function isHeading(line) {
  const m = line.match(HEADING);
  if (!m) return false;
  return line.endsWith(':') || line === line.toUpperCase() || /^(?:\d+[.)]\s*)/.test(line);
}
const SECTION_RULES = [
  ['medications', /medication|medicine|drug|prescription|\brx\b|treatment (?:given|advised)|discharge advice/i],
  ['investigations', /investigation|laborator|lab (?:results|findings)|results?$|blood (?:tests?|work)/i],
  ['diagnosis', /diagnos|impression/i],
  ['procedure', /procedure|operation|surgery|operative/i],
  ['pending', /pending|follow[- ]?up|awaiting/i],
  ['history', /history|comorbid|past medical/i],
  ['allergy', /allerg/i]
];
function sectionOf(heading) {
  const h = heading.replace(/[:\d.)]/g, '').trim();
  const hit = SECTION_RULES.find(([, re]) => re.test(h));
  return hit ? hit[0] : 'other';
}

/* ---------- labelled-value helper ---------- */
function labelled(lines, labelRe, { multiline = false, max = 3 } = {}) {
  const out = [];
  const re = new RegExp('^(?:' + labelRe + ')\\s*[:\\-–]\\s*(.*)$', 'i');
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(re);
    if (!m) continue;
    let v = clean(m[1]);
    if (!v && multiline) {
      for (let j = i + 1; j < lines.length && j <= i + max; j++) {
        if (isHeading(lines[j]) || /^[A-Za-z ]{3,30}\s*:\s*\S/.test(lines[j])) break;
        const t = clean(lines[j].replace(/^[-•*\d.)]+\s*/, ''));
        if (t) out.push(t);
      }
      continue;
    }
    if (v && !NOT_A_VALUE.test(v)) out.push(v.length > 220 ? v.slice(0, 217) + '…' : v);
  }
  return out;
}

/* ---------- investigations ---------- */
const NUMERIC_TESTS = [
  ['Haemoglobin', /\b(?:h(?:a)?emoglobin|hb)\b/i, /g\s*\/\s*d?l|gm\s*%|g%/i],
  ['WBC count', /\b(?:wbc|total\s+(?:leu|leuko)cyte\s+count|tlc)\b/i, /cells|\/\s*(?:cu\s*mm|µl|ul)|10\^?3|x\s*10/i],
  ['Platelets', /\b(?:platelets?(?:\s+count)?|plt)\b/i, /lakh|\/\s*(?:cu\s*mm|µl|ul)|10\^?3|x\s*10/i],
  ['Creatinine', /\b(?:serum\s+)?creatinine\b/i, /mg\s*\/\s*d?l|µmol/i],
  ['Urea', /\b(?:blood\s+)?urea\b/i, /mg\s*\/\s*d?l|mmol/i],
  ['Sodium', /\b(?:serum\s+)?sodium\b|\bna\+?\b(?=\s*[:\-=]?\s*\d)/i, /meq|mmol/i],
  ['Potassium', /\b(?:serum\s+)?potassium\b|\bk\+?\b(?=\s*[:\-=]?\s*\d)/i, /meq|mmol/i],
  ['HbA1c', /\bhba1c\b|\bglycosylated\s+h(?:a)?emoglobin\b/i, /%/],
  ['Fasting blood sugar', /\b(?:fbs|fasting\s+(?:blood\s+)?(?:sugar|glucose))\b/i, /mg\s*\/\s*d?l|mmol/i],
  ['Random blood sugar', /\b(?:rbs|random\s+(?:blood\s+)?(?:sugar|glucose))\b/i, /mg\s*\/\s*d?l|mmol/i],
  ['INR', /\binr\b/i, null],
  ['Total bilirubin', /\b(?:total\s+)?bilirubin\b/i, /mg\s*\/\s*d?l|µmol/i],
  ['SGOT / AST', /\b(?:sgot|ast)\b/i, /u\s*\/\s*l|iu/i],
  ['SGPT / ALT', /\b(?:sgpt|alt)\b/i, /u\s*\/\s*l|iu/i],
  ['TSH', /\btsh\b/i, /µ?i?u\s*\/\s*m?l|miu/i],
  ['Ejection fraction', /\b(?:ejection\s+fraction|lvef|ef)\b/i, /%/]
];
const TEXT_TESTS = [
  ['ECG', /^(?:e\.?c\.?g\.?|electrocardiogram)\b/i],
  ['Chest X-ray', /^(?:chest\s+x[- ]?ray|cxr)\b/i],
  ['2D Echo', /^(?:2d[- ]?echo(?:cardiogram)?|echo(?:cardiogram)?)\b/i],
  ['Pulmonary function', /^(?:pft|pulmonary\s+function(?:\s+tests?)?|spirometry)\b/i],
  ['Histopathology', /^(?:histopathology|biopsy|hpe)\b/i],
  ['Imaging', /^(?:ct|mri|usg|ultrasound|pet[- ]?ct|mammogra(?:m|phy))\b/i]
];

function extractInvestigations(lines) {
  const out = [];
  for (const line of lines) {
    for (const [label, re, unit] of NUMERIC_TESTS) {
      const m = line.match(new RegExp('(?:^|[\\s,;(])(' + re.source + ')\\s*(?:[:\\-=]|\\bof\\b|\\bis\\b|\\bwas\\b)?\\s*(\\d+(?:\\.\\d+)?)\\s*([^\\s,;)]*(?:\\s*\\/\\s*[A-Za-zµ0-9^]+)?)', 'i'));
      if (!m) continue;
      const val = parseFloat(m[2]);
      if (!Number.isFinite(val)) continue;
      const u = clean(m[3]);
      if (unit && u && !unit.test(u) && !unit.test(line)) continue;   // value without a plausible unit → skip
      out.push({ label, value: clean(m[2] + (u ? ' ' + u : '')) });
      break;
    }
    for (const [label, re] of TEXT_TESTS) {
      const m = line.match(new RegExp('^' + re.source.replace(/^\^/, '') + '[^:\\-–]*[:\\-–]\\s*(.+)$', 'i'));
      if (m) { const v = clean(m[1]); if (v && !NOT_A_VALUE.test(v)) out.push({ label, value: v.length > 140 ? v.slice(0, 137) + '…' : v }); break; }
    }
  }
  // keep the first value seen per test
  const seen = new Set();
  return out.filter(x => (seen.has(x.label) ? false : seen.add(x.label)));
}

/* ---------- vitals ---------- */
function extractVitals(text) {
  const out = [];
  let m;
  if ((m = text.match(/\b(?:bp|blood\s+pressure)\s*[:\-=]?\s*(\d{2,3})\s*\/\s*(\d{2,3})\s*(?:mm\s*hg)?/i)) && +m[1] >= 60 && +m[1] <= 260)
    out.push({ label: 'Blood pressure', value: `${m[1]}/${m[2]} mmHg` });
  if ((m = text.match(/\b(?:pulse|heart\s+rate|hr)\s*[:\-=]?\s*(\d{2,3})\s*(?:\/?\s*min|bpm)?/i)) && +m[1] >= 30 && +m[1] <= 220)
    out.push({ label: 'Pulse', value: `${m[1]} /min` });
  if ((m = text.match(/\bsp\s?o2\s*[:\-=]?\s*(\d{2,3})\s*%?/i)) && +m[1] >= 50 && +m[1] <= 100)
    out.push({ label: 'SpO₂', value: `${m[1]}%` });
  if ((m = text.match(/\b(?:temp(?:erature)?)\s*[:\-=]?\s*(\d{2,3}(?:\.\d)?)\s*°?\s*([CF])?\b/i)))
    out.push({ label: 'Temperature', value: `${m[1]}${m[2] ? ' °' + m[2].toUpperCase() : ''}` });
  if ((m = text.match(/\b(?:weight|wt)\s*[:\-=]?\s*(\d{2,3}(?:\.\d)?)\s*kgs?\b/i)))
    out.push({ label: 'Weight', value: `${m[1]} kg` });
  if ((m = text.match(/\b(?:height|ht)\s*[:\-=]?\s*(\d{2,3}(?:\.\d)?)\s*cms?\b/i)))
    out.push({ label: 'Height', value: `${m[1]} cm` });
  if ((m = text.match(/\bbmi\s*[:\-=]?\s*(\d{2}(?:\.\d+)?)/i)))
    out.push({ label: 'BMI', value: m[1] });
  return out;
}

/* ---------- medications ---------- */
const DOSE = /\b(\d+(?:\.\d+)?\s*(?:mg|mcg|µg|g|ml|iu|units?))\b/i;
const FREQ = /\b(once daily|twice daily|thrice daily|three times daily|four times daily|daily|od|bd|bid|tds|tid|qid|hs|qhs|sos|prn|at night|in the morning|every\s+\d+(?:\s*[–-]\s*\d+)?\s*(?:hours?|hrs?)|1-0-1|1-1-1|1-0-0|0-0-1|0-1-0)\b/i;
const DRUG_FORM = /^(?:tab(?:let)?|cap(?:sule)?|inj(?:ection)?|syp|syrup|susp|oint(?:ment)?|drops?|iv|po)\b\.?\s*/i;
const NOT_A_DRUG = /\b(hb|haemoglobin|hemoglobin|creatinine|urea|sodium|potassium|bilirubin|sgot|sgpt|tsh|hba1c|glucose|sugar|weight|height|wt|bp|pressure|pulse|ef|ejection)\b/i;

function parseMedication(line) {
  const raw = clean(line.replace(/^\s*(?:\d+[.)]|[-•*])\s*/, ''));
  const dose = raw.match(DOSE);
  if (!dose) return null;
  let name = clean(raw.slice(0, dose.index).replace(DRUG_FORM, '').replace(/[,:;\-–—]+\s*$/, ''));
  if (!name || name.length > 50 || /^(?:dose|medication|medicines?|total|advised|given)$/i.test(name) || NOT_A_DRUG.test(name)) return null;
  const freq = raw.match(FREQ);
  return { name, dose: clean(dose[1]), freq: freq ? clean(freq[1]) : '' };
}

function extractMedications(lines) {
  const out = [];
  let section = 'other';
  for (const line of lines) {
    if (isHeading(line)) { section = sectionOf(line); continue; }
    const hasForm = DRUG_FORM.test(line.replace(/^\s*(?:\d+[.)]|[-•*])\s*/, ''));
    if (section !== 'medications' && !hasForm) continue;
    const med = parseMedication(line);
    if (med) out.push(med);
  }
  return uniq(out);
}

/* ---------- history / comorbidities ---------- */
const COMORBID = [
  ['Hypertension', /\b(?:hypertension|htn)\b/i], ['Diabetes mellitus', /\b(?:diabetes(?:\s+mellitus)?|dm\s*(?:type\s*)?(?:2|ii|1|i)|t2dm|t1dm)\b/i],
  ['Asthma', /\basthma\b/i], ['COPD', /\bcopd\b/i], ['Coronary artery disease', /\b(?:coronary artery disease|cad|ischaemic heart disease|ihd)\b/i],
  ['Hypothyroidism', /\bhypothyroid(?:ism)?\b/i], ['Chronic kidney disease', /\b(?:chronic kidney disease|ckd)\b/i],
  ['Epilepsy', /\bepilepsy\b/i], ['Tuberculosis', /\b(?:tuberculosis|tb)\b/i]
];
const NEGATION = /\b(?:no|nil|denies|denied|without|not|negative for|non[- ]?)\b[^.;\n]{0,40}$/i;

function extractHistory(lines) {
  const found = [];
  for (const line of lines) {
    if (!/\b(?:h\/o|history|known case|k\/c\/o|kco|comorbid|diagnosed|suffering|on treatment)\b|^\s*(?:past|medical|relevant)/i.test(line)) continue;
    for (const [label, re] of COMORBID) {
      const m = line.match(re);
      if (!m) continue;
      if (NEGATION.test(line.slice(0, m.index))) continue;
      found.push(label);
    }
  }
  return uniq(found);
}

/* ---------- main ---------- */
function extractKeyDetails(rawText) {
  const text = normalizeOcr(rawText);
  const lines = lineList(text);
  const demo = extractDemographics(text);
  const first = a => (a && a.length ? a[0] : '');

  const patient = {};
  if (first(demo.names)) patient.Name = first(demo.names);
  if (demo.ages.length) patient.Age = String(demo.ages[0]);
  if (first(demo.sexes)) patient.Sex = first(demo.sexes);
  if (first(demo.hospitals)) patient.Hospital = first(demo.hospitals);
  if (first(demo.treatments)) patient['Current treatment'] = first(demo.treatments);
  for (const [key, vals] of Object.entries(demo.basic || {})) if (vals.length && BASIC_LABEL[key]) patient[BASIC_LABEL[key]] = vals[0];

  const dates = {};
  const adm = labelled(lines, 'date\\s+of\\s+admission|admission\\s+date|doa|admitted\\s+on')[0];
  const dis = labelled(lines, 'date\\s+of\\s+discharge|discharge\\s+date|dod|discharged\\s+on')[0];
  const surg = labelled(lines, 'date\\s+of\\s+(?:surgery|procedure|operation)|(?:surgery|operation)\\s+date')[0];
  if (adm) dates.Admission = adm.slice(0, 30);
  if (dis) dates.Discharge = dis.slice(0, 30);
  if (surg) dates.Surgery = surg.slice(0, 30);

  const diagnosis = uniq([
    ...labelled(lines, '(?:final|primary|principal|provisional|clinical|working)?\\s*diagnosis|impression', { multiline: true })
  ]).slice(0, 4);

  const stage = uniq([
    ...labelled(lines, '(?:clinical|pathological|pathologic)?\\s*stage'),
    ...(text.match(/\b[cp]?T[0-4][a-c]?\s*N[0-3][a-c]?\s*M[0-1x]\b/g) || [])
  ]).slice(0, 3);

  const procedure = uniq(labelled(lines, '(?:procedure(?:\\s+performed)?|surgery(?:\\s+performed)?|operation(?:\\s+performed)?)', { multiline: true })).slice(0, 4);

  const allergies = uniq([
    ...labelled(lines, 'allerg(?:y|ies)|drug\\s+allerg(?:y|ies)'),
    ...(text.match(/\b(?:no known drug allergies|no known allergies|nkda)\b/gi) || []).map(s => 'No known drug allergies')
  ]).slice(0, 4);

  const pending = uniq(lines
    .filter(l => !isHeading(l) && /\b(?:pending|awaiting|awaited|to be scheduled|not yet received)\b/i.test(l) && l.length < 160)
    .map(l => clean(l.replace(/^[-•*\d.)\s]+/, '')))).slice(0, 6);

  const details = {
    patient,
    dates,
    diagnosis,
    stage,
    procedure,
    allergies,
    history: extractHistory(lines),
    medications: extractMedications(lines),
    investigations: extractInvestigations(lines),
    vitals: extractVitals(text),
    pending
  };

  // drop empty groups so the UI only shows what was really found
  for (const k of Object.keys(details)) {
    const v = details[k];
    if (Array.isArray(v) ? !v.length : !Object.keys(v).length) delete details[k];
  }
  return details;
}

module.exports = { extractKeyDetails, normalizeOcr };
