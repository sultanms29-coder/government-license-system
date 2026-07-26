(function(){
'use strict';
const AI={version:'27.4.0',records:[],sources:[],risk:[],analysis:null,recommendations:[],ready:false};
const APP_MAP=[
 {id:'licenses',k:['رخص','ترخيص'],name:'التراخيص',url:'apps/licenses/index.html',icon:'📋'},
 {id:'contracts',k:['عقد','العقود','إيجار'],name:'العقود',url:'apps/contracts/index.html',icon:'📑'},
 {id:'cases',k:['قضية','قضايا','جلسة'],name:'القضايا',url:'apps/cases/index.html',icon:'⚖️'},
 {id:'projects',k:['مشروع','المشاريع'],name:'المشاريع',url:'apps/projects/index.html',icon:'🏗️'},
 {id:'shomoos',k:['شموس'],name:'شموس',url:'apps/shomoos/index.html',icon:'🛡️'},
 {id:'violations',k:['مخالفة','غرامة','المخالفات'],name:'المخالفات',url:'apps/violations/index.html',icon:'🚨'},
 {id:'correspondence',k:['صادر','وارد','مراسلات','خطاب'],name:'الصادر والوارد',url:'apps/correspondence/index.html',icon:'📨'},
 {id:'opportunities',k:['فرص','استطلاع'],name:'الفرص والمشروعات الحكومية',url:'apps/opportunities/index.html',icon:'🏛️'}
];
const DATE_RX=/(date|expiry|expire|end|due|deadline|جلسة|انتهاء|تاريخ|موعد|استحقاق)/i;
const STATUS_RX=/(status|state|حالة|وضع)/i;
const CLOSED_RX=/(مغلق|منتهي|مكتمل|تم|closed|done|completed|cancelled|ملغي|مسدد|محفوظ)/i;
const HIGH_RX=/(عاجل|حرج|متأخر|منتهي|غير مسدد|مفتوح|high|critical|overdue|متوقف)/i;
const OPEN_RX=/(مفتوح|قائم|جاري|تحت الإجراء|قيد|open|active|pending|in progress)/i;
function safe(v){try{return JSON.parse(v)}catch(e){return null}}
function norm(s){return String(s??'').toLowerCase().replace(/[ـًٌٍَُِّْ]/g,'').trim()}
function flatten(value,out,source,path,depth){
 if(depth>7||value==null)return;
 if(Array.isArray(value)){value.forEach((v,i)=>flatten(v,out,source,path+'['+i+']',depth+1));return}
 if(typeof value==='object'){
   const keys=Object.keys(value),scalar={};let count=0;
   keys.forEach(k=>{const v=value[k];if(v==null||['string','number','boolean'].includes(typeof v)){scalar[k]=v;count++}});
   if(count>=2){out.push({source,path,data:scalar,text:Object.values(scalar).join(' ')})}
   keys.forEach(k=>{if(value[k]&&typeof value[k]==='object')flatten(value[k],out,source,path+'.'+k,depth+1)});
 }
}
function classify(r){
 const hay=norm(r.source+' '+r.path+' '+r.text+' '+Object.keys(r.data).join(' '));
 const scores={};
 APP_MAP.forEach(a=>{scores[a.id]=a.k.reduce((n,k)=>n+(hay.includes(norm(k))?1:0),0)});
 const keyMap=[
  ['licenses',/(license|permit|رخص|ترخيص|بلدي|دفاع مدني)/i],['contracts',/(contract|lease|عقد|إيجار)/i],
  ['cases',/(case|lawsuit|قضي|جلسة|ناجز)/i],['projects',/(project|مشروع|نسبة إنجاز)/i],
  ['shomoos',/(shomoos|شموس)/i],['violations',/(violation|fine|مخالف|غرام)/i],
  ['correspondence',/(correspond|incoming|outgoing|صادر|وارد|مراسلات)/i],['opportunities',/(opportunit|فرص|استطلاع)/i]
 ];
 keyMap.forEach(([id,rx])=>{if(rx.test(hay))scores[id]+=3});
 const best=Object.entries(scores).sort((a,b)=>b[1]-a[1])[0];
 return best&&best[1]>0?best[0]:'other';
}
function load(){
 const rec=[],src=[];
 for(let i=0;i<localStorage.length;i++){
  const key=localStorage.key(i);if(!key||/password|pin|token|anon|apikey|supabase.*key|session|credential/i.test(key))continue;
  const raw=localStorage.getItem(key);if(!raw||raw.length<4||raw.length>6000000)continue;
  const val=safe(raw);if(val&&typeof val==='object'){const before=rec.length;flatten(val,rec,key,key,0);if(rec.length>before)src.push(key)}
 }
 AI.records=dedupe(rec).map(r=>({...r,system:classify(r)}));AI.sources=[...new Set(src)];AI.risk=score(AI.records);AI.analysis=analyze(AI.records,AI.risk);AI.recommendations=buildRecommendations(AI.records,AI.risk,AI.analysis);AI.ready=true;return AI;
}
function dedupe(arr){const s=new Set();return arr.filter(r=>{const x=r.source+'|'+r.path+'|'+r.text;if(s.has(x))return false;s.add(x);return true})}
function parseDate(v){if(!v)return null;const s=String(v).trim();let d=new Date(s);if(!isNaN(d))return d;const m=s.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);if(m){d=new Date(+m[3],+m[2]-1,+m[1]);if(!isNaN(d))return d}return null}
function dateInfo(obj){let best=null;Object.entries(obj).forEach(([k,v])=>{if(!DATE_RX.test(k)||!v)return;const d=parseDate(v);if(d){const days=Math.ceil((d-Date.now())/86400000);if(!best||days<best.days)best={key:k,value:v,days,date:d}}});return best}
function getStatus(obj){for(const [k,v] of Object.entries(obj))if(STATUS_RX.test(k)&&v!=null)return String(v);return ''}
function label(r){const d=r.data;return d.name||d.title||d.subject||d.clubName||d.branch||d.licenseNumber||d.contractNumber||d.caseNumber||d.violationNumber||d.referenceNumber||d['اسم الفرع']||d['الموضوع']||d['رقم المخالفة']||d['رقم الخطاب']||d['الرقم']||r.path}
function score(records){return records.map(r=>{let points=0,reasons=[];const di=dateInfo(r.data),st=getStatus(r.data),txt=r.text;
 if(di){if(di.days<0&&!CLOSED_RX.test(st)){points+=100;reasons.push('تاريخ مستحق أو منتهي منذ '+Math.abs(di.days)+' يومًا')}
 else if(di.days<=7){points+=80;reasons.push('موعد خلال '+Math.max(di.days,0)+' أيام')}
 else if(di.days<=30){points+=55;reasons.push('موعد خلال '+di.days+' يومًا')}
 else if(di.days<=90){points+=25;reasons.push('موعد خلال '+di.days+' يومًا')}}
 if(HIGH_RX.test(txt)&&!CLOSED_RX.test(st)){points+=25;reasons.push('الحالة تحتاج متابعة')}
 return {record:r,points:Math.min(points,100),reasons,label:label(r),date:di,status:st,system:r.system}
 }).filter(x=>x.points>0).sort((a,b)=>b.points-a.points)}

function recommendationAction(x){
 const sys=x.system,days=x.date?x.date.days:null;
 if(sys==='licenses')return days!=null&&days<0?'ابدأ إجراء التجديد فورًا، وتحقق من سبب التأخير والمستندات الناقصة.':'جهّز متطلبات التجديد وحدد مسؤول المتابعة قبل موعد الانتهاء.';
 if(sys==='contracts')return days!=null&&days<0?'راجع الوضع التعاقدي والإشعارات والدفعات، وارفع الحالة للمسؤول المختص.':'راجع شروط التجديد أو الإنهاء والالتزامات المالية قبل الموعد.';
 if(sys==='cases')return 'راجع آخر إجراء وموعد الجلسة والمستندات المطلوبة، وحدد الإجراء القانوني التالي.';
 if(sys==='projects')return 'حدّث نسبة الإنجاز، وحدد سبب التأخير والجهة المسؤولة وتاريخ الإغلاق المستهدف.';
 if(sys==='violations')return 'تحقق من مهلة الاعتراض أو السداد، واربط المخالفة بالإجراء التصحيحي والمستند المؤيد.';
 if(sys==='correspondence')return 'تحقق من الرد المطلوب والجهة المسؤولة وموعد الإقفال، ثم وثّق نتيجة المتابعة.';
 if(sys==='shomoos')return 'راجع اكتمال التسجيل والتحديثات المطلوبة، وتأكد من إقفال الملاحظة لدى الجهة المختصة.';
 return 'راجع السجل وحدد المسؤول والموعد والإجراء التالي ثم حدّث الحالة.';
}
function buildRecommendations(records,risk,analysis){
 const list=risk.slice(0,30).map((x,i)=>({id:'risk-'+i,priority:x.points>=75?'عاجل':x.points>=40?'مهم':'متابعة',score:x.points,system:x.system,title:x.label,reason:x.reasons.join('، '),action:recommendationAction(x),date:x.date,record:x.record}));
 analysis.bySystem.forEach(b=>{if(b.overdue>=3)list.push({id:'sys-overdue-'+b.id,priority:'عاجل',score:90,system:b.id,title:'ارتفاع السجلات المتأخرة في '+b.name,reason:'يوجد '+b.overdue+' سجلات متأخرة تحتاج معالجة جماعية.',action:'أنشئ خطة إقفال أسبوعية، ووزع السجلات على المسؤولين حسب الأولوية.'});if(b.high>=3)list.push({id:'sys-high-'+b.id,priority:'مهم',score:75,system:b.id,title:'ارتفاع المخاطر في '+b.name,reason:'يوجد '+b.high+' سجلات عالية الخطورة.',action:'اعقد مراجعة مركزة للسجلات عالية الخطورة وحدد مالكًا لكل إجراء.'})});
 if(analysis.quality.missingStatus>0)list.push({id:'quality-status',priority:'تحسين',score:35,system:'other',title:'استكمال حالات السجلات',reason:analysis.quality.missingStatus+' سجلًا دون حالة واضحة.',action:'استكمل خانة الحالة لتصبح التقارير والتوصيات أكثر دقة.'});
 if(analysis.quality.duplicates>0)list.push({id:'quality-dup',priority:'تحسين',score:30,system:'other',title:'مراجعة السجلات المحتمل تكرارها',reason:analysis.quality.duplicates+' سجلًا يحتمل التكرار.',action:'راجع الأرقام المرجعية وأسماء الفروع قبل حذف أو دمج أي سجل.'});
 return list.sort((a,b)=>b.score-a.score);
}
function recommendationText(system){load();let a=AI.recommendations;if(system)a=a.filter(x=>x.system===system);if(!a.length)return 'لا توجد توصيات واضحة حاليًا بناءً على البيانات المحلية المتاحة.';return (system?'توصيات '+appName(system)+':':'التوصيات ذات الأولوية:')+'\n'+a.slice(0,10).map((x,i)=>`${i+1}. [${x.priority}] ${x.title} — ${x.action}`).join('\n');}
function actionPlanHtml(){const rs=AI.recommendations.slice(0,24);return `<div class="ai-analytics-head"><div><h2>خطة العمل الذكية</h2><p>توصيات محلية مرتبة حسب الأولوية — الإصدار ${AI.version}</p></div><button id="aiPlanClose">×</button></div><div class="ai-plan-summary"><article><b>${rs.filter(x=>x.priority==='عاجل').length}</b><span>عاجل</span></article><article><b>${rs.filter(x=>x.priority==='مهم').length}</b><span>مهم</span></article><article><b>${rs.length}</b><span>إجمالي التوصيات</span></article></div><div class="ai-plan-list">${rs.map((x,i)=>`<article class="ai-plan-item"><div class="ai-plan-rank">${i+1}</div><div><div class="ai-plan-meta"><span class="p-${x.priority}">${x.priority}</span><em>${esc(appName(x.system))}</em><strong>${x.score}%</strong></div><h3>${esc(x.title)}</h3><p>${esc(x.reason)}</p><div class="ai-next-action"><b>الإجراء المقترح:</b> ${esc(x.action)}</div></div></article>`).join('')||'<p>لا توجد توصيات حاليًا.</p>'}</div><div class="ai-plan-actions"><button id="aiPrintPlan">طباعة خطة العمل</button></div><footer>التوصيات آلية مساعدة، ويجب مراجعتها واعتمادها من المسؤول المختص قبل التنفيذ.</footer>`}
function openActionPlan(){load();let modal=document.getElementById('aiActionPlanModal');if(!modal){modal=document.createElement('div');modal.id='aiActionPlanModal';modal.className='ai-analytics-modal';document.body.appendChild(modal)}modal.innerHTML='<div class="ai-analytics-card ai-plan-card">'+actionPlanHtml()+'</div>';modal.classList.add('open');modal.querySelector('#aiPlanClose').onclick=()=>modal.classList.remove('open');modal.onclick=e=>{if(e.target===modal)modal.classList.remove('open')};modal.querySelector('#aiPrintPlan').onclick=printActionPlan}
function printActionPlan(){load();const w=window.open('','_blank');if(!w)return;const rows=AI.recommendations.slice(0,24).map((x,i)=>`<tr><td>${i+1}</td><td>${esc(x.priority)}</td><td>${esc(appName(x.system))}</td><td>${esc(x.title)}</td><td>${esc(x.action)}</td><td></td></tr>`).join('');w.document.write(`<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>خطة العمل الذكية</title><style>body{font-family:Arial;padding:25px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #bbb;padding:8px;vertical-align:top}th{background:#eee}@page{size:A4 landscape;margin:12mm}</style></head><body><h1>خطة العمل الذكية</h1><p>الإصدار ${AI.version} — ${new Date().toLocaleString('ar-SA')}</p><table><thead><tr><th>#</th><th>الأولوية</th><th>النظام</th><th>الموضوع</th><th>الإجراء المقترح</th><th>المسؤول/الموعد</th></tr></thead><tbody>${rows}</tbody></table><p><small>هذه توصيات آلية مساعدة وتتطلب مراجعة واعتمادًا بشريًا.</small></p><script>window.onload=()=>window.print()<\/script></body></html>`);w.document.close()}

function analyze(records,risk){
 const bySystem={},statuses={},months={},quality={missingStatus:0,missingDate:0,duplicates:0};
 APP_MAP.forEach(a=>bySystem[a.id]={id:a.id,name:a.name,icon:a.icon,total:0,open:0,closed:0,high:0,medium:0,upcoming:0,overdue:0});
 const fingerprints=new Set();
 records.forEach(r=>{
  if(!bySystem[r.system])return;const b=bySystem[r.system];b.total++;
  const st=getStatus(r.data);if(!st)quality.missingStatus++;else{const k=st.trim();statuses[k]=(statuses[k]||0)+1;if(CLOSED_RX.test(st))b.closed++;else if(OPEN_RX.test(st)||st)b.open++}
  const di=dateInfo(r.data);if(!di)quality.missingDate++;else{if(di.days<0&&!CLOSED_RX.test(st))b.overdue++;else if(di.days<=30&&di.days>=0)b.upcoming++;const mk=di.date.getFullYear()+'-'+String(di.date.getMonth()+1).padStart(2,'0');months[mk]=(months[mk]||0)+1}
  const fp=norm(label(r)+'|'+st+'|'+(di?di.value:''));if(fingerprints.has(fp)&&fp.length>5)quality.duplicates++;else fingerprints.add(fp);
 });
 risk.forEach(x=>{const b=bySystem[x.system];if(!b)return;if(x.points>=75)b.high++;else if(x.points>=40)b.medium++});
 const systemList=Object.values(bySystem).filter(x=>x.total>0).sort((a,b)=>b.high-a.high||b.total-a.total);
 const topStatuses=Object.entries(statuses).sort((a,b)=>b[1]-a[1]).slice(0,8);
 const trend=Object.entries(months).sort((a,b)=>a[0].localeCompare(b[0])).slice(-8);
 return {bySystem:systemList,topStatuses,trend,quality,total:records.length,high:risk.filter(x=>x.points>=75).length,medium:risk.filter(x=>x.points>=40&&x.points<75).length,upcoming:risk.filter(x=>x.date&&x.date.days>=0&&x.date.days<=30).length,overdue:risk.filter(x=>x.date&&x.date.days<0).length};
}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function appName(id){return APP_MAP.find(a=>a.id===id)?.name||'غير مصنف'}
function summary(){load();return {total:AI.analysis.total,hi:AI.analysis.high,med:AI.analysis.medium,sources:AI.sources.length,top:AI.risk.slice(0,8),analysis:AI.analysis}}
function systemAnalysis(id){load();const b=AI.analysis.bySystem.find(x=>x.id===id);if(!b)return 'لا توجد بيانات محلية واضحة لهذا النظام حاليًا.';const top=AI.risk.filter(x=>x.system===id).slice(0,5);return `${b.name}: ${b.total} سجلًا، المفتوح ${b.open}، المغلق ${b.closed}، عالي الخطورة ${b.high}، متأخر ${b.overdue}، وقريب خلال 30 يومًا ${b.upcoming}.`+(top.length?'\nأبرز الأولويات:\n'+top.map((x,i)=>`${i+1}. ${x.label} — ${x.points}%`).join('\n'):'')}

function executiveSnapshot(){
 load();const a=AI.analysis;const closed=a.bySystem.reduce((n,x)=>n+x.closed,0),open=a.bySystem.reduce((n,x)=>n+x.open,0),classified=closed+open;
 const closure=classified?Math.round(closed/classified*100):0;
 const riskIndex=a.total?Math.min(100,Math.round((a.high*100+a.medium*55+a.overdue*70)/Math.max(a.total,1))):0;
 const dataQuality=a.total?Math.max(0,Math.round(100-((a.quality.missingStatus+a.quality.missingDate+a.quality.duplicates)/Math.max(a.total*2,1)*100))):100;
 const strongest=a.bySystem.slice().sort((x,y)=>(y.closed/Math.max(y.total,1))-(x.closed/Math.max(x.total,1)))[0];
 const concern=a.bySystem.slice().sort((x,y)=>(y.high+y.overdue)-(x.high+x.overdue))[0];
 return {closure,riskIndex,dataQuality,closed,open,strongest,concern};
}
function smartRecordSummary(r){
 const d=r.data,parts=[];const st=getStatus(d),di=dateInfo(d);parts.push('السجل: '+label(r));parts.push('النظام: '+appName(r.system));if(st)parts.push('الحالة: '+st);if(di)parts.push(di.days<0?'الموعد متجاوز منذ '+Math.abs(di.days)+' يومًا':'الموعد بعد '+di.days+' يومًا');const fields=Object.entries(d).filter(([k,v])=>v!=null&&String(v).trim()&&![st,di&&di.value].includes(String(v))).slice(0,4).map(([k,v])=>k+': '+String(v));if(fields.length)parts.push('أبرز البيانات: '+fields.join('، '));return parts.join('\n');
}
function executiveNarrative(){
 const a=AI.analysis,e=executiveSnapshot(),top=AI.recommendations.slice(0,5);
 let t=`الملخص التنفيذي:\nتم تحليل ${a.total} سجلًا محليًا. مؤشر المخاطر ${e.riskIndex}%، ونسبة الإقفال ${e.closure}%، وجودة البيانات التقديرية ${e.dataQuality}%.`;
 if(e.concern)t+=`\nأعلى تركّز للمخاطر في ${e.concern.name} بواقع ${e.concern.high} سجلات عالية و${e.concern.overdue} متأخرة.`;
 if(e.strongest)t+=`\nأفضل أداء إقفالي حاليًا في ${e.strongest.name}.`;
 if(top.length)t+='\nأهم القرارات المقترحة:\n'+top.map((x,i)=>`${i+1}. ${x.title}: ${x.action}`).join('\n');
 return t;
}
function executiveHtml(){const a=AI.analysis,e=executiveSnapshot();return `<div class="ai-analytics-head"><div><h2>لوحة القرار التنفيذي</h2><p>ملخص ذكي محلي للإدارة العليا — الإصدار ${AI.version}</p></div><button id="aiExecClose">×</button></div><div class="ai-exec-kpis"><article><b>${e.riskIndex}%</b><span>مؤشر المخاطر</span></article><article><b>${e.closure}%</b><span>نسبة الإقفال</span></article><article><b>${e.dataQuality}%</b><span>جودة البيانات</span></article><article><b>${a.upcoming}</b><span>مواعيد خلال 30 يومًا</span></article></div><div class="ai-exec-grid"><section><h3>الملخص التنفيذي</h3><p class="ai-exec-narrative">${esc(executiveNarrative()).replace(/\n/g,'<br>')}</p></section><section><h3>قرارات مقترحة</h3>${AI.recommendations.slice(0,8).map((x,i)=>`<div class="ai-decision-row"><strong>${i+1}</strong><div><b>${esc(x.title)}</b><small>${esc(x.action)}</small></div><span>${esc(x.priority)}</span></div>`).join('')||'<p>لا توجد قرارات مقترحة حاليًا.</p>'}</section><section><h3>ملخص الأنظمة</h3>${a.bySystem.map(x=>`<div class="ai-exec-system"><b>${x.icon} ${esc(x.name)}</b><span>${x.total} سجل</span><small>مفتوح ${x.open} • مغلق ${x.closed} • عالي ${x.high} • متأخر ${x.overdue}</small></div>`).join('')}</section><section><h3>أعلى السجلات أولوية</h3>${AI.risk.slice(0,8).map(x=>`<div class="ai-risk-row"><b>${esc(x.label)}</b><span>${esc(appName(x.system))}</span><strong>${x.points}%</strong><small>${esc(x.reasons.join('، '))}</small></div>`).join('')||'<p>لا توجد مخاطر واضحة.</p>'}</section></div><div class="ai-plan-actions"><button id="aiPrintExecutive">طباعة التقرير التنفيذي</button></div><footer>هذا التحليل أداة مساعدة محلية، ولا يغني عن اعتماد الإدارة المختصة أو المراجعة القانونية.</footer>`}
function openExecutive(){load();let modal=document.getElementById('aiExecutiveModal');if(!modal){modal=document.createElement('div');modal.id='aiExecutiveModal';modal.className='ai-analytics-modal';document.body.appendChild(modal)}modal.innerHTML='<div class="ai-analytics-card ai-exec-card">'+executiveHtml()+'</div>';modal.classList.add('open');modal.querySelector('#aiExecClose').onclick=()=>modal.classList.remove('open');modal.onclick=e=>{if(e.target===modal)modal.classList.remove('open')};modal.querySelector('#aiPrintExecutive').onclick=printExecutive}
function printExecutive(){load();const a=AI.analysis,e=executiveSnapshot(),w=window.open('','_blank');if(!w)return;const rows=a.bySystem.map(x=>`<tr><td>${esc(x.name)}</td><td>${x.total}</td><td>${x.open}</td><td>${x.closed}</td><td>${x.high}</td><td>${x.overdue}</td></tr>`).join('');w.document.write(`<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>التقرير التنفيذي الذكي</title><style>body{font-family:Arial;padding:25px;color:#111}h1{margin:0}.k{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:18px 0}.k div{border:1px solid #aaa;border-radius:8px;padding:12px;text-align:center}.k b{font-size:24px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #aaa;padding:7px;text-align:center}th{background:#eee}.decision{padding:8px 0;border-bottom:1px solid #ddd}@page{size:A4;margin:12mm}</style></head><body><h1>التقرير التنفيذي الذكي</h1><small>الإصدار ${AI.version} — ${new Date().toLocaleString('ar-SA')}</small><div class="k"><div><b>${e.riskIndex}%</b><br>مؤشر المخاطر</div><div><b>${e.closure}%</b><br>نسبة الإقفال</div><div><b>${e.dataQuality}%</b><br>جودة البيانات</div><div><b>${a.upcoming}</b><br>خلال 30 يومًا</div></div><h2>الملخص التنفيذي</h2><p>${esc(executiveNarrative()).replace(/\n/g,'<br>')}</p><h2>الأنظمة</h2><table><thead><tr><th>النظام</th><th>السجلات</th><th>مفتوح</th><th>مغلق</th><th>عالي</th><th>متأخر</th></tr></thead><tbody>${rows}</tbody></table><h2>أهم القرارات</h2>${AI.recommendations.slice(0,10).map((x,i)=>`<div class="decision"><b>${i+1}. ${esc(x.title)}</b><br>${esc(x.action)}</div>`).join('')||'لا توجد توصيات.'}<p><small>تنبيه: التقرير آلي محلي لدعم القرار ويتطلب مراجعة بشرية.</small></p><script>window.onload=()=>window.print()<\/script></body></html>`);w.document.close()}

function answer(q){load();q=(q||'').trim();if(!q)return 'اكتب أمرك، مثل: حلل المخالفات أو ما أهم الأعمال اليوم؟';
 const app=APP_MAP.find(a=>a.k.some(k=>q.includes(k))&&/(افتح|انتقل|اذهب)/.test(q));if(app){navigate(app.url);return 'جاري فتح نظام '+app.name+'…'}
 const target=APP_MAP.find(a=>a.k.some(k=>q.includes(k))&&/(حلل|تحليل|ملخص|وضع|إحصائ)/.test(q));if(target)return systemAnalysis(target.id);
 if(/التقرير التنفيذي|لوحة القرار|ملخص تنفيذي|افتح التنفيذي/.test(q)){openExecutive();return 'تم فتح لوحة القرار التنفيذي.'}
 if(/خطة العمل|لوحة التوصيات|افتح التوصيات/.test(q)){openActionPlan();return 'تم فتح خطة العمل الذكية.'}
 if(/لوحة التحليل|التحليل الذكي|افتح التحليل/.test(q)){openAnalytics();return 'تم فتح لوحة التحليل الذكي.'}
 const recTarget=APP_MAP.find(a=>a.k.some(k=>q.includes(k))&&/(توصي|توصيات|ماذا أفعل|إجراء مقترح)/.test(q));if(recTarget)return recommendationText(recTarget.id);
 if(/توصي|توصيات|ماذا أفعل|خطة اليوم|الإجراء التالي/.test(q))return recommendationText();
 if(/أهم|أولو|اليوم|مخاطر|عاجل/.test(q)){const s=summary();if(!s.top.length)return 'لم أجد سجلات عاجلة في البيانات المحلية المتاحة حاليًا.';return 'أعلى الأولويات الآن:\n'+s.top.slice(0,7).map((x,i)=>`${i+1}. ${x.label} — ${x.points}% — ${x.reasons.join('، ')} — ${appName(x.system)}`).join('\n')}
 if(/جودة البيانات|بيانات ناقصة|مكرر/.test(q)){const a=AI.analysis;return `تحليل جودة البيانات: ${a.quality.missingStatus} سجلًا دون حالة واضحة، ${a.quality.missingDate} دون تاريخ قابل للتحليل، و${a.quality.duplicates} سجلًا يحتمل التكرار. هذه مؤشرات فنية تحتاج مراجعة بشرية.`}
 if(/كم|إحصائ|ملخص المنصة|وضع المنصة/.test(q)){const a=AI.analysis;return `تم تحليل ${a.total} سجلًا محليًا من ${AI.sources.length} مصادر. المخاطر العالية: ${a.high}، المتوسطة: ${a.medium}، المتأخرة: ${a.overdue}، والمواعيد خلال 30 يومًا: ${a.upcoming}.`}
 const days=(q.match(/(\d+)\s*يوم/)||[])[1];if(/تنتهي|انتهاء|موعد|استحقاق/.test(q)){const n=Number(days||30),a=AI.risk.filter(x=>x.date&&x.date.days>=0&&x.date.days<=n);return a.length?`السجلات ذات موعد خلال ${n} يومًا:\n`+a.slice(0,15).map((x,i)=>`${i+1}. ${x.label} — بعد ${x.date.days} يومًا — ${appName(x.system)}`).join('\n'):`لا توجد سجلات واضحة ذات موعد خلال ${n} يومًا في البيانات المحلية.`}
 const terms=q.replace(/اعرض|ابحث|عن|لي|سجل|بيانات|كيف|وضع/g,' ').split(/\s+/).filter(x=>x.length>2);const found=AI.records.filter(r=>terms.every(t=>r.text.includes(t))).slice(0,12);if(found.length)return 'النتائج المطابقة:\n'+found.map((r,i)=>`${i+1}. ${label(r)} — ${appName(r.system)}`).join('\n');
 return 'لم أجد نتيجة مباشرة. جرّب: «حلل المخالفات»، «ما أهم الأعمال اليوم؟»، «جودة البيانات»، أو «افتح لوحة التحليل». '
}
function navigate(url){const root=location.pathname.includes('/apps/')?'../../':'';location.href=root+url}
function analyticsHtml(){const a=AI.analysis,max=Math.max(1,...a.bySystem.map(x=>x.total));return `<div class="ai-analytics-head"><div><h2>لوحة التحليل الذكي</h2><p>تحليل محلي للسجلات المتاحة على هذا الجهاز — الإصدار ${AI.version}</p></div><button id="aiAnalyticsClose">×</button></div>
<div class="ai-kpi-grid"><article><b>${a.total}</b><span>إجمالي السجلات</span></article><article class="danger"><b>${a.high}</b><span>مخاطر عالية</span></article><article class="warn"><b>${a.overdue}</b><span>سجلات متأخرة</span></article><article><b>${a.upcoming}</b><span>خلال 30 يومًا</span></article></div>
<div class="ai-analysis-grid"><section><h3>تحليل الأنظمة</h3>${a.bySystem.length?a.bySystem.map(x=>`<div class="ai-system-row"><div class="ai-system-title"><span>${x.icon}</span><b>${esc(x.name)}</b><em>${x.total}</em></div><div class="ai-bar"><i style="width:${Math.max(4,Math.round(x.total/max*100))}%"></i></div><small>عالي ${x.high} • متأخر ${x.overdue} • قريب ${x.upcoming} • مغلق ${x.closed}</small></div>`).join(''):'<p>لا توجد بيانات مصنفة بعد.</p>'}</section>
<section><h3>أعلى المخاطر</h3>${AI.risk.slice(0,10).map(x=>`<div class="ai-risk-row"><b>${esc(x.label)}</b><span>${esc(appName(x.system))}</span><strong>${x.points}%</strong><small>${esc(x.reasons.join('، '))}</small></div>`).join('')||'<p>لا توجد مخاطر واضحة.</p>'}</section>
<section><h3>جودة البيانات</h3><div class="ai-quality"><p><b>${a.quality.missingStatus}</b> دون حالة واضحة</p><p><b>${a.quality.missingDate}</b> دون تاريخ قابل للتحليل</p><p><b>${a.quality.duplicates}</b> احتمال تكرار</p></div><button class="ai-report-btn" id="aiPrintReport">طباعة تقرير التحليل</button></section>
<section><h3>توزيع الحالات</h3>${a.topStatuses.map(([s,n])=>`<div class="ai-status-row"><span>${esc(s)}</span><b>${n}</b></div>`).join('')||'<p>لا توجد حالات واضحة.</p>'}</section><section class="ai-recommendations-section"><h3>التوصيات الذكية</h3>${AI.recommendations.slice(0,6).map(x=>`<div class="ai-rec-row"><span>${esc(x.priority)}</span><div><b>${esc(x.title)}</b><small>${esc(x.action)}</small></div></div>`).join('')||'<p>لا توجد توصيات حاليًا.</p>'}<button class="ai-report-btn" id="aiOpenPlan">فتح خطة العمل الكاملة</button></section></div><footer>النتائج مؤشرات مساعدة تعتمد على البيانات المحلية، ولا تُعد قرارًا قانونيًا أو إداريًا نهائيًا.</footer>`}
function openAnalytics(){load();let modal=document.getElementById('aiAnalyticsModal');if(!modal){modal=document.createElement('div');modal.id='aiAnalyticsModal';modal.className='ai-analytics-modal';document.body.appendChild(modal)}modal.innerHTML='<div class="ai-analytics-card">'+analyticsHtml()+'</div>';modal.classList.add('open');modal.querySelector('#aiAnalyticsClose').onclick=()=>modal.classList.remove('open');modal.onclick=e=>{if(e.target===modal)modal.classList.remove('open')};modal.querySelector('#aiPrintReport').onclick=printReport;const pb=modal.querySelector('#aiOpenPlan');if(pb)pb.onclick=openActionPlan}
function printReport(){load();const a=AI.analysis,w=window.open('','_blank');if(!w)return;const rows=a.bySystem.map(x=>`<tr><td>${esc(x.name)}</td><td>${x.total}</td><td>${x.high}</td><td>${x.overdue}</td><td>${x.upcoming}</td><td>${x.closed}</td></tr>`).join('');w.document.write(`<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>تقرير التحليل الذكي</title><style>body{font-family:Arial;padding:30px;color:#111}h1{margin:0 0 8px}small{color:#666}section{margin:22px 0}table{width:100%;border-collapse:collapse}th,td{border:1px solid #bbb;padding:8px;text-align:center}th{background:#eee}.k{display:flex;gap:12px}.k div{border:1px solid #bbb;padding:12px;flex:1;text-align:center}.risk{margin:7px 0;padding:8px;border-bottom:1px solid #ddd}@page{size:A4;margin:15mm}</style></head><body><h1>تقرير التحليل الذكي المحلي</h1><small>الإصدار ${AI.version} — ${new Date().toLocaleString('ar-SA')}</small><section class="k"><div><b>${a.total}</b><br>السجلات</div><div><b>${a.high}</b><br>مخاطر عالية</div><div><b>${a.overdue}</b><br>متأخرة</div><div><b>${a.upcoming}</b><br>خلال 30 يومًا</div></section><section><h2>الأنظمة</h2><table><thead><tr><th>النظام</th><th>السجلات</th><th>عالي</th><th>متأخر</th><th>قريب</th><th>مغلق</th></tr></thead><tbody>${rows}</tbody></table></section><section><h2>أعلى الأولويات</h2>${AI.risk.slice(0,12).map(x=>`<div class="risk"><b>${esc(x.label)}</b> — ${x.points}% — ${esc(appName(x.system))}<br><small>${esc(x.reasons.join('، '))}</small></div>`).join('')||'لا توجد مخاطر واضحة.'}</section><p><small>تنبيه: التحليل آلي محلي ومخصص لدعم القرار فقط، ويتطلب مراجعة بشرية.</small></p><script>window.onload=()=>window.print()<\/script></body></html>`);w.document.close()}
function build(){if(document.getElementById('localAiFab'))return;
 const fab=document.createElement('button');fab.id='localAiFab';fab.className='local-ai-fab';fab.innerHTML='<span>🤖</span><b>مساعد الإدارة</b>';fab.onclick=()=>toggle(true);
 const analyticsBtn=document.createElement('button');analyticsBtn.id='localAiAnalyticsFab';analyticsBtn.className='local-ai-analytics-fab';analyticsBtn.innerHTML='<span>📊</span><b>التحليل الذكي</b>';analyticsBtn.onclick=openAnalytics;
 const planBtn=document.createElement('button');planBtn.id='localAiPlanFab';planBtn.className='local-ai-plan-fab';planBtn.innerHTML='<span>🎯</span><b>خطة العمل</b>';planBtn.onclick=openActionPlan;
 const execBtn=document.createElement('button');execBtn.id='localAiExecFab';execBtn.className='local-ai-exec-fab';execBtn.innerHTML='<span>📈</span><b>التقرير التنفيذي</b>';execBtn.onclick=openExecutive;
 const box=document.createElement('section');box.id='localAiPanel';box.className='local-ai-panel';box.innerHTML=`<header><div><strong>مساعد الإدارة الذكي</strong><small>محلي • تحليل الأنظمة والسجلات</small></div><button id="aiClose">×</button></header><div class="local-ai-metrics" id="aiMetrics"></div><div class="local-ai-chat" id="aiChat"><div class="ai-msg bot">مرحبًا، أستطيع تحليل الأنظمة وترتيب المخاطر وتقديم توصيات عملية وخطة عمل يومية.</div></div><div class="local-ai-chips"><button>ما توصياتك اليوم؟</button><button>توصيات المخالفات</button><button>خطة العمل</button><button>افتح لوحة التحليل</button><button>التقرير التنفيذي</button></div><form id="aiForm"><input id="aiInput" autocomplete="off" placeholder="مثال: حلل العقود أو اعرض ما ينتهي خلال 30 يومًا"><button>إرسال</button></form>`;
 document.body.append(fab,analyticsBtn,planBtn,execBtn,box);box.querySelector('#aiClose').onclick=()=>toggle(false);box.querySelectorAll('.local-ai-chips button').forEach(b=>b.onclick=()=>ask(b.textContent));box.querySelector('#aiForm').onsubmit=e=>{e.preventDefault();ask(box.querySelector('#aiInput').value);box.querySelector('#aiInput').value=''};refreshMetrics();
}
function refreshMetrics(){const s=summary(),el=document.getElementById('aiMetrics');if(el)el.innerHTML=`<span><b>${s.total}</b> سجل محلل</span><span><b>${s.hi}</b> مخاطر عالية</span><span><b>${s.analysis.overdue}</b> متأخرة</span>`}
function ask(q){if(!q.trim())return;const c=document.getElementById('aiChat');c.insertAdjacentHTML('beforeend',`<div class="ai-msg user">${esc(q)}</div>`);const a=answer(q);c.insertAdjacentHTML('beforeend',`<div class="ai-msg bot">${esc(a).replace(/\n/g,'<br>')}</div>`);c.scrollTop=c.scrollHeight;refreshMetrics()}
function toggle(show){const p=document.getElementById('localAiPanel');if(!p)return;p.classList.toggle('open',show);if(show){refreshMetrics();setTimeout(()=>document.getElementById('aiInput')?.focus(),100)}}
window.LocalEnterpriseAI={load,summary,answer,toggle,openAnalytics,openActionPlan,openExecutive,executiveNarrative,smartRecordSummary,systemAnalysis,recommendationText,version:AI.version};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',build);else build();
})();
