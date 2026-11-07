const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const ST={U:'● Unverified',V:'✓ Verified',C:'✎ Corrected',Q:'? Needs Clarification',X:'⚠ Conflict',N:'— Not Documented'};

// Navigation icons. Kept inline so the app has no dependency on an external icon library.
const IC={
  Dashboard:'<path d="M3 12 12 3l9 9"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/>',
  Patients:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  'Add Patient':'<path d="M12 5v14M5 12h14"/>',
  Spark:'<path d="M12 3l1.8 4.7 4.7 1.8-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.7 1.8 1.8.7-1.8.7L19 20l-.7-1.8-1.8-.7 1.8-.7z"/>',
  Check:'<path d="M20 6 9 17l-5-5"/>',
  Hospital:'<path d="M3 21h18M5 21V7l7-4 7 4v14"/><path d="M12 9v6M9 12h6"/>',
  Documents:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h6"/>',
  Timeline:'<path d="M4 19V5M4 12h5M9 12l4-5 5 10 2-3"/>',
  'Anaesthesia History':'<path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z"/><path d="M12 7v5l3 2"/>',
  'Missing Information':'<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>',
  Conflicts:'<path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 9v4M12 16h.01"/>',
  Questions:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.6 2.6 0 1 1 4.7 1.6c-.9 1-2.2 1.3-2.2 2.8M12 17h.01"/>',
  'Preparation Briefs':'<path d="M6 2h9l4 4v16H6z"/><path d="M15 2v5h5M9 12h6M9 16h6"/>',
  Profile:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  'User Management':'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M16 11h6"/>',
  'Audit Log':'<path d="M4 19V5h16v14z"/><path d="M8 9h8M8 13h6M8 17h4"/>',
  'Reports & Analytics':'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  'Document Monitor':'<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  Menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
  Logout:'<path d="M10 17l5-5-5-5M15 12H3"/><path d="M21 19V5a2 2 0 0 0-2-2h-6"/>'
};
const ico=name=>`<svg class="navico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[name]||'<circle cx="12" cy="12" r="8"/>'}</svg>`;
const tag=s=>`<span class="tag ${s}">${ST[s]}</span>`;
const nd=v=>v?esc(v):'<span class="sub">Not documented</span>';
const initials=n=>{const w=String(n||'').replace(/^(?:dr|mr|mrs|ms|miss)\.?\s+/i,'').trim().split(/\s+/).filter(Boolean);return ((w[0]?.[0]||'')+(w.length>1?w[w.length-1][0]:'')).toUpperCase()||'?'};
/* Fields PERISCOPE filled from an uploaded document. The label is only shown while the stored value still equals the auto-filled one. */
const AFK={name:'name',age:'age',sex:'sex',hospital:'hospital',dx:'diagnosis',stage:'stage',treat:'treat',surg:'planned_surgery',date:'surgery_date',allergy:'allergy',hist:'medical_history',dob:'dob',mrn:'mrn',ipno:'ipno',opno:'opno',phone:'phone',email:'email',address:'address',emergency:'emergency',bloodgroup:'bloodgroup',height:'height',weight:'weight',bmi:'bmi',ward:'ward',bed:'bed',consultant:'consultant',referredby:'referredby',dept:'dept',admdate:'admdate',dischdate:'dischdate'};
function autoTag(p,f){const a=p&&p.autofill&&p.autofill[AFK[f]];if(!a||String(a.value)!==String(p[f]??''))return'';return `<span class="auto" title="Filled automatically from ${esc(a.src)}">${ico('Spark')}<span>${esc(a.src)}</span></span>`}
const fv=(p,f)=>{const v=p[f];return (v===''||v==null)?'<span class="sub">Not documented</span>':esc(v)};

/* Navigation badges.
   The renderer calls bdg() for every navigation item, so keep this helper
   defined before render() can ever use it. */
function bdg(label){
  let n=0;
  if(label==='Patients'){
    n=P.length;
  }else if(label==='Documents'){
    n=P.reduce((a,p)=>a+(p.docs?.length||0),0);
  }else if(label==='Missing Information'){
    n=P.reduce((a,p)=>a+(p.ms||[]).filter(x=>x.st==='Open'||x.st==='Missing').length,0);
  }else if(label==='Conflicts'){
    n=P.reduce((a,p)=>a+(p.cf||[]).filter(x=>x.st==='Open'||x.st==='Missing').length,0);
  }else if(label==='Questions'){
    n=P.reduce((a,p)=>a+(p.qs?.length||0),0);
  }
  return n>0?`<span class="bdg">${n}</span>`:'';
}
const CATS=['Discharge Summary','Previous Anaesthesia Record','Operation / Surgical Note','Chemotherapy Record','Radiotherapy Record','Immunotherapy Record','Targeted Therapy Record','Prescription','Laboratory Report','Imaging Report','Consultation Note','Medical History','Hospital Record','Investigation Report','Clinical Summary','Other'];
let P=[];
const S={u:null,v:'dash',pid:null,tab:'Overview',audit:[],q:'',ev:null,files:[],ocrEngine:'tesseract',brief:false,auth:'login'};
const cur=()=>P.find(p=>p.id===S.pid);
/* Collapsible navigation. Desktop/tablet: full sidebar <-> icon rail (preference remembered). Phones/narrow tablets (<=900px): top bar with a menu button. */
S.navCollapsed=(()=>{try{const v=localStorage.getItem('periscope_nav_collapsed');if(v!==null)return v==='1'}catch(e){}return window.innerWidth<1100})();
S.navOpen=false;
const navMobile=()=>window.matchMedia('(max-width:900px)').matches;
const navExpanded=()=>navMobile()?S.navOpen:!S.navCollapsed;
function navAria(){const b=document.getElementById('navtoggle');if(!b)return;const x=navExpanded();b.setAttribute('aria-expanded',String(x));b.setAttribute('aria-label',x?'Collapse navigation':'Expand navigation');b.title=x?'Collapse navigation':'Expand navigation'}
function toggleNav(){
  if(navMobile())S.navOpen=!S.navOpen;
  else{S.navCollapsed=!S.navCollapsed;try{localStorage.setItem('periscope_nav_collapsed',S.navCollapsed?'1':'0')}catch(e){}}
  const a=document.querySelector('.app');   // toggle classes on the live element (no re-render) so the CSS transition animates
  if(a){a.classList.toggle('nav-collapsed',S.navCollapsed);a.classList.toggle('nav-open',S.navOpen)}
  navAria();
}
const canV=()=>S.u&&S.u.role!=='Clinical Assistant';
const canEnter=()=>!!(S.u&&(S.u.role==='Doctor'||S.u.role==='Clinical Assistant'));   /* manual add / edit / delete of clinical rows; verification stays Doctor-only */
/* Audit views (the Audit Log page and each patient's Audit tab) are Admin-only. The server enforces this as well. */
const canAudit=()=>!!(S.u&&S.u.role==='Admin');
/* Doctors/Admins may delete any document; a Clinical Assistant only the documents they uploaded. The server enforces the same rule. */
const canDelDoc=d=>!!(S.u&&d&&d.id&&(S.u.role==='Clinical Assistant'?(d.uploadedByUid&&d.uploadedByUid===S.u.uid):true));
const hospOf=d=>String((d&&(d.hospital||d.sourceHospital))||'').trim();
const srcHospitals=p=>[...new Set((p.docs||[]).map(hospOf).filter(Boolean))];
const log=(a,f='',o='',n='')=>S.audit.unshift({t:new Date().toLocaleString(),u:S.u.name,r:S.u.role,pt:S.pid||'—',a,f,o,n});
const $=id=>document.getElementById(id);
function nv(v,tab){
  S.navOpen=false;
  if(v==='add') return addPt();
  if(['doc','tl','an','ms','cf','qs','br'].includes(v) && !S.pid && P.length) S.pid=P[0].id;
  if(tab){
    if(!P.length){ S.v='pts'; S.tab='Overview'; render(); toast('Add a patient first to open this section.'); return; }
    return go('pt',S.pid||P[0].id,tab);
  }
  go(v);
}
function go(v,pid,tab){S.navOpen=false;S.v=v;if(pid)S.pid=pid;if(tab)S.tab=tab;S.brief=false;S.ev=null;render();scrollTo(0,0); if(v==='pt'&&pid) refreshSinglePatient(pid); }
async function login(){
  const email=$('em').value.trim(),password=$('pw').value;
  if(!email||!password){toast('Enter your email and password');return}
  try{
    const cred=await firebaseAuth.signInWithEmailAndPassword(email,password);
    const u=cred.user;
    const savedRole=localStorage.getItem('periscope_role_'+u.uid)||'Doctor';
    const dept=localStorage.getItem('periscope_dept_'+u.uid)||'';
    S.u={name:u.displayName||u.email.split('@')[0],role:savedRole,email:u.email,dept,uid:u.uid};
    go('dash');
  }catch(err){auLoginFailed(email,err);toast(firebaseAuthMessage(err))}
}
function logo(v,mark){const dark=v==='dark';return `<img class="logo-img${mark?' logo-mark':''}" src="assets/${mark?(dark?'periscope-mark-dark.svg':'periscope-mark.svg'):dark?'periscope-logo-dark.svg':'periscope-logo.svg'}" alt="PeriScope" decoding="async">`}
function forgotView(){return `<div class="login"><h1 class="brand">${logo('light')}</h1><p><b>Reset your password</b></p><p class="sub">Enter the email address linked to your account and we will send you a reset link.</p>
 <div class="card" onkeydown="if(event.key==='Enter'&&event.target.tagName==='INPUT')forgot()"><div id="fp_err" class="err" role="alert" hidden></div><div id="fp_ok" class="note" role="status" hidden></div>
 <label for="fp_email">Email / Username</label><input id="fp_email" autocomplete="email" placeholder="name@hospital.org">
 <p><button class="b p" style="width:100%" onclick="forgot()">Send Reset Link</button></p>
 <p class="sub"><button class="lnk" onclick="S.auth='login';render()">Back to sign in</button></p></div></div>`}
async function forgot(){
  const v=$('fp_email').value.trim(),er=$('fp_err'),ok=$('fp_ok');ok.hidden=true;
  if(!v||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)){er.textContent='Please enter a valid email address.';er.hidden=false;return}
  try{
    await firebaseAuth.sendPasswordResetEmail(v);
    er.hidden=true;ok.textContent='Password reset email sent. Check your inbox and follow the reset link.';ok.hidden=false;
  }catch(err){er.textContent=firebaseAuthMessage(err);er.hidden=false}
}
function authBrand(){return `<section class="auth-brand" aria-label="PeriScope"><div class="auth-brand-inner"><div class="auth-logo">${logo('dark')}</div><p class="auth-tagline">Connecting Records. Simplifying Cancer Care.</p></div></section>`}
function signupView(){return `<div class="auth">${authBrand()}<section class="auth-form"><div class="login-card signup-card" onkeydown="if(event.key==='Enter'&&event.target.tagName==='INPUT'&&event.target.type!=='checkbox')signup()"><h2>Create your account</h2><p class="sub" style="margin:0 0 14px">Request access to the pre-anaesthesia preparation workspace. Accounts are intended for authorised clinical staff.</p><div id="su_err" class="err" role="alert" hidden></div>
 <label for="su_name">Full name</label><input id="su_name" autocomplete="name">
 <label for="su_email">Work email</label><input id="su_email" type="email" autocomplete="email" placeholder="name@hospital.org">
 <div class="two"><div><label for="su_role">Role</label><select id="su_role"><option>Doctor</option><option>Clinical Assistant</option></select></div><div><label for="su_dept">Department</label><input id="su_dept" placeholder="e.g. Anaesthesiology"></div></div>
 <div class="two"><div><label for="su_pw">Password</label><input id="su_pw" type="password" autocomplete="new-password"></div><div><label for="su_pw2">Confirm password</label><input id="su_pw2" type="password" autocomplete="new-password"></div></div>
 <p class="sub" style="margin:4px 0 0">At least 8 characters, including a letter and a number.</p>
 <label class="chk" for="su_agree"><input id="su_agree" type="checkbox"><span>I understand PERISCOPE is a clinical workflow assistance prototype and does not replace professional medical judgement.</span></label>
 <p><button class="b p" style="width:100%" onclick="signup()">Create Account</button></p>
 <p class="sub">Already have an account? <button class="lnk" onclick="S.auth='login';render()">Sign in</button></p></div></section></div>`}
async function signup(){
  const g=id=>$(id).value.trim(),n=g('su_name'),e=g('su_email'),r=$('su_role').value,d=g('su_dept'),p=$('su_pw').value,p2=$('su_pw2').value;
  const err=m=>{const b=$('su_err');b.textContent=m;b.hidden=false;b.scrollIntoView({block:'nearest'})};
  if(!n)return err('Please enter your full name.');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))return err('Please enter a valid email address.');
  if(p.length<8||!/[A-Za-z]/.test(p)||!/\d/.test(p))return err('Password must be at least 8 characters and include a letter and a number.');
  if(p!==p2)return err('Passwords do not match.');
  if(!$('su_agree').checked)return err('Please tick the acknowledgement to continue.');
  try{
    window.__pendingSignupRole=r;window.__pendingSignupDept=d;   /* read by loadAppData before the first /api/me call, so the profile is created with the chosen role */
    const cred=await firebaseAuth.createUserWithEmailAndPassword(e,p);
    await cred.user.updateProfile({displayName:n});
    localStorage.setItem('periscope_role_'+cred.user.uid,r);
    localStorage.setItem('periscope_dept_'+cred.user.uid,d);
    S.u={name:n,role:r,email:e,dept:d,uid:cred.user.uid};
    S.auth='login';go('dash');toast('Account created successfully');
  }catch(ex){err(firebaseAuthMessage(ex))}
}
const disc='PERISCOPE is a clinical workflow assistance prototype. It organizes documented patient information and does not replace professional medical judgement or provide autonomous clinical decisions.';
async function signOutUser(){
  try{await firebaseAuth.signOut()}catch(err){toast(firebaseAuthMessage(err));return}
  S.u=null;if(window.stopClinicalCompanions)window.stopClinicalCompanions();S.auth='login';S.v='dash';render();toast('Signed out');
}
/* Tab bar scroll: render() replaces #root.innerHTML, which destroys the .tabs element and
   its scrollLeft. Capture the scroll offset before each render and restore it to the new
   .tabs element, then only nudge the active tab into view if it is clipped. */
function render(){
 const oldTabs=document.querySelector('.tabs');
 const keep=oldTabs?oldTabs.scrollLeft:null;
 renderCore();
 const bar=document.querySelector('.tabs');
 if(!bar)return;
 const setLeft=x=>{try{bar.scrollTo({left:x,behavior:'instant'})}catch(e){bar.scrollLeft=x}};
 if(keep!==null)setLeft(keep);
 const on=bar.querySelector('button.on');
 if(on){
  const pad=12,br=bar.getBoundingClientRect(),or=on.getBoundingClientRect(),l=or.left-br.left+bar.scrollLeft,r=l+or.width;
  if(l<bar.scrollLeft+pad)setLeft(Math.max(0,l-pad));
  else if(r>bar.scrollLeft+bar.clientWidth-pad)setLeft(r-bar.clientWidth+pad);
 }
}
function renderCore(){
 if(!S.u&&S.auth==='signup'){$('root').innerHTML=signupView();return}
 if(!S.u&&S.auth==='forgot'){$('root').innerHTML=forgotView();return}
 if(!S.u){$('root').innerHTML=`<div class="auth">${authBrand()}
 <section class="auth-form"><div class="login-card"><h2>Sign in</h2><p class="sub">Use your hospital account to continue.</p><label for="em">Email / Username</label><input id="em" value="" autocomplete="username"><label for="pw">Password</label><input id="pw" type="password" value="" autocomplete="current-password" onkeydown="if(event.key==='Enter')login()"><p class="sub" style="margin:10px 0 14px">Your role (Doctor, Clinical Assistant or Admin) is assigned to your account and is not selected at login.</p><button class="b p full" onclick="login()">Sign in</button><p class="sub" style="margin:14px 0 4px"><button class="lnk" onclick="S.auth='forgot';render()">Forgot password?</button></p><p class="sub" style="margin:0">New here? <button class="lnk" onclick="S.auth='signup';render()">Create an account</button></p></div><p class="auth-note">Prototype for clinical workflow assistance. Not intended for autonomous clinical decision-making.</p></section></div>`;return}
 const nav=[['dash','Dashboard'],['pts','Patients'],['add','Add Patient'],['prof','Profile']].concat(S.u.role==='Admin'?[['users','User Management'],['docmon','Document Monitor'],['audit','Audit Log'],['reports','Reports & Analytics']]:S.u.role==='Doctor'?[['audit','Audit Log']]:[]);
 $('root').innerHTML=`<div class="app${S.navCollapsed?' nav-collapsed':''}${S.navOpen?' nav-open':''}"><aside id="sidenav" aria-label="Main navigation"><div class="sbtop"><div class="logo"><span class="logo-full">${logo('dark')}</span><span class="logo-short">${logo('dark',true)}</span></div><button type="button" id="navtoggle" class="navtoggle" onclick="toggleNav()" aria-controls="sidenav-menu" aria-expanded="${navExpanded()}" aria-label="${navExpanded()?'Collapse':'Expand'} navigation" title="${navExpanded()?'Collapse':'Expand'} navigation">${ico('Menu')}</button></div><div class="sbody" id="sidenav-menu">${nav.map(n=>`<button title="${n[1]}" class="${(n[2]?S.v==='pt'&&S.tab===n[2]:S.v===n[0]||(n[0]==='pts'&&S.v==='pt'&&!['Documents','Timeline','Anaesthesia','Missing Information','Conflicts','Questions','Brief'].includes(S.tab)))?'on':''}" onclick="nv('${n[0]}','${n[2]||''}')">${ico(n[1])}<span class="l">${n[1]}</span>${bdg(n[1])}</button>`).join('')}<div class="sp"></div>
 <div class="uchip"><span class="avatar">${esc(initials(S.u.name))}</span><div class="un"><b>${esc(S.u.name)}</b><span>${esc(S.u.role)}</span></div></div><button title="Logout" onclick="signOutUser()">${ico('Logout')}<span class="l">Logout</span></button></div></aside><main>${printBtn()}${S.v==='dash'?dash():S.v==='pts'?pts():S.v==='audit'&&auAllowed()?auditV():S.v==='not'?notif():S.v==='prof'?prof():S.v==='users'?users():S.v==='docmon'&&S.u.role==='Admin'?docMon():S.v==='reports'&&S.u.role==='Admin'?rpView():pt()}</main></div>`; if(window.mountClinicalCompanions){window.mountClinicalCompanions();if(window.renderClinicalCompanionPanel)window.renderClinicalCompanionPanel();}if(S.v==='users')loadAdminUsers();}
const statusChip=st=>{const s=String(st||'Awaiting Review');const k=/verified|final|complete/i.test(s)?'ok':/return|reassess|conflict/i.test(s)?'alert':/review|draft|await/i.test(s)?'wait':'info';return `<span class="schip ${k}">${esc(s)}</span>`};
function ptTable(list){return `<div class="tw"><table><tr><th>ID</th><th>Name</th><th>Age</th><th>Cancer diagnosis</th><th>Planned surgery</th><th>Surgery date</th><th>Status</th><th>Updated</th><th>Action</th></tr>${list.map(p=>`<tr><td class="mono">${p.id}</td><td><div class="pn"><span class="avatar sm">${esc(initials(p.name))}</span><div><b>${p.name?esc(p.name):'<span class="sub">Unnamed patient</span>'}</b><span class="sub">${[p.sex].filter(Boolean).map(esc).join(' · ')||'&nbsp;'}</span></div></div></td><td>${p.age||'<span class="sub">—</span>'}</td><td>${esc(p.dx)}</td><td>${esc(p.surg)}</td><td>${displayDate(p.date)}</td><td>${statusChip(p.status)}</td><td>${p.upd}</td><td class="acts"><div class="row bgrp"><button class="b sm" onclick="go('pt','${p.id}','Overview')">View</button><button class="b sm" onclick="editPt('${p.id}')">Edit</button><button class="b sm" onclick="go('pt','${p.id}','PAC')">PAC</button><button class="b p sm" onclick="go('pt','${p.id}','Brief')">Brief</button>${canV()?`<button class="b w sm" onclick="askDeletePt('${p.id}')">Delete</button>`:''}</div></td></tr>`).join('')||'<tr><td colspan=9>No patients match your search.</td></tr>'}</table></div>`}
const cnt=k=>P.reduce((a,p)=>a+(Array.isArray(p?.[k])?p[k]:[]).filter(x=>x.st==='Open'||x.st==='Missing').length,0);
const pend=()=>P.reduce((a,p)=>a+['tl','an','med','inv'].reduce((b,k)=>b+(Array.isArray(p?.[k])?p[k]:[]).filter(x=>x.st==='U'||x.st==='Q').length,0),0);
function dash(){return `<div class="phead"><div><h1>Dashboard</h1><p class="sub">Records awaiting review across your patients.</p></div><button class="b p" onclick="addPt()">${ico('Add Patient')}Add patient</button></div><div class="grid kpis">${[['Total Patients',P.length],['Awaiting Review',P.filter(p=>p.status!=='Verified').length],['Documents Uploaded',P.reduce((a,p)=>a+p.docs.length,0)],['Missing Information',cnt('ms')],['Conflicts',cnt('cf')],['Pending Verification',pend()]].map(s=>`<div class="card stat click" tabindex="0" onclick="statGo('${s[0]}')" onkeydown="if(event.key==='Enter')statGo('${s[0]}')"><b>${s[1]}</b><span>${s[0]}</span></div>`).join('')}</div><section class="card cc-dashboard-card" id="cc-dashboard-card" aria-label="Peri and Sia clinical companions"></section>`}
function statGo(k){const m={'Total Patients':['pts'],'Awaiting Review':['pts'],'Documents Uploaded':['pt','Documents'],'Missing Information':['pt','Missing Information'],Conflicts:['pt','Conflicts'],'Pending Verification':['pt','Timeline']}[k];if(m[1]&&!P.length){toast('Add a patient first.');return}m[1]?go('pt',S.pid||P[0].id,m[1]):go(m[0])}
function pts(){const q=S.q.toLowerCase();const l=P.filter(p=>[p.id,p.name,p.dx,p.surg,...srcHospitals(p)].join(' ').toLowerCase().includes(q));return `<h1>Patients</h1><div class="row" style="margin:10px 0"><input aria-label="Search patients" style="max-width:420px" placeholder="Search by ID, name, diagnosis, hospital, surgery" value="${esc(S.q)}" oninput="S.q=this.value;render();const i=document.querySelector('main input');i.focus();i.setSelectionRange(99,99)"><button class="b p" onclick="addPt()">Add Patient</button></div>${ptTable(l)}`}
function auditV(){return secAudit()}
function auditT(a){return a.length?`<div class="tw"><table><tr><th>Time</th><th>User</th><th>Role</th><th>Patient</th><th>Action</th><th>Field</th><th>Previous</th><th>New</th></tr>${a.map(x=>`<tr><td>${x.t}</td><td>${esc(x.u)}</td><td>${esc(x.r)}</td><td>${x.pt}</td><td>${esc(x.a)}</td><td>${esc(x.f)}</td><td>${esc(x.o)}</td><td>${esc(x.n)}</td></tr>`).join('')}</table></div>`:`<p class="card">No changes recorded yet. Edits, verifications and uploads appear here.</p>`}
const TABS=['Overview','Details','Documents','Timeline','Medical History','Medications','Investigations','Cancer Treatment','Anaesthesia','PAC','Missing Information','Conflicts','Questions','Brief','Audit'];
function pt(){if(S.tab==='Audit'&&!canAudit())S.tab='Overview';const p=cur();if(!p){return `<h1>No patient selected</h1><div class="card"><p>No patients are available yet.</p><button class="b p" onclick="addPt()">Add Patient</button></div>`}const t=S.tab;let body='';
 if(t==='Overview')body=`<section class="card idcard"><div class="cardhead"><h3>Patient overview</h3><span class="sub">Fields marked <span class="auto inline">${ico('Spark')}<span>file name</span></span> were filled automatically from an uploaded document.</span></div><div class="idgrid">${[['Name','name'],['Age','age'],['Sex','sex'],['Date of birth','dob'],['Blood group','bloodgroup'],['MRN / UHID','mrn']].concat([['IP number','ipno'],['OP number','opno'],['Phone','phone'],['Email','email'],['Ward','ward'],['Bed','bed'],['Consultant','consultant'],['Department','dept'],['Admission date','admdate'],['Discharge date','dischdate']].filter(([l,k])=>p[k])).map(([l,k])=>`<div class="idf"><div class="k">${l}</div><div class="v">${DATE_KEYS.includes(k)&&p[k]?esc(displayDate(p[k])):fv(p,k)}</div>${autoTag(p,k)}</div>`).join('')}<div class="idf"><div class="k">Patient ID</div><div class="v mono">${esc(p.id)}</div></div><div class="idf"><div class="k">Status</div><div class="v">${statusChip(p.status)}</div></div></div></section>
 <div class="two"><div class="card"><h3>Cancer</h3><div class="big">${fv(p,'dx')}</div><div class="sub">Stage: ${nd(p.stage)}</div>${autoTag(p,'dx')}</div><div class="card"><h3>Planned procedure</h3><div class="big">${fv(p,'surg')}</div><div class="sub">${displayDate(p.date)}</div>${autoTag(p,'surg')}</div><div class="card"><h3>Needs attention</h3><ul class="attn"><li><b>${p.cf.filter(x=>x.st==='Open').length}</b> open conflict(s)</li><li><b>${p.ms.filter(x=>x.st==='Missing').length}</b> missing item(s)</li><li><b>${p.qs.filter(x=>x.st==='Open').length}</b> open question(s)</li></ul></div><div class="card"><h3>Documents</h3><div class="big">${p.docs.length}</div><div class="sub">uploaded</div>${srcHospitals(p).length?`<div class="sub">Source hospitals: ${srcHospitals(p).map(esc).join(' · ')}</div>`:''}</div></div>`;
 else if(t==='Details')body=`<div class="card">${BASIC_GROUPS.map(g=>`<h4 class="fgrp">${g[0]}</h4><div class="two">${g[1].map(f=>`<div class="idf"><div class="k">${f[1]}</div><div class="v">${bshow(p,f[0])}</div>${autoTag(p,f[0])}</div>`).join('')}</div>`).join('')}<p><button class="b p" onclick="editPt('${p.id}')">Edit Patient</button></p></div>`;
 else if(t==='Documents')body=docs(p);
 else if(t==='Timeline')body=timeline(p);
 else if(t==='Anaesthesia')body=`<p class="sub">Only documented information is shown. PERISCOPE does not conclude airway status.</p>`+vt(p,'an',['Date','Surgery','Anaesthesia','Documented event','Source'],x=>[x.d,x.s,x.a,x.ev,x.src],'ev',null,'an');
 else if(t==='Cancer Treatment')body=vt(p,'tl',['Date','Treatment / event','Type','Source'],x=>[x.d,x.e,x.c,x.man?x.src:x.src+' p'+x.pg],'e',x=>['Diagnosis','Surgery','Chemotherapy','Radiotherapy','Immunotherapy','Targeted Therapy'].includes(x.c),'tl');
 else if(t==='Medical History')body=`<div class="card"><h3>Comorbidities</h3>${nd(p.comorbidities||p.hist)}<p class="sub">Source: ${esc(p.historySource||'Uploaded document')} · ${tag('U')}</p></div><div class="card"><h3>Allergies</h3>${nd(p.allergy)}</div>`;
 else if(t==='Medications')body=vt(p,'med',['Medication','Dose','Frequency','Source'],x=>[x.m,x.dose,x.freq,x.src],'m',null,'med');
 else if(t==='Investigations')body=vt(p,'inv',['Date','Investigation','Documented result','Source'],x=>[x.d,x.t,x.r,x.src],'r');
 else if(t==='Missing Information')body=p.ms.length?p.ms.map((m,i)=>`<div class="card"><h3>${esc(m.i)}</h3><span class="tag Q">${esc(m.st)}</span><p>${esc(m.r)}</p><div class="row bgrp"><button class="b sm" title="Request document" onclick="setS('ms',${i},'Requested')">Request</button><button class="b sm" title="Mark not applicable" onclick="setS('ms',${i},'Not applicable')">N/A</button><button class="b p sm" title="Mark resolved" onclick="setS('ms',${i},'Resolved')">Resolved</button></div></div>`).join(''):`<div class="card"><h3>No Missing Information</h3>No missing records have been identified from the available documents.</div>`;
 else if(t==='Conflicts')body=p.cf.length?p.cf.map((c,i)=>`<div class="card conf"><h3>⚠ Information Conflict: ${esc(c.f)}</h3><span class="tag X">${esc(c.st)}</span>${cfApplied(c)}<div class="two" style="margin:10px 0"><div class="note"><b>Source 1</b> (${esc(c.sa)})<br>“${esc(c.a)}”</div><div class="note"><b>Source 2</b> (${esc(c.sb)})<br>“${esc(c.b)}”</div></div>${canV()?`<div class="row bgrp"><button class="b p sm" title="Confirm Source 1" onclick="resolveCf(${i},1)">Source 1</button><button class="b p sm" title="Confirm Source 2" onclick="resolveCf(${i},2)">Source 2</button><button class="b sm" title="Keep both values" onclick="resolveCf(${i},'both')">Keep both</button></div>`:''}</div>`).join(''):`<div class="card"><h3>No Conflicts Detected</h3>No conflicting information has been identified in the currently processed records.</div>`;
 else if(t==='Questions')body=qsV(p);
 else if(t==='PAC')body=PAC.view(p);
 else if(t==='Brief')body=brief(p);
 else body=auditT(S.audit.filter(a=>a.pt===p.id));
 const nOpenCf=p.cf.filter(x=>x.st==='Open').length,nMiss=p.ms.filter(x=>x.st==='Missing').length;
 return `${t==='Brief'?'':printHead(p,t)}<div class="noprint"><section class="pbanner"><div class="pb-id"><span class="avatar lg">${esc(initials(p.name))}</span><div class="pb-text"><h1>${p.name?esc(p.name):'Unnamed patient'}</h1><div class="pb-meta"><span class="mono">${p.id}</span><span>${p.age?esc(p.age)+' years':'Age not documented'}</span><span>${p.sex?esc(p.sex):'Sex not documented'}</span></div></div></div>
 <div class="pb-flags">${statusChip(p.status)}${p.allergy?`<span class="schip info" title="${esc(p.allergy)}">Allergy documented</span>`:'<span class="schip muted">Allergy not documented</span>'}${nOpenCf?`<span class="schip alert">${nOpenCf} conflict${nOpenCf>1?'s':''}</span>`:''}${nMiss?`<span class="schip wait">${nMiss} missing</span>`:''}${window.ccFlagButton?window.ccFlagButton(p.id):''}</div>
 <div class="pb-actions"><button class="b" onclick="editPt('${p.id}')">Edit patient</button><button class="b" onclick="S.tab='Documents';render()">Upload records</button><button class="b p" onclick="genBrief()">Generate brief</button></div></section>
 <div class="tabs" role="tablist">${TABS.filter(x=>x!=='Audit'||canAudit()).map(x=>`<button role="tab" class="${t===x?'on':''}" onclick="S.tab='${x}';S.ev=null;render()">${x}</button>`).join('')}</div></div>${body}`}
function vt(p,k,heads,fn,fld,flt,mk){
 const rows=(p[k]||[]).map((x,i)=>[x,i]).filter(a=>!flt||flt(a[0])).sort((a,b)=>String(b[0].d||'').localeCompare(String(a[0].d||''))||a[1]-b[1]);   /* newest first, but each row keeps its real index in p[k] */
 const ent=mk&&canEnter();
 const addBar=ent?`<p class="row noprint"><button class="b p" onclick="mrForm('${mk}',-1)">Add ${MR[mk].label}</button></p>`:'';
 if(!rows.length)return addBar+`<div class="card"><h3>Nothing documented yet</h3>Upload records to begin reconstructing the patient journey${ent?', or add an entry manually':''}.</div>`;
 return addBar+`<div class="tw"><table><tr>${heads.map(h=>`<th>${h}</th>`).join('')}<th>Status</th><th class="noprint">Review</th></tr>${rows.map(([x,i])=>`<tr>${fn(x).map(v=>`<td>${nd(v)}</td>`).join('')}<td>${tag(x.st)}${x.man?' <span class="sub">Manual entry</span>':''}</td><td class="noprint"><div class="row bgrp">${canV()?`<button class="b sm ${x.st==='V'?'p':''}" aria-pressed="${x.st==='V'}" onclick="ver('${k}',${i},'V')">${x.st==='V'?'Unverify':'Confirm'}</button><button class="b sm" onclick="corr('${k}',${i},'${fld}')">Correct</button>`:''}<button class="b sm ${x.st==='Q'?'w':''}" aria-pressed="${x.st==='Q'}" title="${x.st==='Q'?'Clear clarification':'Needs clarification'}" onclick="ver('${k}',${i},'Q')">${x.st==='Q'?'Clear':'Clarify'}</button>${ent?`<button class="b sm" onclick="mrForm('${mk}',${i})">Edit</button><button class="b w sm" onclick="mrDel('${mk}',${i})">Delete</button>`:''}</div></td></tr>`).join('')}</table></div>`}
/* Manual add / edit / delete for Medications, Anaesthesia and Cancer Treatment (Doctor and Clinical Assistant).
   Rows are flagged man:true so the server keeps them when documents are re-processed. */
const MR={
 med:{k:'med',label:'medication',f:[['m','Medication','text',1],['dose','Dose','text'],['freq','Frequency','text']]},
 an:{k:'an',label:'anaesthesia record',f:[['d','Date (YYYY-MM-DD)','date',1],['s','Surgery / procedure','text'],['a','Anaesthesia type','text'],['ev','Documented event','text',1]]},
 tl:{k:'tl',label:'cancer treatment',f:[['d','Date (YYYY-MM-DD)','date',1],['e','Treatment / event','text',1],['c','Type','sel',1]]}
};
const MR_TYPES=['Diagnosis','Surgery','Chemotherapy','Radiotherapy','Immunotherapy','Targeted Therapy'];
const mrCap=t=>t[0].toUpperCase()+t.slice(1);
function mrForm(mk,i){
 if(!canEnter()){toast('Your role cannot add or edit these entries');return}
 const c=MR[mk],x=i<0?{}:cur()[c.k][i];if(!x)return;
 const fld=c.f.map(f=>{const id='mr_'+f[0],v=x[f[0]]??(f[0]==='c'?'Chemotherapy':''),lab=f[1]+(f[3]?' *':'');
  if(f[2]==='sel')return `<label for="${id}">${lab}</label><select id="${id}">${[...new Set([...MR_TYPES,v].filter(Boolean))].map(o=>`<option ${o===v?'selected':''}>${esc(o)}</option>`).join('')}</select>`;
  return `<label for="${id}">${lab}</label><input id="${id}" ${f[2]==='date'?'placeholder="YYYY-MM-DD" inputmode="numeric"':''} value="${esc(v)}">`}).join('');
 $('dlg').innerHTML=`<h3>${i<0?'Add':'Edit'} ${c.label}</h3><div id="mr_err" class="err" role="alert" hidden></div>${fld}<label for="mr_src">Source</label><input id="mr_src" value="${esc(x.src||'')}" placeholder="Manual entry"><p class="sub">Entries added or edited here are marked as manual and recorded in the audit log.</p><div class="row" style="margin-top:14px"><button class="b p" onclick="mrSave('${mk}',${i})">Save</button><button class="b" onclick="$('dlg').close()">Cancel</button></div>`;
 $('dlg').showModal();
}
function mrSave(mk,i){
 const c=MR[mk],n={},err=m=>{const b=$('mr_err');b.textContent=m;b.hidden=false};
 for(const f of c.f){const v=$('mr_'+f[0]).value.trim();if(f[3]&&!v)return err(f[1].replace(' (YYYY-MM-DD)','')+' is required.');n[f[0]]=v}
 if(n.d&&!/^\d{4}-\d{2}-\d{2}$/.test(n.d))return err('Enter the date as YYYY-MM-DD, for example 2026-03-14.');
 n.src=$('mr_src').value.trim()||'Manual entry';
 const arr=cur()[c.k],label=n.m||n.ev||n.e;
 if(i<0){Object.assign(n,{st:'C',man:true,pg:1});arr.push(n);log(mrCap(c.label)+' Added',c.k,'',label)}
 else{const old=arr[i];log(mrCap(c.label)+' Edited',c.k,old.m||old.ev||old.e,label);Object.assign(old,n,{st:'C',man:true})}
 $('dlg').close();toast('Saved');render();
}
function mrDel(mk,i){
 if(!canEnter())return;const c=MR[mk],x=cur()[c.k][i];if(!x)return;
 if(!confirm('Delete this '+c.label+' entry?'+(x.man?'':' It came from a document and may reappear if the document is re-processed.')))return;
 log(mrCap(c.label)+' Deleted',c.k,x.m||x.ev||x.e,'');cur()[c.k].splice(i,1);render();
}
function ver(k,i,s){const x=cur()[k][i];if(!x)return;
 if(s==='V'&&!canV()){toast('Only a Doctor can verify information');return}
 const was=x.st||'U';let to=s,act=s==='V'?'Information Verified':'Marked Needs Clarification';
 if(was===s){to='U';act=s==='V'?'Information Unverified':'Clarification Cleared'}   /* pressing the same button again undoes it */
 toast(to==='V'?'Verified':to==='Q'?'Marked for clarification':to==='U'&&s==='V'?'Verification removed':'Clarification cleared');
 log(act,k,ST[was],ST[to]);x.st=to;render()}
function corr(k,i,f){const x=cur()[k][i];$('dlg').innerHTML=`<h3>Correct information</h3><label for="cv">Value</label><textarea id="cv" rows="3">${esc(x[f])}</textarea><div class="row" style="margin-top:14px"><button class="b p" onclick="saveC('${k}',${i},'${f}')">Save correction</button><button class="b" onclick="$('dlg').close()">Cancel</button></div>`;$('dlg').showModal()}
function saveC(k,i,f){const x=cur()[k][i],n=$('cv').value;log('Information Corrected',k+'.'+f,x[f],n);x[f]=n;x.st='C';$('dlg').close();render()}
/* Conflict resolution: the chosen value is written to the matching field (patient details or medication list),
   so the rest of the app, the brief and the PAC background all show the resolved value. */
const CF_FIELD={'Patient name':['name'],'Age':['age'],'Sex':['sex'],'Surgery date':['date','surgery_date'],'Date of birth':['dob'],'MRN / UHID':['mrn'],'IP number':['ipno'],'OP number':['opno'],'Phone':['phone'],'Email':['email'],'Address':['address'],'Emergency contact':['emergency'],'Blood group':['bloodgroup'],'Height':['height'],'Weight':['weight'],'BMI':['bmi'],'Ward':['ward'],'Bed':['bed'],'Consultant':['consultant'],'Referred by':['referredby'],'Department':['dept'],'Admission date':['admdate'],'Discharge date':['dischdate']};
const medLbl=m=>`${m.dose||'dose not stated'} ${m.freq||''}`.trim();
function cfApplied(c){if(!c||!/^Resolved/.test(c.st||'')||!c.pick)return '';const v=c.pick===1?c.a:c.pick===2?c.b:'';return v?`<div class="sub" style="margin-top:6px">Applied to the record: <b>${esc(v)}</b></div>`:`<div class="sub" style="margin-top:6px">Both values kept; the record was not changed.</div>`}
function resolveCf(i,pick){
 if(!canV()){toast('Clinical Assistants cannot resolve conflicts');return}
 const p=cur(),c=p&&p.cf&&p.cf[i];if(!c)return;
 const val=pick===1?c.a:pick===2?c.b:null,old=c.st;
 if(val!==null){
  if(/^Medication: /.test(c.f)){
   const name=c.f.slice(12).trim().toLowerCase();
   p.med=(p.med||[]).filter(m=>String(m.m).trim().toLowerCase()!==name||medLbl(m)===val);
   p.med.forEach(m=>{if(String(m.m).trim().toLowerCase()===name)m.st='V'});
  }else{
   const keys=CF_FIELD[c.f];
   if(!keys){toast('This conflict cannot be applied to a field automatically');return}
   keys.forEach(k=>{p[k]=val});
  }
 }
 c.pick=pick;c.st=pick===1?'Resolved: Source 1 confirmed':pick===2?'Resolved: Source 2 confirmed':'Resolved: Both kept';
 log('Conflict Resolved','cf.'+c.f,old,c.st+(val!==null?' ('+val+')':''));
 toast(val!==null?'Resolved and applied to the record':'Resolved');render();
}
function setS(k,i,s){const p=cur();const arr=Array.isArray(p?.[k])?p[k]:[];if(!arr[i])return;toast(s);const x=arr[i];log(k==='cf'?'Conflict Resolved':'Status Changed',k,x.st,s);x.st=s;render()}
function displayDate(d){
  const s=String(d||'').slice(0,10);
  const m=s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : (s || 'Undated');
}
function sortClinical(arr){
  return [...(arr||[])].sort((a,b)=>String(b.d||'').localeCompare(String(a.d||'')));
}
/* Timeline: events grouped under one heading per date, oldest first. Each entry keeps its index in p.tl so that
   select / verify / edit / delete always act on the event that was clicked. */
function tlGroups(tl){
  const rows=(tl||[]).map((x,i)=>({x,i}));
  rows.sort((a,b)=>(a.x.d||'9999-99-99').localeCompare(b.x.d||'9999-99-99')||a.i-b.i);
  const out=[];
  rows.forEach(r=>{const last=out[out.length-1];if(last&&last.d===(r.x.d||''))last.items.push(r);else out.push({d:r.x.d||'',items:[r]})});
  return out;
}
function timeline(p){
  const groups=tlGroups(p.tl);
  const e=S.ev!==null&&S.ev!==undefined?p.tl[S.ev]:null;
  const alt=e&&e.alt&&e.alt.length?`<br><span class="sub">Also documented in ${e.alt.map(esc).join(', ')}</span>`:'';
  return `${canV()?`<p class="row noprint"><button class="b p sm" onclick="evForm(-1)">Add event</button></p>`:''}<p class="sub">Oldest first, one heading per date. Only events with a date written in the records are listed. Select an event to see its source.</p>${groups.length?`<div class="tl">${groups.map(g=>`<section class="tdate"><h3 class="tdh">${g.d?displayDate(g.d):'Undated'}</h3><div class="tle">${g.items.map(({x,i})=>`<button class="ev ${S.ev===i?'sel':''}" onclick="S.ev=${i};render()"><span class="tcat">${esc(x.c||'Event')}</span><span class="ttx">${esc(x.e)}</span> ${tag(x.st||'U')}</button>`).join('')}</div></section>`).join('')}</div>`:'<div class="card"><h3>No dated events yet</h3>Upload records, or add an event manually. Events are never created without a documented date.</div>'}${e?`<div class="card"><h3>Source</h3>${esc(e.src)} · page ${e.pg||1}${alt}<br>${tag(e.st||'U')}<p class="row bgrp"><button class="b sm" title="View source" onclick="alert('Prototype: the original document opens at page ${e.pg||1} here.')">Source</button>${canV()?`<button class="b p sm" onclick="ver('tl',${S.ev},'V')">${e.st==='V'?'Unverify':'Verify'}</button><button class="b sm" onclick="evForm(${S.ev})">Edit</button><button class="b w sm" onclick="delEv(${S.ev})">Delete</button>`:''}</p></div>`:''}`
}

function docs(p){const cat=d=>d.cat==='Other'?'Other — '+esc(d.cc):esc(d.cat);
 const lf=S.lastFill&&S.lastFill.pid===p.id&&S.lastFill.fields.length?`<div class="fillnote noprint" role="status">${ico('Spark')}<div><b>${S.lastFill.fields.length} patient field${S.lastFill.fields.length>1?'s':''} filled from ${S.lastFill.files.map(esc).join(', ')}</b><div class="sub">${S.lastFill.fields.map(esc).join(' · ')}. Existing entries are never overwritten; differences appear under Conflicts.</div></div><button class="b sm" onclick="S.tab='Overview';render()">Review in Overview</button><button class="b sm" aria-label="Dismiss" onclick="S.lastFill=null;render()">Dismiss</button></div>`:'';
 return `${lf}<div class="card noprint"><div class="dz" id="dropzone"><svg class="dzico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg><div class="dzt">Drag and drop medical records here</div><input type="file" id="fi" multiple accept=".pdf,.docx,.txt,.png,.jpg,.jpeg" style="display:none" onchange="pick(this.files)"><button class="b p" style="margin-top:10px" onclick="$('fi').click()">Browse files</button><p class="sub">PDF, DOCX, TXT, PNG, JPG · max 50 MB each. Name, age, sex and clinical details found in the document are filled into the patient record automatically. The source hospital is saved with each document only.</p></div><div class="ocr-choice" style="margin-top:16px;padding:14px;border:1px solid var(--line);border-radius:12px;background:var(--surface)"><div style="font-weight:600;margin-bottom:8px">Document extraction engine</div><div class="row" style="gap:8px;flex-wrap:wrap"><button type="button" class="b ${S.ocrEngine==='gemini'?'p':''}" aria-pressed="${S.ocrEngine==='gemini'}" onclick="S.ocrEngine='gemini';render()">AI OCR – Gemini</button><button type="button" class="b ${S.ocrEngine==='tesseract'?'p':''}" aria-pressed="${S.ocrEngine==='tesseract'}" onclick="S.ocrEngine='tesseract';render()">Local OCR – Tesseract</button></div><p class="sub" style="margin:8px 0 0">Gemini uses the backend API key for AI-powered PDF/image extraction. Existing OCR keeps the current local Tesseract pipeline. DOCX and TXT continue using their existing native text readers.</p></div><div id="fl">${S.files.map((f,i)=>`<div class="two" style="margin-top:10px"><div><b>${esc(f.n)}</b><div class="sub">${f.file?formatBytes(f.file.size):'Ready'}</div></div><div><select aria-label="Category" onchange="S.files[${i}].cat=this.value;if(this.value!=='Other')S.files[${i}].cc='';render()">${CATS.map(c=>`<option ${c===f.cat?'selected':''}>${c}</option>`).join('')}</select>${f.cat==='Other'?`<label>Specify Document Category</label><input placeholder="Enter the document category" value="${esc(f.cc)}" oninput="S.files[${i}].cc=this.value">`:''}<label for="fh_${i}">Source Hospital / Institution (Optional)</label><input id="fh_${i}" list="hosp_list" maxlength="150" autocomplete="off" placeholder="Hospital this document came from" value="${esc(f.hosp||'')}" oninput="S.files[${i}].hosp=this.value"></div></div>`).join('')}<datalist id="hosp_list">${[...new Set(P.flatMap(x=>srcHospitals(x)))].map(h=>`<option value="${esc(h)}">`).join('')}</datalist></div>${S.files.length?`<p><button class="b p" onclick="process()">Upload, extract text &amp; save records</button><button class="b" onclick="S.files=[];render()">Clear queue</button></p>`:''}<div id="prog"></div></div>
 <div class="card"><h3>Uploaded records</h3>${p.docs?.length?`<div class="tw"><table><tr><th>Document</th><th>Source hospital</th><th>Category</th><th>Date</th><th>Status</th><th>Text</th><th>Actions</th></tr>${p.docs.map((d,i)=>`<tr><td>${esc(d.n)}</td><td>${hospOf(d)?esc(hospOf(d)):'<span class="sub">Not specified</span>'}</td><td>${cat(d)}</td><td>${esc(d.dt||'')}</td><td>${esc(d.p||d.status||'Processed')}</td><td>${d.text?`<span class="tag V">Extracted</span>`:`<span class="tag Q">No text</span>`}</td><td><div class="row bgrp"><button class="b sm" onclick="viewDoc('${esc(p.id)}','${esc(d.id||'')}')">View text</button><button class="b sm" onclick="downloadDoc('${esc(p.id)}','${esc(d.id||'')}')">Open file</button>${canDelDoc(d)?`<button class="b w sm" onclick="deleteDoc('${esc(p.id)}','${esc(d.id||'')}')">Delete</button>`:''}</div></td></tr>`).join('')}</table></div>`:'<p class="sub">No documents uploaded yet.</p>'}</div>`}

/* ---- Key details renderer: shows only the important extracted facts; full OCR text is opt-in ---- */
function keyDetailsHtml(kd){
  kd=kd||{};
  const kv=(title,obj)=>Object.keys(obj||{}).length?`<div class="kd-group"><h4>${esc(title)}</h4><table>${Object.entries(obj).map(([k,v])=>`<tr><th style="width:38%;text-align:left">${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</table></div>`:'';
  const list=(title,arr)=>arr&&arr.length?`<div class="kd-group"><h4>${esc(title)}</h4><ul style="margin:4px 0 0 18px;padding:0">${arr.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`:'';
  const pairs=(title,arr)=>arr&&arr.length?`<div class="kd-group"><h4>${esc(title)}</h4><table>${arr.map(x=>`<tr><th style="width:38%;text-align:left">${esc(x.label)}</th><td>${esc(x.value)}</td></tr>`).join('')}</table></div>`:'';
  const meds=kd.medications&&kd.medications.length?`<div class="kd-group"><h4>Medications</h4><table><tr><th style="text-align:left">Drug</th><th style="text-align:left">Dose</th><th style="text-align:left">Frequency</th></tr>${kd.medications.map(m=>`<tr><td>${esc(m.name)}</td><td>${esc(m.dose)}</td><td>${esc(m.freq||'—')}</td></tr>`).join('')}</table></div>`:'';
  const html=[kv('Patient',kd.patient),kv('Key dates',kd.dates),list('Diagnosis',kd.diagnosis),list('Stage',kd.stage),list('Procedure',kd.procedure),list('Allergies',kd.allergies),list('Documented history',kd.history),meds,pairs('Key results',kd.investigations),pairs('Vitals',kd.vitals),list('Pending / awaited',kd.pending)].join('');
  return html||'<p class="sub">No key clinical details were recognised in this document. Use “Show full OCR text” to read it.</p>';
}
function fieldEvidenceHtml(entries){
  if(!Array.isArray(entries)||!entries.length) return '';
  const rows=entries.map(item=>{
    const value=typeof item.value==='object'?JSON.stringify(item.value):String(item.value??'');
    const source=String(item.sourceText||'').slice(0,240);
    const confidence=item.ocrConfidence==null?'Not scored':`${item.ocrConfidence}%`;
    const status=item.reviewRequired?'Review required':'Check against source';
    return `<tr><td>${esc(item.field||'')}</td><td>${esc(value)}</td><td>${item.sourcePage?`Page ${esc(item.sourcePage)}`:'Page not identified'}</td><td>${esc(confidence)}</td><td>${esc(status)}${source?`<div class="sub">${esc(source)}</div>`:''}</td></tr>`;
  }).join('');
  return `<div class="kd-group"><h4>Extraction evidence — verify against original</h4><div style="overflow-x:auto"><table><thead><tr><th>Field</th><th>Extracted value</th><th>Source</th><th>OCR confidence</th><th>Review</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
}
function ocrSummaryHtml(ocr){
  if(!ocr) return '';
  const confidence=ocr.averageConfidence==null?'Not applicable to native PDF text':`${esc(ocr.averageConfidence)}%`;
  const pages=Array.isArray(ocr.pages)?ocr.pages.length:0;
  const duration=ocr.processingMs!=null&&Number.isFinite(Number(ocr.processingMs))?` · ${Math.round(Number(ocr.processingMs)/1000)} sec`:''; 
  const review=ocr.reviewRecommended?'<strong>Manual review recommended.</strong>':'Please verify clinical details against the original.';
  return `<p class="sub">Extraction: ${esc(ocr.mode||'document text')} · ${pages} page(s) · OCR confidence: ${confidence}${duration}. ${review}</p>`;
}

function toggleRawText(btn){
  const pre=btn.parentElement.nextElementSibling;
  const show=pre.style.display==='none';
  pre.style.display=show?'block':'none';
  btn.textContent=show?'Hide full OCR text':'Show full OCR text';
}
async function viewDoc(patientId, docId){
  try {
    const r=await apiFetch(`/api/patients/${encodeURIComponent(patientId)}/documents/${encodeURIComponent(docId)}`);
    const d=r.document||{};
    const text=String(d.text||'').trim();
    $('dlg').innerHTML=`<h3>${esc(d.n||'Document')}</h3>
      <p class="sub">${esc(d.cat||'Other')} · ${esc(d.dt||'')} · ${esc(d.p||d.status||'Processed')}</p>
      <p class="sub"><b>Source hospital / institution:</b> ${hospOf(d)?esc(hospOf(d)):'Not specified'}</p>
      <div class="card"><h4>Key details</h4>${text?keyDetailsHtml(d.keyDetails):`<p class="sub">No text was extracted. If this DOCX contains scanned images only, it needs to be converted to an image/PDF or OCR support for embedded images added.</p>`}</div>
      ${text?`<p class="row"><button class="b" onclick="toggleRawText(this)">Show full OCR text</button></p><pre style="display:none;white-space:pre-wrap;max-height:50vh;overflow:auto">${esc(text)}</pre>`:''}
      <p class="row"><button class="b" onclick="$('dlg').close()">Close</button></p>`;
    $('dlg').showModal();
  } catch(e){ toast(`Could not open document: ${e.message}`); }
}

function deleteDoc(patientId, docId){
  const p=P.find(x=>x.id===patientId), d=p&&(p.docs||[]).find(x=>x.id===docId);
  if(!p||!d){ toast('That document is no longer in the list.'); render(); return; }
  if(!canDelDoc(d)){ toast('Clinical Assistants can delete only documents they uploaded.'); return; }
  $('dlg').innerHTML=`<h3>Delete document?</h3>
    <p><b>${esc(d.n)}</b></p>
    <p class="sub">${esc(d.cat==='Other'&&d.cc?d.cc:(d.cat||'Other'))} · Source hospital: ${hospOf(d)?esc(hospOf(d)):'Not specified'} · ${esc(p.name||'Unnamed patient')} (${esc(p.id)})</p>
    <p>This permanently deletes the uploaded file and its extracted text. Timeline events, medications, investigations, conflicts and missing items are recalculated from the remaining documents. This cannot be undone.</p>
    <div id="delerr"></div>
    <div class="row" style="margin-top:14px">
      <button class="b w" id="deldocgo" onclick="confirmDeleteDoc('${esc(p.id)}','${esc(d.id)}')">Yes, delete document</button>
      <button class="b" onclick="$('dlg').close()">Cancel</button>
    </div>`;
  $('dlg').showModal();
}
async function confirmDeleteDoc(patientId, docId){
  const btn=$('deldocgo'), box=$('delerr');
  if(btn){ btn.disabled=true; btn.textContent='Deleting...'; }
  if(box) box.innerHTML='';
  const idx=P.findIndex(x=>x.id===patientId);
  const name=(P[idx]?.docs||[]).find(x=>x.id===docId)?.n||'Document';
  const done=(msg)=>{ $('dlg').close(); render(); toast(msg,3600); };
  try{
    const r=await apiFetch(`/api/patients/${encodeURIComponent(patientId)}/documents/${encodeURIComponent(docId)}`,{method:'DELETE'});
    if(idx>=0 && r.patient) P[idx]=normalizePatient(r.patient);
    else if(idx>=0) P[idx]={...P[idx],docs:(P[idx].docs||[]).filter(x=>x.id!==docId)};
    log('Document Deleted','document',name,'');
    done(`Deleted ${name}`);
  }catch(e){
    const msg=e.message||'Request failed';
    if(/document not found|already.*deleted/i.test(msg)){
      // Already gone on the server (for example removed from Supabase directly): refresh this patient and drop the stale row.
      try{ const f=await apiFetch(`/api/patients/${encodeURIComponent(patientId)}`); if(idx>=0&&f.patient) P[idx]=normalizePatient(f.patient); }
      catch(_){ if(idx>=0) P[idx]={...P[idx],docs:(P[idx].docs||[]).filter(x=>x.id!==docId)}; }
      done(`${name} was already deleted. The list has been refreshed.`);
      return;
    }
    console.error('Document delete failed',e);
    if(btn){ btn.disabled=false; btn.textContent='Try again'; }
    if(box) box.innerHTML=`<div class="err" role="alert">Could not delete the document: ${esc(msg)}</div>`;
    toast('Could not delete the document: '+msg,5200);
  }
}

async function downloadDoc(patientId, docId){
  try {
    const r=await apiFetch(`/api/patients/${encodeURIComponent(patientId)}/documents/${encodeURIComponent(docId)}?download=1`);
    if(r.url) window.open(r.url,'_blank','noopener');
  } catch(e){ toast(`Could not open file: ${e.message}`); }
}

function formatBytes(n){if(!n)return '';const u=['B','KB','MB','GB'];let i=0,v=n;while(v>=1024&&i<u.length-1){v/=1024;i++}return `${v.toFixed(v>=10||i===0?0:1)} ${u[i]}`}

function toast(m,ms){let t=$('toast');if(!t){t=document.createElement('div');t.id='toast';t.setAttribute('role','status');document.body.appendChild(t)}t.textContent=m;t.className='show';clearTimeout(t._h);t._h=setTimeout(()=>t.className='',ms||2400)}
const VL={U:['Unverified','<circle cx="12" cy="12" r="4"/>'],V:['Verified','<path d="M20 6 9 17l-5-5"/>'],C:['Corrected','<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>']};
const pill=(v,extra='')=>`<button class="pill ${v}" ${extra}><svg viewBox="0 0 24 24">${VL[v][1]}</svg>${VL[v][0]}</button>`;
const fdt=d=>new Date(d).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
const dname=n=>n.replace(/\.[^.]+$/,'').replace(/_/g,' ');
const allDocs=()=>{const a=[];P.forEach((p,pi)=>p.docs.forEach((d,di)=>a.push({p,d,pi,di})));return a.sort((x,y)=>y.d.dt.localeCompare(x.d.dt))};
S.df='All';
function docBoard(){
 const at=P.map(p=>({p,o:p.cf.filter(x=>x.st==='Open').length,m:p.ms.filter(x=>x.st==='Missing').length})).filter(a=>a.o||a.m);
 const L=allDocs().filter(x=>S.df==='All'||(x.d.v||'U')===S.df.charAt(0)).slice(0,8);
 return `<div class="dgrid noprint"><section class="pcard"><header><h3>Needs attention</h3></header><div class="pbody">${at.map(a=>`<div class="arow"><div class="top"><div><b>${esc(a.p.name)}</b><div class="sub">${esc(a.p.surg)}, ${fdt(a.p.date)}</div></div><div class="bs">${a.o?`<span class="pill bad"><svg viewBox="0 0 24 24">${IC.Conflicts}</svg>Conflict</span>`:''}${a.m?`<span class="pill bad"><svg viewBox="0 0 24 24"><path d="M5 12h14"/></svg>${a.m} missing</span>`:''}</div></div><button class="open" onclick="go('pt','${a.p.id}','Brief')">Open preparation</button></div>`).join('')||'<p class="sub" style="padding:14px 0">Nothing needs attention right now.</p>'}</div></section>
 <section class="pcard"><header><h3>Recently added documents</h3></header><div class="chips">${['All','Unverified','Verified','Corrected'].map(f=>`<button class="chip ${S.df===f?'on':''}" onclick="S.df='${f}';render()">${f}</button>`).join('')}</div><div class="pbody">${L.map(x=>`<div class="drow"><div><button class="t" onclick="docDlg(${x.pi},${x.di})">${esc(dname(x.d.n))}</button><div class="sub">${esc(x.p.name)} &nbsp; ${fdt(x.d.dt)}${hospOf(x.d)?' &nbsp; '+esc(hospOf(x.d)):''}</div></div>${pill(x.d.v||'U',`title="Click to change status" onclick="cycD(${x.pi},${x.di})"`)}</div>`).join('')||'<p class="sub" style="padding:14px 0">No documents in this filter.</p>'}</div></section></div>`}
function setD(pi,di,v){if(!canV()){toast('Clinical Assistants cannot verify documents');return}const d=P[pi].docs[di];S.pid=P[pi].id;log('Document '+VL[v][0],'document',VL[d.v||'U'][0],VL[v][0]+': '+d.n);d.v=v;$('dlg').close();render();toast(dname(d.n)+' marked '+VL[v][0].toLowerCase())}
function cycD(pi,di){const d=P[pi].docs[di];setD(pi,di,{U:'V',V:'C',C:'U'}[d.v||'U'])}
function docDlg(pi,di){const p=P[pi],d=p.docs[di];$('dlg').innerHTML=`<h3>${esc(dname(d.n))}</h3><p class="sub">${esc(p.name)} · ${p.id}</p><div class="two"><div><div class="sub">File</div>${esc(d.n)}</div><div><div class="sub">Category</div>${d.cat==='Other'?'Other — '+esc(d.cc):esc(d.cat)}</div><div><div class="sub">Document date</div>${fdt(d.dt)}</div><div><div class="sub">Source hospital</div>${hospOf(d)?esc(hospOf(d)):'Not specified'}</div><div><div class="sub">Processing</div>${esc(d.p)}</div><div><div class="sub">Status</div>${pill(d.v||'U','style="cursor:default"')}</div></div><div class="row bgrp" style="margin-top:16px">${canV()?`<button class="b p sm" onclick="setD(${pi},${di},'V')">Verify</button><button class="b sm" title="Mark corrected" onclick="setD(${pi},${di},'C')">Corrected</button><button class="b sm" onclick="setD(${pi},${di},'U')">Reset</button>`:''}<button class="b sm" title="View timeline" onclick="go('pt','${p.id}','Timeline');$('dlg').close()">Timeline</button><button class="b sm" onclick="$('dlg').close()">Close</button></div>`;$('dlg').showModal()}

function printHead(p,t){return `<div class="printhead"><h1>PERISCOPE — ${esc(p.name)}</h1><p>${p.id} · ${p.age}y · ${p.sex} · ${esc(p.dx)}<br>Planned: ${esc(p.surg)} on ${displayDate(p.date)}</p><h2 style="margin:8px 0 0">${t}</h2><p class="sub">Printed ${new Date().toLocaleString()} by ${esc(S.u.name)}</p></div>`}
function docTable(p){return `<div class="printonly"><h2>Documents</h2><table><tr><th>File</th><th>Category</th><th>Document date</th><th>Source hospital</th><th>Status</th></tr>${p.docs.map(d=>`<tr><td>${esc(d.n)}</td><td>${d.cat==='Other'?'Other — '+esc(d.cc):esc(d.cat)}</td><td>${d.dt}</td><td>${hospOf(d)?esc(hospOf(d)):'Not specified'}</td><td>${VL[d.v||'U'][0]}</td></tr>`).join('')}</table></div>`}

function briefDoc(p){return `<!doctype html><html><head><meta charset="utf-8"><title>PERISCOPE Brief - ${esc(p.name)}</title><style>
body{font:12pt/1.45 Arial,Helvetica,sans-serif;color:#000;background:#fff;margin:18mm}
h1{font-size:22pt;margin:0}h2{font-size:15pt;margin:4px 0 10px}h3{font-size:12.5pt;margin:0 0 4px}
.card{border:1px solid #777;border-radius:6px;padding:10px 12px;margin:0 0 10px;break-inside:avoid}
.conf{border-left:6px solid #000}.note{border:1px dashed #777;padding:8px 10px;font-size:10pt}
.tag{border:1px solid #000;border-radius:4px;padding:0 6px;font-size:9.5pt;font-weight:600;white-space:nowrap}
.sub{color:#444}.noprint{display:none}table{border-collapse:collapse;width:100%}td{border:1px solid #999;padding:3px 6px;font-size:10pt;vertical-align:top}h4{font-size:11pt}ul{margin:4px 0;padding-left:20px}li{margin-bottom:3px}
</style></head><body>${brief(p)}</body></html>`}
async function printBrief(){const p=cur(),html=briefDoc(p);
 let d=null;try{d=window.claude&&await claude.use('downloads')}catch(e){}
 if(d){const auto=html.replace('</body>','<scr'+'ipt>addEventListener("load",function(){setTimeout(function(){print()},400)})</scr'+'ipt></body>');
  try{await d.save({filename:`PERISCOPE_Brief_${p.id}_print.html`,data:auto});log('Brief Printed');toast('Saved. Open the file and the print dialog opens automatically (or press Ctrl+P).')}catch(e){toast(e&&e.code==='declined'?'Print copy cancelled':'Printing is unavailable here. Use Download PDF.')}return}
 try{const f=document.createElement('iframe');f.style.cssText='position:fixed;right:0;bottom:0;width:0;height:0;border:0';f.onload=()=>{try{f.contentWindow.focus();f.contentWindow.print();log('Brief Printed')}catch(e){toast('Printing is blocked. Use Download PDF.')}setTimeout(()=>f.remove(),90000)};document.body.appendChild(f);f.srcdoc=html}catch(e){toast('Printing is blocked. Use Download PDF.')}}

const pdfClean=s=>String(s??'').replace(/[—–]/g,'-').replace(/[“”]/g,'"').replace(/[‘’]/g,"'").replace(/[^\x20-\x7E\xA0-\xFF]/g,'');
const pdfW=(s,z)=>{let w=0;for(const c of s)w+=/[ijl.,;:!|' ()\[\]\-tfIr]/.test(c)?.3:/[mwMW]/.test(c)?.85:/[A-Z]/.test(c)?.67:.52;return w*z};
function pdfWrap(t,z,mw){const out=[];let cur='';for(const w of t.split(' ')){const n=cur?cur+' '+w:w;if(pdfW(n,z)>mw&&cur){out.push(cur);cur=w}else cur=n}out.push(cur);return out}
const STL={U:'Unverified',V:'Verified',C:'Corrected',Q:'Needs clarification',X:'Conflict',N:'Not documented'};
function briefPDF(p){
 const L=[],H=(t,z=13,g=10)=>L.push({t,z,b:1,g,i:0}),T=(t,z=10.5,i=0,b=0)=>L.push({t,z,b,g:0,i}),
 B=(a,f)=>a.length?a.forEach(x=>T('- '+f(x),10.5,10)):T('Not documented',10.5,10),d=v=>v||'Not documented';
 const unv=['tl','an','med','inv'].reduce((a,k)=>a+p[k].filter(x=>x.st==='U'||x.st==='Q').length,0);
 H('PERISCOPE',22,0);H('Pre-Anaesthesia Preparation Brief',15,4);
 T(`${p.id} - ${p.name}  | Status: ${p.status}`,11,0,1);
 T(`Requires verification: ${unv} unverified item(s), ${p.cf.filter(x=>x.st==='Open').length} open conflict(s), ${p.ms.filter(x=>x.st==='Missing').length} missing item(s). Everything else listed is documented in the source records.`,10.5);
 H('Patient Summary');briefSummary(p).forEach(l=>T('- '+l,10.5,10));
 H('1. Patient Information');T(`${p.name} | ${p.id} | ${p.age}y | ${p.sex}`);T(`${p.dx} | Stage: ${d(p.stage)}`);
 H('2. Planned Procedure');T(`${p.surg} | ${p.date}`);
 H('3. Previous Anaesthesia');B(p.an,x=>`${x.d}: ${x.s} - ${x.a}; ${x.ev} (${x.src}) [${STL[x.st]}]`);
 H('4. Surgical History');B(p.tl.filter(x=>x.c==='Surgery'),x=>`${x.d}: ${x.e} (${x.src} p${x.pg}) [${STL[x.st]}]`);
 H('5. Cancer Treatment Journey');B(p.tl.filter(x=>['Diagnosis','Surgery','Chemotherapy','Radiotherapy','Immunotherapy','Targeted Therapy'].includes(x.c)),x=>`${x.d}: ${x.e} (${x.src} p${x.pg}) [${STL[x.st]}]`);
 H('6. Medical History');T(d(p.hist));
 H('7. Allergies');T(d(p.allergy)+(p.cf.some(c=>c.f==='Allergy'&&c.st==='Open')?'  [Conflict] Conflicting records; see Conflicts':''));
 H('8. Medications');B(p.med,x=>`${x.m} - ${d(x.dose)}, ${d(x.freq)} (${x.src}) [${STL[x.st]}]`);
 H('9. Investigations');B(p.inv,x=>`${x.d} ${x.t}: ${x.r} (${x.src}) [${STL[x.st]}]`);
 H('10. Missing Information');B(p.ms,x=>`${x.i} - ${x.r} (${x.st})`);
 H('11. Conflicts');B(p.cf,x=>`${x.f}: "${x.a}" (${x.sa}) vs "${x.b}" (${x.sb}) - ${x.st}`);
 H('12. Clarification Questions');B(p.qs,x=>`${x.q} (${x.st})`);
 H('13. Source Documents');B(p.docs,x=>`${x.n}${hospOf(x)?' — '+hospOf(x):''} - ${x.cat==='Other'?'Other: '+x.cc:x.cat} (${x.dt})`);
 H('14. Complete Patient Timeline');B(tlGroups(p.tl),g=>`${g.d?displayDate(g.d):'Undated'}: ${g.items.map(({x})=>`${x.e} (${x.c}; ${x.src} p${x.pg})`).join('; ')}`);
 H('15. Pre-Anaesthesia Check-Up (PAC)');{const pd=PAC.data(p);if(!pd.length)T('PAC not started for this patient.',10.5,10);pd.forEach(b=>{T(b.h,11,0,1);b.r.forEach(r=>T('- '+r[0]+': '+r[1],10.5,10))})}
 H('Prototype for clinical workflow assistance. Not intended for autonomous clinical decision-making. No recommendations or risk scores are generated.',9,14);
 return pdfBuild(L,p)}
function pdfBuild(L,p,label){const M=50,W=495,pages=[[]];let y=792;
 for(const it of L){const t=pdfClean(it.t),lh=it.z*1.4,ls=pdfWrap(t,it.z,W-it.i);y-=it.g;
  for(const ln of ls){if(y-lh<60){pages.push([]);y=792}y-=lh;pages[pages.length-1].push(`BT /${it.b?'F2':'F1'} ${it.z} Tf ${M+it.i} ${y.toFixed(1)} Td (${ln.replace(/[\\()]/g,'\\$&')}) Tj ET`)}}
 const n=pages.length;pages.forEach((ops,i)=>ops.push(`BT /F1 8 Tf ${M} 30 Td (${pdfClean('PERISCOPE - '+(label?label+' - ':'')+p.name+' ('+p.id+') - Page '+(i+1)+' of '+n).replace(/[\\()]/g,'\\$&')}) Tj ET`));
 let o='%PDF-1.4\n';const off=[],add=(id,b)=>{off[id]=o.length;o+=id+' 0 obj\n'+b+'\nendobj\n'};
 add(1,'<< /Type /Catalog /Pages 2 0 R >>');add(2,`<< /Type /Pages /Kids [${pages.map((_,i)=>(6+2*i)+' 0 R').join(' ')}] /Count ${n} >>`);
 add(3,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');add(4,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
 pages.forEach((ops,i)=>{const st=ops.join('\n');add(5+2*i,`<< /Length ${st.length} >>\nstream\n${st}\nendstream`);add(6+2*i,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${5+2*i} 0 R >>`)});
 const xr=o.length,N=5+2*n;o+=`xref\n0 ${N}\n0000000000 65535 f \n`;for(let i=1;i<N;i++)o+=String(off[i]).padStart(10,'0')+' 00000 n \n';
 o+=`trailer\n<< /Size ${N} /Root 1 0 R >>\nstartxref\n${xr}\n%%EOF`;return Uint8Array.from(o,c=>c.charCodeAt(0)&255)}
function pacPDF(p){const L=[],H=(t,z=13,g=10)=>L.push({t,z,b:1,g,i:0}),T=(t,z=10.5,i=0,b=0)=>L.push({t,z,b,g:0,i}),d=v=>v||'Not documented',z=p.pac;
 H('PERISCOPE',22,0);H('Pre-Anaesthesia Check-Up (PAC) Summary',15,4);
 T(`${p.id} - ${p.name}  | ${p.age}y | ${p.sex}`,11,0,1);T(`${p.dx} | Stage: ${d(p.stage)} | Planned: ${p.surg} on ${p.date}`);T(`PAC status: ${PAC.stat(p)}`,10.5,0,1);
 if(z){const op=z.acts.filter(a=>a.status==='Pending'||a.status==='In Progress');H('Open items');if(op.length)op.forEach(a=>T('- '+a.type+': '+a.req+' ('+a.status+')',10.5,10));else T('No unresolved pending actions.',10.5,10);
  z.acts.filter(a=>!op.includes(a)).forEach(a=>T('- [Done] '+a.type+': '+a.req+' ('+a.status+')',10.5,10))}
 H('Background from PERISCOPE records');
 T('Previous anaesthesia:',10.5,0,1);p.an.length?p.an.forEach(x=>T(`- ${x.d}: ${x.s} - ${x.a}; ${x.ev} (${x.src}) [${STL[x.st]}]`,10.5,10)):T('None documented',10.5,10);
 T('Cancer treatment and surgical history:',10.5,0,1);p.tl.filter(x=>['Diagnosis','Surgery','Chemotherapy','Radiotherapy','Immunotherapy','Targeted Therapy'].includes(x.c)).forEach(x=>T(`- ${x.d}: ${x.e} (${x.src} p${x.pg}) [${STL[x.st]}]`,10.5,10));
 T('Medications:',10.5,0,1);p.med.length?p.med.forEach(x=>T(`- ${x.m} ${d(x.dose)} ${x.freq||''} (${x.src}) [${STL[x.st]}]`,10.5,10)):T('Not documented',10.5,10);
 T(`Allergies: ${d(p.allergy)}${p.cf.some(c=>c.f==='Allergy'&&c.st==='Open')?' [Conflicting records]':''}`,10.5,0,1);
 const pd=PAC.data(p);if(!pd.length)H('PAC not started for this patient.');pd.forEach(b=>{H(b.h,12,10);b.r.forEach(r=>T('- '+r[0]+': '+r[1],10.5,10))});
 H('Clinician-entered decisions are shown as entered. No recommendations, risk scores or clearance are generated by PERISCOPE.',9,14);
 return pdfBuild(L,p,'PAC Summary')}
async function downloadPacPDF(){const p=cur();let r;try{r=await saveFile(`PERISCOPE_PAC_${p.id}_${p.name.replace(/\W+/g,'_')}.pdf`,pacPDF(p))}catch(e){r='fail'}
 if(r==='ok'){log('PAC Summary PDF Downloaded');toast('PAC summary PDF ready — confirm the save prompt if one appears')}else if(r==='declined')toast('Download cancelled');else toast('Download is unavailable in this view. Open the app in its own browser tab and try again.')}
async function saveFile(name,data){
 try{const d=window.claude&&await claude.use('downloads');if(d){await d.save({filename:name,data});return 'ok'}}catch(e){return e&&e.code==='declined'?'declined':'fail'}
 try{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([data]));a.download=name;document.body.appendChild(a);a.click();a.remove();return 'ok'}catch(e){return 'fail'}}
async function downloadBriefPDF(){const p=cur();let r;try{r=await saveFile(`PERISCOPE_Brief_${p.id}_${p.name.replace(/\W+/g,'_')}.pdf`,briefPDF(p))}catch(e){r='fail'}
 if(r==='ok'){log('Brief PDF Downloaded');toast('PDF ready — confirm the save prompt if one appears')}else if(r==='declined')toast('Download cancelled');else toast('Download is unavailable in this view. Open the app in its own browser tab and try again.')}
function printPage(){const o=document.title;document.title='PERISCOPE'+(S.v==='pt'&&cur()?' - '+cur().name+' - '+S.tab:'');window.print();document.title=o}
const printBtn=()=>'';
function pick(fs){
  const files=[...fs].filter(f=>f && f.size>0);
  if(!files.length){ toast('No file selected.'); return; }
  const allowed=/\.(pdf|docx|txt|png|jpe?g)$/i;
  const max=50*1024*1024;
  const bad=files.find(f=>!allowed.test(f.name));
  if(bad){ toast(`Unsupported file type: ${bad.name}`); return; }
  const tooBig=files.find(f=>f.size>max);
  if(tooBig){ toast(`${tooBig.name} is larger than 50 MB.`); return; }
  for(const f of files){
    const key=`${f.name}|${f.size}|${f.lastModified}`;
    if(!S.files.some(x=>x.key===key)){
      S.files.push({key,n:f.name,file:f,cat:CATS[0],cc:'',hosp:''});
    }
  }
  render();
  setTimeout(()=>document.getElementById('fl')?.scrollIntoView({behavior:'smooth',block:'nearest'}),50);
}

async function process(){
  if(S.files.some(f=>f.cat==='Other'&&!f.cc.trim())){
    alert('Please enter the required information: specify the document category.'); return;
  }
  if(!S.files.length){ alert('Please upload a document first.'); return; }
  const el=$('prog');
  el.innerHTML=`<div class="card"><h3>Processing Records</h3><p>Preparing secure upload...</p></div>`;
  try{
    const p=cur();
    if(!p) throw new Error('Select a patient before uploading documents.');
    const fillLog=[];
    for(const f of S.files){
      if(!f.file) throw new Error(`No file data available for ${f.n}`);
      el.innerHTML=`<div class="card"><h3>Processing Records</h3><div>✓ Selected: ${esc(f.n)}</div><p class="sub">Uploading securely and extracting text...</p></div>`;
      const formData=new FormData();
      formData.append('document',f.file,f.n);
      formData.append('category',f.cat);
      formData.append('customCategory',f.cc||'');
      formData.append('sourceHospital',(f.hosp||'').trim());
      formData.append('ocrEngine',S.ocrEngine||'tesseract');
      const result=await apiFetch(`/api/patients/${encodeURIComponent(p.id)}/documents`,{method:'POST',body:formData});
      const fresh = result.patient ? normalizePatient(result.patient) : normalizePatient((await apiFetch(`/api/patients/${encodeURIComponent(p.id)}`)).patient || {});
      const idx=P.findIndex(x=>x.id===p.id);
      if(idx>=0) P[idx]=fresh;
      log('Document Uploaded','document','',f.n+(f.cc?' ('+f.cc+')':'')+((f.hosp||'').trim()?' — '+f.hosp.trim():''));
      const filled=Array.isArray(result.filled)?result.filled:[];
      if(filled.length){fillLog.push({file:f.n,fields:filled});log('Fields Auto-filled','patient','',filled.join(', ')+' ← '+f.n)}
      el.innerHTML=`<div class="card"><h3>Processing Records</h3>
        <div>✓ Document stored in Supabase</div><div>✓ Text extraction completed</div><div>✓ Timeline, anaesthesia, medications and investigations refreshed</div>${filled.length?`<div>✓ Patient fields filled: ${filled.map(esc).join(', ')}</div>`:'<div class="sub">No new patient details were found to fill.</div>'}
        ${ocrSummaryHtml(result.ocr)}
        <h4>Key details</h4>${result.text?keyDetailsHtml(result.keyDetails):'<p class="sub">No text found</p>'}
        ${fieldEvidenceHtml(result.fieldEvidence)}
        ${result.text?`<p class="row"><button class="b" onclick="toggleRawText(this)">Show full OCR text</button></p><pre style="display:none;white-space:pre-wrap;max-height:300px;overflow:auto">${esc(result.text)}</pre>`:''}
      </div>`;
    }
    S.files=[];
    log('Document Text Extraction Completed');
    const all=[...new Set(fillLog.flatMap(x=>x.fields))];
    S.lastFill={pid:p.id,files:fillLog.map(x=>x.file),fields:all};
    render();
    toast(all.length?`Filled ${all.length} patient field${all.length>1?'s':''}: ${all.join(', ')}`:'Document processed. No new patient details found.',all.length?5200:3200);
  }catch(error){
    console.error(error);
    el.innerHTML=`<div class="card"><h3>Processing Error</h3><p>${esc(error.message||'Something went wrong')}</p>
      <p class="sub">Check the PERISCOPE backend, Firebase login token, and Supabase configuration.</p></div>`;
  }
}

function qsV(p){return `<div class="row noprint" style="margin-bottom:10px"><input id="nq" aria-label="New question" placeholder="Add a clarification question" style="max-width:480px"><button class="b p" onclick="addQ()">Add Question</button></div>`+(p.qs.length?p.qs.map((q,i)=>`<div class="card"><span class="tag ${q.st==='Open'?'Q':'V'}">${esc(q.st)}</span><p>${esc(q.q)}</p>${q.r?`<p class="note">Response: ${esc(q.r)}</p>`:''}<div class="row"><button class="b" onclick="ansQ(${i})">Mark Answered</button><button class="b" onclick="delQ(${i})">Delete</button></div></div>`).join(''):`<div class="card"><h3>No questions</h3>Questions appear when records are missing, unclear or in conflict.</div>`)}
function addQ(){const v=$('nq').value.trim();if(!v)return;cur().qs.push({q:v,st:'Open'});log('Question Added','question','',v);render()}
function delQ(i){log('Question Deleted','question',cur().qs[i].q,'');cur().qs.splice(i,1);render()}
function ansQ(i){const r=prompt('Response (optional)')||'';const q=cur().qs[i];q.st='Answered';q.r=r;log('Question Edited','question','Open','Answered');render()}
function genBrief(){S.tab='Brief';log('Brief Generated');render()}
function briefSummary(p){const d=v=>v||'Not documented',cf=p.cf.some(c=>c.f==='Allergy'&&c.st==='Open'),tl=p.tl;
return [`${p.name} · ${p.id} · ${p.age}y ${p.sex}`,
`Diagnosis: ${p.dx} · Stage: ${d(p.stage)} · Current treatment: ${d(p.treat)}`,
`Planned procedure: ${p.surg} on ${p.date} (${p.status})`,
`Cancer journey: ${tl.length} documented event(s)${tl.length?', '+tl[0].d+' to '+tl[tl.length-1].d:''}; ${p.tl.filter(x=>x.c==='Surgery'&&!/^Planned/.test(x.e)).length} previous surgery event(s)`,
`Medical history: ${d(p.hist)} · Allergies: ${d(p.allergy)}${cf?' (conflicting records)':''}`,
`Previous anaesthesia: ${p.an.length?p.an.map(x=>`${x.d} ${x.s} (${x.a}; ${x.ev})`).join(' | '):'None documented'}`,
`Current medications: ${p.med.length?p.med.map(x=>[x.m,x.dose,x.freq].filter(Boolean).join(' ')).join('; '):'Not documented'}`,
`Investigations on file: ${p.inv.length?p.inv.map(x=>`${x.t} ${x.r} (${x.d})`).join('; '):'None'}`,
`Records: ${p.docs.length} document(s) · ${p.cf.filter(x=>x.st==='Open').length} open conflict(s) · ${p.ms.filter(x=>x.st==='Missing').length} missing item(s) · ${p.qs.filter(x=>x.st==='Open').length} open question(s)`,
`Pre-Anaesthesia Check-Up: ${PAC.stat(p)}`]}
function brief(p){const L=(a,f)=>a.length?`<ul>${a.map(x=>`<li>${f(x)}</li>`).join('')}</ul>`:'<p class="sub">Not documented</p>';
 const sec=(n,t,b)=>`<div class="card"><h3>${n}. ${t}</h3>${b}</div>`;
 const unv=['tl','an','med','inv'].reduce((a,k)=>a+p[k].filter(x=>x.st==='U'||x.st==='Q').length,0);
 return `<div class="row noprint" style="margin-bottom:10px"><button class="b p" onclick="downloadBriefPDF()">Download PDF</button></div>
 <h1 style="color:var(--pri)">PERISCOPE</h1><h2 style="margin-top:0">Pre-Anaesthesia Preparation Brief</h2><p><b>${p.id} — ${esc(p.name)}</b>  · Status: ${esc(p.status)}</p>
 <div class="card conf"><b>Requires verification:</b> ${unv} unverified item(s), ${p.cf.filter(x=>x.st==='Open').length} open conflict(s), ${p.ms.filter(x=>x.st==='Missing').length} missing item(s). Everything else listed is documented in the source records.</div>
 <div class="card"><h3>Patient Summary</h3><ul>${briefSummary(p).map(x=>`<li>${esc(x)}</li>`).join('')}</ul><p class="sub">Compiled only from documented records; no recommendations or risk scores.</p></div>
 ${sec(1,'Patient Information',`${esc(p.name)} · ${p.id} · ${p.age}y · ${p.sex}<br>${esc(p.dx)} · Stage: ${nd(p.stage)}`)}
 ${sec(2,'Planned Procedure',`${esc(p.surg)} · ${displayDate(p.date)}`)}
 ${sec(3,'Previous Anaesthesia',L(p.an,x=>`${x.d}: ${esc(x.s)} — ${esc(x.a)}; ${esc(x.ev)} <i>(${esc(x.src)})</i> ${tag(x.st)}`))}
 ${sec(4,'Surgical History',L(p.tl.filter(x=>x.c==='Surgery'),x=>`${x.d}: ${esc(x.e)} <i>(${esc(x.src)} p${x.pg})</i> ${tag(x.st)}`))}
 ${sec(5,'Cancer Treatment Journey',L(p.tl.filter(x=>['Diagnosis','Surgery','Chemotherapy','Radiotherapy','Immunotherapy','Targeted Therapy'].includes(x.c)),x=>`${x.d}: ${esc(x.e)} <i>(${esc(x.src)} p${x.pg})</i> ${tag(x.st)}`))}
 ${sec(6,'Medical History',nd(p.hist))}
 ${sec(7,'Allergies',`${nd(p.allergy)}${p.cf.some(c=>c.f==='Allergy'&&c.st==='Open')?' '+tag('X')+' <span class="sub">Conflicting records; see Conflicts</span>':''}`)}
 ${sec(8,'Medications',L(p.med,x=>`${esc(x.m)} — ${nd(x.dose)}, ${nd(x.freq)} <i>(${esc(x.src)})</i> ${tag(x.st)}`))}
 ${sec(9,'Investigations',L(p.inv,x=>`${x.d} ${esc(x.t)}: ${esc(x.r)} <i>(${esc(x.src)})</i> ${tag(x.st)}`))}
 ${sec(10,'Missing Information',L(p.ms,x=>`${esc(x.i)} — ${esc(x.r)} (${esc(x.st)})`))}
 ${sec(11,'Conflicts',L(p.cf,x=>`${esc(x.f)}: “${esc(x.a)}” (${esc(x.sa)}) vs “${esc(x.b)}” (${esc(x.sb)}) — ${esc(x.st)}`))}
 ${sec(12,'Clarification Questions',L(p.qs,x=>`${esc(x.q)} (${esc(x.st)})`))}
 ${sec(13,'Source Documents',L(p.docs,d=>`${esc(d.n)}${hospOf(d)?' — '+esc(hospOf(d)):''} — ${d.cat==='Other'?'Other: '+esc(d.cc):esc(d.cat)} (${d.dt})`))}
 ${sec(14,'Complete Patient Timeline',L(tlGroups(p.tl),g=>`<b>${g.d?displayDate(g.d):'Undated'}</b>: ${g.items.map(({x})=>`${esc(x.e)} <span class="sub">(${esc(x.c)}; ${esc(x.src)} p${x.pg})</span>`).join('; ')}`))}
 ${PAC.brief(p,15)}
 <p class="note"><b>Prototype for clinical workflow assistance. Not intended for autonomous clinical decision-making.</b> No recommendations or risk scores are generated.</p>`}
/* Basic details, grouped. Entry: [key, label shown in Details, label used in the edit form (optional)]. */
const BASIC_GROUPS=[
 ['Patient demographics',[['name','Name','Patient name'],['age','Age'],['sex','Sex'],['dob','Date of birth'],['bloodgroup','Blood group']]],
 ['Identification',[['mrn','MRN / UHID'],['ipno','IP number'],['opno','OP number']]],
 ['Contact',[['phone','Phone'],['email','Email'],['address','Address'],['emergency','Emergency contact']]],
 ['Admission and care team',[['dept','Department'],['ward','Ward'],['bed','Bed'],['consultant','Consultant'],['referredby','Referred by'],['admdate','Admission date'],['dischdate','Discharge date']]],
 ['Clinical',[['dx','Diagnosis','Cancer diagnosis'],['stage','Stage','Stage (if documented)'],['treat','Current treatment'],['surg','Planned surgery'],['date','Surgery date'],['allergy','Allergies'],['hist','Comorbidities','Comorbidities / medical history'],['height','Height'],['weight','Weight'],['bmi','BMI']]]
];
const FLD=BASIC_GROUPS.flatMap(g=>g[1].map(f=>[f[0],f[2]||f[1],0]));
const DATE_KEYS=['date','dob','admdate','dischdate'];
const bval=(p,k)=>k==='hist'?(p.comorbidities||p.hist):p[k];
const bshow=(p,k)=>{const v=bval(p,k);return DATE_KEYS.includes(k)&&v?esc(displayDate(v)):nd(v)};
function form(p,title,onsave){$('dlg').innerHTML=`<h3>${title}</h3>${BASIC_GROUPS.map(g=>`<h4 class="fgrp">${g[0]}</h4>`+g[1].map(f=>`<label for="f_${f[0]}">${f[2]||f[1]}</label><input id="f_${f[0]}" value="${esc(p[f[0]])}">`).join('')).join('')}${S.u.role==='Clinical Assistant'?'<p class="sub">Clinical Assistants can add and edit patient information and upload records. Patient deletion and clinical verification remain restricted.</p>':''}<div class="row" style="margin-top:14px"><button class="b p" onclick="${onsave}">Save Patient</button><button class="b" onclick="$('dlg').close()">Cancel</button></div>`;$('dlg').showModal()}
function editPt(id){S.pid=id;form(cur(),'Edit Patient',"saveEdit()")}
/* The record keeps short UI names (dx, surg, date, hist) and long database names (diagnosis, planned_surgery, surgery_date,
   medical_history, comorbidities). They must always carry the same value, otherwise the stale one wins and an edit seems to vanish. */
const ALIAS=[['dx','diagnosis'],['surg','planned_surgery'],['date','surgery_date'],['hist','medical_history']];
function syncAliases(p){ALIAS.forEach(([a,b])=>{if(a in p)p[b]=p[a]});if('hist' in p)p.comorbidities=p.hist;return p}
async function saveEdit(){
  const p=cur();
  if(!p){toast('Patient not found in the current patient list.');return;}
  if(!apiLoaded || !firebaseAuth.currentUser){
    toast('Database is not connected. Patient changes were not saved.');
    return;
  }
  const draft={...p};
  FLD.forEach(f=>{
    const n=$('f_'+f[0]).value;
    if(String(draft[f[0]])!==n){
      log('Patient Edited',f[1],draft[f[0]],n);
      draft[f[0]]=f[0]==='age'?+n||draft.age:n;
    }
  });
  syncAliases(draft);
  try{
    const result=await apiFetch(`/api/patients/${encodeURIComponent(draft.id)}`,{method:'PUT',body:JSON.stringify(serializablePatient(draft))});
    if(!result.patient) throw new Error('The server did not return the saved patient.');
    const updated=normalizePatient(result.patient);
    const i=P.findIndex(x=>x.id===draft.id);
    if(i>=0) P[i]=updated;
    $('dlg').close();
    render();
    toast('Patient saved to Supabase successfully');
  }catch(e){
    console.error('Patient edit save failed:',e);
    toast('Could not save patient: '+e.message);
  }
}
function addPt(){const p={id:'P'+Date.now().toString().slice(-10),name:'',age:'',sex:'',dx:'',stage:'',treat:'',surg:'',date:'',allergy:'',hist:'',status:'Awaiting Review',upd:new Date().toISOString().slice(0,10),docs:[],tl:[],an:[],med:[],inv:[],cf:[],ms:[],qs:[]};S.newP=p;form(p,'Add Patient',"saveNew()")}
async function saveNew() {
  const p = S.newP;
  FLD.forEach(f => p[f[0]] = $('f_'+f[0]).value);
  if (!p.name.trim()) { alert('Please enter the required information: patient name.'); return; }
  p.age = +p.age || '';
  syncAliases(p);
  p.docs=p.docs||[]; p.tl=p.tl||[]; p.an=p.an||[]; p.med=p.med||[]; p.inv=p.inv||[]; p.cf=p.cf||[]; p.ms=p.ms||[]; p.qs=p.qs||[];
  try {
    if(!apiLoaded || !firebaseAuth.currentUser){
      throw new Error('Database is not connected. The patient was not saved. Please check the PERISCOPE backend and Supabase connection, then try again.');
    }
    const remote = await createPatientRemote(p);
    if(!remote?.id) throw new Error('The server did not return the saved patient.');
    S.pid = remote.id;
    S.v = 'pts';
    S.tab = 'Overview';
    log('Patient Created','patient','',p.name);
    $('dlg').close();
    render();
    toast('Patient saved and added to the patient list');
  } catch(e) {
    console.error('Could not create patient:', e);
    toast('Could not create patient: '+e.message);
  }
}
const CT=['Admission','Discharge','Follow-up','Diagnosis','Surgery','Anaesthesia','Chemotherapy','Radiotherapy','Immunotherapy','Targeted Therapy','Hospitalization','Investigation','Consultation','Medication','Other'];
function evForm(i){const x=i<0?{d:'',e:'',c:'Surgery',src:'',pg:1,st:'U'}:cur().tl[i];$('dlg').innerHTML=`<h3>${i<0?'Add':'Edit'} timeline event</h3><label for="ed">Date (YYYY-MM-DD)</label><input id="ed" value="${esc(x.d)}"><label for="ee">Event</label><input id="ee" value="${esc(x.e)}"><label for="ec">Category</label><select id="ec">${CT.map(c=>`<option ${c===x.c?'selected':''}>${c}</option>`).join('')}</select><label for="es">Source document</label><input id="es" value="${esc(x.src)}"><div class="row" style="margin-top:14px"><button class="b p" onclick="saveEv(${i})">Save event</button><button class="b" onclick="$('dlg').close()">Cancel</button></div>`;$('dlg').showModal()}
function saveEv(i){const p=cur(),n={d:$('ed').value.trim(),e:$('ee').value.trim(),c:$('ec').value,src:$('es').value.trim()||'Manual entry',pg:1,st:'C',man:true};if(!n.d||!n.e){alert('Please enter the required information: date and event.');return}
 if(i<0){p.tl.push(n);log('Timeline Event Added','event','',n.e)}else{log('Timeline Event Edited','event',p.tl[i].e,n.e);p.tl[i]=Object.assign(p.tl[i],n)}
 p.tl.sort((a,b)=>a.d.localeCompare(b.d));S.ev=null;$('dlg').close();render()}
function delEv(i){log('Timeline Event Deleted','event',cur().tl[i].e,'');cur().tl.splice(i,1);S.ev=null;render()}
function notif(){const l=[];P.forEach(p=>{p.cf.filter(x=>x.st==='Open').forEach(x=>l.push(`⚠ Conflict detected for ${p.id}: ${x.f}`));p.ms.filter(x=>x.st==='Missing').forEach(x=>l.push(`Missing information for ${p.id}: ${x.i}`));p.docs.slice(-1).forEach(d=>l.push(`Document processed for ${p.id}: ${d.n}`))});
 return `<h1>Notifications</h1>${l.map(t=>`<div class="card">${esc(t)}</div>`).join('')||'<div class="card">No new notifications.</div>'}`}
function prof(){return `<h1>Profile</h1><div class="card two"><div><div class="sub">Name</div>${esc(S.u.name)}</div><div><div class="sub">Email</div>${esc(S.u.email||'')}</div><div><div class="sub">Role</div>${esc(S.u.role)}</div><div><div class="sub">Hospital / Department</div>${esc(S.u.dept)||'—'}</div><div><div class="sub">Account status</div>Active</div></div><div class="row"><button class="b" onclick="editProfile()">Edit Profile</button><button class="b" onclick="changePassword()">Change Password</button></div>`}
/* ---------- Profile: edit details + change password ---------- */
const PW_RULE=p=>p.length>=8&&/[A-Za-z]/.test(p)&&/\d/.test(p);
function editProfile(){
  $('dlg').innerHTML=`<h3>Edit profile</h3>
  <div id="pf_err" class="err" role="alert" hidden></div>
  <label for="pf_name">Full name</label><input id="pf_name" value="${esc(S.u.name)}" maxlength="80" autocomplete="name" onkeydown="if(event.key==='Enter')saveProfile()">
  <label for="pf_dept">Hospital / Department</label><input id="pf_dept" value="${esc(S.u.dept)}" maxlength="100" placeholder="e.g. Anaesthesiology" onkeydown="if(event.key==='Enter')saveProfile()">
  <p class="sub" style="margin:10px 0 0">Your email (${esc(S.u.email)}) and role (${esc(S.u.role)}) are managed by your account and cannot be changed here.</p>
  <div class="row" style="margin-top:14px"><button class="b p" id="pf_save" onclick="saveProfile()">Save changes</button><button class="b" onclick="$('dlg').close()">Cancel</button></div>`;
  $('dlg').showModal();
}
async function saveProfile(){
  const err=m=>{const b=$('pf_err');b.textContent=m;b.hidden=false};
  $('pf_err').hidden=true;
  const name=$('pf_name').value.replace(/\s+/g,' ').trim(),dept=$('pf_dept').value.replace(/\s+/g,' ').trim();
  if(name.length<2)return err('Full name must be at least 2 characters.');
  if(name.length>80)return err('Full name must be 80 characters or fewer.');
  if(dept.length>100)return err('Hospital / Department must be 100 characters or fewer.');
  if(name===S.u.name&&dept===(S.u.dept||'')){$('dlg').close();toast('No changes to save');return}
  const btn=$('pf_save');btn.disabled=true;btn.textContent='Saving…';
  try{
    const r=await apiFetch('/api/me',{method:'PUT',body:JSON.stringify({name,dept})});
    const u=r.user||{};
    S.u={...S.u,name:u.name||name,dept:u.dept!==undefined?u.dept:dept};
    try{localStorage.setItem('periscope_dept_'+S.u.uid,S.u.dept||'')}catch(e){}
    $('dlg').close();render();toast('Profile updated');
  }catch(ex){err(ex.message||'Could not save your profile. Please try again.');btn.disabled=false;btn.textContent='Save changes'}
}
function changePassword(){
  $('dlg').innerHTML=`<h3>Change password</h3>
  <div id="pw_err" class="err" role="alert" hidden></div>
  <label for="pw_cur">Current password</label><input id="pw_cur" type="password" autocomplete="current-password">
  <label for="pw_new">New password</label><input id="pw_new" type="password" autocomplete="new-password">
  <label for="pw_new2">Confirm new password</label><input id="pw_new2" type="password" autocomplete="new-password" onkeydown="if(event.key==='Enter')savePassword()">
  <p class="sub" style="margin:8px 0 0">At least 8 characters, including a letter and a number, and different from your current password.</p>
  <div class="row" style="margin-top:14px"><button class="b p" id="pw_save" onclick="savePassword()">Update password</button><button class="b" onclick="$('dlg').close()">Cancel</button></div>`;
  /* wipe the password fields from the DOM however the dialog is closed (button, Esc, success) */
  $('dlg').addEventListener('close',()=>{$('dlg').innerHTML=''},{once:true});
  $('dlg').showModal();
}
async function savePassword(){
  const err=m=>{const b=$('pw_err');b.textContent=m;b.hidden=false};
  $('pw_err').hidden=true;
  const cur=$('pw_cur').value,nw=$('pw_new').value,nw2=$('pw_new2').value;
  if(!cur)return err('Enter your current password.');
  if(!nw)return err('Enter a new password.');
  if(!PW_RULE(nw))return err('New password must be at least 8 characters and include a letter and a number.');
  if(nw!==nw2)return err('New password and confirmation do not match.');
  if(nw===cur)return err('New password must be different from your current password.');
  const user=firebaseAuth.currentUser;
  if(!user||!user.email)return err('Please sign in again.');
  const btn=$('pw_save');btn.disabled=true;btn.textContent='Updating…';
  const reset=()=>{btn.disabled=false;btn.textContent='Update password'};
  try{
    /* verifies the current password with Firebase before anything is changed */
    await user.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(user.email,cur));
  }catch(ex){
    const bad=['auth/wrong-password','auth/invalid-credential','auth/invalid-login-credentials'];
    err(bad.includes(ex.code)?'Current password is incorrect.':firebaseAuthMessage(ex));reset();return;
  }
  try{
    await user.updatePassword(nw);
    $('dlg').close();toast('Password updated. Use your new password next time you sign in.',4200);
  }catch(ex){err(firebaseAuthMessage(ex));reset()}
}
let adminUsersCache=[];
function users(){return `<div class="phead"><div><h1>User Management</h1><p class="sub">Manage hospital accounts and access permissions.</p></div><button class="b" onclick="loadAdminUsers()">Refresh</button></div><div id="admin-users-content" class="card"><p class="sub">Loading users from the live database…</p></div>`}
async function loadAdminUsers(){const host=$('admin-users-content');if(!host||S.v!=='users')return;host.innerHTML='<p class="sub">Loading users…</p>';try{const r=await apiFetch('/api/admin/users');adminUsersCache=r.users||[];if(!host.isConnected||S.v!=='users')return;host.innerHTML=`<div class="row" style="justify-content:space-between;margin-bottom:12px"><b>${adminUsersCache.length} account(s)</b><span class="sub">Changes are saved to Firebase and Supabase.</span></div><div class="tw"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Last login</th><th>Created</th><th>Actions</th></tr></thead><tbody>${adminUsersCache.map(u=>`<tr><td>${esc(u.name||'—')}</td><td>${esc(u.email||'—')}</td><td>${esc(u.role)}</td><td><span class="schip ${u.disabled?'alert':'ok'}">${u.disabled?'Disabled':'Active'}</span></td><td>${u.lastLogin?esc(new Date(u.lastLogin).toLocaleString()):'Never'}</td><td>${u.createdAt?esc(new Date(u.createdAt).toLocaleDateString()):'—'}</td><td><div class="row user-actions"><button class="b sm" onclick="editManagedUser('${esc(u.uid)}')">Edit</button><button class="b sm" onclick="resetManagedPassword('${esc(u.email)}')">Reset password</button><button class="b sm w" ${u.uid===S.u.uid?'disabled title="You cannot delete your own account"':''} onclick="deleteManagedUser('${esc(u.uid)}','${esc(u.name||u.email)}')">Delete</button></div></td></tr>`).join('')||'<tr><td colspan="7">No user accounts found.</td></tr>'}</tbody></table></div>`}catch(e){host.innerHTML=`<p class="msg">${esc(e.message)}</p><button class="b" onclick="loadAdminUsers()">Try again</button>`}}
function editManagedUser(uid){const u=adminUsersCache.find(x=>x.uid===uid);if(!u)return; $('dlg').innerHTML=`<h3>Edit user</h3><label for="um_name">Full name</label><input id="um_name" maxlength="80" value="${esc(u.name)}"><label for="um_email">Email</label><input id="um_email" type="email" value="${esc(u.email)}"><label for="um_role">Role</label><select id="um_role">${['Admin','Doctor','Clinical Assistant'].map(r=>`<option ${u.role===r?'selected':''}>${r}</option>`).join('')}</select><label for="um_dept">Hospital / Department</label><input id="um_dept" maxlength="100" value="${esc(u.department)}"><p class="sub">Email changes update the Firebase sign-in email and require the user to verify the new address.</p><div class="row" style="margin-top:14px"><button class="b p" id="um_save" onclick="saveManagedUser('${esc(uid)}')">Save changes</button><button class="b" onclick="$('dlg').close()">Cancel</button></div>`;$('dlg').showModal()}
async function saveManagedUser(uid){const b=$('um_save');b.disabled=true;b.textContent='Saving…';try{await apiFetch('/api/admin/users/'+encodeURIComponent(uid),{method:'PUT',body:JSON.stringify({name:$('um_name').value,email:$('um_email').value,role:$('um_role').value,department:$('um_dept').value})});$('dlg').close();toast('User details updated');await loadAdminUsers()}catch(e){toast(e.message,4000);b.disabled=false;b.textContent='Save changes'}}
async function resetManagedPassword(email){if(!email)return toast('This account has no email address.');if(!confirm(`Send a password reset email to ${email}?`))return;try{await firebaseAuth.sendPasswordResetEmail(email);toast('Password reset email sent to '+email,4000)}catch(e){toast(firebaseAuthMessage(e),4000)}}
async function deleteManagedUser(uid,label){if(!confirm(`Permanently delete the account for ${label}? This removes its Firebase login and user profile. Patient records are not automatically deleted.`))return;try{await apiFetch('/api/admin/users/'+encodeURIComponent(uid),{method:'DELETE'});toast('User account deleted');await loadAdminUsers()}catch(e){toast(e.message,4000)}}
render();
const PAC=(()=>{
const q=id=>document.getElementById(id),YN=['Yes','No'],TD=()=>new Date().toISOString().slice(0,10);
const FIT=['Accepted for Anaesthesia — With Accepted Risk','Not Accepted / Not Cleared','Optimisation Required','Further Specialist Consultation Required','Further Investigation Required'];
const FIN=['Accepted for Anaesthesia','Not Cleared','Optimisation Required','Further Specialist Consultation Required','Further Investigation Required'];
const docs=()=>[...new Set(['','Dr. Meera Nair',S.u&&S.u.role=='Doctor'?S.u.name:''])];
const yn=(id,l)=>[id,l,'r',YN],nt=id=>[id,'Notes / Remarks','a',,1];
const INV={Blood:['Blood Group & RH','Haemoglobin','Platelet Count','Total Leucocyte Count','Differential Count','Neutrophil Count','Lymphocyte Count','Absolute Neutrophil Count'],Liver:['Bilirubin (Direct/Indirect)','SGOT','SGPT','ALP','Serum Albumin','Serum Globulin','Serum Proteins'],Coagulation:['Bleeding Time','Clotting Time','PT','INR','aPTT','TT','Fibrinogen'],Other:['CRP','Procalcitonin / Lactate','Serum Creatinine','Blood Urea','BUN / Uric Acid','Sodium','Potassium','Chloride','Calcium','Magnesium','Phosphate','RBS','FBS','PPBS','NT-ProBNP'],'Thyroid (optional)':['Free T3','Free T4','TSH','Anti-TG','Anti-TPO'],'Viral Markers':['HIV','HBsAg','HCV'],'Other Investigations':['ECG','X-Ray / USG','2D Echo','Stress Test','6 Minute Walk Test','CPET','Pulmonary Function Test','Arterial Blood Gas','CT / MRI','V/Q Scan','DL Scopy']};
const SUB=['Drugs','Alcohol','Betel Nut','Tobacco','Smoking'],ACT=['Investigation','Optimisation','Specialist Consultation','Medical Review','Previous Record Required','Other'],AST=['Pending','In Progress','Completed','Not Required'];
const SEC=[
{t:'General Details',f:[['pactype','PAC Type','r',['PAC','Review PAC']],['ward','Ward','t'],['caseno','Case Number','t'],['height','Height (cm)','n'],['weight','Weight (kg)','n'],['bmi','BMI (auto)','bmi'],['anaes','Evaluating Anaesthesiologist','s'],['unit','Unit Name','t'],['doc','Treating Doctor','t'],['proc','Name of Procedure','t'],['dos','Date of Surgery','d'],['nature','Nature of Surgery','r',['Urgent','Emergency','Elective']]],custom:'bg'},
{t:'Vitals',f:[['vdate','Date','d'],['temp','Temperature (°C)','t'],['pulse','Pulse (/min)','n'],['bp','Blood Pressure (mmHg)','t'],['spo2','SpO₂ (%)','n'],nt('n_vit')]},
{t:'Physical Examination',f:[['gc','General Condition','r',['Good','Fair','Poor']],['breath','Breathing Pattern','r',['Normal','Tachypnoea','Bradypnoea','Obstructed','Noisy Breathing','Stridor']],['orient','Orientation','r',['Normal','Confused','Very Poor','Agitated']],yn('pallor','Pallor'),yn('icterus','Icterus'),yn('cyan','Cyanosis'),yn('club','Clubbing'),yn('lymph','Lymphadenopathy'),yn('edema','Pedal Edema'),yn('lrti','LRTI'),yn('urti','URTI'),nt('n_phys')]},
{t:'Comorbidities',f:[['htn','Hypertension','a'],['dm','Diabetes Mellitus','a'],['card','Cardiac','a',,,'IHD / CHF / Any other'],['resp','Respiratory','a',,,'Asthma / TB / COPD'],['nerv','Nervous System','a',,,'Epilepsy / Stroke / Others'],['renal','Renal','a',,,'AKI / CKD / Others'],['thy','Thyroid Disorder','a'],['chemo','Chemotherapy Drugs','a'],['rt','Radiotherapy','a'],['surg','History of Surgeries','a'],['transf','Transfusion / Blood Disorders','a'],['pain','Acute / Chronic Pain','a'],['allergy','Drug Allergies','a'],['othmed','Other Relevant Medical History','a'],['sb','STOP-BANG / Obesity (no auto-diagnosis)','c',['Gender — Male','Neck circumference >40 cm','Age >50 years','BMI >35 kg/m²','High blood pressure','Observed apnoea','Tiredness','Snoring']],nt('n_com')]},
{t:'Substance History',custom:'sub'},
{t:'Airway',f:[['nares','Nares','r',['Normal','Abnormal']],['dns','Deviated Nasal Septum','r',['Normal','Right','Left','Post Surgical']],['mouth','Mouth Opening','r',['>4 cm','3–4 cm','<3 cm']],['teeth','Teeth','c',['Normal','Edentulous','Protruding','Artificial','Buck','Loose Tooth']],['mall','Mallampati','r',['0','1','2','3','4','NA']],['jaw','Jaw Sliding','r',['+1','0','-1']],['tmd','Thyromental Distance','r',['>7.5 cm','6–7.5 cm','<6 cm']],['neck','Neck','t'],['spine','Spine','t'],yn('trach','Tracheostomy'),['airc','Airway Comments','a',,1]]},
{t:'Systemic Examination',f:[['cvs','Cardiovascular System','a'],['rs','Respiratory System','a'],['abd','Abdominal System','a'],['cns','Central Nervous System','a']]},
{t:'Investigations',custom:'inv'},{t:'Specialty Reference',custom:'ref'},
{t:'ASA / Risk',f:[['asa','ASA Physical Status (clinician-entered)','r',['I','II','III','IV','V','VI']],['asae','Emergency modifier','r',['E']]]},
{t:'Fitness Status',f:[['fit','PAC Fitness Status','r',FIT],['assess','Anaesthesiologist\'s Assessment / Remarks','a',,1,'Enter clinical assessment, pending concerns, optimisation requirements or other remarks.']]},
{t:'Consent',f:[['consent','Anaesthesia Consent','r',YN],['cdate','Date','d']]},
{t:'Pending Actions',custom:'act'},{t:'Consultations',custom:'con'},
{t:'Anaesthesiologist Advice',f:[['advice','Other Anaesthesiologist Advice','a']],custom:'fast'},
{t:'Proposed Anaesthesia Plan',lbl:'Clinician-entered proposed anaesthesia plan',f:[['plan','Proposed Plan','a'],['cons','Additional Anaesthesia Considerations','a'],['equip','Equipment / Preparation Notes','a'],['othadv','Other Anaesthesiologist Advice','a']]},
{t:'Final Review',custom:'fin'},{t:'Approval / Sign-off',custom:'sign'}];
let Z,pp,D,acts,cons,revs,rd,sec=0,st,done,msg='',err=[],PV,SR={},curId=null,dirty=false;
const PAC_DEBUG=()=>{try{return localStorage.getItem('periscope_pac_debug')==='1'}catch(_){return false}},dbg=(...a)=>{if(PAC_DEBUG())console.log('[PAC]',...a)};
const today=TD();
function seed(p){const f=c=>p.tl.filter(x=>x.c==c&&!/^Planned/.test(x.e)),j=a=>a.map(x=>x.e+' ('+x.d+')').join('; ');
const histText=String(p.hist||''); const comText=String(p.comorbidities||''); const allHist=(comText+'; '+histText).trim();
const has=(re)=>re.test(allHist);
const d={pactype:'PAC',proc:p.surg,dos:p.date,vdate:today,chemo:j(f('Chemotherapy')),rt:j(f('Radiotherapy')),surg:j(f('Surgery')),allergy:p.allergy=='Not documented'?'':p.allergy,
htn:has(/\bhypertension\b/i)?(allHist.match(/[^.;]*(?:hypertension)[^.;]*/i)||['Hypertension'])[0].trim():'',
dm:has(/\bdiabetes(?: mellitus)?\b/i)?(allHist.match(/[^.;]*(?:diabetes(?: mellitus)?)[^.;]*/i)||['Diabetes Mellitus'])[0].trim():'',
othmed:''};
const M={
  'Haemoglobin':x=>/\b(?:Hb|Haemoglobin|Hemoglobin)\b/i.test(x.r)?x.r:'',
  'Platelet Count':x=>/\bplatelets?\b/i.test(x.r)?x.r:'',
  'Total Leucocyte Count':x=>/\b(?:WBC|white blood|total leucocyte|total leukocyte)\b/i.test(x.r)?x.r:'',
  'Serum Creatinine':x=>/\bcreatinine\b/i.test(x.r)?x.r:'',
  'Blood Urea':x=>/\b(?:blood urea|urea)\b/i.test(x.r)?x.r:'',
  'ECG':x=>/\becg\b/i.test(x.r)?x.r:'',
  'X-Ray / USG':x=>/\b(?:x[- ]?ray|ultrasound|usg|mammograph|mammogram)\b/i.test(x.r)?x.r:'',
  'CT / MRI':x=>/\b(?:ct|mri)\b/i.test(x.r)?x.r:'',
  'Core Biopsy':x=>/\b(?:core biopsy|biopsy)\b/i.test(x.r)?x.r:''
};
const used=[];
Object.entries(INV).forEach(([g,ts])=>ts.forEach((t,i)=>{const fn=M[t];const x=fn&&p.inv.find(z=>fn(z));if(x){const k='inv_'+g+i;d[k+'v']=x.r;d[k+'d']=x.d;d[k+'s']=x.src+' · '+STL[x.st];used.push(x)}}));
const remaining=p.inv.filter(x=>!used.includes(x));
if(remaining.length)d.n_inv=remaining.map(x=>`${x.d||''} ${x.t}: ${x.r}`.trim()).join('\n');
Object.keys(d).forEach(k=>d[k]===''&&delete d[k]);return d}
function bind(p){pp=p;Z=p.pac;Z.D=Z.D||{};Z.acts=Z.acts||[];Z.cons=Z.cons||[];Z.revs=Z.revs||[];Z.rd=Z.rd||{};Z.rdAt=Z.rdAt||{};Z.P=Z.P||{...Z.D};
D=Z.D;acts=Z.acts;cons=Z.cons;revs=Z.revs;rd=Z.rd;st=Z.st||'Draft';done=!!Z.done;PV=Z.P}
/* init() runs on every render. It re-binds the module to the CURRENT patient object (P entries are replaced by
   server copies after each save), but the active section, messages and errors live in module state so a save /
   re-render / refresh can never reset them. The saved section is only used when a different patient is opened. */
function init(p){if(!p.pac){p.pac={D:seed(p),acts:[],cons:[],revs:[],rd:{},rdAt:{},sec:0,st:'Draft',done:false,reviewed:false,reviewedAt:null};p.pac.P={...p.pac.D}}
const first=curId!==p.id;bind(p);if(first){curId=p.id;sec=Math.min(Math.max(+Z.sec||0,0),SEC.length-1);msg='';err=[];dirty=false}}
function srcs(p){const f=c=>p.tl.find(x=>x.c==c&&!/^Planned/.test(x.e)),t=x=>x?`${x.src} p${x.pg} · ${STL[x.st]}`:'',r={},set=(k,s)=>{if(D[k]&&s)r[k]='✓ Auto-filled · '+s};
set('proc','Patient record');set('dos','Patient record');set('chemo',t(f('Chemotherapy')));set('rt',t(f('Radiotherapy')));set('surg',t(f('Surgery')));if(D.allergy)r.allergy=p.cf.some(c=>c.f=='Allergy'&&c.st=='Open')?'⚠ Auto-filled · Conflicting records (see Conflicts tab) — please verify':'✓ Auto-filled · Patient record';return r}
const sync=()=>{Z.sec=sec;Z.st=st;Z.done=done;Z.P=JSON.parse(JSON.stringify(D));Z.reviewed=Object.values(rd).some(Boolean);if(!Z.reviewed)Z.reviewedAt=null;delete Z.msg;delete Z.err},rr=()=>{sync();render()};
/* Persist the complete PAC state to Supabase through the existing patient API and wait for the result. */
async function persist(tag){sync();dbg(tag,'state before save',JSON.parse(JSON.stringify(Z)),'section',sec);
const ok=await savePatientNow(pp);
if(!ok){console.error('[PAC] save failed ('+tag+'):',lastSaveError());return{ok:false,error:lastSaveError()||'Unknown error'}}
const np=cur();if(np&&np.pac)bind(np);dirty=false;dbg(tag,'saved patient.data.pac',np&&np.pac,'section',sec);return{ok:true}}
const fail=(what,r)=>show([what+': '+r.error]);
const L=(s,f,o,n)=>log('PAC · '+s,f,o,n),bmi=()=>{const h=D.height/100,w=+D.weight;return h>0&&w>0?(w/h/h).toFixed(1):'—'};
const openA=()=>acts.filter(a=>a.status=='Pending'||a.status=='In Progress');
function status(){if(done)return'Completed';if(revs.length&&openA().length)return'Awaiting Actions';if(st=='Awaiting Actions')return'Ready for Final Review';return st}
function fld(x){const[id,l,t,o,big,ph]=x,v=D[id],w=(t=='a'||t=='c'||big)?' wide':'';let h='';
if(t=='r'||t=='s'){const os=o||docs();h=`<select data-k="${id}"><option value="">— Select —</option>${os.filter(Boolean).map(z=>`<option value="${esc(z)}" ${v==z?'selected':''}>${esc(z)}</option>`).join('')}</select>`}
else if(t=='c')h=`<details class="ms"><summary data-s="${id}">${esc((v||[]).join(', '))||'— Select one or more —'}</summary><div class="opts">${o.map(z=>`<label><input type="checkbox" data-k="${id}" value="${esc(z)}" ${(v||[]).includes(z)?'checked':''}>${esc(z)}</label>`).join('')}</div></details>`;
else if(t=='a')h=`<textarea data-k="${id}" placeholder="${esc(ph||'')}">${esc(v)}</textarea>`;
else if(t=='bmi')h=`<b id="pbmi" style="font-size:20px">${bmi()}</b>`;
else h=`<input type="${t=='n'?'number':t=='d'?'date':'text'}" data-k="${id}" value="${esc(v)}">`;
return`<div class="f${w}"><label class="l">${esc(l)}</label>${h}${SR[id]?`<div class="src">${esc(SR[id])} · <u>View Source</u></div>`:''}</div>`}
const tbl=(hd,rows)=>`<div class="tw"><table class="ptb"><tr>${hd.map(h=>`<th>${h}</th>`).join('')}</tr>${String(rows).replace(/<tr>([\s\S]*?)<\/tr>/g,(m,inner)=>{let i=0;return'<tr>'+inner.replace(/<td(?=[\s>])/g,()=>`<td data-label="${esc(String(hd[i++]||'').replace(/<[^>]*>/g,''))}"`)+'</tr>'})}</table></div>`;
const bg=p=>`<h3 class="h">Background from PERISCOPE records</h3>`+(p.an.length?tbl(['Date','Previous anaesthesia','Documented event','Source','Status'],p.an.map(x=>`<tr><td>${x.d}</td><td>${esc(x.s)} — ${esc(x.a)}</td><td>${esc(x.ev)}</td><td>${esc(x.src)}</td><td>${tag(x.st)}</td></tr>`).join('')):'<p class="sub">No previous anaesthesia documented.</p>')+(p.med.length?tbl(['Medication','Dose','Frequency','Source','Status'],p.med.map(x=>`<tr><td>${esc(x.m)}</td><td>${nd(x.dose)}</td><td>${nd(x.freq)}</td><td>${esc(x.src)}</td><td>${tag(x.st)}</td></tr>`).join('')):'')+`<p class="sub">${p.cf.filter(x=>x.st=='Open').length} open conflict(s) · ${p.ms.filter(x=>x.st=='Missing').length} missing item(s) · ${p.qs.filter(x=>x.st=='Open').length} open question(s) — see the Conflicts, Missing Information and Questions tabs.</p>`;
function custom(c){
if(c=='bg')return bg(pp);
if(c=='sub')return tbl(['Substance','Present / History','Duration','Remarks'],SUB.map(s=>`<tr><td>${s}</td><td><select data-k="sub_${s}_p">${['','Present','History','None'].map(o=>`<option ${D['sub_'+s+'_p']==o?'selected':''}>${o}</option>`).join('')}</select></td><td><input type="text" data-k="sub_${s}_d" value="${esc(D['sub_'+s+'_d'])}"></td><td><input type="text" data-k="sub_${s}_r" value="${esc(D['sub_'+s+'_r'])}"></td></tr>`).join(''))+'<p class="sub">Duration is required where Present / History is marked.</p>';
if(c=='inv')return'<p class="sub">Results are shown as documented or entered. PERISCOPE does not interpret values; interpretation is clinician-entered.</p>'+Object.entries(INV).map(([g,ts])=>`<h3 class="h">${g}</h3>`+tbl(['Test','Value / Unit','Date','Source','Clinician interpretation'],ts.map((t,i)=>{const k='inv_'+g+i;return`<tr><td>${t}${D[k+'v']?'':' <span class="warn">· missing</span>'}</td>${['v','d','s','i'].map(f=>`<td><input type="${f=='d'?'date':'text'}" data-k="${k+f}" value="${esc(D[k+f])}"></td>`).join('')}</tr>`}).join(''))).join('')+fld(['n_inv','Notes / Remarks','a']);
if(c=='ref')return`<div class="g"><div class="f"><label class="l">Refer to Specialty</label><select id="rsp" onchange="PAC.oth(this)"><option></option>${['Cardiology','Pulmonology','Endocrinology','Nephrology','Neurology','Haematology','Medicine','Other'].map(o=>`<option>${o}</option>`).join('')}</select></div><div class="f" id="rsow" style="display:none"><label class="l">Specify other specialty</label><input type="text" id="rso" placeholder="e.g. Psychiatry"></div><div class="f"><label class="l">Referral Doctor (name)</label><input type="text" id="rdoc" placeholder="Doctor / consultant name"></div><div class="f"><label class="l">Referral Date</label><input type="date" id="rdt" value="${TD()}"></div><div class="f wide"><label class="l">Reason for Referral</label><textarea id="rrs"></textarea></div></div><p class="row"><button class="b p" onclick="PAC.addRef()">Add referral (creates linked pending action)</button></p><p class="sub">Referrals and specialist advice are managed in the Consultations section.</p>`;
if(c=='act')return`<div class="g"><div class="f"><label class="l">Action Type</label><select id="at">${ACT.map(o=>`<option>${o}</option>`).join('')}</select></div><div class="f"><label class="l">Assigned To</label><input type="text" id="aw"></div><div class="f"><label class="l">Due Date</label><input type="date" id="ad"></div><div class="f wide"><label class="l">Action / Requirement</label><textarea id="ar"></textarea></div></div><p class="row"><button class="b p" onclick="PAC.addAct()">Add action</button></p><h3 class="h">Actions</h3>`+(acts.length?tbl(['Type','Requirement','Assigned','Due','Raised in','Status','Notes'],acts.map((a,i)=>`<tr><td>${a.type}</td><td>${esc(a.req)}</td><td>${esc(a.who)}</td><td>${a.due||'—'}</td><td>Review ${a.rv}</td><td><select onchange="PAC.setAct(${i},this.value)" ${done?'disabled':''}>${AST.map(o=>`<option ${a.status==o?'selected':''}>${o}</option>`).join('')}</select></td><td><input type="text" value="${esc(a.note)}" onchange="PAC.note(${i},this.value)"></td></tr>`).join('')):'<p class="sub">No actions yet.</p>')+`<div class="rv noprint"><button class="b p" onclick="PAC.ret()">Return to PAC Review</button> <span class="sub">Enabled when no action is Pending / In Progress.</span></div>`+fld(['n_act','Notes / Remarks','a']);
if(c=='con')return(cons.length?tbl(['Date','Specialty','Doctor','Reason','Specialist advice / remarks','Status'],cons.map((c,i)=>`<tr><td>${c.date}</td><td>${esc(c.sp)}</td><td>${esc(c.doc)||'—'}</td><td>${esc(c.rs)}</td><td><textarea onchange="PAC.adv(${i},this.value)">${esc(c.adv)}</textarea></td><td><select onchange="PAC.setCon(${i},this.value)">${['Requested','Pending','Completed','Follow-up Required'].map(o=>`<option ${c.status==o?'selected':''}>${o}</option>`).join('')}</select></td></tr>`).join('')):'<p class="sub">No consultations. Add one from Specialty Reference.</p>')+fld(['n_con','Notes / Remarks','a']);
if(c=='fast')return`<div class="fast"><b>Fasting guidelines prior to surgery:</b><br>2 hours for clear liquids.<br>8 hours for heavy meal.<br>6 hours for light meal / formula feeds.<br>4 hours for breast feeding.</div>`;
if(c=='sign'){const a=S.audit.filter(x=>x.pt==pp.id&&/^PAC/.test(x.a));return`<div class="g"><div class="f"><label class="l">Anaesthesiologist's Name</label><b>${esc(D.anaes)||'— select in General Details —'}</b></div><div class="f"><label class="l">E-signature (type full name)</label><input type="text" data-k="esign" value="${esc(D.esign)}" style="font-style:italic"></div><div class="f"><label class="l">Date</label><input type="date" data-k="sdate" value="${esc(D.sdate||TD())}"></div></div><h3 class="h">PAC audit trail</h3>`+(a.length?tbl(['Time','User','Role','Action','Field','Previous','New'],a.slice(0,40).map(x=>`<tr><td>${x.t}</td><td>${esc(x.u)}</td><td>${esc(x.r)}</td><td>${esc(x.a)}</td><td>${esc(x.f)}</td><td>${esc(x.o)}</td><td>${esc(x.n)}</td></tr>`).join('')):'<p class="sub">No PAC changes yet.</p>')}
if(c=='fin')return summary()}
function dump(){return SEC.map(s=>{if(!s.f)return'';const r=s.f.filter(f=>f[2]!='bmi'&&D[f[0]]&&D[f[0]].length).map(f=>`<b>${esc(f[1])}</b><span>${esc([].concat(D[f[0]]).join(', '))}${SR[f[0]]?` <span class="src">· ${esc(SR[f[0]])}</span>`:''}</span>`).join('');return r?`<h3 class="h">${s.t}</h3><div class="kv">${r}</div>`:''}).join('')}
function summary(){const o=openA(),last=revs[revs.length-1],inv=Object.entries(INV).flatMap(([g,ts])=>ts.map((t,i)=>[t,'inv_'+g+i])).filter(([t,k])=>D[k+'v']),miss=['ECG','Haemoglobin','Serum Creatinine'].filter(n=>!inv.some(x=>x[0]==n));
const diff=last?Object.keys(D).filter(k=>JSON.stringify(D[k])!=JSON.stringify(last.d[k])).map(k=>`<tr><td>${esc(k)}</td><td>${esc([].concat(last.d[k]||'—').join(', '))}</td><td>${esc([].concat(D[k]||'—').join(', '))}</td></tr>`).join(''):'';
return`<div class="g" style="margin-bottom:10px">${fld(['final','Final Anaesthesia Status (clinician-entered)','r',FIN])}${fld(['fdate','Final Review Date','d'])}${fld(['fremarks','Final Remarks','a'])}</div>
<div class="kv"><b>Patient</b><span>${esc(pp.name)} · ${pp.id} · ${pp.age}y ${pp.sex} · BMI ${bmi()}</span><b>Cancer</b><span>${esc(pp.dx)} · ${esc(pp.stage)||'stage not documented'}</span><b>Procedure</b><span>${esc(D.proc)} · ${esc(D.dos)} · ${esc(D.nature)||'—'}</span><b>ASA</b><span>${esc(D.asa||'—')}${D.asae?' E':''} (clinician-entered)</span><b>Fitness</b><span>${esc(D.fit||'—')}</span><b>Consent</b><span>${esc(D.consent||'—')} ${esc(D.cdate||'')}</span><b>Reviews</b><span>${revs.length} submitted</span></div>
<h3 class="h">Open items</h3>${o.length||miss.length?`<ul>${o.map(a=>`<li class="warn">⚠ ${a.type}: ${esc(a.req)} — ${a.status}</li>`).join('')}${miss.map(m=>`<li class="warn">⚠ No ${m} on file</li>`).join('')}</ul>`:'<p>✓ No unresolved items</p>'}${acts.filter(a=>!o.includes(a)).map(a=>`<div>✓ ${a.type}: ${esc(a.req)} — ${a.status}</div>`).join('')}
<h3 class="h">Journey timeline</h3><div>${revs.map(r=>`<span class="chip">Review ${r.n} · ${r.date} · ${esc(r.by)}</span>`).join('→ ')||'<span class="sub">No reviews submitted yet</span>'}${cons.map(c=>` → <span class="chip">${esc(c.sp)} (${c.status})</span>`).join('')}</div>
${revs.length?`<h3 class="h">Review history</h3>`+tbl(['Review','Date','By','Outcome','Actions open'],revs.map(r=>`<tr><td>${r.n}</td><td>${r.date}</td><td>${esc(r.by)}</td><td>${esc(r.out||'Further evaluation')}</td><td>${r.open}</td></tr>`).join('')):''}
${diff?`<h3 class="h">Changes since Review ${last.n}</h3>`+tbl(['Field','Previous','Current'],diff):''}${bg(pp)}
<h3 class="h">Investigations on file</h3>${inv.length?tbl(['Test','Value','Date','Source','Interpretation'],inv.map(([t,k])=>`<tr><td>${t}</td><td>${esc(D[k+'v'])}</td><td>${esc(D[k+'d'])}</td><td>${esc(D[k+'s'])}</td><td>${esc(D[k+'i'])}</td></tr>`).join('')):'<p class="sub">None entered</p>'}
<h3 class="h">Consultations</h3>${cons.length?tbl(['Date','Specialty','Doctor','Reason','Advice','Status'],cons.map(c=>`<tr><td>${c.date}</td><td>${esc(c.sp)}</td><td>${esc(c.doc)||'—'}</td><td>${esc(c.rs)}</td><td>${esc(c.adv)||'Pending'}</td><td>${c.status}</td></tr>`).join('')):'<p class="sub">None</p>'}${dump()}<p class="row noprint"><button class="b p" onclick="downloadPacPDF()">Download PAC Summary (PDF)</button></p>`}
function chk(m){const r=[],g=k=>D[k]&&String(D[k]).trim();
if(!g('anaes'))r.push('Evaluating anaesthesiologist');if(!g('proc')||!g('dos')||!g('nature'))r.push('Procedure, surgery date, nature of surgery');
if(!g('height')||!g('weight'))r.push('Height and weight (not in patient record)');if(!g('vdate')||!g('pulse')||!g('bp')||!g('spo2'))r.push('Vitals (date, pulse, BP, SpO₂)');
if(!g('gc'))r.push('General condition');if(!g('mouth')||!g('mall')||!g('tmd'))r.push('Airway: mouth opening, Mallampati, thyromental distance');
if(!g('allergy'))r.push('Drug allergies (enter “None known” if none)');
SUB.forEach(s=>{if((D['sub_'+s+'_p']=='Present'||D['sub_'+s+'_p']=='History')&&!g('sub_'+s+'_d'))r.push('Duration for '+s)});
if(D.cdate&&D.cdate>TD())r.push('Consent date cannot be in the future');
if(m=='final'){[0,1,2,3,4,5,6,7,9,10,11,14].forEach(i=>{if(!rd[i])r.push('Mark reviewed: '+SEC[i].t)});
if(!D.asa)r.push('ASA grade');if(!D.fit)r.push('PAC Fitness Status');if(!D.final)r.push('Final Anaesthesia Status');if(!g('assess'))r.push('Anaesthesiologist\'s assessment');if(!g('fremarks'))r.push('Final remarks');if(!D.consent||!D.cdate)r.push('Consent Yes/No with date');
if(D.final=='Accepted for Anaesthesia'&&!g('plan'))r.push('Proposed anaesthesia plan');if(D.fit&&D.final&&FIN[FIT.indexOf(D.fit)]!=D.final)r.push('Fitness Status and Final Status contradict each other');
if(D.final=='Accepted for Anaesthesia'&&openA().length)r.push('Close open pending actions before accepting');
if(!g('esign')||!D.anaes)r.push('E-signature by anaesthesiologist');if(S.u.role!='Doctor')r.push('Finalizing requires a Doctor login')}return r}
const snap=()=>revs.push({n:revs.length+1,date:new Date().toLocaleDateString('en-GB'),by:D.anaes||S.u.name,out:D.final||D.fit,open:openA().length,d:JSON.parse(JSON.stringify(D))});
function show(e,m){err=e||[];msg=m||'';rr();scrollTo(0,0)}
function data(p){const z=p.pac,B=[];if(!z)return B;const d=z.D,g=k=>[].concat(d[k]||[]).join(', '),open=z.acts.filter(a=>a.status=='Pending'||a.status=='In Progress');
B.push({h:'PAC status & sign-off',r:[['Status',stat(p)+(z.revs.length?' ('+z.revs.length+' review(s) submitted)':'')],['Final anaesthesia status (clinician-entered)',g('final')||'Not entered'],['Final remarks',g('fremarks')||'—'],['Signed by',d.esign?d.esign+(d.anaes?' ('+d.anaes+')':'')+' '+(d.sdate||''):'Not signed']]});
SEC.forEach(s=>{if(!s.f)return;const r=s.f.filter(f=>f[2]!='bmi'&&g(f[0])).map(f=>[f[1],g(f[0])]);if(s.t=='General Details'&&d.height&&d.weight){const h=d.height/100;r.push(['BMI',(d.weight/h/h).toFixed(1)])}if(s.t=='Anaesthesiologist Advice')['2 hours for clear liquids','8 hours for heavy meal','6 hours for light meal / formula feeds','4 hours for breast feeding'].forEach(x=>r.push(['Fasting guideline',x]));if(r.length)B.push({h:s.t,r})});
const su=SUB.filter(x=>d['sub_'+x+'_p']).map(x=>[x,[d['sub_'+x+'_p'],d['sub_'+x+'_d'],d['sub_'+x+'_r']].filter(Boolean).join(' · ')]);if(su.length)B.push({h:'Substance history',r:su});
const iv=Object.entries(INV).flatMap(([gr,ts])=>ts.map((t,i)=>[t,'inv_'+gr+i])).filter(([t,k])=>d[k+'v']).map(([t,k])=>[t,[d[k+'v'],d[k+'d'],d[k+'s'],d[k+'i']?'Interpretation: '+d[k+'i']:''].filter(Boolean).join(' · ')]);if(iv.length)B.push({h:'PAC investigations (as documented)',r:iv});
if(z.cons.length)B.push({h:'Specialist consultations',r:z.cons.map(c=>[c.date+' · '+c.sp+(c.doc?' ('+c.doc+')':'')+' · '+c.status,c.rs+(c.adv?' — Advice: '+c.adv:'')])});
if(z.acts.length)B.push({h:'Pending actions / optimisation',r:z.acts.map(a=>[a.type+' · '+a.status,a.req+(a.who?' — '+a.who:'')+(a.due?' — due '+a.due:'')])});
if(z.revs.length)B.push({h:'PAC review history',r:z.revs.map(r=>['Review '+r.n+' · '+r.date,(r.by||'')+' · '+(r.out||'Further evaluation')+' · '+r.open+' action(s) open'])});
return B}
function stat(p){const z=p.pac;if(!z)return'Not started';const o=z.acts.some(a=>a.status=='Pending'||a.status=='In Progress');return z.done?'Completed':z.revs.length&&o?'Awaiting Actions':z.st=='Awaiting Actions'?'Ready for Final Review':z.st}
const briefH=(p,n)=>{const B=data(p);return`<div class="card" style="break-inside:auto"><h3>${n}. Pre-Anaesthesia Check-Up (PAC)</h3>${B.length?B.map(b=>`<h4 style="margin:12px 0 4px">${esc(b.h)}</h4><table>${b.r.map(r=>`<tr><td style="width:34%"><b>${esc(r[0])}</b></td><td>${esc(r[1])}</td></tr>`).join('')}</table>`).join(''):'<p class="sub">PAC not started for this patient.</p>'}</div>`};
function view(p){init(p);SR=srcs(p);const stt=status(),ch=[...new Set(openA().map(a=>({Investigation:'Awaiting Investigation',Optimisation:'Pending Optimisation','Specialist Consultation':'Specialist Consultation Required'}[a.type]||'Other action open')))],n=Object.values(rd).filter(Boolean).length,s=SEC[sec];
const top=(err.length?`<div class="msg"><b>${err.length} item${err.length>1?'s':''} need attention:</b><ul>${err.map(e=>`<li>${esc(e)}</li>`).join('')}</ul></div>`:'')+(msg?`<div class="msg ok">${esc(msg)}</div>`:'');
return`<div class="pac"><div class="card"><div class="row"><h2 style="margin:0">Pre-Anaesthesia Check-Up</h2><span class="chip s">${stt}${revs.length?' · '+revs.length+' review(s)':''}</span>${ch.map(c=>`<span class="chip w">${c}</span>`).join('')}${Z.reviewed?`<span class="chip s" title="Last reviewed ${esc(Z.reviewedAt||'')}">Reviewed · ${n} section(s)</span>`:''}</div>
<div class="sub" style="margin-top:6px">${esc(p.name)} · ${p.id} · ${p.age}y</div>
<div class="pacwrap"><div class="pnav">${SEC.map((x,i)=>`<button class="${i==sec?'on':''}" onclick="PAC.go(${i})"><i>${i+1}</i>${x.t}<u>${rd[i]?'✓':''}</u></button>`).join('')}</div>
<div class="pmain">${top}<div class="card"><h2 style="margin-top:0">${sec+1}. ${s.t}</h2>${s.lbl?`<p class="sub"><b>${s.lbl}</b> — not AI-generated.</p>`:''}<fieldset style="border:0;padding:0;margin:0" ${done?'disabled':''}>${s.f?`<div class="g">${s.f.map(f=>fld(f)).join('')}</div>`:''}${s.custom?custom(s.custom):''}</fieldset>${s.custom=='fin'?'':`<p><label style="font-weight:400"><input type="checkbox" style="width:auto" ${rd[sec]?'checked':''} onchange="PAC.rev(this.checked)"> Mark this section as reviewed</label>${rd[sec]&&Z.rdAt&&Z.rdAt[sec]?` <span class="sub">✓ Reviewed ${esc(new Date(Z.rdAt[sec]).toLocaleString())}</span>`:''}</p>`}</div>
<div class="row noprint"><button class="b" onclick="PAC.save()">Save Draft</button><button class="b" onclick="PAC.next()">Save &amp; Continue</button><button class="b p" onclick="PAC.submit()">Submit for Review</button><button class="b" onclick="PAC.ret()">Return for Reassessment</button>${done?'<button class="b" onclick="PAC.reopen()">Reopen PAC</button>':''}<button class="b s" onclick="PAC.fin()">Finalize PAC</button></div></div></div></div>`}
const val=el=>el.type=='checkbox'?[...document.querySelectorAll(`.pac input[type=checkbox][data-k="${el.dataset.k}"]:checked`)].map(x=>x.value):el.value;
document.addEventListener('input',e=>{const el=e.target,k=el.dataset&&el.dataset.k;if(!k||!D||!el.closest('.pac'))return;D[k]=val(el);dirty=true;if(k=='height'||k=='weight'){const b=q('pbmi');if(b)b.textContent=bmi()}});
document.addEventListener('change',e=>{const el=e.target,k=el.dataset&&el.dataset.k;if(!k||!D||!el.closest('.pac'))return;D[k]=val(el);dirty=true;const o=[].concat(PV[k]??'').join(', '),n=[].concat(D[k]).join(', ');if(o!=n)L(SEC[sec].t,k,o,n);PV[k]=D[k];const sm=document.querySelector(`summary[data-s="${k}"]`);if(sm)sm.textContent=n||'— Select one or more —'});
return{view,data,stat,brief:briefH,
go:i=>{dbg('section change',sec,'->',i);sec=Math.min(Math.max(+i||0,0),SEC.length-1);msg='';err=[];rr()},
rev:async c=>{const s0=sec,was=rd[s0],wasAt=Z.rdAt[s0],wasTop=[Z.reviewed,Z.reviewedAt];rd[s0]=!!c;Z.rdAt[s0]=c?new Date().toISOString():null;if(c){Z.reviewed=true;Z.reviewedAt=Z.rdAt[s0]}
dbg('Mark as Reviewed request',s0,c);const r=await persist('review');dbg('Mark as Reviewed response',r);
if(!r.ok){rd[s0]=was;Z.rdAt[s0]=wasAt;Z.reviewed=wasTop[0];Z.reviewedAt=wasTop[1];return fail('Could not save reviewed state',r)}
L(SEC[s0].t,'Reviewed',c?'No':'Yes',c?'Yes':'No');show(null,c?'Section '+(s0+1)+' marked as reviewed and saved.':'Reviewed mark removed from section '+(s0+1)+' and saved.')},
save:async()=>{const r=await persist('save draft');if(r.ok)show(null,'PAC draft saved');else fail('PAC draft not saved',r)},
next:async()=>{const from=sec,r=await persist('save & continue');if(!r.ok)return fail('PAC not saved, staying on this section',r);sec=Math.min(SEC.length-1,from+1);dbg('section after save',sec);show(null,'Section '+(from+1)+' saved')},
rebind:p=>{if(p&&p.pac&&p.id===curId)bind(p)},isDirty:id=>dirty&&id===curId,
oth:el=>{q('rsow').style.display=el.value=='Other'?'':'none'},
note:(i,v)=>{acts[i].note=v},adv:(i,v)=>{cons[i].adv=v},
setAct:(i,v)=>{L('Pending Actions','Status',acts[i].status,v);acts[i].status=v;rr()},
setCon:(i,v)=>{cons[i].status=v;const a=acts.find(a=>a.type=='Specialist Consultation'&&a.sp==cons[i].sp&&openA().includes(a));if(v=='Completed'&&a)a.status='Completed';rr()},
addAct:()=>{const r=q('ar').value.trim();if(!r)return show(['Action / requirement is required']);const t=q('at').value,w=q('aw').value,d=q('ad').value;if(t=='Specialist Consultation'&&(!w||!d))return show(['Assigned To and Due Date are required for Specialist Consultation']);acts.push({type:t,req:r,who:w,due:d,status:'Pending',note:'',rv:revs.length+1});L('Pending Actions','Add action','',r);rr()},
addRef:()=>{let sp=q('rsp').value;const rs=q('rrs').value.trim(),dr=q('rdoc').value.trim();if(sp=='Other')sp=q('rso').value.trim();if(!sp||!rs)return show(['Specialty (or the “Other” specialty name) and reason for referral are required']);cons.push({date:q('rdt').value,sp,doc:dr,rs,adv:'',status:'Requested'});acts.push({type:'Specialist Consultation',req:sp+' consultation'+(dr?' ('+dr+')':'')+': '+rs,who:dr||sp,sp,due:'',status:'Pending',note:'',rv:revs.length+1});L('Specialty Reference','Referral','',sp+(dr?' — '+dr:''));show(null,'Referral added with a linked pending action.')},
submit:async()=>{const e=chk('sub');if(e.length)return show(e);const st0=st;snap();L('Workflow','Submit','','Review '+revs.length);st=openA().length?'Awaiting Actions':'Under Anaesthesiologist Review';const r=await persist('submit');if(r.ok)show(null,'Review '+revs.length+' submitted and saved to Supabase.');else{revs.pop();st=st0;fail('Review not submitted',r)}},
ret:async()=>{if(!revs.length)return show(['Submit a review first']);if(openA().length)return show(['Close open actions before returning to review']);const o=[st,done];st='Under Anaesthesiologist Review';done=false;const r=await persist('return');if(r.ok)show(null,'Returned to PAC review and saved to Supabase.');else{st=o[0];done=o[1];fail('PAC change not saved',r)}},
fin:async()=>{const e=chk('final');if(e.length)return show(e);const o=[st,done];snap();L('Workflow','Finalize','',D.final);if(D.final=='Accepted for Anaesthesia'){done=true;st='Completed';}else{st='Awaiting Actions';}const r=await persist('finalize');if(r.ok)show(null,done?'PAC finalized and signed and saved to Supabase.':'Outcome is not “Accepted”, so the PAC stays open and has been saved.');else{revs.pop();st=o[0];done=o[1];fail('PAC not finalized',r)}},
reopen:async()=>{const why=prompt('Reason for reopening (required):');if(!why)return;const o=[st,done];L('Workflow','Reopen','Completed',why);done=false;st='Under Anaesthesiologist Review';const r=await persist('reopen');if(r.ok)show(null,'PAC reopened and saved.');else{st=o[0];done=o[1];fail('PAC not reopened',r)}}}})();

/* ===================== PERISCOPE BACKEND / FIREBASE DATA LAYER ===================== */
const PERISCOPE_API_URL = localStorage.getItem('periscope_api_url') || ((location.hostname === 'localhost' || location.hostname === '127.0.0.1') && location.port !== '5500' ? location.origin : 'http://localhost:5000');
let apiLoaded = false;
const dirtyIds = new Set();   /* patients with local edits not yet confirmed saved */
let saveTimer = null;
let saveInFlight = false;
let saveAgain = false;

async function apiFetch(path, options = {}) {
  const user = firebaseAuth.currentUser;
  if (!user) throw new Error('Please sign in again.');
  const token = await user.getIdToken();
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const r = await fetch(`${PERISCOPE_API_URL}${path}`, {...options, headers});
  let data = {};
  try { data = await r.json(); } catch (_) {}
  if (!r.ok || data.success === false) throw new Error(data.message || `Request failed (${r.status})`);
  return data;
}

function normalizePatient(p={}){
  const out={...p};
  out.docs=Array.isArray(out.docs)?out.docs:[];
  for(const k of ['tl','an','med','inv','cf','ms','qs']) out[k]=Array.isArray(out[k])?out[k]:[];
  out.status=out.status||'Awaiting Review';
  out.upd=out.upd||new Date().toISOString().slice(0,10);
  return out;
}

async function loadAppData(user) {
  apiLoaded = false;
  try {
    const [profile, patients] = await Promise.all([
      apiFetch('/api/me', {headers:{'X-Periscope-Role': window.__pendingSignupRole||localStorage.getItem('periscope_role_'+user.uid)||'Doctor'}}),
      apiFetch('/api/patients')
    ]);
    const u = profile.user || {};
    const role = u.role || localStorage.getItem('periscope_role_'+user.uid) || 'Doctor';
    let dept = u.dept || '';
    /* Department used to live only in localStorage (set at signup). Copy it to the database once, then treat the database as the source of truth. */
    const lsDept = localStorage.getItem('periscope_dept_'+user.uid) || '', syncKey = 'periscope_dept_synced_'+user.uid;
    if (!dept && lsDept && !localStorage.getItem(syncKey)) {
      try { const r = await apiFetch('/api/me', {method:'PUT', body:JSON.stringify({dept:lsDept})}); dept = (r.user && r.user.dept) || lsDept; localStorage.setItem(syncKey,'1'); }
      catch (_) { dept = lsDept; }
    } else if (dept) { localStorage.setItem(syncKey,'1'); }
    window.__pendingSignupRole=null;window.__pendingSignupDept=null;
    localStorage.setItem('periscope_role_'+user.uid, role);
    localStorage.setItem('periscope_dept_'+user.uid, dept);
    S.u = {name:u.name || user.displayName || user.email.split('@')[0], role, email:user.email, dept, uid:user.uid};
    P = (patients.patients || []).map(normalizePatient);
    apiLoaded = true;
    if (!P.length) {
      S.pid = null;
      S.v = 'dash';
    } else if (!P.some(x => x.id === S.pid)) {
      S.pid = P[0].id;
    }
    startRemotePatientSync();
    render();
  } catch (e) {
    apiLoaded = false;
    console.error(e);
    toast(`Backend connection failed: ${e.message}`);
    P=[]; S.pid=null; S.v='dash'; render();
  }
}

function serializablePatient(p) {
  const copy = JSON.parse(JSON.stringify(p || {}));
  delete copy.ownerUid;
  delete copy.createdAt;
  delete copy.updatedAt;
  /* Uploaded files are stored by the backend. Do not send extracted text/storage paths back. */
  copy.docs = undefined;
  return copy;
}

let _lastSaveError = '';
const lastSaveError = () => _lastSaveError;
let _saveChain = Promise.resolve();
const _pacDebug = () => { try { return localStorage.getItem('periscope_pac_debug') === '1'; } catch (_) { return false; } };

/* Saves are serialised so an autosave can never overwrite a newer explicit save with an older snapshot. */
function savePatientNow(p) {
  const run = () => _savePatient(p);
  const r = _saveChain.then(run, run);
  _saveChain = r.catch(() => {});
  return r;
}

async function _savePatient(p) {
  _lastSaveError = '';
  if (!apiLoaded || !firebaseAuth.currentUser || !p?.id) { _lastSaveError = 'Not connected to the database. Please sign in again.'; return false; }
  const live = P.find(x => x.id === p.id) || p;          // always send the current object, never a stale one
  const data = serializablePatient(live);
  const sentPac = JSON.stringify(live.pac || null);
  try {
    saveInFlight = true;
    if (_pacDebug()) console.log('[PAC] request payload data.pac', data.pac);
    const result = await apiFetch(`/api/patients/${encodeURIComponent(p.id)}`, {
      method:'PUT', body: JSON.stringify(data)
    });
    const remote = result.patient;
    if (!remote) throw new Error('The server did not return the saved patient.');
    if (_pacDebug()) console.log('[PAC] backend response data.pac', remote.pac);
    const i = P.findIndex(x => x.id === p.id);
    if (i >= 0) {
      const old = P[i];
      if (JSON.stringify(serializablePatient(old)) !== JSON.stringify(data)) {
        /* The user changed something while this save was in flight: keep the newer local copy and save again. */
        P[i] = {...old, docs: remote.docs || old.docs || []};
        saveAgain = true;
      } else {
        P[i] = {...old, ...remote, docs: remote.docs || old.docs || []};
        dirtyIds.delete(p.id);
      }
      /* Edits made while the request was in flight are not in the server copy yet: keep the live PAC object. */
      if (old.pac && JSON.stringify(old.pac) !== sentPac) P[i].pac = old.pac;
      else if (!remote.pac && old.pac) P[i].pac = old.pac;
      if (typeof PAC !== 'undefined' && PAC.rebind) PAC.rebind(P[i]);
    }
    return true;
  } catch(e) {
    _lastSaveError = e.message || String(e);
    console.error('Patient save failed', e);
    toast(`Save failed: ${e.message}`);
    return false;
  } finally {
    saveInFlight = false;
    if (saveAgain) { saveAgain=false; queuePatientSave(cur()); }
  }
}

function queuePatientSave(p) {
  if (!apiLoaded || !p?.id) return;
  if (saveInFlight) { saveAgain=true; return; }
  clearTimeout(saveTimer);
  const id = p.id;
  dirtyIds.add(id);
  saveTimer=setTimeout(()=>{ const live = P.find(x => x.id === id); if (live) savePatientNow(live); }, 650);
}

/* Never let a server refresh replace PAC data the user has typed but not saved yet. */
function keepUnsavedPac(oldList, fresh) {
  if (typeof PAC === 'undefined') return fresh;
  return fresh.map(f => { const o = oldList.find(x => x.id === f.id); return (o && o.pac && PAC.isDirty(f.id)) ? {...f, pac:o.pac} : f; });
}

async function createPatientRemote(p) {
  if(!apiLoaded || !firebaseAuth.currentUser) throw new Error('Database is not connected.');
  const result = await apiFetch('/api/patients', {method:'POST', body:JSON.stringify(serializablePatient(p))});
  const remote = normalizePatient(result.patient || {});
  if(!remote.id) throw new Error('Patient was not returned by the server after save.');
  // Refresh from Supabase so the UI immediately reflects the authoritative data.
  const list = await apiFetch('/api/patients');
  P = (list.patients || []).map(normalizePatient);
  const created = P.find(x => x.id === remote.id);
  if(!created) throw new Error('Patient was created by the server but could not be read back from Supabase.');
  S.pid = created.id;
  return created;
}

async function deletePatientRemote(id) {
  clearTimeout(saveTimer); saveAgain=false;          // stop any queued autosave for this patient
  try {
    await apiFetch(`/api/patients/${encodeURIComponent(id)}`, {method:'DELETE'});
  } catch (e) {
    // Already removed directly in Supabase: just clean up the screen.
    if (!/not found/i.test(e.message)) throw e;
  }
  P = P.filter(x => x.id !== id);
  if (S.pid === id) {
    S.pid = P[0]?.id || null;
    if (S.v === 'pt') { S.v = 'pts'; S.tab = 'Overview'; }
  }
}

function askDeletePt(id) {
  if (!canV()) { toast('Clinical Assistants cannot delete patients'); return; }
  const p = P.find(x => x.id === id);
  if (!p) return;
  $('dlg').innerHTML = `<h3>Delete patient?</h3>
    <p><b>${esc(p.name || 'Unnamed patient')}</b> <span class="sub">(${esc(p.id)})</span></p>
    <p>This permanently deletes the patient, all ${p.docs?.length||0} uploaded document(s) and their extracted data from the database. This cannot be undone.</p>
    <div class="row" style="margin-top:14px">
      <button class="b w" id="delgo" onclick="confirmDeletePt('${esc(p.id)}')">Yes, delete permanently</button>
      <button class="b" onclick="$('dlg').close()">Cancel</button>
    </div>`;
  $('dlg').showModal();
}

async function confirmDeletePt(id) {
  const btn = $('delgo'); if (btn) { btn.disabled = true; btn.textContent = 'Deleting...'; }
  try {
    await deletePatientRemote(id);
    $('dlg').close();
    render();
    toast('Patient and records deleted');
  } catch (e) {
    console.error('Delete failed', e);
    if (btn) { btn.disabled = false; btn.textContent = 'Yes, delete permanently'; }
    toast('Could not delete patient: ' + e.message);
  }
}

async function refreshSinglePatient(id){
  if(!apiLoaded || !firebaseAuth.currentUser || !id) return;
  try{
    const r=await apiFetch(`/api/patients/${encodeURIComponent(id)}`);
    const fresh=normalizePatient(r.patient||{});
    const i=P.findIndex(x=>x.id===id);
    if(i>=0&&!dirtyIds.has(id)){ P[i]=keepUnsavedPac([P[i]],[fresh])[0]; if(typeof PAC!=='undefined'&&PAC.rebind) PAC.rebind(P[i]); if(S.pid===id&&!(S.tab==='PAC'&&PAC.isDirty(id))) _periscopeOriginalRender(); }
  }catch(e){ console.warn('Patient refresh failed:',e.message); }
}

let remotePatientSyncBusy = false;
let remotePatientSyncTimer = null;

async function refreshPatientsFromServer({renderAfter=true}={}) {
  if (!apiLoaded || !firebaseAuth.currentUser || remotePatientSyncBusy) return false;
  remotePatientSyncBusy = true;
  try {
    const list = await apiFetch('/api/patients');
    const fresh = (list.patients || []).map(normalizePatient);
    const oldIds = new Set(P.map(x=>x.id));
    const newIds = new Set(fresh.map(x=>x.id));
    const changed = oldIds.size !== newIds.size || [...oldIds].some(id=>!newIds.has(id));
    P = keepUnsavedPac(P, fresh).map(f => (dirtyIds.has(f.id) || (saveInFlight && f.id === S.pid)) ? (P.find(x => x.id === f.id) || f) : f);
    if (typeof PAC !== 'undefined' && PAC.rebind) PAC.rebind(cur());
    if (S.pid && !newIds.has(S.pid)) {
      S.pid = fresh[0]?.id || null;
      S.v = 'dash';
      S.tab = 'Overview';
    } else if (!S.pid && fresh.length) {
      S.pid = fresh[0].id;
    }
    if (renderAfter && changed) _periscopeOriginalRender();
    return changed;
  } catch (e) {
    console.warn('Patient refresh failed:', e.message);
    return false;
  } finally {
    remotePatientSyncBusy = false;
  }
}

function startRemotePatientSync() {
  clearInterval(remotePatientSyncTimer);
  remotePatientSyncTimer = setInterval(() => refreshPatientsFromServer({renderAfter:true}), 5000);
}

async function getAuditRemote(id) {
  try {
    const r=await apiFetch(`/api/patients/${encodeURIComponent(id)}/audit`);
    return r.audit||[];
  } catch(e) { return []; }
}

async function backendHealth() {
  try { return await (await fetch(`${PERISCOPE_API_URL}/api/health`)).json(); }
  catch(e) { return {success:false,message:e.message}; }
}

/* Persist every patient-changing render without changing the existing UI code. */
const _periscopeOriginalRender = render;
let auditLoading=false;
render = function() {
  _periscopeOriginalRender();
  if(apiLoaded && S.u && S.pid && P.some(x => x.id === S.pid)) {
    queuePatientSave(cur());
    if(S.tab==='Audit' && canAudit() && !auditLoading){
      auditLoading=true;
      getAuditRemote(S.pid).then(rows=>{
        if(rows?.length) S.audit=rows.map(x=>({
          t:x.at?new Date(x.at).toLocaleString():'',u:S.u?.email||'',r:S.u?.role||'',
          pt:x.patientId||'',a:x.action||'',f:x.entity||'',o:x.oldValue||'',n:x.newValue||''
        }));
        auditLoading=false;
        if(S.tab==='Audit') _periscopeOriginalRender();
      }).catch(()=>{auditLoading=false});
    }
  }
};

// Drag-and-drop support for the document upload area.
document.addEventListener('dragover',e=>{const z=e.target.closest?.('#dropzone');if(z){e.preventDefault();z.classList.add('drag')}});
document.addEventListener('dragleave',e=>{const z=e.target.closest?.('#dropzone');if(z)z.classList.remove('drag')});
document.addEventListener('drop',e=>{const z=e.target.closest?.('#dropzone');if(z){e.preventDefault();z.classList.remove('drag');pick(e.dataTransfer.files)}});

/* Navigation: Escape or a tap outside closes the menu on narrow screens; leaving narrow mode resets it. */
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&S.navOpen&&navMobile()){toggleNav();document.getElementById('navtoggle')?.focus()}});
document.addEventListener('click',e=>{if(S.navOpen&&navMobile()&&!e.target.closest('aside'))toggleNav()});
try{window.matchMedia('(max-width:900px)').addEventListener('change',()=>{S.navOpen=false;document.querySelector('.app')?.classList.remove('nav-open');navAria()})}catch(e){}


/* ===================== DOCUMENT PROCESSING MONITOR (Admin) =====================
   Everything here is read from /api/admin/documents/monitor (Supabase: documents, patients, audit_logs).
   Retrying calls /api/admin/documents/:id/retry, which re-runs the existing OCR / extraction pipeline on the stored file. */
const DM_STATUS={completed:['ok','Completed'],processing:['wait','Processing'],failed:['alert','Failed']};
function dmDur(ms){if(ms==null||!Number.isFinite(Number(ms)))return '<span class="sub">Not recorded</span>';ms=Number(ms);if(ms<1000)return '< 1 sec';const s=ms/1000;if(s<60)return `${s<10?s.toFixed(1):Math.round(s)} sec`;const m=Math.floor(s/60);return `${m} min ${Math.round(s-m*60)} sec`}
function dmDT(v){if(!v)return '—';const d=new Date(v);return isNaN(d)?'—':d.toLocaleString([],{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}
function dmChip(x){const st=x.stale?['alert','Stuck']:(DM_STATUS[x.status]||DM_STATUS.completed);return `<span class="schip ${st[0]}">${st[1]}</span>`}
function dmState(){return S.dm=S.dm||{f:{status:'',from:'',to:'',patient:''},limit:50,tlN:30,data:null,err:'',loading:false,at:0,busy:{},engine:'tesseract'}}
function dmLoad(){
  const d=dmState(),n=d.seq=(d.seq||0)+1,f=d.f,q=new URLSearchParams();
  d.loading=true;
  if(f.status)q.set('status',f.status);
  if(f.patient)q.set('patient',f.patient);
  if(f.from)q.set('from',new Date(f.from+'T00:00:00').toISOString());   // local-day boundaries, sent as UTC instants
  if(f.to)q.set('to',new Date(f.to+'T23:59:59.999').toISOString());
  q.set('limit',d.limit);
  return apiFetch('/api/admin/documents/monitor?'+q.toString())
    .then(r=>{if(n!==d.seq)return;d.data=r;d.err='';d.at=Date.now()})
    .catch(e=>{if(n!==d.seq)return;d.err=e.message||'Could not load the document monitor'})
    .finally(()=>{if(n!==d.seq)return;d.loading=false;if(S.v==='docmon')render();dmSchedule()});
}
function dmSchedule(){
  const d=dmState();clearTimeout(d.timer);
  if(S.v==='docmon'&&d.data&&d.data.summary.processing>0)d.timer=setTimeout(()=>{if(S.v==='docmon'&&!d.loading)dmLoad()},5000);   // live-update while jobs are running
}
function dmSet(k,v){
  const d=dmState();
  if(k==='status'&&d.f.status===v)v='';
  const next={...d.f,[k]:v};
  if(next.from&&next.to&&next.from>next.to){toast('The “From” date is after the “To” date.');render();return}
  d.f=next;d.limit=50;d.tlN=30;d.err='';dmLoad();render();
}
function dmClear(){const d=dmState();d.f={status:'',from:'',to:'',patient:''};d.limit=50;d.tlN=30;d.err='';dmLoad();render()}
function dmRefresh(){const d=dmState();d.err='';dmLoad();render()}
function dmMore(){const d=dmState();d.limit+=50;dmLoad();render()}
function dmEvent(e){
  const who=e.by?` by ${esc(e.by)}`:'',dur=e.durationMs!=null?` · ${dmDur(e.durationMs)}`:'';
  const doc=`<b>${esc(e.name||'Document')}</b>${e.patientName||e.patientId?` <span class="sub">· ${esc(e.patientName||'Unnamed patient')}${e.patientId?' ('+esc(e.patientId)+')':''}</span>`:''}`;
  const err=t=>t?`<div class="sub">${esc(String(t).slice(0,160))}${String(t).length>160?'…':''}</div>`:'';
  const m={
    uploaded:['Uploaded',doc],
    processing:['Processing',`${doc}<div class="sub">Extraction in progress</div>`],
    completed:['Completed',`${doc}<div class="sub">Text extraction finished${dur}</div>`],
    failed:['Failed',`${doc}${err(e.error)}`],
    'retry-started':['Retry started',`${doc}<div class="sub">Re-processing${who}${e.detail?' · '+esc(e.detail):''}</div>`],
    'retry-completed':['Retry completed',`${doc}<div class="sub">Re-processed${who}${e.detail?' · '+esc(e.detail):''}</div>`],
    'retry-failed':['Retry failed',`${doc}<div class="sub">Re-processing${who} did not succeed</div>${err(e.detail)}`]
  }[e.kind]||['Event',doc];
  return `<div class="ev dm-ev"><span class="tcat">${m[0]}</span><span class="ttx">${m[1]}</span><span class="sub dm-time">${esc(new Date(e.at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}))}</span></div>`;
}
function dmTimeline(d){
  const ev=(d.data&&d.data.timeline)||[];
  if(!ev.length)return `<div class="card"><h3>Processing activity</h3><p class="sub">No processing activity for the current filters.</p></div>`;
  const shown=ev.slice(0,d.tlN),groups=[];
  shown.forEach(e=>{const k=new Date(e.at).toLocaleDateString([],{weekday:'short',day:'numeric',month:'long',year:'numeric'});let g=groups[groups.length-1];if(!g||g.k!==k){g={k,items:[]};groups.push(g)}g.items.push(e)});
  return `<div class="card"><div class="cardhead"><h3>Processing activity</h3><span class="sub">Newest first · uploads, outcomes and admin retries</span></div><div class="tl">${groups.map(g=>`<section class="tdate"><h3 class="tdh">${esc(g.k)}</h3><div class="tle">${g.items.map(dmEvent).join('')}</div></section>`).join('')}</div>${ev.length>d.tlN?`<p class="row noprint" style="margin-top:10px"><button class="b sm" onclick="dmState().tlN+=30;render()">Show more activity</button></p>`:''}</div>`;
}
function docMon(){
  const d=dmState();
  if(!d.loading&&!d.err&&(!d.data||Date.now()-d.at>20000))dmLoad();   // sets d.loading synchronously; never renders here
  const data=d.data,sm=data?data.summary:{total:0,processing:0,completed:0,failed:0},f=d.f;
  const kpi=(key,label,n,cls)=>`<div class="card stat click ${cls} ${f.status===key?'on':''}" tabindex="0" role="button" aria-pressed="${f.status===key}" onclick="dmSet('status','${key}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();dmSet('status','${key}')}"><b>${n}</b><span>${label}</span></div>`;
  const pats=[...P].sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')));
  const filtered=!!(f.status||f.from||f.to||f.patient);
  const docs=data?data.documents:[];
  const rows=docs.map(x=>{
    const busy=!!d.busy[x.id],canRetry=x.status==='failed'||x.stale;
    const dur=x.status==='processing'?`<span class="sub">Running · ${dmDur(Date.now()-new Date(x.startedAt||x.uploadedAt).getTime())}</span>`:dmDur(x.durationMs);
    return `<tr><td><b>${esc(x.name||'Untitled')}</b><div class="sub">${esc(x.category||'')}${x.fileSize?' · '+esc(formatBytes(x.fileSize)):''}</div></td><td>${x.patientId?`<b>${esc(x.patientName||'Unnamed patient')}</b><div class="sub mono">${esc(x.patientId)}</div>`:'<span class="sub">Unknown patient</span>'}</td><td>${esc(dmDT(x.uploadedAt))}</td><td>${dmChip(x)}</td><td>${dur}</td><td class="acts"><div class="row"><button class="b sm" onclick="dmInspect('${esc(x.id)}')">Inspect</button>${canRetry?`<button class="b sm p" ${busy?'disabled':''} onclick="dmRetry('${esc(x.id)}')">${busy?'Retrying…':'Retry'}</button>`:''}</div></td></tr>`;
  }).join('');
  const body=!data&&d.loading?`<div class="card"><p class="sub">Loading document activity…</p></div>`
    :!data?'':`<div class="tw dm-tw"><table><tr><th>Document</th><th>Patient</th><th>Uploaded</th><th>Status</th><th>Duration</th><th>Actions</th></tr>${rows||`<tr><td colspan="6" class="sub">${filtered?'No documents match these filters.':'No documents have been uploaded yet.'}</td></tr>`}</table></div>${data.matching>docs.length?`<p class="row noprint" style="margin:10px 0"><span class="sub">Showing ${docs.length} of ${data.matching}</span><button class="b sm" onclick="dmMore()">Show more</button></p>`:''}${data.truncated?'<p class="sub">Counts cover the most recent 5,000 documents. Narrow the date range to see older ones.</p>':''}`;
  return `<div class="phead"><div><h1>Document Monitor</h1><p class="sub">OCR and extraction status for every uploaded document.</p></div><button class="b" onclick="dmRefresh()" ${d.loading?'disabled':''}>${d.loading?'Refreshing…':'Refresh'}</button></div>
  ${d.err?`<div class="err" role="alert">${esc(d.err)}</div>`:''}
  ${data&&data.migrationApplied===false?`<div class="note" style="margin-bottom:14px">Durations, engines and error messages are recorded for each new job once <b>backend/supabase-migration-v4-6-document-monitor.sql</b> has been run in the Supabase SQL Editor. Older documents will show “Not recorded”.</div>`:''}
  <div class="grid kpis dm-kpis"><div class="card stat click ${!f.status?'on':''}" tabindex="0" role="button" aria-pressed="${!f.status}" onclick="dmSet('status','')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();dmSet('status','')}"><b>${sm.total}</b><span>Total documents</span></div>${kpi('processing','Processing',sm.processing,'processing')}${kpi('completed','Completed',sm.completed,'completed')}${kpi('failed','Failed',sm.failed,'failed')}</div>
  <div class="card noprint"><div class="dm-filters"><div><label for="dm_status">Status</label><select id="dm_status" onchange="dmSet('status',this.value)"><option value="">All statuses</option>${Object.entries(DM_STATUS).map(([k,v])=>`<option value="${k}" ${f.status===k?'selected':''}>${v[1]}</option>`).join('')}</select></div><div><label for="dm_from">Uploaded from</label><input id="dm_from" type="date" value="${esc(f.from)}" onchange="dmSet('from',this.value)"></div><div><label for="dm_to">Uploaded to</label><input id="dm_to" type="date" value="${esc(f.to)}" onchange="dmSet('to',this.value)"></div><div><label for="dm_pt">Patient</label><select id="dm_pt" onchange="dmSet('patient',this.value)"><option value="">All patients</option>${pats.map(p=>`<option value="${esc(p.id)}" ${f.patient===p.id?'selected':''}>${esc(p.name||'Unnamed patient')} (${esc(p.id)})</option>`).join('')}</select></div>${filtered?`<div><button class="b" onclick="dmClear()">Clear filters</button></div>`:''}</div></div>
  ${body}${data?dmTimeline(d):''}`;
}
function dmInspect(id){
  const d=dmState(),x=((d.data&&d.data.documents)||[]).find(r=>r.id===id);
  if(!x){toast('That document is no longer in the list.');return}
  const eng={tesseract:'Local OCR – Tesseract',gemini:'AI OCR – Gemini',direct:'Direct text extraction'}[x.engine]||'<span class="sub">Not recorded</span>';
  d.engine=['gemini','tesseract'].includes(x.engine)?x.engine:'tesseract';
  const canRetry=x.status==='failed'||x.stale,fact=(k,v)=>`<div><div class="k">${k}</div><div class="v">${v}</div></div>`;
  $('dlg').innerHTML=`<h3>${esc(x.name||'Document')}</h3>
    <p class="sub">${esc(x.category||'')}${x.mimeType?' · '+esc(x.mimeType):''}${x.fileSize?' · '+esc(formatBytes(x.fileSize)):''}</p>
    <div class="dm-facts">${fact('Status',dmChip(x))}${fact('Patient',x.patientId?esc((x.patientName||'Unnamed patient')+' ('+x.patientId+')'):'Unknown')}${fact('Uploaded',esc(dmDT(x.uploadedAt)))}${fact('Uploaded by',x.uploadedBy?esc(x.uploadedBy):'<span class="sub">Unknown</span>')}${fact('Engine',eng)}${fact('Duration',dmDur(x.durationMs))}${fact('Attempts',x.attempts!=null?x.attempts:'<span class="sub">Not recorded</span>')}${fact('Last processed',x.processedAt?esc(dmDT(x.processedAt)):'<span class="sub">Not recorded</span>')}</div>
    ${x.status==='failed'?`<h4>Error</h4><div class="err" role="alert" style="white-space:pre-wrap;overflow-wrap:anywhere">${x.error?esc(x.error):'No error message was recorded for this job (it was processed before error logging was added). Retry it to capture a fresh result.'}</div>`:''}
    ${x.stale?`<div class="err" role="alert">This document has been processing for more than 15 minutes and may be stuck. You can retry it.</div>`:''}
    ${x.status==='completed'?'<p class="sub">This document was processed successfully. Use “View text” on the patient’s Documents tab to read the extracted text.</p>':''}
    ${canRetry?`<div class="ocr-choice" style="margin-top:12px"><div style="font-weight:600;margin-bottom:8px">Retry with</div><div class="row"><button type="button" id="dm_e_tesseract" class="b ${d.engine==='tesseract'?'p':''}" onclick="dmEngine('tesseract')">Local OCR – Tesseract</button><button type="button" id="dm_e_gemini" class="b ${d.engine==='gemini'?'p':''}" onclick="dmEngine('gemini')">AI OCR – Gemini</button></div><p class="sub" style="margin:8px 0 0">Applies to PDFs and images. DOCX and TXT always use their native readers. The patient’s timeline, medications and investigations are rebuilt if the retry succeeds.</p></div>`:''}
    <div id="dm_err"></div>
    <div class="row" style="margin-top:14px">${canRetry?`<button class="b p" id="dm_retry" onclick="dmRetry('${esc(x.id)}',true)">Retry processing</button>`:''}<button class="b" onclick="$('dlg').close()">Close</button></div>`;
  $('dlg').showModal();
}
function dmEngine(e){
  dmState().engine=e;
  ['tesseract','gemini'].forEach(k=>{const b=$('dm_e_'+k);if(b)b.classList.toggle('p',k===e)});
}
async function dmRetry(id,fromDialog){
  const d=dmState(),x=((d.data&&d.data.documents)||[]).find(r=>r.id===id);
  if(!x||d.busy[id])return;
  d.busy[id]=true;
  const btn=$('dm_retry'),box=$('dm_err');
  if(btn){btn.disabled=true;btn.textContent='Retrying…'}
  if(box)box.innerHTML='';
  render();
  setTimeout(()=>{if(d.busy[id])dmLoad()},900);   // pick up the server-side "processing" state while the retry runs
  try{
    const r=await apiFetch(`/api/admin/documents/${encodeURIComponent(id)}/retry`,{method:'POST',body:JSON.stringify(fromDialog?{ocrEngine:d.engine}:{})});
    if(r.patient){const i=P.findIndex(p=>p.id===r.patient.id);if(i>=0)P[i]=normalizePatient(r.patient)}
    if($('dlg').open)$('dlg').close();
    toast(r.message||'Document re-processed',3600);
  }catch(e){
    const msg=e.message||'Retry failed';
    if(box&&$('dlg').open)box.innerHTML=`<div class="err" role="alert" style="margin-top:10px">${esc(msg)}</div>`;
    toast(msg,5200);
  }finally{
    delete d.busy[id];
    if(btn){btn.disabled=false;btn.textContent='Retry processing'}
    dmLoad();render();
  }
}

/* ===================== AUDIT LOGS & SECURITY MANAGEMENT (Admin / Doctor) =====================
   Everything is read from /api/audit-logs and /api/admin/security/overview (Supabase audit_logs + profiles).
   Admins see every user's activity plus user statistics and role distribution. Doctors see only their own activity.
   Other roles never see the page; the server enforces the same rule. The log is append-only, so there is nothing to edit or delete here.
   Patient names, file names and record contents are never part of these responses. */
const AU_ROLES=['Admin','Doctor'];
const auAllowed=()=>!!(S.u&&AU_ROLES.includes(S.u.role));
const auAdmin=()=>!!(S.u&&S.u.role==='Admin');
const AU_ACTIVITY=[['Authentication',['User Login','Login Failed']],['Patient',['Patient Created','Patient Updated','Patient Deleted']],['Document',['Document Uploaded','Document Deleted','OCR Retry Started','OCR Retry Completed','OCR Retry Failed']],['Security',['Access Denied']]];
function auState(){return S.au=S.au||{f:{user:'',activity:'',result:'',from:'',to:''},limit:50,data:null,err:'',loading:false,at:0,ov:null,ovErr:'',ovLoading:false,ovAt:0}}
function auDT(v){if(!v)return '—';const d=new Date(v);return isNaN(d)?'—':d.toLocaleString([],{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}
function auLoginFailed(email,err){
  /* Reports a failed sign-in to the backend (public, rate-limited, always answers the same). Wrong-network errors are not security events. */
  try{
    const code=String((err&&err.code)||'');
    if(!code.startsWith('auth/')||code==='auth/network-request-failed'||code==='auth/invalid-email'||code==='auth/missing-password')return;
    fetch(`${PERISCOPE_API_URL}/api/audit/login-failed`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:String(email||'').slice(0,200)})}).catch(()=>{});
  }catch(e){}
}
function auLoad(){
  const d=auState(),n=d.seq=(d.seq||0)+1,f=d.f,q=new URLSearchParams();
  d.loading=true;
  if(f.user&&auAdmin())q.set('user',f.user);
  if(f.activity)q.set('activity',f.activity);
  if(f.result)q.set('result',f.result);
  if(f.from)q.set('from',new Date(f.from+'T00:00:00').toISOString());
  if(f.to)q.set('to',new Date(f.to+'T23:59:59.999').toISOString());
  q.set('limit',d.limit);
  return apiFetch('/api/audit-logs?'+q.toString())
    .then(r=>{if(n!==d.seq)return;d.data=r;d.err='';d.at=Date.now()})
    .catch(e=>{if(n!==d.seq)return;d.err=e.message||'Could not load the audit log'})
    .finally(()=>{if(n!==d.seq)return;d.loading=false;if(S.v==='audit')render()});
}
function auOverviewLoad(){
  const d=auState();
  d.ovLoading=true;
  return apiFetch('/api/admin/security/overview')
    .then(r=>{d.ov=r;d.ovErr='';d.ovAt=Date.now()})
    .catch(e=>{d.ovErr=e.message||'Could not load user statistics'})
    .finally(()=>{d.ovLoading=false;if(S.v==='audit')render()});
}
function auSet(k,v){
  const d=auState(),next={...d.f,[k]:v};
  if(next.from&&next.to&&next.from>next.to){toast('The “From” date is after the “To” date.');render();return}
  d.f=next;d.limit=50;d.err='';auLoad();render();
}
function auClear(){const d=auState();d.f={user:'',activity:'',result:'',from:'',to:''};d.limit=50;d.err='';auLoad();render()}
function auRefresh(){const d=auState();d.err='';d.ovErr='';auLoad();if(auAdmin())auOverviewLoad();render()}
function auMore(){const d=auState();d.limit+=50;auLoad();render()}
function auUserFilter(uid){const d=auState();d.f={...d.f,user:uid};d.limit=50;d.err='';auLoad();render();scrollTo(0,0)}
function auRoleBars(ov){
  const rows=ov.roles||[],total=rows.reduce((a,x)=>a+x.count,0)||1;
  return `<div class="card"><div class="cardhead"><h3>Role distribution</h3><span class="sub">${ov.summary.totalUsers} user${ov.summary.totalUsers===1?'':'s'}</span></div>${rows.map(x=>{const pct=Math.round(x.count*100/total);return `<div class="au-role"><div class="au-rl"><b>${esc(x.role)}</b><span class="sub">${x.count} · ${pct}%</span></div><div class="au-track" role="img" aria-label="${esc(x.role)}: ${x.count} users, ${pct} percent"><span class="au-fill ${x.role==='Admin'?'adm':x.role==='Doctor'?'doc':x.role==='Clinical Assistant'?'ca':'oth'}" style="width:${pct}%"></span></div></div>`}).join('')}</div>`;
}
function auUserTable(ov){
  const rows=(ov.users||[]).map(u=>`<tr><td><b>${esc(u.name)}</b><div class="sub">${esc(u.email)}</div></td><td>${esc(u.role)}</td><td>${u.disabled?'<span class="schip alert">Disabled</span>':'<span class="schip ok">Active</span>'}</td><td>${esc(auDT(u.lastLogin))}</td><td>${u.logins30d}</td><td>${u.actions30d}</td><td>${u.failures30d?`<span class="schip alert">${u.failures30d}</span>`:'0'}</td><td class="acts"><button class="b sm" onclick="auUserFilter('${esc(u.uid)}')">View activity</button></td></tr>`).join('');
  return `<div class="card"><div class="cardhead"><h3>User statistics</h3><span class="sub">Last 30 days</span></div><div class="tw au-tw"><table><tr><th>User</th><th>Role</th><th>Status</th><th>Last sign-in</th><th>Sign-ins</th><th>Actions</th><th>Failures</th><th></th></tr>${rows||'<tr><td colspan="8" class="sub">No users yet.</td></tr>'}</table></div></div>`;
}
function secAudit(){
  const d=auState(),admin=auAdmin();
  if(!d.loading&&!d.err&&(!d.data||Date.now()-d.at>20000))auLoad();
  if(admin&&!d.ovLoading&&!d.ovErr&&(!d.ov||Date.now()-d.ovAt>20000))auOverviewLoad();
  const data=d.data,f=d.f,filtered=!!(f.user||f.activity||f.result||f.from||f.to),logs=data?data.logs:[],ov=d.ov;
  const sm=ov?ov.summary:null;
  const kpi=(n,l,cls)=>`<div class="card stat ${cls||''}"><b>${n}</b><span>${l}</span></div>`;
  const users=ov?ov.users:[];
  const rows=logs.map(x=>`<tr><td>${esc(auDT(x.at))}</td>${admin?`<td><b>${esc(x.userName)}</b>${x.userEmail?`<div class="sub">${esc(x.userEmail)}</div>`:''}</td><td>${esc(x.role||'—')}</td>`:''}<td>${esc(x.action)}<div class="sub">${esc(x.category)}</div></td><td>${esc(x.target)}</td><td><span class="schip ${x.result==='Failure'?'alert':'ok'}">${x.result==='Failure'?'Failure':'Success'}</span></td></tr>`).join('');
  const cols=admin?6:4;
  return `<div class="phead"><div><h1>${admin?'Audit Log & Security':'My Activity'}</h1><p class="sub">${admin?'Sign-ins, patient changes, document uploads and deletions, and user activity across PERISCOPE.':'Your own sign-ins and the changes you have made. Only you and Admins can see this.'}</p></div><button class="b" onclick="auRefresh()" ${d.loading?'disabled':''}>${d.loading?'Refreshing…':'Refresh'}</button></div>
  ${admin?`${d.ovErr?`<div class="card"><p class="err" role="alert">${esc(d.ovErr)}</p></div>`:''}
  ${sm?`<div class="grid kpis au-kpis">${kpi(sm.totalUsers,'Total users')}${kpi(sm.active7d,'Active users (7 days)')}${kpi(sm.logins24h,'Sign-ins (24 hours)')}${kpi(sm.failures24h,'Failed events (24 hours)','fail')}</div>
  <div class="au-two">${auRoleBars(ov)}<div class="card"><div class="cardhead"><h3>Security activity</h3><span class="sub">Last 24 hours</span></div><div class="au-facts"><div><b>${sm.failedLogins24h}</b><span class="sub">Failed sign-ins</span></div><div><b>${sm.actions24h}</b><span class="sub">Patient and document actions</span></div><div><b>${users.filter(u=>u.disabled).length}</b><span class="sub">Disabled accounts</span></div></div>${ov.truncated?'<p class="sub">Statistics cover the most recent 20,000 events of the last 30 days.</p>':''}</div></div>
  ${auUserTable(ov)}`:d.ovLoading?'<div class="card"><p class="sub">Loading user statistics…</p></div>':''}`:''}
  ${data&&data.migrationNeeded?'<div class="card note"><p>The audit table has no <b>result</b> column yet, so results are estimated from the action name. Run <b>backend/supabase-migration-v4-7-audit-security.sql</b> once in the Supabase SQL Editor to enable full tracking and the append-only protection.</p></div>':''}
  <div class="card noprint"><div class="dm-filters">${admin?`<div><label for="au_user">User</label><select id="au_user" onchange="auSet('user',this.value)"><option value="">All users</option>${users.map(u=>`<option value="${esc(u.uid)}" ${f.user===u.uid?'selected':''}>${esc(u.name)} (${esc(u.role)})</option>`).join('')}</select></div>`:''}<div><label for="au_act">Activity</label><select id="au_act" onchange="auSet('activity',this.value)"><option value="">All activity</option>${AU_ACTIVITY.map(g=>`<optgroup label="${g[0]}"><option value="cat:${g[0]}" ${f.activity==='cat:'+g[0]?'selected':''}>All ${g[0].toLowerCase()} activity</option>${g[1].map(a=>`<option value="${esc(a)}" ${f.activity===a?'selected':''}>${esc(a)}</option>`).join('')}</optgroup>`).join('')}</select></div><div><label for="au_res">Result</label><select id="au_res" onchange="auSet('result',this.value)"><option value="">Any result</option><option value="Success" ${f.result==='Success'?'selected':''}>Success</option><option value="Failure" ${f.result==='Failure'?'selected':''}>Failure</option></select></div><div><label for="au_from">From</label><input id="au_from" type="date" value="${esc(f.from)}" onchange="auSet('from',this.value)"></div><div><label for="au_to">To</label><input id="au_to" type="date" value="${esc(f.to)}" onchange="auSet('to',this.value)"></div>${filtered?'<div><button class="b" onclick="auClear()">Clear filters</button></div>':''}</div></div>
  ${d.err?`<div class="card"><p class="err" role="alert">${esc(d.err)}</p><p><button class="b" onclick="auRefresh()">Try again</button></p></div>`:!data?'<div class="card"><p class="sub">Loading audit log…</p></div>':`<div class="tw au-tw"><table><tr><th>Time</th>${admin?'<th>User</th><th>Role</th>':''}<th>Activity</th><th>Target</th><th>Result</th></tr>${rows||`<tr><td colspan="${cols}" class="sub">${filtered?'No entries match these filters.':'No activity has been recorded yet.'}</td></tr>`}</table></div>${data.matching>logs.length?`<p class="row noprint" style="margin:10px 0"><span class="sub">Showing ${logs.length} of ${data.matching}</span><button class="b sm" onclick="auMore()">Show more</button></p>`:`<p class="sub" style="margin:10px 0">${data.matching} entr${data.matching===1?'y':'ies'}</p>`}`}
  <p class="sub au-note">The audit log is append-only: entries cannot be edited or deleted. Patient names, file names and record contents are not shown here.</p>`;
}

/* ===================== REPORTS & ANALYTICS (Admin) =====================
   Every figure comes from GET /api/admin/reports, which aggregates the live Supabase tables (patients, documents, audit_logs).
   Deleted records no longer exist there, so they are never counted. Only aggregates reach the browser: no patient names, IDs or file names.
   Charts are plain SVG (hover for values, click a legend item to hide a series). The page re-fetches every 60 seconds while it is open.
   CSV export is built from the exact data on screen. */
function rpState(){return S.rp=S.rp||{range:30,from:'',to:'',data:null,err:'',loading:false,at:0,hidden:{},charts:{},exp:'daily'}}
function rpDay(v,end){const d=new Date(v+'T'+(end?'23:59:59.999':'00:00:00'));return d.toISOString()}
function rpLoad(){
  const r=rpState(),n=r.seq=(r.seq||0)+1,q=new URLSearchParams(),now=new Date();
  r.loading=true;
  if(r.range==='custom'){
    if(!r.from||!r.to){r.loading=false;return Promise.resolve()}
    q.set('from',rpDay(r.from,false));q.set('to',rpDay(r.to,true));
  }else{
    const s=new Date(now.getFullYear(),now.getMonth(),now.getDate()-(Number(r.range)-1));
    q.set('from',s.toISOString());q.set('to',now.toISOString());
  }
  q.set('tz',String(-now.getTimezoneOffset()));
  return apiFetch('/api/admin/reports?'+q.toString())
    .then(x=>{if(n!==r.seq)return;r.data=x;r.err='';r.at=Date.now()})
    .catch(e=>{if(n!==r.seq)return;r.err=e.message||'Could not load the report'})
    .finally(()=>{if(n!==r.seq)return;r.loading=false;if(S.v==='reports')render();rpSchedule()});
}
function rpSchedule(){const r=rpState();clearTimeout(r.timer);if(S.v==='reports')r.timer=setTimeout(()=>{if(S.v==='reports'&&!r.loading&&!document.hidden)rpLoad();else if(S.v==='reports')rpSchedule()},60000)}
function rpSetRange(v){const r=rpState();r.range=v;r.err='';if(v!=='custom')rpLoad();render()}
function rpApplyCustom(){
  const r=rpState(),f=$('rp_from')?.value||'',t=$('rp_to')?.value||'';
  if(!f||!t){toast('Choose both a start and an end date.');return}
  if(f>t){toast('The start date is after the end date.');return}
  if((new Date(t)-new Date(f))/864e5>365){toast('Choose a range of 366 days or less.');return}
  r.from=f;r.to=t;r.err='';rpLoad();render();
}
function rpRefresh(){const r=rpState();r.err='';rpLoad();render()}
/* ---- formatting ---- */
const rpN=v=>v==null?'—':Number(v).toLocaleString();
function rpDur(ms){if(ms==null)return '—';if(ms<1000)return '< 1 sec';const s=ms/1000;if(s<60)return (s<10?s.toFixed(1):Math.round(s))+' sec';const m=Math.floor(s/60);return m+' min '+Math.round(s-m*60)+' sec'}
function rpPct(v){return v==null?'—':v+'%'}
function rpDelta(cur,prev){
  if(prev==null)return '';
  if(prev===0)return cur>0?'<span class="rp-d up">New activity vs previous period</span>':'<span class="rp-d">No change vs previous period</span>';
  const p=Math.round((cur-prev)*100/prev);
  return `<span class="rp-d ${p>0?'up':p<0?'down':''}">${p>0?'▲':p<0?'▼':'•'} ${Math.abs(p)}% vs previous period (${rpN(prev)})</span>`;
}
function rpLbl(k){const d=new Date(k+'T00:00:00');return d.toLocaleDateString([],{day:'numeric',month:'short'})}
/* ---- SVG charts ---- */
const RP_W=640,RP_H=230,RP_L=44,RP_R=10,RP_T=12,RP_B=26;
function rpNice(max){if(max<=0)return 1;const p=Math.pow(10,Math.floor(Math.log10(max))),f=max/p;return (f<=1?1:f<=2?2:f<=5?5:10)*p}
function rpChart(id,o){
  const r=rpState(),labels=o.labels;
  r.charts[id]={labels,series:o.series,fmt:o.fmt||rpN,kind:o.kind};
  const vis=o.series.filter(x=>!r.hidden[id+':'+x.key]);
  const any=o.series.some(x=>x.values.some(v=>v!=null&&v>0));
  const legend=o.series.length>1?`<div class="rp-legend">${o.series.map(x=>`<button type="button" class="rp-lg ${r.hidden[id+':'+x.key]?'off':''}" aria-pressed="${!r.hidden[id+':'+x.key]}" onclick="rpToggle('${id}','${x.key}')"><i style="background:${x.color}"></i>${esc(x.label)}</button>`).join('')}</div>`:'';
  if(!any)return `<div class="rp-empty">No data in this period.</div>`;
  const n=labels.length,pw=RP_W-RP_L-RP_R,ph=RP_H-RP_T-RP_B;
  const max=rpNice(Math.max(1,...vis.flatMap(x=>x.values.map(v=>v||0))));
  const X=i=>o.kind==='bar'?RP_L+pw*(i+.5)/n:RP_L+(n===1?pw/2:pw*i/(n-1)),Y=v=>RP_T+ph-ph*v/max;
  let g='';
  for(let t=0;t<=4;t++){const v=max*t/4,y=Y(v);g+=`<line x1="${RP_L}" x2="${RP_W-RP_R}" y1="${y}" y2="${y}" class="rp-grid"/><text x="${RP_L-6}" y="${y+4}" text-anchor="end" class="rp-ax">${esc(o.fmt?o.fmt(v):rpN(Math.round(v*10)/10))}</text>`}
  const every=Math.ceil(n/8);
  labels.forEach((l,i)=>{if(i%every===0||(i===n-1&&(n-1)%every>=every*.6))g+=`<text x="${X(i)}" y="${RP_H-8}" text-anchor="middle" class="rp-ax">${esc(rpLbl(l))}</text>`});
  if(o.kind==='bar'){
    const k=vis.length||1,slot=pw/n,bw=Math.max(.5,Math.min(28,slot*.76/k));   /* bars always stay inside their own day slot, so 30/90-day views no longer overlap */
    vis.forEach((x,si)=>x.values.forEach((v,i)=>{if(!v)return;const h=ph*v/max;g+=`<rect x="${(X(i)-bw*k/2+si*bw).toFixed(2)}" y="${RP_T+ph-h}" width="${bw.toFixed(2)}" height="${h}" rx="${bw>4?2:0}" style="fill:${x.color}"/>`}));
  }else{
    vis.forEach(x=>{
      let d='',pen=false;x.values.forEach((v,i)=>{if(v==null){pen=false;return}d+=(pen?'L':'M')+X(i).toFixed(1)+' '+Y(v).toFixed(1)+' ';pen=true});
      g+=`<path d="${d}" fill="none" style="stroke:${x.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
      if(n<=45)x.values.forEach((v,i)=>{if(v!=null)g+=`<circle cx="${X(i)}" cy="${Y(v)}" r="2.6" style="fill:${x.color}"/>`});
    });
  }
  return `${legend}<div class="rp-wrap" id="rpw_${id}"><svg viewBox="0 0 ${RP_W} ${RP_H}" role="img" aria-label="${esc(o.title||'Chart')}" onmousemove="rpHover('${id}',event)" onmouseleave="rpOut('${id}')" ontouchmove="rpHover('${id}',event.touches[0])" ontouchend="rpOut('${id}')">${g}<line id="rpx_${id}" y1="${RP_T}" y2="${RP_T+ph}" class="rp-cross" style="display:none"/><rect x="${RP_L}" y="${RP_T}" width="${pw}" height="${ph}" fill="transparent"/></svg><div class="rp-tip" id="rpt_${id}" role="status" hidden></div></div>`;
}
function rpToggle(id,key){const r=rpState(),k=id+':'+key;r.hidden[k]=!r.hidden[k];render()}
function rpHover(id,e){
  const c=rpState().charts[id],svg=document.querySelector('#rpw_'+id+' svg');if(!c||!svg)return;
  const b=svg.getBoundingClientRect(),n=c.labels.length,pw=RP_W-RP_L-RP_R,sx=(e.clientX-b.left)/b.width*RP_W;
  let i=c.kind==='bar'?Math.floor((sx-RP_L)/pw*n):Math.round((sx-RP_L)/pw*(n===1?1:n-1));
  i=Math.max(0,Math.min(n-1,i));
  const x=c.kind==='bar'?RP_L+pw*(i+.5)/n:RP_L+(n===1?pw/2:pw*i/(n-1));
  const line=$('rpx_'+id),tip=$('rpt_'+id);
  line.setAttribute('x1',x);line.setAttribute('x2',x);line.style.display='';
  const vis=c.series.filter(s=>!rpState().hidden[id+':'+s.key]);
  tip.innerHTML=`<b>${esc(new Date(c.labels[i]+'T00:00:00').toLocaleDateString([],{weekday:'short',day:'numeric',month:'short',year:'numeric'}))}</b>`+vis.map(s=>`<div><i style="background:${s.color}"></i>${esc(s.label)}: <b>${s.values[i]==null?'—':esc(c.fmt(s.values[i]))}</b></div>`).join('');
  tip.hidden=false;
  const wrap=tip.parentElement.getBoundingClientRect(),px=x/RP_W*wrap.width;
  tip.style.left=Math.min(Math.max(px+12,0),wrap.width-tip.offsetWidth)+'px';
}
function rpOut(id){const l=$('rpx_'+id),t=$('rpt_'+id);if(l)l.style.display='none';if(t)t.hidden=true}
function rpDonut(parts){
  const total=parts.reduce((a,x)=>a+x.v,0);
  if(!total)return `<div class="rp-empty">No documents in this period.</div>`;
  let off=0;const R=54,C=2*Math.PI*R;
  const arcs=parts.filter(x=>x.v>0).map(x=>{const len=C*x.v/total,a=`<circle cx="70" cy="70" r="${R}" fill="none" stroke-width="22" style="stroke:${x.c}" stroke-dasharray="${len} ${C-len}" stroke-dashoffset="${-off}" transform="rotate(-90 70 70)" tabindex="0" onmouseenter="rpDon('${esc(x.l)}',${x.v},${Math.round(x.v*1000/total)/10})" onfocus="rpDon('${esc(x.l)}',${x.v},${Math.round(x.v*1000/total)/10})"><title>${esc(x.l)}: ${x.v}</title></circle>`;off+=len;return a}).join('');
  return `<div class="rp-donut"><svg viewBox="0 0 140 140" role="img" aria-label="OCR outcomes">${arcs}<text x="70" y="66" text-anchor="middle" class="rp-dn" id="rp_dn">${total}</text><text x="70" y="84" text-anchor="middle" class="rp-ax" id="rp_dl">documents</text></svg><ul class="rp-dl">${parts.map(x=>`<li><i style="background:${x.c}"></i>${esc(x.l)} <b>${x.v}</b> <span class="sub">${Math.round(x.v*1000/total)/10}%</span></li>`).join('')}</ul></div>`;
}
function rpDon(l,v,p){const a=$('rp_dn'),b=$('rp_dl');if(a)a.textContent=v;if(b)b.textContent=l+' · '+p+'%'}
/* ---- CSV export (built from the data on screen) ---- */
function rpCell(v){let t=v==null?'':String(v);if(/^[=+\-@\t\r]/.test(t)&&isNaN(Number(t)))t="'"+t;return /[",\n\r]/.test(t)?'"'+t.replace(/"/g,'""')+'"':t}
function rpExport(){
  const r=rpState(),d=r.data;if(!d){toast('Nothing to export yet.');return}
  const kind=r.exp,day=v=>String(v).slice(0,10),loc=v=>new Date(v).toLocaleDateString('en-CA');
  let rows;
  if(kind==='daily'){
    rows=[['Date','Patients registered','Documents uploaded','OCR completed','OCR failed','Still processing','Avg processing time (sec)','Sign-ins','Patient & document actions','Active users','Failed events']]
      .concat(d.series.map(x=>[x.date,x.patients,x.uploaded,x.completed,x.failed,x.processing,x.avgMs==null?'':Math.round(x.avgMs/100)/10,x.logins,x.actions,x.activeUsers,x.failures]));
  }else if(kind==='ocr'){
    rows=[['OCR engine','Documents','Completed','Failed','Success rate (%)','Avg processing time (sec)']]
      .concat(d.ocr.byEngine.map(x=>[x.engine,x.documents,x.completed,x.failed,x.successRate==null?'':x.successRate,x.avgMs==null?'':Math.round(x.avgMs/100)/10]));
  }else{
    rows=[['Metric','Value'],['Period start',loc(d.range.from)],['Period end',loc(d.range.to)],['Days',d.range.days],['Generated at',new Date(d.generatedAt).toLocaleString()],
      ['Patients registered',d.patients.registered],['Patients registered (previous period)',d.patients.previous==null?'':d.patients.previous],['Total patients now',d.patients.total==null?'':d.patients.total],
      ['Documents uploaded',d.documents.total],['Documents uploaded (previous period)',d.documents.previous==null?'':d.documents.previous],
      ['OCR completed',d.ocr.completed],['OCR failed',d.ocr.failed],['Still processing',d.ocr.processing],['OCR success rate (%)',d.ocr.successRate==null?'':d.ocr.successRate],['OCR failure rate (%)',d.ocr.failureRate==null?'':d.ocr.failureRate],
      ['Avg processing time (sec)',d.processing.avgMs==null?'':Math.round(d.processing.avgMs/100)/10],['Median processing time (sec)',d.processing.medianMs==null?'':Math.round(d.processing.medianMs/100)/10],['Max processing time (sec)',d.processing.maxMs==null?'':Math.round(d.processing.maxMs/100)/10],['Documents with a recorded time',d.processing.samples],
      ['Sign-ins',d.activity.logins],['Failed sign-ins',d.activity.failedLogins],['Patient & document actions',d.activity.actions],['Failed events',d.activity.failures],['Active users',d.activity.activeUsers]]
      .concat(d.documents.byCategory.map(x=>['Documents: '+x.name,x.count]));
  }
  const csv='\ufeff'+rows.map(r=>r.map(rpCell).join(',')).join('\r\n');
  const a=document.createElement('a'),url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  a.href=url;a.download=`periscope-report-${kind}-${loc(d.range.from)}_to_${loc(d.range.to)}.csv`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
/* ---- page ---- */
function rpView(){
  const r=rpState();
  if(!r.loading&&!r.err&&(!r.data||Date.now()-r.at>60000)&&(r.range!=='custom'||(r.from&&r.to)))rpLoad();
  const d=r.data,custom=r.range==='custom';
  const bar=`<div class="card noprint"><div class="rp-bar"><div class="rp-seg" role="group" aria-label="Date range">${[[7,'Last 7 days'],[30,'Last 30 days'],[90,'Last 90 days'],['custom','Custom']].map(x=>`<button type="button" class="${r.range===x[0]?'on':''}" aria-pressed="${r.range===x[0]}" onclick="rpSetRange(${typeof x[0]==='number'?x[0]:"'custom'"})">${x[1]}</button>`).join('')}</div>${custom?`<div class="rp-cust"><div><label for="rp_from">From</label><input id="rp_from" type="date" value="${esc(r.from)}" max="${new Date().toLocaleDateString('en-CA')}"></div><div><label for="rp_to">To</label><input id="rp_to" type="date" value="${esc(r.to)}" max="${new Date().toLocaleDateString('en-CA')}"></div><div><button class="b p" onclick="rpApplyCustom()">Apply</button></div></div>`:''}<div class="rp-exp"><div><label for="rp_exp">CSV report</label><select id="rp_exp" onchange="rpState().exp=this.value"><option value="daily" ${r.exp==='daily'?'selected':''}>Daily trends</option><option value="summary" ${r.exp==='summary'?'selected':''}>Summary</option><option value="ocr" ${r.exp==='ocr'?'selected':''}>OCR by engine</option></select></div><div><button class="b" onclick="rpExport()" ${d?'':'disabled'}>Export CSV</button></div></div></div></div>`;
  const head=`<div class="phead"><div><h1>Reports &amp; Analytics</h1><p class="sub">${d?`${esc(rpLbl(d.series[0].date))} – ${esc(rpLbl(d.series[d.series.length-1].date))} · updated ${esc(new Date(d.generatedAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}))} · refreshes automatically`:'Live statistics from your Supabase records.'}</p></div><button class="b" onclick="rpRefresh()" ${r.loading?'disabled':''}>${r.loading?'Refreshing…':'Refresh'}</button></div>`;
  if(custom&&!d&&!r.err)return head+bar+'<div class="card"><p class="sub">Choose a start and end date, then press Apply.</p></div>';
  if(r.err)return head+bar+`<div class="card"><p class="err" role="alert">${esc(r.err)}</p><p><button class="b" onclick="rpRefresh()">Try again</button></p></div>`;
  if(!d)return head+bar+'<div class="card"><p class="sub">Loading report…</p></div>';
  const L=d.series.map(x=>x.date),col=x=>d.series.map(s=>s[x]);
  const kpi=(n,l,sub)=>`<div class="card stat"><b>${n}</b><span>${l}</span>${sub?`<div>${sub}</div>`:''}</div>`;
  const ocr=d.ocr,pc=d.processing,ac=d.activity;
  const engines=ocr.byEngine.length?`<div class="tw"><table><tr><th>Engine</th><th>Documents</th><th>Completed</th><th>Failed</th><th>Success rate</th><th>Avg time</th></tr>${ocr.byEngine.map(x=>`<tr><td>${esc(x.engine)}</td><td>${x.documents}</td><td>${x.completed}</td><td>${x.failed}</td><td>${rpPct(x.successRate)}</td><td>${rpDur(x.avgMs)}</td></tr>`).join('')}</table></div>`:'';
  const cats=d.documents.byCategory.length?`<div class="tw"><table><tr><th>Document category</th><th>Uploads</th></tr>${d.documents.byCategory.map(x=>`<tr><td>${esc(x.name)}</td><td>${x.count}</td></tr>`).join('')}</table></div>`:'';
  return head+bar+
  (d.truncated?'<div class="card note"><p>This period holds more than 50,000 records of one type, so figures cover the earliest 50,000. Choose a shorter range for exact numbers.</p></div>':'')+
  (!d.monitorColumns?'<div class="card note"><p>Processing times and OCR engines are not recorded yet. Run <b>backend/supabase-migration-v4-6-document-monitor.sql</b> once; documents uploaded afterwards will be included.</p></div>':'')+
  (d.migrationNeeded?'<div class="card note"><p>Run <b>backend/supabase-migration-v4-7-audit-security.sql</b> once so failed events are tracked precisely in activity trends.</p></div>':'')+
  `<div class="grid kpis rp-kpis">${kpi(rpN(d.patients.registered),'Patients registered',rpDelta(d.patients.registered,d.patients.previous))}${kpi(rpN(d.documents.total),'Documents uploaded',rpDelta(d.documents.total,d.documents.previous))}${kpi(rpPct(ocr.successRate),'OCR success rate',`<span class="rp-d">${ocr.completed} completed · ${ocr.failed} failed</span>`)}${kpi(rpDur(pc.avgMs),'Avg processing time',`<span class="rp-d">${pc.samples?pc.samples+' timed document'+(pc.samples===1?'':'s'):'No timed documents'}</span>`)}${kpi(rpN(ac.activeUsers),'Active users',`<span class="rp-d">${ac.logins} sign-in${ac.logins===1?'':'s'}</span>`)}</div>
  <div class="card"><div class="cardhead"><h3>Patient registrations</h3><span class="sub">${rpN(d.patients.total)} patient${d.patients.total===1?'':'s'} in total today</span></div>${rpChart('pat',{kind:'bar',title:'Patients registered per day',labels:L,series:[{key:'p',label:'Patients registered',color:'var(--teal)',values:col('patients')}]})}</div>
  <div class="card"><div class="cardhead"><h3>Document uploads &amp; processing</h3><span class="sub">By upload date</span></div>${rpChart('doc',{kind:'line',title:'Documents per day',labels:L,series:[{key:'u',label:'Uploaded',color:'var(--teal)',values:col('uploaded')},{key:'c',label:'Completed',color:'var(--ok)',values:col('completed')},{key:'f',label:'Failed',color:'var(--coral)',values:col('failed')}]})}${cats}</div>
  <div class="rp-two"><div class="card"><div class="cardhead"><h3>OCR outcomes</h3><span class="sub">Success ${rpPct(ocr.successRate)} · Failure ${rpPct(ocr.failureRate)}</span></div>${rpDonut([{l:'Completed',v:ocr.completed,c:'var(--ok)'},{l:'Failed',v:ocr.failed,c:'var(--coral)'},{l:'Processing',v:ocr.processing,c:'var(--amber)'}])}${engines}</div>
  <div class="card"><div class="cardhead"><h3>Average processing time</h3><span class="sub">Median ${rpDur(pc.medianMs)} · Longest ${rpDur(pc.maxMs)}</span></div>${rpChart('ms',{kind:'line',title:'Average processing time per day in seconds',labels:L,fmt:v=>(Math.round(v/100)/10)+' s',series:[{key:'a',label:'Avg processing time',color:'var(--amber)',values:col('avgMs')}]})}</div></div>
  <div class="card"><div class="cardhead"><h3>User activity trends</h3><span class="sub">${ac.actions} patient &amp; document actions · ${ac.failedLogins} failed sign-in${ac.failedLogins===1?'':'s'}</span></div>${rpChart('act',{kind:'line',title:'User activity per day',labels:L,series:[{key:'l',label:'Sign-ins',color:'var(--teal)',values:col('logins')},{key:'a',label:'Actions',color:'var(--ok)',values:col('actions')},{key:'u',label:'Active users',color:'var(--amber)',values:col('activeUsers')},{key:'f',label:'Failed events',color:'var(--coral)',values:col('failures')}]})}</div>
  <p class="sub au-note">All figures are aggregated live from current Supabase records. Deleted patients and documents are not counted, and no patient names, IDs or file names appear in reports or exports.</p>`;
}
