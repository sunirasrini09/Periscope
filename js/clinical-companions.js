/* Peri & Sia clinical companions v2.
   - Curated, static oncology facts only (no runtime AI, no generated medical content).
   - Patient flags are rule-based "needs attention" signals computed from documented gaps in the records.
     They are NOT a clinical risk score and never make clinical decisions.
   - Preferences, manual flags and "since last visit" snapshots are stored in this browser only (localStorage). */
(function(){
  'use strict';
  const CONFIG={
    development:true,developmentIntervalMinutes:3,productionIntervalHours:2.5,messageSeconds:11,
    avatars:{peri:'assets/avatars/peri-cutout.webp',sia:'assets/avatars/sia-cutout.webp'},
    busts:{peri:'assets/avatars/peri-bust.webp',sia:'assets/avatars/sia-bust.webp'},
    roam:{speedPxPerSec:72,pauseMinSec:7,pauseMaxSec:18,minHopPx:150},
    priority:{high:8,watch:4,maxListed:5,surgerySoonDays:7,surgeryNearDays:14,surgeryHorizonDays:30}
  };
  window.PERI_SIA_CONFIG=CONFIG;
  const VERIFIED='2026-11-05';
  const sources={NCI:'https://www.cancer.gov/about-cancer/causes-prevention',NCI_SCREEN:'https://www.cancer.gov/about-cancer/screening',NCI_TREAT:'https://www.cancer.gov/about-cancer/treatment',NCI_BIOMARK:'https://www.cancer.gov/about-cancer/diagnosis-staging/diagnosis/tumor-markers-fact-sheet',WHO:'https://www.who.int/news-room/fact-sheets/detail/cancer',CDC:'https://www.cdc.gov/cancer/prevention/index.htm',CDC_VAX:'https://www.cdc.gov/vaccines/vpd/hpv/hcp/recommendations.html',USPSTF:'https://www.uspreventiveservicestaskforce.org/uspstf/recommendation-topics/uspstf-a-and-b-recommendations'};
  const FACTS=[
 ['Tobacco use is the leading preventable cause of cancer and cancer deaths.','NCI'],
 ['Avoiding tobacco, including second-hand smoke, lowers cancer risk.','CDC'],
 ['Maintaining a healthy body weight can reduce the risk of several cancers.','NCI'],
 ['Regular physical activity is associated with lower risk of several cancers.','NCI'],
 ['Limiting alcohol can reduce the risk of certain cancers; less is better for cancer prevention.','NCI'],
 ['Ultraviolet radiation from the sun and tanning devices can cause skin cancer.','CDC'],
 ['Shade, protective clothing, and broad-spectrum sunscreen help reduce UV exposure.','CDC'],
 ['HPV vaccination prevents infections that cause most cervical cancers and several other cancers.','CDC_VAX'],
 ['Hepatitis B vaccination helps prevent liver cancer caused by chronic HBV infection.','WHO'],
 ['Some infections, including HPV, hepatitis B/C and H. pylori, are linked to cancer.','WHO'],
 ['A diet rich in whole grains, vegetables and fruit supports a healthy lifestyle; no single food prevents cancer.','NCI'],
 ['Cancer screening is intended to find cancer or precancerous changes before symptoms develop.','NCI_SCREEN'],
 ['Screening recommendations depend on cancer type, age, risk factors and local guidance.','NCI_SCREEN'],
 ['A screening test is not a diagnostic confirmation; abnormal results may need follow-up testing.','NCI_SCREEN'],
 ['Not every cancer has an effective routine screening test for people at average risk.','NCI_SCREEN'],
 ['People with a strong family history may need earlier or additional risk assessment.','NCI'],
 ['A new or persistent symptom deserves clinical assessment; screening does not replace symptom evaluation.','NCI_SCREEN'],
 ['Cervical screening can detect precancerous changes, allowing treatment before cancer develops.','WHO'],
 ['Breast screening decisions should consider age, personal risk and shared decision-making.','USPSTF'],
 ['Colorectal screening can detect precancerous polyps as well as early cancer.','USPSTF'],
 ['Lung cancer screening with low-dose CT is recommended only for defined higher-risk groups.','USPSTF'],
 ['Cancer diagnosis is usually confirmed by examining tissue or cells in a pathology laboratory.','NCI_TREAT'],
 ['Imaging helps determine the location and extent of disease but may not establish cancer type alone.','NCI_TREAT'],
 ['Cancer stage describes the extent of cancer in the body and helps guide treatment planning.','NCI_TREAT'],
 ['Cancer grade describes how abnormal cells look and may indicate how quickly a tumour may grow.','NCI_TREAT'],
 ['A second pathology review can be useful when diagnosis or treatment decisions are complex.','NCI_TREAT'],
 ['Treatment plans may combine surgery, radiation therapy, chemotherapy, immunotherapy or targeted therapy.','NCI_TREAT'],
 ['Treatment choice depends on cancer type, stage, biomarkers, overall health and patient preferences.','NCI_TREAT'],
 ['Biomarker testing can help identify treatments that may work for some cancers.','NCI_BIOMARK'],
 ['A biomarker result must be interpreted in the context of tumour type and the specific assay.','NCI_BIOMARK'],
 ['Not every patient or cancer has an actionable biomarker.','NCI_BIOMARK'],
 ['Tumour markers in blood are not usually sufficient on their own to diagnose cancer.','NCI_BIOMARK'],
 ['Some biomarker tests use tumour tissue; others may use blood or other samples.','NCI_BIOMARK'],
 ['Targeted therapies act on specific molecules involved in cancer growth and spread.','NCI_TREAT'],
 ['Immunotherapy helps the immune system recognize and attack cancer cells.','NCI_TREAT'],
 ['Chemotherapy can affect healthy fast-growing cells as well as cancer cells.','NCI_TREAT'],
 ['Radiation therapy uses high doses of radiation to kill cancer cells or shrink tumours.','NCI_TREAT'],
 ['Surgery may be used to diagnose, stage, remove or relieve symptoms from cancer.','NCI_TREAT'],
 ['Palliative care can be provided alongside cancer treatment to relieve symptoms and stress.','WHO'],
 ['Cancer rehabilitation can help address physical, emotional and functional effects of treatment.','NCI_TREAT'],
 ['Fertility preservation should be discussed before treatment that may affect reproductive function.','NCI_TREAT'],
 ['Smoking cessation remains beneficial after a cancer diagnosis and during treatment.','NCI'],
 ['Follow-up care after treatment helps monitor recovery, late effects and possible recurrence.','NCI_TREAT'],
 ['A treatment summary and survivorship care plan can support continuity between care teams.','NCI_TREAT'],
 ['Clinical trial participation is voluntary; eligibility and potential benefits and risks should be discussed.','NCI_TREAT'],
 ['Cancer risk is influenced by age, genetics, environment, infections and lifestyle factors.','WHO'],
 ['Inherited pathogenic variants account for a minority of cancers; most are not inherited.','NCI'],
 ['Genetic counselling can help assess inherited cancer risk and explain testing options.','NCI'],
 ['Avoiding exposure to known occupational carcinogens can reduce cancer risk.','WHO'],
 ['Early diagnosis and timely access to appropriate treatment improve outcomes for many cancers.','WHO']
  ].map((f,i)=>({id:i+1,text:f[0],source:f[1],url:sources[f[1]],verified:VERIFIED}));
  const SIA=[
   'A gentle reminder: take a sip of water when you have a moment.',
   'You have been focusing for a while. Give your eyes a brief rest.',
   'Welcome back. One step at a time is still progress.',
   'Take a comfortable breath and relax your shoulders.',
   'A short stretch between tasks can help you reset.',
   'Remember to blink and look away from the screen occasionally.',
   'Your careful work matters. Thank you for the attention you give each patient.',
   'If it is time for a break, step away from the screen for a moment.',
   'Stay hydrated and keep a water bottle within reach.',
   'Good work today. Keep a steady pace and be kind to yourself.'
  ];

  /* ---------- helpers & local preferences ---------- */
  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const REDUCED=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  const PK='periscope.companions.v2';
  const store={
    get(k,d){try{const v=localStorage.getItem(PK+'.'+k);return v?JSON.parse(v):d}catch(e){return d}},
    set(k,v){try{localStorage.setItem(PK+'.'+k,JSON.stringify(v))}catch(e){}}
  };
  const prefs=Object.assign({mode:'active',roam:true,mute:false},store.get('prefs',{}));
  const savePrefs=()=>store.set('prefs',prefs);
  const uid=()=>(typeof S!=='undefined'&&S.u&&(S.u.uid||S.u.email||S.u.id||S.u.name))||'anon';
  const patients=()=>(typeof P!=='undefined'&&Array.isArray(P))?P:[];
  const arr=(p,k)=>Array.isArray(p&&p[k])?p[k]:[];
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const sessionStart=Date.now();

  /* ---------- manual flags (device-local) ---------- */
  const flagsAll=()=>store.get('flags',{});
  const myFlags=()=>flagsAll()[uid()]||{};
  const isPinned=id=>!!myFlags()[id];
  function togglePin(id){const all=flagsAll(),m=all[uid()]||{};if(m[id])delete m[id];else m[id]={at:Date.now()};all[uid()]=m;store.set('flags',all);
    if(typeof toast==='function')toast(m[id]?'Flagged for follow-up (this device)':'Follow-up flag removed');if(typeof render==='function')render();}

  /* ---------- rule-based attention signals ---------- */
  function daysToSurgery(p){
    if(!p||!p.date)return null;const s=String(p.date);
    const d=/^\d{4}-\d{2}-\d{2}/.test(s)?new Date(s.slice(0,10)+'T00:00:00'):new Date(s);
    if(isNaN(d))return null;const t=new Date();t.setHours(0,0,0,0);return Math.round((d-t)/864e5);
  }
  function signals(p){
    const C=CONFIG.priority,cf=arr(p,'cf').filter(x=>x.st==='Open').length,ms=arr(p,'ms').filter(x=>x.st==='Missing').length,
      qs=arr(p,'qs').filter(x=>x.st==='Open').length,
      unv=['tl','an','med','inv'].reduce((a,k)=>a+arr(p,k).filter(x=>x.st==='U'||x.st==='Q').length,0),
      docsU=arr(p,'docs').filter(d=>(d.v||'U')==='U').length,days=daysToSurgery(p),reasons=[];let score=0;
    const today=new Date().toISOString().slice(0,10),acts=(p.pac&&Array.isArray(p.pac.acts))?p.pac.acts:[];
    const overdue=acts.filter(a=>(a.status==='Pending'||a.status==='In Progress')&&a.due&&a.due<today).length;
    if(cf){score+=Math.min(cf,4)*3;reasons.push(cf+' open conflict'+(cf>1?'s':''))}
    if(ms){score+=Math.min(ms,4)*2;reasons.push(ms+' missing item'+(ms>1?'s':''))}
    if(days!==null&&days>=0&&days<=C.surgeryNearDays){score+=days<=2?5:days<=C.surgerySoonDays?3:1;reasons.push(days===0?'Procedure today':days===1?'Procedure tomorrow':'Procedure in '+days+' days')}
    if(days!==null&&days>C.surgeryNearDays&&days<=C.surgeryHorizonDays){score+=.5;reasons.push('Surgery planned in '+days+' days')}
    if(overdue){score+=Math.min(overdue,3)*2;reasons.push(overdue+' overdue PAC action'+(overdue>1?'s':''))}
    if(!p.allergy&&days!==null&&days>=0&&days<=C.surgeryNearDays){score+=1.5;reasons.push('Allergy not documented')}
    if(qs){score+=Math.min(qs,3);reasons.push(qs+' open question'+(qs>1?'s':''))}
    if(docsU){score+=Math.min(docsU,5)*.4;reasons.push(docsU+' document'+(docsU>1?'s':'')+' to verify')}
    score+=Math.min(unv,10)*.3;
    return {cf,ms,qs,unv,docsU,days,overdue,score,reasons};
  }
  function priorities(){
    const C=CONFIG.priority,out=[];
    patients().forEach(p=>{
      const s=signals(p),pinned=isPinned(p.id);
      const level=pinned?'pinned':s.score>=C.high?'high':s.score>=C.watch?'watch':null;
      if(!level)return;
      if(p.status==='Verified'&&!pinned&&s.score<C.high)return;
      out.push(Object.assign({p,level,pinned},s));
    });
    const rank={pinned:0,high:1,watch:2};
    /* within the same level, the earliest upcoming planned surgery date comes first; no/past date goes last */
    const dKey=x=>(x.days!==null&&x.days>=0)?x.days:Infinity;
    return out.sort((a,b)=>rank[a.level]-rank[b.level]||(dKey(a)-dKey(b)||0)||b.score-a.score);
  }
  const levelLabel={pinned:'Your follow-up flag',high:'Needs attention first',watch:'Review soon'};

  /* ---------- performance snapshot (since last visit, this device) ---------- */
  function metrics(){
    const list=patients(),n=list.length;
    const open=list.reduce((a,p)=>a+arr(p,'cf').filter(x=>x.st==='Open').length+arr(p,'ms').filter(x=>x.st==='Missing').length+arr(p,'qs').filter(x=>x.st==='Open').length,0);
    const docs=list.reduce((a,p)=>a+arr(p,'docs').length,0),docsU=list.reduce((a,p)=>a+arr(p,'docs').filter(d=>(d.v||'U')==='U').length,0);
    const ready=list.filter(p=>!arr(p,'cf').some(x=>x.st==='Open')&&!arr(p,'ms').some(x=>x.st==='Missing')).length;
    return {n,open,docs,docsU,ready,readyPct:n?Math.round(ready/n*100):0,verifiedPct:docs?Math.round((docs-docsU)/docs*100):0};
  }
  function delta(m){
    if(!m.n)return null;const all=store.get('snap',{}),me=all[uid()]||{},day=new Date().toISOString().slice(0,10);
    if(!me.cur)me.cur=Object.assign({day},m);
    else if(me.cur.day!==day){me.prev=me.cur;me.cur=Object.assign({day},m)}
    else me.cur=Object.assign({day},m);
    all[uid()]=me;store.set('snap',all);
    return me.prev?{open:m.open-me.prev.open,docsU:m.docsU-me.prev.docsU,readyPct:m.readyPct-me.prev.readyPct,since:me.prev.day}:null;
  }

  /* ---------- messages ---------- */
  const state={timer:null,hideTimer:null,index:0,lastCharacter:'Sia',current:null,started:false,msgVisible:false,periCount:0,lastBreak:0};
  function contextual(){
    const list=priorities();if(!list.length)return null;
    const top=list[0],reason=top.reasons.slice(0,2).join(' · ');
    return {character:'Peri',text:list.length===1?`${top.p.name} needs attention first: ${reason}.`:`${list.length} records need attention. Starting with ${top.p.name}: ${reason}.`,
      source:null,url:null,verified:null,action:{label:'Open record',id:top.p.id}};
  }
  function nextMessage(forceContext){
    if(forceContext){const c=contextual();if(c){state.lastCharacter='Peri';return c}}
    const character=state.lastCharacter==='Peri'?'Sia':'Peri';state.lastCharacter=character;
    if(character==='Peri'){
      state.periCount++;
      if(state.periCount%3===1){const c=contextual();if(c)return c}
      const f=FACTS[state.index%FACTS.length];state.index++;
      return {character,text:f.text,source:f.source,url:f.url,verified:f.verified};
    }
    const mins=(Date.now()-sessionStart)/60000;
    if(mins>=75&&Date.now()-state.lastBreak>45*60000){state.lastBreak=Date.now();
      return {character,text:`You have been working for about ${Math.round(mins/5)*5} minutes. A short break will help you stay sharp.`,source:null,url:null,verified:null}}
    return {character,text:SIA[Math.floor(state.index/2)%SIA.length],source:null,url:null,verified:null};
  }
  const avatarSrc=c=>CONFIG.avatars[String(c).toLowerCase()];
  const bustSrc=c=>CONFIG.busts[String(c).toLowerCase()];

  /* ---------- floating roaming companion ---------- */
  const W={el:null,actor:null,x:null,target:null,walking:false,endT:null,roamT:null,hover:false,menu:false};
  const alive=()=>typeof S!=='undefined'&&S.u&&W.el&&document.body.contains(W.el);
  function typing(){const a=document.activeElement;return !!a&&(/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)||a.isContentEditable)}
  function bounds(){
    let min=8;const nav=document.getElementById('sidenav');
    if(nav&&innerWidth>800){min=Math.max(8,nav.getBoundingClientRect().right+8)}
    const w=W.el?W.el.offsetWidth:64;return {min,max:Math.max(min,innerWidth-w-12)};
  }
  function place(x,animate,sec){W.el.style.transition=animate?`transform ${sec}s linear`:'none';W.el.style.transform=`translate3d(${x}px,0,0)`;W.x=x}
  function setFacing(deg){W.el.style.setProperty('--turn',deg+'deg')}
  function walkTo(tx){
    const b=bounds();tx=clamp(tx,b.min,b.max);const dist=Math.abs(tx-W.x);if(dist<40){scheduleRoam();return}
    const sec=dist/CONFIG.roam.speedPxPerSec;setFacing(tx>W.x?24:-24);W.el.classList.add('cc-walking');
    place(tx,true,sec);W.target=tx;W.walking=true;clearTimeout(W.endT);W.endT=setTimeout(arrive,sec*1000+80);
  }
  function arrive(){W.walking=false;W.x=W.target;W.el.classList.remove('cc-walking');setFacing(0);scheduleRoam()}
  function freeze(){
    if(!W.walking||!W.el)return;const x=W.el.getBoundingClientRect().left;place(x,false);
    W.walking=false;clearTimeout(W.endT);W.el.classList.remove('cc-walking');setFacing(0);
  }
  function blocked(){
    return prefs.mode!=='active'||!prefs.roam||REDUCED||document.hidden||state.msgVisible||W.hover||W.menu||
      !!document.querySelector('dialog[open]')||typing();
  }
  function scheduleRoam(){
    clearTimeout(W.roamT);const r=CONFIG.roam;
    W.roamT=setTimeout(roamTick,(r.pauseMinSec+Math.random()*(r.pauseMaxSec-r.pauseMinSec))*1000);
  }
  function roamTick(){
    if(!alive()){return}
    if(blocked()){scheduleRoam();return}
    const b=bounds();let tx=W.x;
    for(let i=0;i<6;i++){tx=b.min+Math.random()*(b.max-b.min);if(Math.abs(tx-W.x)>=CONFIG.roam.minHopPx)break}
    walkTo(tx);
  }
  function applyMode(){
    if(!W.el)return;const tucked=prefs.mode==='tucked';
    W.el.classList.toggle('cc-tucked',tucked);document.body.classList.toggle('cc-on',!tucked);
    freeze();const b=bounds();
    if(tucked)place(innerWidth-W.el.offsetWidth-14,true,.5);
    else if(W.x==null||W.x>b.max||W.x<b.min)place(b.max,true,.5);
    const t=document.getElementById('cc-avatar');
    if(t)t.setAttribute('aria-label',tucked?'Bring Peri and Sia back':'Open companion message');
    updateBadge();
  }
  function updateBadge(){
    const n=priorities().length,b=document.getElementById('cc-badge');if(!b)return;
    b.textContent=n>9?'9+':String(n);b.hidden=!n;b.setAttribute('aria-label',n+' record'+(n===1?'':'s')+' flagged');
  }

  function mount(){
    if(typeof S==='undefined'||!S.u)return;
    if(document.getElementById('clinical-companions')){W.el=document.getElementById('clinical-companions');updateBadge();return}
    const w=document.createElement('div');w.id='clinical-companions';w.className='cc-widget';W.el=w;
    w.innerHTML=`<div class="cc-message" id="cc-message" role="status" aria-live="polite" aria-hidden="true">
      <div class="cc-message-head"><img class="cc-mini" id="cc-mini" alt="" width="34" height="34"><b id="cc-name">Peri</b>
        <span class="cc-head-actions"><button type="button" id="cc-opts" aria-haspopup="true" aria-expanded="false" aria-label="Companion options" title="Options">&#8943;</button><button type="button" id="cc-close" aria-label="Close message" title="Close">&times;</button></span></div>
      <div class="cc-menu" id="cc-menu" role="menu" hidden>
        <button type="button" role="menuitem" data-act="tuck">Tuck away</button>
        <button type="button" role="menuitem" data-act="roam"></button>
        <button type="button" role="menuitem" data-act="mute"></button></div>
      <p id="cc-text"></p><div class="cc-action" id="cc-action"></div><small id="cc-source"></small></div>
      <div class="cc-actor" id="cc-actor"><button type="button" class="cc-avatar" id="cc-avatar" aria-label="Open companion message">
        <img id="cc-img" alt="" decoding="async"><span class="cc-contact" aria-hidden="true"></span></button>
        <span class="cc-badge" id="cc-badge" hidden></span>
        <button type="button" class="cc-hide" id="cc-hide" aria-label="Tuck companions away" title="Tuck away">&#8964;</button></div>`;
    document.body.appendChild(w);W.actor=w.querySelector('#cc-actor');
    const img=w.querySelector('#cc-img');img.src=avatarSrc('Peri');
    w.querySelector('#cc-avatar').addEventListener('click',()=>{if(prefs.mode==='tucked'){setMode('active');return}
      if(state.msgVisible){hideMessage();return}state.current=nextMessage(true)||state.current||nextMessage();showCurrent(true)});
    w.querySelector('#cc-close').addEventListener('click',hideMessage);
    w.querySelector('#cc-hide').addEventListener('click',()=>setMode('tucked'));
    w.querySelector('#cc-opts').addEventListener('click',e=>{e.stopPropagation();toggleMenu()});
    w.querySelector('#cc-menu').addEventListener('click',e=>{const a=e.target.closest('button')?.dataset.act;if(!a)return;
      if(a==='tuck')setMode('tucked');if(a==='roam'){prefs.roam=!prefs.roam;savePrefs();if(prefs.roam)scheduleRoam()}
      if(a==='mute'){prefs.mute=!prefs.mute;savePrefs()}toggleMenu(false);syncMenu()});
    w.addEventListener('pointerenter',()=>{W.hover=true;freeze()});w.addEventListener('pointerleave',()=>{W.hover=false});
    w.addEventListener('focusin',()=>{W.hover=true;freeze()});w.addEventListener('focusout',()=>{W.hover=false});
    w.addEventListener('keydown',e=>{if(e.key==='Escape'){if(W.menu)toggleMenu(false);else hideMessage()}});
    const b=bounds();place(b.max,false);syncMenu();applyMode();
    window.addEventListener('resize',()=>{if(!W.el)return;freeze();const bb=bounds();place(prefs.mode==='tucked'?innerWidth-W.el.offsetWidth-14:clamp(W.x,bb.min,bb.max),false)});
    document.addEventListener('visibilitychange',()=>{if(document.hidden)freeze()});
    if(!state.started)start();scheduleRoam();
  }
  function setMode(m){prefs.mode=m;savePrefs();if(m==='tucked')hideMessage();applyMode();if(m==='active')scheduleRoam();
    const t=document.getElementById('cc-toggle');if(t)t.textContent=m==='tucked'?'Bring Peri & Sia back':'Tuck companions away'}
  function toggleMenu(force){
    const m=document.getElementById('cc-menu'),o=document.getElementById('cc-opts');if(!m)return;
    W.menu=force===undefined?!W.menu:force;m.hidden=!W.menu;o.setAttribute('aria-expanded',String(W.menu));
    if(W.menu)m.querySelector('button').focus();
  }
  function syncMenu(){
    const r=document.querySelector('#cc-menu [data-act=roam]'),m=document.querySelector('#cc-menu [data-act=mute]');
    if(r)r.textContent=prefs.roam?'Stay put':'Let them roam';if(m)m.textContent=prefs.mute?'Unmute messages':'Mute messages';
  }

  function showCurrent(manual){
    if(!W.el)return;if(!state.current)state.current=nextMessage();
    if(prefs.mode==='tucked'&&!manual)return;if(prefs.mute&&!manual)return;
    if(!manual&&typing()){clearTimeout(state.deferT);state.deferT=setTimeout(()=>showCurrent(false),20000);return}
    const m=state.current;freeze();
    const img=document.getElementById('cc-img');img.src=avatarSrc(m.character);img.alt='';
    const mini=document.getElementById('cc-mini');mini.src=bustSrc(m.character);
    document.getElementById('cc-name').textContent=m.character;document.getElementById('cc-text').textContent=m.text;
    const act=document.getElementById('cc-action');act.innerHTML=m.action?`<button type="button" class="b p" onclick="ccOpen('${esc(m.action.id)}')">${esc(m.action.label)}</button>`:'';
    const src=document.getElementById('cc-source');
    src.innerHTML=m.url?`Reference: <a href="${esc(m.url)}" target="_blank" rel="noopener noreferrer">${esc(m.source)} source</a> · verified ${esc(m.verified)}`:'';
    const bw=Math.min(310,innerWidth-36);W.el.classList.toggle('cc-right',W.x+bw+8>innerWidth);
    W.el.classList.add('cc-visible');state.msgVisible=true;document.getElementById('cc-message').setAttribute('aria-hidden','false');
    clearTimeout(state.hideTimer);state.hideTimer=setTimeout(hideMessage,CONFIG.messageSeconds*1000+(m.action?6000:0));
  }
  function hideMessage(){
    if(!W.el)return;W.el.classList.remove('cc-visible');state.msgVisible=false;toggleMenu(false);
    document.getElementById('cc-message').setAttribute('aria-hidden','true');clearTimeout(state.hideTimer);scheduleRoam();
  }
  function scheduleNext(){
    clearTimeout(state.timer);const mins=CONFIG.development?CONFIG.developmentIntervalMinutes:CONFIG.productionIntervalHours*60;
    state.timer=setTimeout(()=>{state.current=nextMessage();showCurrent(false);scheduleNext()},mins*60000);
  }
  function start(){if(state.started)return;state.started=true;state.current=nextMessage(true);showCurrent(false);scheduleNext()}
  function stop(){
    state.started=false;[state.timer,state.hideTimer,state.deferT,W.roamT,W.endT].forEach(clearTimeout);
    if(W.el)W.el.remove();W.el=null;W.x=null;state.msgVisible=false;state.lastCharacter='Sia';state.periCount=0;state.current=null;
    document.body.classList.remove('cc-on');
  }
  function speak(who){
    if(!W.el)return;if(prefs.mode==='tucked')setMode('active');
    state.lastCharacter=who==='Peri'?'Sia':'Peri';state.current=nextMessage();showCurrent(true);
  }

  /* ---------- dashboard panel (2.5D stage + attention list + metrics) ---------- */
  const part=()=>{const h=new Date().getHours();return h<12?'Good morning':h<17?'Good afternoon':'Good evening'};
  const dlt=(v,goodDown,u)=>{if(!v)return '<em class="cc-flat">no change since last visit</em>';const good=goodDown?v<0:v>0;return `<em class="${good?'cc-good':'cc-warn'}">${v>0?'+':''}${v}${u||''} since last visit</em>`};
  function renderDashboardPanel(){
    const panel=document.getElementById('cc-dashboard-card');if(!panel)return;
    const list=priorities(),m=metrics(),d=delta(m),top=list[0];
    const sub=!m.n?'Add a patient to begin. Peri and Sia will flag records that need attention.'
      :list.length?`${list.length} of ${m.n} record${m.n>1?'s':''} flagged for attention. They are ordered by documented gaps and upcoming procedure dates.`
      :'No records are flagged right now. Keep verifying documents as they arrive.';
    const rows=list.slice(0,CONFIG.priority.maxListed).map(x=>`
      <li class="cc-row cc-${x.level}"><span class="cc-dot" aria-hidden="true"></span>
        <div class="cc-row-main"><b>${esc(x.p.name||'Unnamed patient')}</b><small>${esc(levelLabel[x.level])}</small>
          <div class="cc-chips">${x.reasons.slice(0,3).map(r=>`<span>${esc(r)}</span>`).join('')}</div></div>
        <div class="cc-row-actions"><button type="button" class="b" onclick="ccOpen('${esc(x.p.id)}')">Open</button>
          <button type="button" class="cc-pin${x.pinned?' on':''}" aria-pressed="${x.pinned}" aria-label="${x.pinned?'Remove follow-up flag for':'Flag for follow-up:'} ${esc(x.p.name||'patient')}" title="${x.pinned?'Remove follow-up flag':'Flag for follow-up'}" onclick="ccTogglePin('${esc(x.p.id)}')">&#9873;</button></div></li>`).join('');
    panel.innerHTML=`<div class="cc-dash-inner">
      <div class="cc-dash-copy">
        <span class="cc-eyebrow">PERI &amp; SIA · TODAY</span>
        <h2>${part()}.</h2><p>${esc(sub)}</p>
        <div class="cc-metrics">
          <div><b>${m.readyPct}%</b><span>Records with no open conflicts or missing items</span>${d?dlt(d.readyPct,false,'%'):''}</div>
          <div><b>${m.open}</b><span>Open items to resolve</span>${d?dlt(d.open,true):''}</div>
          <div><b>${m.docsU}</b><span>Documents awaiting verification</span>${d?dlt(d.docsU,true):''}</div></div>
        <div class="cc-cta">${top?`<button type="button" class="b p" onclick="ccOpen('${esc(top.p.id)}')">Review next: ${esc(top.p.name||'patient')}</button>`:''}
          <button type="button" class="b" onclick="ccSpeak('Peri')">Peri&rsquo;s insight</button>
          <button type="button" class="b" onclick="ccSpeak('Sia')">Sia&rsquo;s check-in</button>
          <button type="button" class="cc-link" id="cc-toggle" onclick="ccToggleMode()">${prefs.mute?'Resume pop-ups':'Pause pop-ups'}</button></div>
        ${rows?`<h3 class="cc-h3">Flagged records</h3><ul class="cc-list">${rows}</ul><p class="cc-note">Flags are rule-based reminders from documented gaps and dates, not a clinical risk assessment. Follow-up flags are saved on this device only.</p>`:''}
      </div></div>`;
    updateBadge();
  }

  /* ---------- timed solo appearances: one companion at a time ---------- */
  const SOLO_INTERVAL=3*60*1000;   /* one companion every 3 minutes, on every screen */
  const SOLO_VISIBLE=14000;
  let nextSolo='Peri';
  let soloPaused=!!prefs.mute;
  let soloDock=null;
  function soloMessage(who){
    if(who==='Peri'){
      const list=priorities();
      if(list.length){
        const top=list[0],reason=top.reasons.slice(0,2).join(' · ');
        return {title:'Priority reminder',text:`${top.p.name||'Patient'} · ${levelLabel[top.level]}. ${reason}.`,action:{id:top.p.id,label:'Review record'}};
      }
      return {title:'Flag & prioritise',text:'No records are currently flagged. Review open gaps and upcoming procedure dates.',action:null};
    }
    const f=FACTS[state.index%FACTS.length];state.index++;
    const wellness=SIA[Math.floor(state.index/2)%SIA.length];
    return {title:'Cancer care & wellness tip',text:`${f.text} ${wellness}`,source:f.source,url:f.url,action:null};
  }
  function ensureSoloWidget(){
    if(W.el&&document.body.contains(W.el))return W.el;
    let el=document.getElementById('clinical-companions');
    if(!el){el=document.createElement('div');el.id='clinical-companions';document.body.appendChild(el)}
    const host=document.querySelector('dialog[open]')||document.body;
    if(el.parentNode!==host)host.appendChild(el);
    el.className=el.className.indexOf('cc-solo')>-1?el.className:'cc-solo';el.setAttribute('aria-live','polite');el.setAttribute('aria-atomic','true');W.el=el;return el;
  }
  function hideMessage(){
    if(!W.el)return;W.el.classList.remove('cc-solo-show','cc-solo-walking');W.el.classList.add('cc-solo-hide');state.msgVisible=false;
    clearTimeout(state.hideTimer);setTimeout(()=>{if(W.el&&!state.msgVisible){W.el.innerHTML='';W.el.classList.remove('cc-solo-hide')}},500);
  }
  function showSolo(who,manual){
    if(typeof S==='undefined'||!S.u)return;
    if(prefs.mute&&!manual)return;
    const el=ensureSoloWidget(),m=soloMessage(who);state.current=m;state.msgVisible=true;
    const avatar=CONFIG.avatars[who.toLowerCase()];
    el.innerHTML=`<div class="cc-solo-card" role="status">
      <div class="cc-solo-copy"><div class="cc-solo-heading"><span>${who==='Peri'?'Peri · Clinical companion':'Sia · Wellness companion'}</span><button type="button" class="cc-solo-close" aria-label="Dismiss">×</button></div>
      <b class="cc-solo-title">${esc(m.title)}</b><p>${esc(m.text)}</p>
      ${m.url?`<small>Source: <a href="${esc(m.url)}" target="_blank" rel="noopener noreferrer">${esc(m.source)} guidance</a></small>`:''}
      ${m.action?`<button class="b p cc-solo-action" type="button">${esc(m.action.label)}</button>`:''}</div>
      <div class="cc-solo-character"><img src="${esc(avatar)}" alt="${who}"/><span>${who}</span></div></div>`;
    el.classList.remove('cc-solo-hide');el.classList.add('cc-solo-walking');
    requestAnimationFrame(()=>{if(W.el===el)el.classList.add('cc-solo-show')});
    el.querySelector('.cc-solo-close').addEventListener('click',hideMessage);
    const action=el.querySelector('.cc-solo-action');if(action&&m.action)action.addEventListener('click',()=>window.ccOpen(m.action.id));
    clearTimeout(state.hideTimer);state.hideTimer=setTimeout(hideMessage,SOLO_VISIBLE);
  }
  function showCurrent(manual){showSolo(nextSolo,!!manual);nextSolo=nextSolo==='Peri'?'Sia':'Peri'}
  function scheduleNext(){
    clearTimeout(state.timer);if(!state.started||soloPaused)return;
    state.timer=setTimeout(function fire(){
      if(!state.started||soloPaused)return;
      /* never skip a cycle: if the tab is hidden or the user is typing, retry shortly */
      if(document.hidden||typing()){clearTimeout(state.deferT);state.deferT=setTimeout(fire,8000);return}
      showCurrent(false);scheduleNext();
    },SOLO_INTERVAL);
  }
  function start(){if(state.started)return;state.started=true;state.msgVisible=false;nextSolo='Peri';scheduleNext()}
  function stop(){state.started=false;[state.timer,state.hideTimer,state.deferT].forEach(clearTimeout);if(W.el)W.el.remove();W.el=null;state.msgVisible=false;state.current=null}
  function speak(who){if(!W.el)ensureSoloWidget();showSolo(who,true)}
  function setMode(m){prefs.mode=m;savePrefs();if(m==='tucked')hideMessage()}
  /* return the pop-up to <body> when a modal dialog closes, so it keeps appearing on every screen */
  document.addEventListener('close',e=>{const d=e.target;if(d&&d.tagName==='DIALOG'&&W.el&&d.contains(W.el)){document.body.appendChild(W.el);W.el.classList.remove('cc-solo-show');state.msgVisible=false}},true);
  window.ccDismiss=hideMessage;
  window.ccOpen=id=>{hideMessage();if(typeof go==='function')go('pt',id,'Brief')};
  window.ccTogglePin=togglePin;window.ccSpeak=speak;
  window.ccToggleMode=()=>{soloPaused=!soloPaused;prefs.mute=soloPaused;savePrefs();if(soloPaused)hideMessage();else scheduleNext();const b=document.getElementById('cc-toggle');if(b)b.textContent=soloPaused?'Resume pop-ups':'Pause pop-ups';if(typeof toast==='function')toast(soloPaused?'Companion pop-ups paused':'Companion pop-ups resumed')};
  window.ccFlagButton=id=>{const on=isPinned(id);return `<button type="button" class="schip cc-flagbtn${on?' on':''}" aria-pressed="${on}" onclick="ccTogglePin('${esc(id)}')" title="Saved on this device only">&#9873; ${on?'Flagged for follow-up':'Flag for follow-up'}</button>`};
  window.mountClinicalCompanions=()=>{if(typeof S==='undefined'||!S.u)return;ensureSoloWidget();if(!state.started)start()};
  window.startClinicalCompanions=start;window.stopClinicalCompanions=stop;
  window.renderClinicalCompanionPanel=renderDashboardPanel;window.PERI_ONCOLOGY_FACTS=FACTS;window.ccPriorities=priorities;
})();
