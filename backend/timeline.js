/* PERISCOPE — clinical timeline extraction.
   Builds a short, dated list of clinical events from raw document text.

   Rules
   - An event needs a date that is written in the document (on its own line, on the line directly after it, or in a
     date heading that introduces a bullet list). Dates are never assumed, and the upload date is never used.
   - Each line produces at most one event, with one category.
   - Descriptions are shortened to the clinical content; labels, dates and filler are removed.
   - Planned / scheduled items are kept but prefixed "Planned:" so they are never mistaken for something that happened.
   Pure functions, no dependencies. */

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const MON = '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';

const DATE_RES = [
  { re: /\b(\d{4})-(\d{2})-(\d{2})\b/g, f: m => [m[1], m[2], m[3]] },
  { re: /\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})\b/g, f: m => [m[3], m[2], m[1]] },
  { re: new RegExp(String.raw`\b(\d{1,2})(?:st|nd|rd|th)?[\s\-]+(${MON})\.?,?[\s\-]+(\d{4})\b`, 'gi'), f: m => [m[3], MONTHS[m[2].slice(0, 3).toLowerCase()], m[1]] },
  { re: new RegExp(String.raw`\b(${MON})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b`, 'gi'), f: m => [m[3], MONTHS[m[1].slice(0, 3).toLowerCase()], m[2]] }
];

function validIso(y, mo, d) {
  y = +y; mo = +mo; d = +d;
  if (!(y >= 1900 && y <= 2100 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31)) return '';
  const t = new Date(Date.UTC(y, mo - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d) return '';
  return `${String(y).padStart(4, '0')}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/* All explicit calendar dates in a line: [{iso, start, end}] in reading order, overlaps removed. */
function findDates(line) {
  const hits = [];
  for (const { re, f } of DATE_RES) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(line))) {
      const [y, mo, d] = f(m);
      const iso = validIso(y, mo, d);
      if (iso) hits.push({ iso, start: m.index, end: m.index + m[0].length });
    }
  }
  hits.sort((a, b) => a.start - b.start || b.end - a.end);
  const out = [];
  for (const h of hits) if (!out.length || h.start >= out[out.length - 1].end) out.push(h);
  return out;
}

/* ---------- classification ---------- */
const EXCLUDE = /\b(?:dob|d\.o\.b|date\s+of\s+birth|born|printed|generated|signed|signature|e-?signed|registered\s+on|registration\s+date|valid\s+(?:till|until)|expiry|invoice|bill(?:ed|ing)?|receipt|\breport\s+date\b|\bdate\s+of\s+report\b|reported\s+on|page\s+\d+\s+of)\b/i;
const PLANNED = /\b(?:planned|scheduled|proposed|to\s+be\s+(?:done|scheduled|performed|planned)|due\s+(?:on|for)|next\s+(?:visit|review|appointment|cycle|follow[- ]?up)|will\s+(?:undergo|be)|awaiting|pending)\b/i;

const SURG = /\b(?:mastectomy|lumpectomy|surgery|operation|operated|resection|excision|dissection|laparotomy|laparoscop\w*|thoracotomy|hysterectomy|colectomy|gastrectomy|nephrectomy|prostatectomy|oesophagectomy|esophagectomy|whipple|reconstruction|amputation|mastectomy|craniotomy|thyroidectomy|cholecystectomy|appendicectomy|appendectomy|hernia\s+repair|tracheostomy|stent\s+placement)\b/i;
const INVEST = /\b(?:ecg|ekg|echo(?:cardiogram)?|2d[- ]?echo|x-?ray|cxr|ct|mri|usg|ultrasound|ultrasonography|sonograph\w*|mammogra\w*|pet(?:[- ]?ct)?|scan|biopsy|fnac|cytology|blood\s+(?:test|tests|work|count|picture)|cbc|haemoglobin|hemoglobin|creatinine|lft|kft|rft|culture|spirometry|pft|angiograph\w*|endoscopy|colonoscopy|bronchoscopy|bone\s+marrow|tumou?r\s+marker|ca[- ]?\d{2,3}|cea|psa|hba1c|investigations?|laborator\w+|pathology)\b/i;
const DIAG = /\b(?:diagnos\w*|histopatholog\w*|carcinoma|adenocarcinoma|malignan\w*|metasta\w*|tumou?r|lymphoma|leuk(?:a)?emia|sarcoma|melanoma|stage\s+(?:[0iv]+[abc]?|\d)|tnm|grade\s+[1-3iv]+|er[- ]?positive|her2)\b/i;
const CHEMO = /\b(?:chemotherapy|chemo|cycle\s*\d+|neoadjuvant|adjuvant\s+chemo\w*|paclitaxel|docetaxel|doxorubicin|epirubicin|cyclophosphamide|carboplatin|cisplatin|oxaliplatin|capecitabine|gemcitabine|5-?fu|folfox|folfiri|ac-?t|fec)\b/i;
const RT = /\b(?:radiotherapy|radiation|imrt|brachytherapy|\d+\s*gy|fractions?)\b/i;
const IMMUNO = /\b(?:immunotherapy|immuno-?therapy|pembrolizumab|nivolumab|atezolizumab|durvalumab)\b/i;
const TARGET = /\b(?:targeted\s+(?:therapy|treatment)|trastuzumab|herceptin|pertuzumab|bevacizumab|imatinib|osimertinib|olaparib)\b/i;
const FOLLOW = /\b(?:follow[- ]?up|review\s+(?:visit|appointment|on|after)|next\s+(?:visit|review)|check-?up)\b/i;
const CONSULT = /\b(?:consult\w*|opinion|referred|referral|seen\s+by|opd|clinic\s+visit|visit|evaluated|assessment|pre-?anaesthe\w*|pac\b|tumou?r\s+board|mdt|reviewed\s+by)\b/i;

function categorise(text) {
  if (/\bdischarg/i.test(text)) return 'Discharge';
  if (/\badmi(?:t|ssion)/i.test(text)) return 'Admission';
  const invest = INVEST.test(text);
  if (SURG.test(text) && !(invest && /\bbiopsy\b/i.test(text) && !/\b(?:mastectomy|resection|excision|dissection)\b/i.test(text))) return 'Surgery';
  if (CHEMO.test(text)) return 'Chemotherapy';
  if (RT.test(text)) return 'Radiotherapy';
  if (IMMUNO.test(text)) return 'Immunotherapy';
  if (TARGET.test(text)) return 'Targeted Therapy';
  if (/\b(?:histopatholog\w*|biopsy)\b/i.test(text) && DIAG.test(text)) return 'Diagnosis';
  if (/\b(?:consult\w*|opd|clinic\s+visit|seen\s+by|referred|referral)\b/i.test(text) && !/\b(?:report|result|shows?|showed|revealed)\b/i.test(text)) return 'Consultation';
  if (invest) return 'Investigation';
  if (DIAG.test(text)) return 'Diagnosis';
  if (FOLLOW.test(text)) return 'Follow-up';
  if (/\b(?:underwent|procedure)\b/i.test(text)) return 'Surgery';
  if (CONSULT.test(text)) return 'Consultation';
  return '';
}

/* ---------- description clean-up ---------- */
const CANON = { Admission: 'Admitted', Discharge: 'Discharged', Surgery: 'Surgery' };

function tidy(s) {
  return s
    .replace(/\(\s*\)/g, ' ')
    .replace(/\s*[|¦]\s*/g, ' – ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([:;,.])/g, '$1')
    .replace(/(?:\s+(?:on|dated|date|from|since|at|w\.e\.f\.?|of))+\s*([,;:.\-–]|$)/gi, '$1')
    .replace(/^[\s,;:.\-–•*]+|[\s,;:.\-–]+$/g, '')
    .replace(/\s+(?:to\s+start|to\s+begin|starting|commencing)$/i, '')
    .replace(/^(?:on|dated|date)\s*[:\-]?\s+/i, '')
    .trim();
}

function describe(clause, dates, cat) {
  let s = clause;
  for (const d of [...dates].sort((a, b) => b.start - a.start)) {
    let a = d.start, b = d.end;
    const before = s.slice(0, a).match(/(?:\(\s*|\b(?:on|dated?|from|since|w\.e\.f\.?|as\s+of|at|in)\s*[:\-]?\s*)$/i);
    if (before) { a -= before[0].length; if (/\($/.test(before[0].trim()) && /^\s*\)/.test(s.slice(b))) b += s.slice(b).match(/^\s*\)/)[0].length; }
    s = s.slice(0, a) + ' ' + s.slice(b);
  }
  s = s.trim().replace(/^\s*(?:\d+[.)]|[-•*])\s*/, '');
  s = s.replace(/^(?:date\s+of\s+)?(?:procedure|operation)(?:\s+performed)?\s*[:\-–]\s*/i, '');
  s = s.replace(/^(?:visit|chemotherapy|radiotherapy|immunotherapy|investigations?|surgery|follow[- ]?up)\s*[:\-–]\s*(?=\S)/i, '');
  s = s.replace(/^(?:date\s+of\s+)(?:admission|discharge|surgery|procedure|operation)\s*[:\-–]?\s*/i, m => '__LBL__' + m.replace(/[^a-z]/gi, '').toLowerCase() + '__');
  const lbl = s.match(/^__LBL__(\w+)__/);
  s = s.replace(/^__LBL__\w+__\s*/, '');
  s = tidy(s);
  if (!s || /^(?:date|surgery|operation|procedure|admission|discharge)$/i.test(s)) {
    if (lbl || CANON[cat]) return CANON[cat] || '';
    return '';
  }
  // keep the first sentence / clause group; shorten at a word boundary
  const first = s.split(/(?<!\b(?:Dr|Mr|Mrs|Ms|Prof|St|No|vs|approx)\.)(?<=[.;])\s+(?=[A-Z0-9])/)[0].replace(/[.;]+$/, '');
  s = first.length >= 12 ? first : s;
  if (s.length > 150) s = s.slice(0, 147).replace(/\s+\S*$/, '') + '…';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* A line can hold several sentences and several dates: return one clause per dated sentence / dated item. */
function clausesOf(line, dates) {
  const out = [];
  const sentences = line.split(/(?<!\b(?:Dr|Mr|Mrs|Ms|Prof|St|No|vs|approx)\.)(?<=[.!?])\s+(?=[A-Z])/);
  let pos = 0;
  for (const sen of sentences) {
    const s0 = line.indexOf(sen, pos);
    pos = s0 + sen.length;
    const inSen = dates.filter(d => d.start >= s0 && d.end <= s0 + sen.length).map(d => ({ ...d, start: d.start - s0, end: d.end - s0 }));
    if (!inSen.length) continue;
    if (inSen.length === 1) { out.push({ text: sen, dates: inSen }); continue; }
    const pieces = sen.split(/;|\s+(?:and|then)\s+|,\s+(?=[A-Za-z])/);
    const groups = [];
    let p0 = 0;
    for (const p of pieces) {
      const st = sen.indexOf(p, p0), en = st + p.length;
      p0 = en;
      const ds = inSen.filter(d => d.start >= st && d.end <= en).map(d => ({ ...d, start: d.start - st, end: d.end - st }));
      if (!ds.length && groups.length) { groups[groups.length - 1].text += ', ' + p; continue; }
      groups.push({ text: p, dates: ds });
    }
    // "AC-T cycle 1 on …, cycle 2 on …": later short clauses inherit the regimen named in the first one
    const head = groups[0] && groups[0].text.match(/^(?:[A-Za-z ]+:\s*)?(.*?)\s*\bcycle\s*\d+/i);
    groups.forEach((g, k) => {
      if (k && head && head[1] && /^\s*cycle\s*\d+/i.test(g.text)) {
        const lead = g.text.length - g.text.trimStart().length, pre = head[1] + ' ';
        g.text = pre + g.text.trimStart();
        g.dates = g.dates.map(d => ({ ...d, start: d.start - lead + pre.length, end: d.end - lead + pre.length }));
      }
    });
    out.push(...groups.filter(g => g.dates.length));
  }
  return out;
}

/* A line that is only a date (optionally labelled): returns {iso, labelled} or null. */
function dateOnly(line) {
  const ds = findDates(line);
  if (ds.length !== 1) return null;
  const rest = (line.slice(0, ds[0].start) + ' ' + line.slice(ds[0].end)).replace(/[\s:\-–,.()]+/g, ' ').trim();
  if (!rest) return { iso: ds[0].iso, labelled: false };
  if (/^(?:date|dated|on|visit date|date of visit)$/i.test(rest)) return { iso: ds[0].iso, labelled: true };
  return null;
}

const HEADING = /^(?:\d+[.)]\s*)?[A-Za-z][A-Za-z /&()\-]{2,48}\s*:?\s*$/;
const isHeading = l => HEADING.test(l) && (l.endsWith(':') || l === l.toUpperCase() || /^\d+[.)]/.test(l));

/* ---------- main ---------- */
function buildTimeline(rawText, { src = 'Uploaded document' } = {}) {
  const raw = String(rawText || '').replace(/\r/g, '').replace(/\u00a0/g, ' ').split('\n');
  const lines = [];
  let page = 1;
  for (const r of raw) {
    const pm = r.trim().match(/^\[PAGE\s+(\d+)\]$/i);
    if (pm) { page = +pm[1]; continue; }
    const t = r.replace(/\t+/g, '   ').replace(/[ ]{4,}/g, '   ').trim();
    if (t) lines.push({ t, pg: page });
  }

  const events = [];
  let ctx = null;                       // date heading that introduces a bullet list
  const used = new Set();
  const BULLET = /^\s*(?:[-•*]|\d+[.)])\s+/;

  for (let i = 0; i < lines.length; i++) {
    if (used.has(i)) continue;
    const { t, pg } = lines[i];

    const only = dateOnly(t);
    if (only) { ctx = only.labelled ? null : only.iso; continue; }
    if (isHeading(t)) { ctx = null; continue; }
    if (EXCLUDE.test(t)) continue;

    const dates = findDates(t);
    let found = dates.length ? clausesOf(t, dates) : [];

    if (!found.length) {
      // date written on the next line ("Procedure: …" then "Date: 8 November 2026")
      const nxt = lines[i + 1] && dateOnly(lines[i + 1].t);
      if (nxt && categorise(t)) {
        used.add(i + 1);
        if (t.split(/\s+/).length <= 4 && lines[i + 2] && BULLET.test(lines[i + 2].t)) { ctx = nxt.iso; continue; }   // "Follow-up" / date / bullets
        found = [{ text: t, dates: [{ iso: nxt.iso, start: 0, end: 0 }] }];
      }
      else if (ctx && BULLET.test(t)) found = [{ text: t, dates: [{ iso: ctx, start: 0, end: 0 }] }];
      else { if (!BULLET.test(t)) ctx = null; continue; }
    }

    for (const g of found) {
      const flat = g.text.replace(/\s*[|¦]\s*/g, ' ');
      if (/\b(?:awaited|awaiting|pending|not\s+(?:yet\s+)?(?:available|received))\b/i.test(flat) && !findDates(g.text).length) continue;   // an outstanding item has no date of its own
      const cat = categorise(flat);
      if (!cat) continue;
      let e = describe(g.text, g.dates, cat);
      if (!e) continue;
      if (PLANNED.test(g.text) && !/^planned/i.test(e)) e = 'Planned: ' + e.charAt(0).toLowerCase() + e.slice(1);
      events.push({ d: g.dates[0].iso, e, c: cat, src, pg, st: 'U' });
    }
  }
  return dedupeTimeline(events);
}

/* ---------- merge / de-duplicate ---------- */
const STOP = new Set(['underwent', 'procedure', 'performed', 'the', 'a', 'an', 'of', 'to', 'for', 'and', 'with', 'was', 'were', 'is', 'on', 'in', 'at', 'by', 'patient', 'planned']);
const tokens = s => new Set(String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 1 && !STOP.has(w)));
function similar(a, b) {
  const A = tokens(a), B = tokens(b);
  if (!A.size || !B.size) return false;
  let hit = 0;
  for (const w of A) if (B.has(w)) hit++;
  const small = Math.min(A.size, B.size);
  return hit >= 3 || hit / small >= 0.8 || hit / (A.size + B.size - hit) >= 0.6;
}
const ORDER = ['Admission', 'Consultation', 'Investigation', 'Diagnosis', 'Surgery', 'Chemotherapy', 'Radiotherapy', 'Immunotherapy', 'Targeted Therapy', 'Follow-up', 'Clinical Event', 'Discharge'];
const rank = c => { const i = ORDER.indexOf(c); return i < 0 ? ORDER.length : i; };

/* One entry per (date, category, meaning). When the same fact is repeated — in one document or across several — the
   most informative wording is kept and the other sources are recorded in `alt`. Result is oldest → newest, and events
   on the same date are kept together in a clinical order (admission first, discharge last). */
function dedupeTimeline(list) {
  const out = [];
  for (const ev of list || []) {
    if (!ev || !String(ev.e || '').trim()) continue;
    const twin = out.find(x => x.d === ev.d && x.c === ev.c &&
      (similar(x.e, ev.e) || x.c === 'Admission' || x.c === 'Discharge'));
    const generic = x => /^(?:Admitted|Discharged|Surgery|Follow-up|Consultation)$/.test(x.e);
    const gtwin = out.find(x => x.d === ev.d && x.c === ev.c && (generic(x) || generic(ev)) && !x.man);
    if (!twin && gtwin) {
      if (generic(gtwin) && !generic(ev)) { gtwin.e = ev.e; gtwin.src = ev.src; gtwin.pg = ev.pg; }
      if (ev.src && ev.src !== gtwin.src) gtwin.alt = [...new Set([...(gtwin.alt || []), ev.src])];
      continue;
    }
    if (twin) {
      if (ev.e.length > twin.e.length && ev.e.length <= 150 && !twin.man && twin.st === 'U') { twin.e = ev.e; }
      if (ev.src && ev.src !== twin.src) twin.alt = [...new Set([...(twin.alt || []), ev.src])];
      if (ev.st && ev.st !== 'U' && twin.st === 'U') twin.st = ev.st;
      continue;
    }
    out.push({ ...ev });
  }
  return out
    .map((x, i) => [x, i])
    .sort((a, b) => {
      const da = a[0].d || '9999-99-99', db = b[0].d || '9999-99-99';          // undated (manual) entries go last
      return da.localeCompare(db) || rank(a[0].c) - rank(b[0].c) || a[1] - b[1];
    })
    .map(a => a[0]);
}

module.exports = { buildTimeline, dedupeTimeline, findDates };
