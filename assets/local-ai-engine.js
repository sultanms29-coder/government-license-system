(function(){
'use strict';
const AI={version:'27.1.0',records:[],sources:[],risk:[],ready:false};
const APP_MAP=[
 {k:['رخص','ترخيص'],name:'التراخيص',url:'apps/licenses/index.html'},
 {k:['عقد','العقود'],name:'العقود',url:'apps/contracts/index.html'},
 {k:['قضية','قضايا'],name:'القضايا',url:'apps/cases/index.html'},
 {k:['مشروع','المشاريع'],name:'المشاريع',url:'apps/projects/index.html'},
 {k:['شموس'],name:'شموس',url:'apps/shomoos/index.html'},
 {k:['مخالفة','غرامة','المخالفات'],name:'المخالفات',url:'apps/violations/index.html'},
 {k:['صادر','وارد','مراسلات'],name:'الصادر والوارد',url:'apps/correspondence/index.html'},
 {k:['فرص'],name:'الفرص',url:'apps/opportunities/index.html'}
];
const DATE_RX=/(date|expiry|expire|end|due|جلسة|انتهاء|تاريخ)/i;
const STATUS_RX=/(status|state|حالة)/i;
const CLOSED_RX=/(مغلق|منتهي|مكتمل|تم|closed|done|completed|cancelled|ملغي)/i;
const HIGH_RX=/(عاجل|حرج|متأخر|منتهي|غير مسدد|مفتوح|high|critical|overdue)/i;
function safe(v){try{return JSON.parse(v)}catch(e){return null}}
function flatten(value,out,source,path,depth){
 if(depth>6||value==null)return;
 if(Array.isArray(value)){value.forEach((v,i)=>flatten(v,out,source,path+'['+i+']',depth+1));return}
 if(typeof value==='object'){
   const keys=Object.keys(value); const scalar={}; let count=0;
   keys.forEach(k=>{const v=value[k]; if(v==null||['string','number','boolean'].includes(typeof v)){scalar[k]=v;count++}});
   if(count>=2){out.push({source,path,data:scalar,text:Object.values(scalar).join(' ')})}
   keys.forEach(k=>{if(value[k]&&typeof value[k]==='object')flatten(value[k],out,source,path+'.'+k,depth+1)});
 }
}
function load(){
 const rec=[],src=[];
 for(let i=0;i<localStorage.length;i++){
  const key=localStorage.key(i); if(!key||/password|pin|token|anon|apikey|supabase.*key/i.test(key))continue;
  const raw=localStorage.getItem(key); if(!raw||raw.length<4||raw.length>6000000)continue;
  const val=safe(raw); if(val&&typeof val==='object'){const before=rec.length;flatten(val,rec,key,key,0); if(rec.length>before)src.push(key)}
 }
 AI.records=dedupe(rec); AI.sources=src; AI.risk=score(AI.records); AI.ready=true; return AI;
}
function dedupe(arr){const s=new Set();return arr.filter(r=>{const x=r.source+'|'+r.path+'|'+r.text;if(s.has(x))return false;s.add(x);return true})}
function dateInfo(obj){
 let best=null;
 Object.entries(obj).forEach(([k,v])=>{if(!DATE_RX.test(k)||!v)return; const d=new Date(v); if(!isNaN(d)){const days=Math.ceil((d-Date.now())/86400000); if(!best||days<best.days)best={key:k,value:v,days}}});
 return best;
}
function getStatus(obj){for(const [k,v] of Object.entries(obj))if(STATUS_RX.test(k)&&v!=null)return String(v);return ''}
function label(r){const d=r.data;return d.name||d.title||d.subject||d.clubName||d.branch||d.licenseNumber||d.contractNumber||d.caseNumber||d.violationNumber||d.referenceNumber||d['اسم الفرع']||d['الموضوع']||d['الرقم']||r.path}
function score(records){return records.map(r=>{let points=0,reasons=[];const di=dateInfo(r.data),st=getStatus(r.data),txt=r.text;
 if(di){if(di.days<0&&!CLOSED_RX.test(st)){points+=100;reasons.push('تاريخ مستحق/منتهي منذ '+Math.abs(di.days)+' يومًا')}
 else if(di.days<=7){points+=80;reasons.push('موعد خلال '+Math.max(di.days,0)+' أيام')}
 else if(di.days<=30){points+=55;reasons.push('موعد خلال '+di.days+' يومًا')}
 else if(di.days<=90){points+=25;reasons.push('موعد خلال '+di.days+' يومًا')}}
 if(HIGH_RX.test(txt)&&!CLOSED_RX.test(st)){points+=25;reasons.push('الحالة تحتاج متابعة')}
 return {record:r,points:Math.min(points,100),reasons,label:label(r),date:di,status:st}
 }).filter(x=>x.points>0).sort((a,b)=>b.points-a.points)}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function summary(){load(); const total=AI.records.length, hi=AI.risk.filter(x=>x.points>=75).length, med=AI.risk.filter(x=>x.points>=40&&x.points<75).length; return {total,hi,med,sources:AI.sources.length,top:AI.risk.slice(0,8)}}
function answer(q){load(); q=(q||'').trim(); if(!q)return 'اكتب أمرك، مثل: ما أهم الأعمال اليوم؟';
 const app=APP_MAP.find(a=>a.k.some(k=>q.includes(k))&&/(افتح|انتقل|اذهب)/.test(q)); if(app){navigate(app.url);return 'جاري فتح نظام '+app.name+'…'}
 if(/أهم|أولو|اليوم|مخاطر|عاجل/.test(q)){const s=summary(); if(!s.top.length)return 'لم أجد سجلات عاجلة في البيانات المحلية المتاحة حاليًا.'; return 'أعلى الأولويات الآن:\n'+s.top.slice(0,6).map((x,i)=>`${i+1}. ${x.label} — ${x.points}% — ${x.reasons.join('، ')}`).join('\n')}
 if(/كم|إحصائ|ملخص المنصة|وضع المنصة/.test(q)){const s=summary();return `تم تحليل ${s.total} سجلًا محليًا من ${s.sources} مصادر. المخاطر العالية: ${s.hi}، والمتوسطة: ${s.med}.`}
 const days=(q.match(/(\d+)\s*يوم/)||[])[1]; if(/تنتهي|انتهاء|موعد/.test(q)){const n=Number(days||30);const a=AI.risk.filter(x=>x.date&&x.date.days>=0&&x.date.days<=n);return a.length?`السجلات ذات موعد خلال ${n} يومًا:\n`+a.slice(0,12).map((x,i)=>`${i+1}. ${x.label} — بعد ${x.date.days} يومًا`).join('\n'):`لا توجد سجلات واضحة ذات موعد خلال ${n} يومًا في البيانات المحلية.`}
 const terms=q.replace(/اعرض|ابحث|عن|لي|سجل|بيانات|كيف|وضع/g,' ').split(/\s+/).filter(x=>x.length>2); const found=AI.records.filter(r=>terms.every(t=>r.text.includes(t))).slice(0,12); if(found.length)return 'النتائج المطابقة:\n'+found.map((r,i)=>`${i+1}. ${label(r)} (${r.source})`).join('\n');
 return 'لم أجد نتيجة مباشرة. جرّب: «ما أهم الأعمال اليوم؟»، «اعرض ما ينتهي خلال 30 يومًا»، أو «افتح نظام المخالفات».'
}
function navigate(url){const root=location.pathname.includes('/apps/')?'../../':'';location.href=root+url}
function build(){if(document.getElementById('localAiFab'))return;
 const fab=document.createElement('button');fab.id='localAiFab';fab.className='local-ai-fab';fab.innerHTML='<span>🤖</span><b>مساعد الإدارة</b>';fab.onclick=()=>toggle(true);
 const box=document.createElement('section');box.id='localAiPanel';box.className='local-ai-panel';box.innerHTML=`<header><div><strong>مساعد الإدارة الذكي</strong><small>محلي • لا يرسل بيانات خارج الجهاز</small></div><button id="aiClose">×</button></header><div class="local-ai-metrics" id="aiMetrics"></div><div class="local-ai-chat" id="aiChat"><div class="ai-msg bot">مرحبًا، حللت البيانات المحلية المتاحة. اسألني عن الأولويات أو المواعيد أو اطلب فتح أي نظام.</div></div><div class="local-ai-chips"><button>ما أهم الأعمال اليوم؟</button><button>اعرض ما ينتهي خلال 30 يومًا</button><button>ملخص المنصة</button></div><form id="aiForm"><input id="aiInput" autocomplete="off" placeholder="اكتب أمرًا بالعربية…"><button>إرسال</button></form>`;
 document.body.append(fab,box);box.querySelector('#aiClose').onclick=()=>toggle(false);box.querySelectorAll('.local-ai-chips button').forEach(b=>b.onclick=()=>ask(b.textContent));box.querySelector('#aiForm').onsubmit=e=>{e.preventDefault();ask(box.querySelector('#aiInput').value);box.querySelector('#aiInput').value=''}; refreshMetrics();
}
function refreshMetrics(){const s=summary(),el=document.getElementById('aiMetrics');if(el)el.innerHTML=`<span><b>${s.total}</b> سجل محلل</span><span><b>${s.hi}</b> مخاطر عالية</span><span><b>${s.med}</b> متابعة</span>`}
function ask(q){if(!q.trim())return;const c=document.getElementById('aiChat');c.insertAdjacentHTML('beforeend',`<div class="ai-msg user">${esc(q)}</div>`);const a=answer(q);c.insertAdjacentHTML('beforeend',`<div class="ai-msg bot">${esc(a).replace(/\n/g,'<br>')}</div>`);c.scrollTop=c.scrollHeight;refreshMetrics()}
function toggle(show){const p=document.getElementById('localAiPanel');if(!p)return;p.classList.toggle('open',show);if(show){refreshMetrics();setTimeout(()=>document.getElementById('aiInput')?.focus(),100)}}
window.LocalEnterpriseAI={load,summary,answer,toggle};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',build);else build();
})();
