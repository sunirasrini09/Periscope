const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const ST={U:'● Unverified',V:'✓ Verified',C:'✎ Corrected',Q:'? Needs Clarification',X:'⚠ Conflict',N:'— Not Documented'};

// Navigation icons. Kept inline so the app has no dependency on an external icon library.
const IC={
  Dashboard:'<path d="M3 12 12 3l9 9"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/>',
  Patients:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  'Add Patient:' : '<path d="M12 5v14M5 12h14"/>',
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
  Logout:'<path d="M10 17l5-5-5-5M15 12H3"/><path d="M21 19V5a2 2 0 0 0-2-2h-6"/>'
};
const ico=name=>`<svg class="navico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[name]||'<circle cx="12" cy="12" r="8"/>'}</svg>`;
const tag=s=>`<span class="tag ${s}">${ST[s]}</span>`;
const nd=v=>v?esc(v):'<span class="sub">Not documented</span>';

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
const H='';
let P=[];
const S={u:null,v:'dash',pid:null,tab:'Overview',audit:[],q:'',ev:null,files:[],brief:false,auth:'login'};
const cur=()=>P.find(p=>p.id===S.pid);
const canV=()=>S.u&&S.u.role!=='Clinical Assistant';
const log=(a,f='',o='',n='')=>S.audit.unshift({t:new Date().toLocaleString(),u:S.u.name,r:S.u.role,pt:S.pid||'—',a,f,o,n});
const $=id=>document.getElementById(id);
function nv(v,tab){
  if(v==='add') return addPt();
  if(['doc','tl','an','ms','cf','qs','br'].includes(v) && !S.pid && P.length) S.pid=P[0].id;
  if(tab){
    if(!P.length){ S.v='pts'; S.tab='Overview'; render(); toast('Add a patient first to open this section.'); return; }
    return go('pt',S.pid||P[0].id,tab);
  }
  go(v);
}
function go(v,pid,tab){S.v=v;if(pid)S.pid=pid;if(tab)S.tab=tab;S.brief=false;S.ev=null;render();scrollTo(0,0); if(v==='pt'&&pid) refreshSinglePatient(pid); }
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
  }catch(err){toast(firebaseAuthMessage(err))}
}
let _lg=0;
function logo(v,mark){const id='lgm'+(++_lg),c=v==='dark'?{p:'#C5BAC4',w:'#DECDCD',a:'#F08A9B'}:{p:'#3F7488',w:'#1F3A47',a:'#D2566B'};
 const vb=mark?'520 405 220 280':'270 405 720 410',mw=mark?520:270,mh=405,ww=mark?220:720,hh=mark?280:410;
 return `<svg viewBox="${vb}" role="img" aria-label="PERISCOPE" xmlns="http://www.w3.org/2000/svg"><defs><mask id="${id}" maskUnits="userSpaceOnUse" x="${mw}" y="${mh}" width="${ww}" height="${hh}"><rect x="${mw}" y="${mh}" width="${ww}" height="${hh}" fill="#fff"/><circle cx="630" cy="517" r="79" fill="#000"/><circle cx="697" cy="456" r="32" fill="#000"/></mask></defs><g mask="url(#${id})" fill="${c.p}"><rect x="526" y="413" width="35" height="265"/><rect x="526" y="413" width="104" height="30"/><circle cx="630" cy="517" r="104"/></g><polyline points="572,520 607,520 622,484 640,559 655,520 690,520" fill="none" stroke="${c.a}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/><circle cx="697" cy="456" r="19" fill="${c.a}"/>${mark?'':`<text x="277" y="803" textLength="703" lengthAdjust="spacing" font-family="Montserrat,Inter,'Segoe UI',system-ui,-apple-system,sans-serif" font-weight="600" font-size="94" fill="${c.w}">PERISCOPE</text>`}</svg>`}
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
function signupView(){return `<div class="login"><h1 class="brand">${logo('light')}</h1><p><b>Create your account</b></p><p class="sub">Request access to the pre-anaesthesia preparation workspace. Accounts are intended for authorised clinical staff.</p>
 <div class="card" onkeydown="if(event.key==='Enter'&&event.target.tagName==='INPUT'&&event.target.type!=='checkbox')signup()"><div id="su_err" class="err" role="alert" hidden></div>
 <label for="su_name">Full name</label><input id="su_name" autocomplete="name">
 <label for="su_email">Work email</label><input id="su_email" type="email" autocomplete="email" placeholder="name@hospital.org">
 <div class="two"><div><label for="su_role">Role</label><select id="su_role"><option>Doctor</option><option>Clinical Assistant</option></select></div><div><label for="su_dept">Department</label><input id="su_dept" placeholder="e.g. Anaesthesiology"></div></div>
 <div class="two"><div><label for="su_pw">Password</label><input id="su_pw" type="password" autocomplete="new-password"></div><div><label for="su_pw2">Confirm password</label><input id="su_pw2" type="password" autocomplete="new-password"></div></div>
 <p class="sub" style="margin:4px 0 0">At least 8 characters, including a letter and a number.</p>
 <label class="chk" for="su_agree"><input id="su_agree" type="checkbox"><span>I understand PERISCOPE is a clinical workflow assistance prototype and does not replace professional medical judgement.</span></label>
 <p><button class="b p" style="width:100%" onclick="signup()">Create Account</button></p>
 <p class="sub">Already have an account? <button class="lnk" onclick="S.auth='login';render()">Sign in</button></p></div></div>`}
async function signup(){
  const g=id=>$(id).value.trim(),n=g('su_name'),e=g('su_email'),r=$('su_role').value,d=g('su_dept'),p=$('su_pw').value,p2=$('su_pw2').value;
  const err=m=>{const b=$('su_err');b.textContent=m;b.hidden=false;b.scrollIntoView({block:'nearest'})};
  if(!n)return err('Please enter your full name.');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))return err('Please enter a valid email address.');
  if(p.length<8||!/[A-Za-z]/.test(p)||!/\d/.test(p))return err('Password must be at least 8 characters and include a letter and a number.');
  if(p!==p2)return err('Passwords do not match.');
  if(!$('su_agree').checked)return err('Please tick the acknowledgement to continue.');
  try{
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
  S.u=null;S.auth='login';S.v='dash';render();toast('Signed out');
}
function render(){
 if(!S.u&&S.auth==='signup'){$('root').innerHTML=signupView();return}
 if(!S.u&&S.auth==='forgot'){$('root').innerHTML=forgotView();return}
 if(!S.u){$('root').innerHTML=`<div class="login"><h1 class="brand">${logo('light')}</h1><p><b>See the complete patient journey before anaesthesia.</b></p><p class="sub">An assistive platform for reconstructing fragmented oncology and anaesthesia records into a source-traceable clinical preparation view.</p>
 <div class="card"><label for="em">Email / Username</label><input id="em" value=""><label for="pw">Password</label><input id="pw" type="password" value=""><p class="sub">Your role (Doctor, Clinical Assistant or Admin) is assigned to your account and is not selected at login.</p><p><button class="b p" style="width:100%" onclick="login()">Sign In</button></p><p class="sub"><button class="lnk" onclick="S.auth='forgot';render()">Forgot Password?</button></p><p class="sub">New here? <button class="lnk" onclick="S.auth='signup';render()">Create an account</button></p></div></div>`;return}
 const nav=[['dash','Dashboard'],['pts','Patients'],['add','Add Patient'],['prof','Profile']].concat(S.u.role==='Admin'?[['users','User Management'],['audit','Audit Log']]:[]);
 $('root').innerHTML=`<div class="app"><aside><div class="logo">${logo('dark')}</div>${nav.map(n=>`<button class="${(n[2]?S.v==='pt'&&S.tab===n[2]:S.v===n[0]||(n[0]==='pts'&&S.v==='pt'&&!['Documents','Timeline','Anaesthesia','Missing Information','Conflicts','Questions','Brief'].includes(S.tab)))?'on':''}" onclick="nv('${n[0]}','${n[2]||''}')">${ico(n[1])}<span class="l">${n[1]}</span>${bdg(n[1])}</button>`).join('')}<div class="sp"></div>
 <button onclick="signOutUser()">${ico('Logout')}<span class="l">Logout</span></button><div style="font-size:12px;padding:8px 12px;opacity:.8">${esc(S.u.name)}<br>${esc(S.u.role)}</div></aside><main>${printBtn()}${S.v==='dash'?dash():S.v==='pts'?pts():S.v==='audit'?auditV():S.v==='not'?notif():S.v==='prof'?prof():S.v==='users'?users():pt()}</main></div>`}
function ptTable(list){return `<div class="tw"><table><tr><th>ID</th><th>Name</th><th>Age</th><th>Cancer diagnosis</th><th>Planned surgery</th><th>Surgery date</th><th>Status</th><th>Updated</th><th>Action</th></tr>${list.map(p=>`<tr><td>${p.id}</td><td>${esc(p.name)}</td><td>${p.age}</td><td>${esc(p.dx)}</td><td>${esc(p.surg)}</td><td>${displayDate(p.date)}</td><td>${esc(p.status)}</td><td>${p.upd}</td><td class="row"><button class="b" onclick="go('pt','${p.id}','Overview')">View</button><button class="b" onclick="editPt('${p.id}')">Edit</button><button class="b" onclick="go('pt','${p.id}','PAC')">PAC</button><button class="b p" onclick="go('pt','${p.id}','Brief')">Prepare Brief</button><button class="b w" ${canV()?'':'disabled title="Clinical Assistants cannot delete patients"'} onclick="askDeletePt('${p.id}')">Delete</button></td></tr>`).join('')||'<tr><td colspan=9>No patients match your search.</td></tr>'}</table></div>`}
const cnt=k=>P.reduce((a,p)=>a+(Array.isArray(p?.[k])?p[k]:[]).filter(x=>x.st==='Open'||x.st==='Missing').length,0);
const pend=()=>P.reduce((a,p)=>a+['tl','an','med','inv'].reduce((b,k)=>b+(Array.isArray(p?.[k])?p[k]:[]).filter(x=>x.st==='U'||x.st==='Q').length,0),0);
function dash(){return `<h1>Dashboard</h1><p class="sub">Records awaiting review across your patients.</p><div class="grid">${[['Total Patients',P.length],['Awaiting Review',P.filter(p=>p.status!=='Verified').length],['Documents Uploaded',P.reduce((a,p)=>a+p.docs.length,0)],['Missing Information',cnt('ms')],['Conflicts',cnt('cf')],['Pending Verification',pend()]].map(s=>`<div class="card stat click" tabindex="0" onclick="statGo('${s[0]}')" onkeydown="if(event.key==='Enter')statGo('${s[0]}')"><b>${s[1]}</b><span>${s[0]}</span></div>`).join('')}</div><h2>Recent patients</h2>${ptTable(P)}`}
function statGo(k){const m={'Total Patients':['pts'],'Awaiting Review':['pts'],'Documents Uploaded':['pt','Documents'],'Missing Information':['pt','Missing Information'],Conflicts:['pt','Conflicts'],'Pending Verification':['pt','Timeline']}[k];if(m[1]&&!P.length){toast('Add a patient first.');return}m[1]?go('pt',S.pid||P[0].id,m[1]):go(m[0])}
function pts(){const q=S.q.toLowerCase();const l=P.filter(p=>[p.id,p.name,p.dx,p.surg,p.hospital].join(' ').toLowerCase().includes(q));return `<h1>Patients</h1><div class="row" style="margin:10px 0"><input aria-label="Search patients" style="max-width:420px" placeholder="Search by ID, name, diagnosis, hospital, surgery" value="${esc(S.q)}" oninput="S.q=this.value;render();const i=document.querySelector('main input');i.focus();i.setSelectionRange(99,99)"><button class="b p" onclick="addPt()">Add Patient</button></div>${ptTable(l)}`}
function auditV(){return `<h1>Audit Log</h1>${auditT(S.audit)}`}
function auditT(a){return a.length?`<div class="tw"><table><tr><th>Time</th><th>User</th><th>Role</th><th>Patient</th><th>Action</th><th>Field</th><th>Previous</th><th>New</th></tr>${a.map(x=>`<tr><td>${x.t}</td><td>${esc(x.u)}</td><td>${esc(x.r)}</td><td>${x.pt}</td><td>${esc(x.a)}</td><td>${esc(x.f)}</td><td>${esc(x.o)}</td><td>${esc(x.n)}</td></tr>`).join('')}</table></div>`:`<p class="card">No changes recorded yet. Edits, verifications and uploads appear here.</p>`}
const TABS=['Overview','Details','Documents','Timeline','Medical History','Medications','Investigations','Cancer Treatment','Anaesthesia','PAC','Missing Information','Conflicts','Questions','Brief','Audit'];
function pt(){const p=cur();if(!p){return `<h1>No patient selected</h1><div class="card"><p>No patients are available yet.</p><button class="b p" onclick="addPt()">Add Patient</button></div>`}const t=S.tab;let body='';
 if(t==='Overview')body=`<div class="two"><div class="card"><h3>Cancer</h3>${esc(p.dx)}<br><span class="sub">Stage: ${nd(p.stage)}</span></div><div class="card"><h3>Planned procedure</h3>${esc(p.surg)}<br><span class="sub">${displayDate(p.date)} · ${esc(p.hospital)}</span></div><div class="card"><h3>Needs attention</h3>${p.cf.filter(x=>x.st==='Open').length} open conflict(s)<br>${p.ms.filter(x=>x.st==='Missing').length} missing item(s)<br>${p.qs.filter(x=>x.st==='Open').length} open question(s)</div><div class="card"><h3>Documents</h3>${p.docs.length} uploaded</div></div>`;
 else if(t==='Details')body=`<div class="card"><div class="two">${[['Name',p.name],['Age',p.age],['Sex',p.sex],['Hospital',p.hospital],['Diagnosis',p.dx],['Stage',p.stage],['Current treatment',p.treat],['Planned surgery',p.surg],['Surgery date',p.date],['Allergies',p.allergy],['Comorbidities',p.comorbidities||p.hist]].map(x=>`<div><div class="sub">${x[0]}</div>${nd(x[1])}</div>`).join('')}</div><p><button class="b p" onclick="editPt('${p.id}')">Edit Patient</button></p></div>`;
 else if(t==='Documents')body=docs(p);
 else if(t==='Timeline')body=timeline(p);
 else if(t==='Anaesthesia')body=`<p class="sub">Only documented information is shown. PERISCOPE does not conclude airway status.</p>`+vt(p,'an',['Date','Surgery','Anaesthesia','Documented event','Source'],x=>[x.d,x.s,x.a,x.ev,x.src],'ev');
 else if(t==='Cancer Treatment')body=vt(p,'tl',['Date','Treatment / event','Type','Source'],x=>[x.d,x.e,x.c,x.src+' p'+x.pg],'e',x=>['Diagnosis','Surgery','Chemotherapy','Radiotherapy','Immunotherapy','Targeted Therapy'].includes(x.c));
 else if(t==='Medical History')body=`<div class="card"><h3>Comorbidities</h3>${nd(p.comorbidities||p.hist)}<p class="sub">Source: ${esc(p.historySource||'Uploaded document')} · ${tag('U')}</p></div><div class="card"><h3>Allergies</h3>${nd(p.allergy)}</div>`;
 else if(t==='Medications')body=vt(p,'med',['Medication','Dose','Frequency','Source'],x=>[x.m,x.dose,x.freq,x.src],'m');
 else if(t==='Investigations')body=vt(p,'inv',['Date','Investigation','Documented result','Source'],x=>[x.d,x.t,x.r,x.src],'r');
 else if(t==='Missing Information')body=p.ms.length?p.ms.map((m,i)=>`<div class="card"><h3>${esc(m.i)}</h3><span class="tag Q">${esc(m.st)}</span><p>${esc(m.r)}</p><div class="row"><button class="b" onclick="setS('ms',${i},'Requested')">Request Document</button><button class="b" onclick="setS('ms',${i},'Not applicable')">Mark Not Applicable</button><button class="b p" onclick="setS('ms',${i},'Resolved')">Mark Resolved</button></div></div>`).join(''):`<div class="card"><h3>No Missing Information</h3>No missing records have been identified from the available documents.</div>`;
 else if(t==='Conflicts')body=p.cf.length?p.cf.map((c,i)=>`<div class="card conf"><h3>⚠ Information Conflict: ${esc(c.f)}</h3><span class="tag X">${esc(c.st)}</span><div class="two" style="margin:10px 0"><div class="note"><b>Source 1</b> (${esc(c.sa)})<br>“${esc(c.a)}”</div><div class="note"><b>Source 2</b> (${esc(c.sb)})<br>“${esc(c.b)}”</div></div><div class="row"><button class="b p" ${canV()?'':'disabled'} onclick="setS('cf',${i},'Resolved: Source 1 confirmed')">Confirm Source 1</button><button class="b p" ${canV()?'':'disabled'} onclick="setS('cf',${i},'Resolved: Source 2 confirmed')">Confirm Source 2</button><button class="b" ${canV()?'':'disabled'} onclick="setS('cf',${i},'Resolved: Both kept')">Keep Both</button><button class="b w" onclick="setS('cf',${i},'Needs clarification')">Needs Clarification</button></div></div>`).join(''):`<div class="card"><h3>No Conflicts Detected</h3>No conflicting information has been identified in the currently processed records.</div>`;
 else if(t==='Questions')body=qsV(p);
 else if(t==='PAC')body=PAC.view(p);
 else if(t==='Brief')body=brief(p);
 else body=auditT(S.audit.filter(a=>a.pt===p.id));
 return `${t==='Brief'?'':printHead(p,t)}<div class="noprint"><h1>${esc(p.name)} <span class="sub" style="font-size:16px">${p.id} · ${p.age}y</span></h1>
 <div class="row"><button class="b" onclick="editPt('${p.id}')">Edit Patient</button><button class="b p" onclick="S.tab='Documents';render()">Upload Records</button><button class="b p" onclick="genBrief()">Generate Brief</button></div>
 <div class="tabs" role="tablist">${TABS.map(x=>`<button role="tab" class="${t===x?'on':''}" onclick="S.tab='${x}';S.ev=null;render()">${x}</button>`).join('')}</div></div>${body}`}
function vt(p,k,heads,fn,fld,flt){const source=sortClinical(p[k]); const rows=source.map((x,i)=>[x,i]).filter(a=>!flt||flt(a[0]));if(!rows.length)return `<div class="card"><h3>Nothing documented yet</h3>Upload records to begin reconstructing the patient journey.</div>`;
 return `<div class="tw"><table><tr>${heads.map(h=>`<th>${h}</th>`).join('')}<th>Status</th><th class="noprint">Review</th></tr>${rows.map(([x,i])=>`<tr>${fn(x).map(v=>`<td>${nd(v)}</td>`).join('')}<td>${tag(x.st)}</td><td class="noprint"><div class="row"><button class="b" ${canV()?'':'disabled'} onclick="ver('${k}',${i},'V')">Confirm</button><button class="b" ${canV()?'':'disabled'} onclick="corr('${k}',${i},'${fld}')">Correct</button><button class="b" onclick="ver('${k}',${i},'Q')">Clarify</button></div></td></tr>`).join('')}</table></div>`}
function ver(k,i,s){toast(s==='V'?'Verified':'Marked for clarification');const x=cur()[k][i];log(s==='V'?'Information Verified':'Marked Needs Clarification',k,ST[x.st],ST[s]);x.st=s;render()}
function corr(k,i,f){const x=cur()[k][i];$('dlg').innerHTML=`<h3>Correct information</h3><label for="cv">Value</label><textarea id="cv" rows="3">${esc(x[f])}</textarea><div class="row" style="margin-top:14px"><button class="b p" onclick="saveC('${k}',${i},'${f}')">Save correction</button><button class="b" onclick="$('dlg').close()">Cancel</button></div>`;$('dlg').showModal()}
function saveC(k,i,f){const x=cur()[k][i],n=$('cv').value;log('Information Corrected',k+'.'+f,x[f],n);x[f]=n;x.st='C';$('dlg').close();render()}
function setS(k,i,s){const p=cur();const arr=Array.isArray(p?.[k])?p[k]:[];if(!arr[i])return;toast(s);const x=arr[i];log(k==='cf'?'Conflict Resolved':'Status Changed',k,x.st,s);x.st=s;render()}
function displayDate(d){
  const s=String(d||'').slice(0,10);
  const m=s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : (s || 'Undated');
}
function sortClinical(arr){
  return [...(arr||[])].sort((a,b)=>String(b.d||'').localeCompare(String(a.d||'')));
}
function timeline(p){
  const rows=sortClinical(p.tl);
  const e=S.ev!==null?rows[S.ev]:null;
  return `<p class="row noprint"><button class="b p" ${canV()?'':'disabled'} onclick="evForm(-1)">Add event</button></p><p class="sub">Newest documented events first. Select an event to see its source.</p><div class="tl">${rows.map((x,i)=>`<button class="ev ${S.ev===i?'sel':''}" onclick="S.ev=${i};render()"><b>${displayDate(x.d)}</b> · ${esc(x.e)} <span class="sub">(${esc(x.c||'Event')})</span> ${tag(x.st||'U')}</button>`).join('')}</div>${e?`<div class="card"><h3>Source</h3>${esc(e.src)} · page ${e.pg||1}<br>${tag(e.st||'U')}<p class="row"><button class="b" onclick="alert('Prototype: the original document opens at page ${e.pg||1} here.')">View Source</button><button class="b p" ${canV()?'':'disabled'} onclick="ver('tl',${S.ev},'V')">Verify event</button><button class="b" ${canV()?'':'disabled'} onclick="evForm(${S.ev})">Edit event</button><button class="b" ${canV()?'':'disabled'} onclick="delEv(${S.ev})">Delete event</button></p></div>`:''}`
}

function docs(p){const cat=d=>d.cat==='Other'?'Other — '+esc(d.cc):esc(d.cat);
 return `<div class="card noprint"><div class="dz" id="dropzone">Drag and drop medical records here<br><input type="file" id="fi" multiple accept=".pdf,.docx,.txt,.png,.jpg,.jpeg" style="display:none" onchange="pick(this.files)"><button class="b" style="margin-top:8px" onclick="$('fi').click()">Browse Files</button><p class="sub">Supported: PDF, DOCX, TXT, PNG, JPG · max 50 MB each</p></div><div id="fl">${S.files.map((f,i)=>`<div class="two" style="margin-top:10px"><div><b>${esc(f.n)}</b><div class="sub">${f.file?formatBytes(f.file.size):'Ready'}</div></div><div><select aria-label="Category" onchange="S.files[${i}].cat=this.value;if(this.value!=='Other')S.files[${i}].cc='';render()">${CATS.map(c=>`<option ${c===f.cat?'selected':''}>${c}</option>`).join('')}</select>${f.cat==='Other'?`<label>Specify Document Category</label><input placeholder="Enter the document category" value="${esc(f.cc)}" oninput="S.files[${i}].cc=this.value">`:''}</div></div>`).join('')}</div>${S.files.length?`<p><button class="b p" onclick="process()">Upload, extract text &amp; save records</button><button class="b" onclick="S.files=[];render()">Clear queue</button></p>`:''}<div id="prog"></div></div>
 <div class="card"><h3>Uploaded records</h3>${p.docs?.length?`<div class="tw"><table><tr><th>Document</th><th>Category</th><th>Date</th><th>Status</th><th>Text</th><th>Actions</th></tr>${p.docs.map((d,i)=>`<tr><td>${esc(d.n)}</td><td>${cat(d)}</td><td>${esc(d.dt||'')}</td><td>${esc(d.p||d.status||'Processed')}</td><td>${d.text?`<span class="tag V">Extracted</span>`:`<span class="tag Q">No text</span>`}</td><td class="row"><button class="b" onclick="viewDoc('${esc(p.id)}','${esc(d.id||'')}')">View text</button><button class="b" onclick="downloadDoc('${esc(p.id)}','${esc(d.id||'')}')">Open file</button><button class="b w" ${canV()?'':'disabled'} onclick="deleteDoc('${esc(p.id)}','${esc(d.id||'')}')">Delete</button></td></tr>`).join('')}</table></div>`:'<p class="sub">No documents uploaded yet.</p>'}</div>`}
async function viewDoc(patientId, docId){
  try {
    const r=await apiFetch(`/api/patients/${encodeURIComponent(patientId)}/documents/${encodeURIComponent(docId)}`);
    const d=r.document||{};
    const text=String(d.text||'').trim();
    $('dlg').innerHTML=`<h3>${esc(d.n||'Document')}</h3>
      <p class="sub">${esc(d.cat||'Other')} · ${esc(d.dt||'')} · ${esc(d.p||d.status||'Processed')}</p>
      <div class="card"><h4>Extracted text</h4>${text?`<pre style="white-space:pre-wrap;max-height:60vh;overflow:auto">${esc(text)}</pre>`:`<p class="sub">No text was extracted. If this DOCX contains scanned images only, it needs to be converted to an image/PDF or OCR support for embedded images added.</p>`}</div>
      <p class="row"><button class="b" onclick="$('dlg').close()">Close</button></p>`;
    $('dlg').showModal();
  } catch(e){ toast(`Could not open document: ${e.message}`); }
}

async function downloadDoc(patientId, docId){
  try {
    const r=await apiFetch(`/api/patients/${encodeURIComponent(patientId)}/documents/${encodeURIComponent(docId)}?download=1`);
    if(r.url) window.open(r.url,'_blank','noopener');
  } catch(e){ toast(`Could not open file: ${e.message}`); }
}

function formatBytes(n){if(!n)return '';const u=['B','KB','MB','GB'];let i=0,v=n;while(v>=1024&&i<u.length-1){v/=1024;i++}return `${v.toFixed(v>=10||i===0?0:1)} ${u[i]}`}

function toast(m){let t=$('toast');if(!t){t=document.createElement('div');t.id='toast';document.body.appendChild(t)}t.textContent=m;t.className='show';clearTimeout(t._h);t._h=setTimeout(()=>t.className='',2200)}
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
 <section class="pcard"><header><h3>Recently added documents</h3></header><div class="chips">${['All','Unverified','Verified','Corrected'].map(f=>`<button class="chip ${S.df===f?'on':''}" onclick="S.df='${f}';render()">${f}</button>`).join('')}</div><div class="pbody">${L.map(x=>`<div class="drow"><div><button class="t" onclick="docDlg(${x.pi},${x.di})">${esc(dname(x.d.n))}</button><div class="sub">${esc(x.p.name)} &nbsp; ${fdt(x.d.dt)}</div></div>${pill(x.d.v||'U',`title="Click to change status" onclick="cycD(${x.pi},${x.di})"`)}</div>`).join('')||'<p class="sub" style="padding:14px 0">No documents in this filter.</p>'}</div></section></div>`}
function setD(pi,di,v){if(!canV()){toast('Clinical Assistants cannot verify documents');return}const d=P[pi].docs[di];S.pid=P[pi].id;log('Document '+VL[v][0],'document',VL[d.v||'U'][0],VL[v][0]+': '+d.n);d.v=v;$('dlg').close();render();toast(dname(d.n)+' marked '+VL[v][0].toLowerCase())}
function cycD(pi,di){const d=P[pi].docs[di];setD(pi,di,{U:'V',V:'C',C:'U'}[d.v||'U'])}
function docDlg(pi,di){const p=P[pi],d=p.docs[di];$('dlg').innerHTML=`<h3>${esc(dname(d.n))}</h3><p class="sub">${esc(p.name)} · ${p.id}</p><div class="two"><div><div class="sub">File</div>${esc(d.n)}</div><div><div class="sub">Category</div>${d.cat==='Other'?'Other — '+esc(d.cc):esc(d.cat)}</div><div><div class="sub">Document date</div>${fdt(d.dt)}</div><div><div class="sub">Hospital</div>${esc(p.hospital)}</div><div><div class="sub">Processing</div>${esc(d.p)}</div><div><div class="sub">Status</div>${pill(d.v||'U','style="cursor:default"')}</div></div><div class="row" style="margin-top:16px"><button class="b p" onclick="setD(${pi},${di},'V')">Verify</button><button class="b" onclick="setD(${pi},${di},'C')">Mark corrected</button><button class="b" onclick="setD(${pi},${di},'U')">Reset</button><button class="b" onclick="go('pt','${p.id}','Timeline');$('dlg').close()">View timeline</button><button class="b" onclick="$('dlg').close()">Close</button></div>`;$('dlg').showModal()}

function printHead(p,t){return `<div class="printhead"><h1>PERISCOPE — ${esc(p.name)}</h1><p>${p.id} · ${p.age}y · ${p.sex} · ${esc(p.dx)}<br>Planned: ${esc(p.surg)} on ${displayDate(p.date)} · ${esc(p.hospital)}</p><h2 style="margin:8px 0 0">${t}</h2><p class="sub">Printed ${new Date().toLocaleString()} by ${esc(S.u.name)}</p></div>`}
function docTable(p){return `<div class="printonly"><h2>Documents</h2><table><tr><th>File</th><th>Category</th><th>Document date</th><th>Hospital</th><th>Status</th></tr>${p.docs.map(d=>`<tr><td>${esc(d.n)}</td><td>${d.cat==='Other'?'Other — '+esc(d.cc):esc(d.cat)}</td><td>${d.dt}</td><td>${esc(p.hospital)}</td><td>${VL[d.v||'U'][0]}</td></tr>`).join('')}</table></div>`}

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
 H('1. Patient Information');T(`${p.name} | ${p.id} | ${p.age}y | ${p.sex} | ${p.hospital}`);T(`${p.dx} | Stage: ${d(p.stage)}`);
 H('2. Planned Procedure');T(`${p.surg} | ${p.date} | ${p.hospital}`);
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
 H('13. Source Documents');B(p.docs,x=>`${x.n} - ${x.cat==='Other'?'Other: '+x.cc:x.cat} (${x.dt})`);
 H('14. Complete Patient Timeline');B(p.tl,x=>`${x.d}: ${x.e} (${x.c}; ${x.src} p${x.pg}) [${STL[x.st]}]`);
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
 T(`${p.id} - ${p.name}  | ${p.age}y | ${p.sex} | ${p.hospital}`,11,0,1);T(`${p.dx} | Stage: ${d(p.stage)} | Planned: ${p.surg} on ${p.date}`);T(`PAC status: ${PAC.stat(p)}`,10.5,0,1);
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
      S.files.push({key,n:f.name,file:f,cat:CATS[0],cc:''});
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
    for(const f of S.files){
      if(!f.file) throw new Error(`No file data available for ${f.n}`);
      el.innerHTML=`<div class="card"><h3>Processing Records</h3><div>✓ Selected: ${esc(f.n)}</div><p class="sub">Uploading securely and extracting text...</p></div>`;
      const formData=new FormData();
      formData.append('document',f.file,f.n);
      formData.append('category',f.cat);
      formData.append('customCategory',f.cc||'');
      const result=await apiFetch(`/api/patients/${encodeURIComponent(p.id)}/documents`,{method:'POST',body:formData});
      const fresh = result.patient ? normalizePatient(result.patient) : normalizePatient((await apiFetch(`/api/patients/${encodeURIComponent(p.id)}`)).patient || {});
      const idx=P.findIndex(x=>x.id===p.id);
      if(idx>=0) P[idx]=fresh;
      log('Document Uploaded','document','',f.n+(f.cc?' ('+f.cc+')':''));
      el.innerHTML=`<div class="card"><h3>Processing Records</h3>
        <div>✓ Document stored in Supabase</div><div>✓ Text extraction completed</div><div>✓ Timeline, anaesthesia, medications and investigations refreshed</div>
        <h4>Extracted text</h4><pre style="white-space:pre-wrap;max-height:400px;overflow:auto">${esc(result.text||'No text found')}</pre>
      </div>`;
    }
    S.files=[];
    log('Document Text Extraction Completed');
    render();
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
return [`${p.name} · ${p.id} · ${p.age}y ${p.sex} · ${p.hospital}`,
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
 ${sec(1,'Patient Information',`${esc(p.name)} · ${p.id} · ${p.age}y · ${p.sex} · ${esc(p.hospital)}<br>${esc(p.dx)} · Stage: ${nd(p.stage)}`)}
 ${sec(2,'Planned Procedure',`${esc(p.surg)} · ${displayDate(p.date)} · ${esc(p.hospital)}`)}
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
 ${sec(13,'Source Documents',L(p.docs,d=>`${esc(d.n)} — ${d.cat==='Other'?'Other: '+esc(d.cc):esc(d.cat)} (${d.dt})`))}
 ${sec(14,'Complete Patient Timeline',L(p.tl,x=>`${x.d}: ${esc(x.e)} <span class="sub">(${x.c})</span> <i>(${esc(x.src)} p${x.pg})</i> ${tag(x.st)}`))}
 ${PAC.brief(p,15)}
 <p class="note"><b>Prototype for clinical workflow assistance. Not intended for autonomous clinical decision-making.</b> No recommendations or risk scores are generated.</p>`}
const FLD=[['name','Patient name',0],['age','Age',0],['sex','Sex',0],['hospital','Hospital',0],['dx','Cancer diagnosis',1],['stage','Stage (if documented)',1],['treat','Current treatment',1],['surg','Planned surgery',1],['date','Surgery date',1],['allergy','Allergies',1],['hist','Comorbidities / medical history',1]];
function form(p,title,onsave){$('dlg').innerHTML=`<h3>${title}</h3>${FLD.map(f=>`<label for="f_${f[0]}">${f[1]}</label><input id="f_${f[0]}" value="${esc(p[f[0]])}">`).join('')}${S.u.role==='Clinical Assistant'?'<p class="sub">Clinical Assistants can add and edit patient information and upload records. Patient deletion and clinical verification remain restricted.</p>':''}<div class="row" style="margin-top:14px"><button class="b p" onclick="${onsave}">Save Patient</button><button class="b" onclick="$('dlg').close()">Cancel</button></div>`;$('dlg').showModal()}
function editPt(id){S.pid=id;form(cur(),'Edit Patient',"saveEdit()")}
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
function addPt(){const p={id:'P'+Date.now().toString().slice(-10),name:'',age:'',sex:'',hospital:H,dx:'',stage:'',treat:'',surg:'',date:'',allergy:'',hist:'',status:'Awaiting Review',upd:new Date().toISOString().slice(0,10),docs:[],tl:[],an:[],med:[],inv:[],cf:[],ms:[],qs:[]};S.newP=p;form(p,'Add Patient',"saveNew()")}
async function saveNew() {
  const p = S.newP;
  FLD.forEach(f => p[f[0]] = $('f_'+f[0]).value);
  if (!p.name.trim()) { alert('Please enter the required information: patient name.'); return; }
  p.age = +p.age || '';
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
const CT=['Diagnosis','Surgery','Anaesthesia','Chemotherapy','Radiotherapy','Immunotherapy','Targeted Therapy','Hospitalization','Investigation','Consultation','Medication','Other'];
function evForm(i){const x=i<0?{d:'',e:'',c:'Surgery',src:'',pg:1,st:'U'}:cur().tl[i];$('dlg').innerHTML=`<h3>${i<0?'Add':'Edit'} timeline event</h3><label for="ed">Date (YYYY-MM)</label><input id="ed" value="${esc(x.d)}"><label for="ee">Event</label><input id="ee" value="${esc(x.e)}"><label for="ec">Category</label><select id="ec">${CT.map(c=>`<option ${c===x.c?'selected':''}>${c}</option>`).join('')}</select><label for="es">Source document</label><input id="es" value="${esc(x.src)}"><div class="row" style="margin-top:14px"><button class="b p" onclick="saveEv(${i})">Save event</button><button class="b" onclick="$('dlg').close()">Cancel</button></div>`;$('dlg').showModal()}
function saveEv(i){const p=cur(),n={d:$('ed').value.trim(),e:$('ee').value.trim(),c:$('ec').value,src:$('es').value.trim()||'Manual entry',pg:1,st:'C'};if(!n.d||!n.e){alert('Please enter the required information: date and event.');return}
 if(i<0){p.tl.push(n);log('Timeline Event Added','event','',n.e)}else{log('Timeline Event Edited','event',p.tl[i].e,n.e);p.tl[i]=Object.assign(p.tl[i],n)}
 p.tl.sort((a,b)=>a.d.localeCompare(b.d));S.ev=null;$('dlg').close();render()}
function delEv(i){log('Timeline Event Deleted','event',cur().tl[i].e,'');cur().tl.splice(i,1);S.ev=null;render()}
function notif(){const l=[];P.forEach(p=>{p.cf.filter(x=>x.st==='Open').forEach(x=>l.push(`⚠ Conflict detected for ${p.id}: ${x.f}`));p.ms.filter(x=>x.st==='Missing').forEach(x=>l.push(`Missing information for ${p.id}: ${x.i}`));p.docs.slice(-1).forEach(d=>l.push(`Document processed for ${p.id}: ${d.n}`))});
 return `<h1>Notifications</h1>${l.map(t=>`<div class="card">${esc(t)}</div>`).join('')||'<div class="card">No new notifications.</div>'}`}
function prof(){return `<h1>Profile</h1><div class="card two"><div><div class="sub">Name</div>${esc(S.u.name)}</div><div><div class="sub">Email</div>${esc(S.u.email||'')}</div><div><div class="sub">Role</div>${esc(S.u.role)}</div><div><div class="sub">Hospital / Department</div>${S.u.dept||'—'}</div><div><div class="sub">Account status</div>Active</div></div><div class="row"><button class="b" onclick="alert('Prototype: profile editing is not connected to a backend.')">Edit Profile</button><button class="b" onclick="alert('Prototype: password change is not connected to a backend.')">Change Password</button></div>`}
function users(){const u=S.u?[ [S.u.name,S.u.email,S.u.role,'Active','Current','—'] ]:[];
 return `<h1>User Management</h1><p><button class="b p" onclick="alert('Prototype: user creation needs the backend.')">Add User</button></p><div class="tw"><table><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Last login</th><th>Created</th><th>Actions</th></tr>${u.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}<td class="row"><button class="b">Edit</button><button class="b">Disable</button><button class="b">Reset Password</button></td></tr>`).join('')}</table></div>`}
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
const d={pactype:'PAC',proc:p.surg,dos:p.date,unit:p.hospital,vdate:today,chemo:j(f('Chemotherapy')),rt:j(f('Radiotherapy')),surg:j(f('Surgery')),allergy:p.allergy=='Not documented'?'':p.allergy,
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
set('proc','Patient record');set('dos','Patient record');set('unit','Patient record');set('chemo',t(f('Chemotherapy')));set('rt',t(f('Radiotherapy')));set('surg',t(f('Surgery')));if(D.allergy)r.allergy=p.cf.some(c=>c.f=='Allergy'&&c.st=='Open')?'⚠ Auto-filled · Conflicting records (see Conflicts tab) — please verify':'✓ Auto-filled · Patient record';return r}
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
const tbl=(hd,rows)=>`<div class="tw"><table><tr>${hd.map(h=>`<th>${h}</th>`).join('')}</tr>${rows}</table></div>`;
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
const PERISCOPE_API_URL = localStorage.getItem('periscope_api_url') || location.origin;
let apiLoaded = false;
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
      apiFetch('/api/me', {headers:{'X-Periscope-Role': localStorage.getItem('periscope_role_'+user.uid)||'Doctor'}}),
      apiFetch('/api/patients')
    ]);
    const u = profile.user || {};
    const role = u.role || localStorage.getItem('periscope_role_'+user.uid) || 'Doctor';
    const dept = u.dept || localStorage.getItem('periscope_dept_'+user.uid) || '';
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
      P[i] = {...old, ...remote, docs: remote.docs || old.docs || []};
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
    if(i>=0){ P[i]=keepUnsavedPac([P[i]],[fresh])[0]; if(typeof PAC!=='undefined'&&PAC.rebind) PAC.rebind(P[i]); if(S.pid===id&&!(S.tab==='PAC'&&PAC.isDirty(id))) _periscopeOriginalRender(); }
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
    P = keepUnsavedPac(P, fresh);
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
    if(S.tab==='Audit' && !auditLoading){
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
