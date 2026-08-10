(()=>{
'use strict';
const VERSION='28.18.13';
const LOG_KEY='scc-trust-audit-v1';
const LAST_SYNC='scc-trust-last-sync-v1';
const WHATS_NEW_KEY='scc-whats-new-seen';
const CONFIG_KEYS=['scc-supabase-master-config','scc-home-cloud-v4','srco-license-sync-cfg','srco-projects-supabase-cfg','srco-contracts-supabase-cfg','srco-cases-supabase-cfg','srco-shomoos-supabase-cfg','srco-correspondence-supabase-cfg','srco-violations-supabase-cfg'];
const DATA_KEYS=['srco-license-tracker-v1','srco-contract-tracker-v1','srco-case-tracker-v1','srco-project-tracker-v1','srco-shomoos-tracker-v1','srco-mail-tracker-v1','srco-violations-tracker-v1'];
const MODULE_LABELS={licenses:'التصاريح الحكومية',contracts:'العقود الإيجارية',cases:'القضايا وتراضي',projects:'المشاريع',shomoos:'شموس',correspondence:'الصادر والوارد',violations:'المخالفات والغرامات',opportunities:'الفرص الحكومية',home:'الصفحة الرئيسية'};
function moduleName(){const m=location.pathname.match(/\/apps\/([^/]+)/);return MODULE_LABELS[m?.[1]]||MODULE_LABELS.home}
function safeParse(v,f=null){try{return JSON.parse(v)}catch{return f}}
function userName(){const u=safeParse(localStorage.getItem('scc-v17-current-user'),{});return u?.name||u?.username||localStorage.getItem('scc-current-user-name')||'مستخدم النظام'}
function readLog(){return safeParse(localStorage.getItem(LOG_KEY),[])||[]}
function audit(action,detail='',level='info'){
 const list=readLog();list.unshift({id:Date.now()+'-'+Math.random().toString(36).slice(2,7),at:new Date().toISOString(),user:userName(),module:moduleName(),action:String(action).slice(0,90),detail:String(detail).slice(0,180),level});
 localStorage.setItem(LOG_KEY,JSON.stringify(list.slice(0,250)));
 window.dispatchEvent(new CustomEvent('tg:audit-updated'));
}
window.TrustGovernance={audit,open:()=>openModal()};

// Record meaningful operations without recording values or secrets.
const nativeSet=Storage.prototype.setItem;
Storage.prototype.setItem=function(k,v){
 const result=nativeSet.apply(this,arguments);
 try{
  if(this===localStorage && k!==LOG_KEY){
   if(CONFIG_KEYS.includes(k)){audit('تحديث إعدادات المزامنة','تم تعديل إعداد اتصال دون حفظ أي قيمة سرية في السجل','warn')}
   else if(DATA_KEYS.includes(k)){audit('حفظ بيانات النظام','تم تحديث النسخة المحلية للبيانات')}
   if(/last.*sync|sync.*last/i.test(k)){nativeSet.call(localStorage,LAST_SYNC,new Date().toISOString())}
  }
 }catch{}
 return result;
};

function connectedConfig(){
 for(const k of CONFIG_KEYS){const c=safeParse(localStorage.getItem(k),{});if((c?.projectUrl&&c?.anonKey)||(c?.url&&c?.key))return true}
 return false;
}
function serviceWorkerState(){return 'serviceWorker'in navigator?(navigator.serviceWorker.controller?'مفعّل ويعمل':'متاح — بانتظار التفعيل'):'غير مدعوم'}
function storageUsage(){let n=0;for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);n+=(k?.length||0)+(localStorage.getItem(k)?.length||0)}return n}
function fmtBytes(n){if(n<1024)return n+' B';if(n<1048576)return (n/1024).toFixed(1)+' KB';return (n/1048576).toFixed(1)+' MB'}
function lastSync(){const v=localStorage.getItem(LAST_SYNC);if(!v)return 'لم تُسجّل بعد';const d=new Date(v);return isNaN(d)?'غير معروف':d.toLocaleString('ar-SA')}
function reliability(){
 let valid=0,total=0,records=0;
 for(const k of DATA_KEYS){const raw=localStorage.getItem(k);if(!raw)continue;total++;const obj=safeParse(raw);if(obj&&typeof obj==='object'){valid++;for(const v of Object.values(obj)){if(Array.isArray(v))records+=v.length;else if(v&&typeof v==='object'&&!Array.isArray(v))records+=Object.keys(v).length}}
 }
 const config=connectedConfig()?1:0;const online=navigator.onLine?1:0;const score=Math.round(Math.min(100,40+(total?valid/total*30:10)+config*20+online*10));return {score,records,valid,total}
}
function healthRows(){
 const rel=reliability();
 return [
  ['الاتصال بالإنترنت',navigator.onLine?'متصل':'غير متصل',navigator.onLine?'ok':'warn'],
  ['المزامنة السحابية',connectedConfig()?'تم إعداد الاتصال':'غير مفعلة',connectedConfig()?'ok':'warn'],
  ['Service Worker',serviceWorkerState(),navigator.serviceWorker?.controller?'ok':'warn'],
  ['آخر مزامنة مسجلة',lastSync(),localStorage.getItem(LAST_SYNC)?'ok':'warn'],
  ['الإصدار الحالي',VERSION,'ok'],
  ['التخزين المحلي',fmtBytes(storageUsage()),storageUsage()<4_000_000?'ok':'warn']
 ];
}
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function modalHtml(){const rel=reliability(),logs=readLog();return `<div class="tg-box" role="dialog" aria-modal="true" aria-label="مركز الثقة والحوكمة">
 <div class="tg-head"><div><h2>🛡️ مركز الثقة والحوكمة</h2><div class="tg-badge"><i class="tg-dot ${connectedConfig()&&navigator.onLine?'ok':''}"></i>${connectedConfig()?'النظام مرتبط':'وضع محلي'}</div></div><button class="tg-close" data-tg-close>×</button></div>
 <div class="tg-summary">
  <div class="tg-card"><small>موثوقية البيانات</small><strong>${rel.score}%</strong><div class="tg-progress"><i style="width:${rel.score}%"></i></div><p>تقدير تقني مبني على سلامة التخزين، الاتصال، وإمكانية قراءة البيانات.</p></div>
  <div class="tg-card"><small>السجلات المرصودة</small><strong>${rel.records.toLocaleString('ar-SA')}</strong><p>عدد تقريبي للسجلات المتاحة على هذا الجهاز عبر الأنظمة.</p></div>
  <div class="tg-card"><small>آخر مزامنة</small><strong style="font-size:15px">${escapeHtml(lastSync())}</strong><p>يتم تحديثها عند رصد عملية مزامنة ناجحة أو يدوية.</p></div>
  <div class="tg-card"><small>حالة النظام</small><strong>${navigator.onLine?'مستقر':'دون اتصال'}</strong><p>${navigator.onLine?'الخدمات الأساسية متاحة.':'يمكن متابعة البيانات المحلية لحين عودة الاتصال.'}</p></div>
 </div>
 <div class="tg-section"><h3>فحص سلامة النظام</h3><div class="tg-health">${healthRows().map(r=>`<div class="tg-row"><span>${r[0]}</span><b class="tg-state ${r[2]}">${escapeHtml(r[1])}</b></div>`).join('')}</div><div class="tg-actions"><button class="tg-action primary" data-tg-refresh>إعادة الفحص</button><button class="tg-action" data-tg-syncmark>تسجيل مزامنة ناجحة</button><button class="tg-action" data-tg-export>تصدير سجل الحركة</button></div></div>
 <div class="tg-section"><h3>آخر الأنشطة على هذا الجهاز</h3><div class="tg-log">${logs.length?logs.slice(0,30).map(x=>`<div class="tg-log-item"><div><b>${escapeHtml(x.action)}</b><br><span>${escapeHtml(x.module)} · ${escapeHtml(x.user)}${x.detail?' · '+escapeHtml(x.detail):''}</span></div><span>${new Date(x.at).toLocaleString('ar-SA')}</span></div>`).join(''):'<div class="tg-row"><span>لا توجد أنشطة مسجلة حتى الآن.</span></div>'}</div></div>
 <div class="tg-section"><p style="font-size:11px;color:var(--tg-muted);line-height:1.8">هذا السجل محلي لتعزيز الشفافية التشغيلية ولا يُعد سجل تدقيق مركزي غير قابل للتعديل. للحصول على حوكمة مؤسسية كاملة يجب حفظ سجل التدقيق في قاعدة البيانات من جهة الخادم.</p></div>
 </div>`}
function ensureModal(){let m=document.getElementById('tgModal');if(!m){m=document.createElement('div');m.id='tgModal';m.className='tg-modal';document.body.appendChild(m)}return m}
function openModal(){const m=ensureModal();m.innerHTML=modalHtml();m.classList.add('show');audit('فتح مركز الثقة والحوكمة');bindModal(m)}
function bindModal(m){
 m.querySelector('[data-tg-close]')?.addEventListener('click',()=>m.classList.remove('show'));
 m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('show')},{once:true});
 m.querySelector('[data-tg-refresh]')?.addEventListener('click',()=>openModal());
 m.querySelector('[data-tg-syncmark]')?.addEventListener('click',()=>{nativeSet.call(localStorage,LAST_SYNC,new Date().toISOString());audit('تأكيد المزامنة','تم تأكيد نجاح المزامنة يدويًا');openModal()});
 m.querySelector('[data-tg-export]')?.addEventListener('click',()=>{const blob=new Blob([JSON.stringify(readLog(),null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='system-audit-log-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500);audit('تصدير سجل الحركة')});
}
function addButton(){
 if(document.querySelector('.tg-open-btn'))return;
 const host=document.querySelector('#v4Settings .v17-settings-actions,#v4Settings,.settings-panel,.sidebar,.nav-menu');
 if(!host)return;
 const b=document.createElement('button');b.type='button';b.className='tg-open-btn';b.innerHTML='<span>🛡️ مركز الثقة والحوكمة</span><span class="tg-badge"><i class="tg-dot '+(connectedConfig()&&navigator.onLine?'ok':'')+'"></i>'+(connectedConfig()?'مزامنة مفعلة':'وضع محلي')+'</span>';b.onclick=openModal;host.appendChild(b);
}
function whatsNew(){
 if(localStorage.getItem(WHATS_NEW_KEY)===VERSION)return;
 const w=document.createElement('div');w.className='tg-whatsnew show';w.innerHTML=`<div class="tg-whatsnew-box"><h2>ما الجديد في الإصدار ${VERSION}</h2><p style="color:#aeb7c2">إصدار الثقة والحوكمة</p><ul><li>مركز موحد لسلامة النظام والمزامنة.</li><li>مؤشر مبسط لموثوقية البيانات.</li><li>سجل حركة محلي يوضح العمليات المهمة دون حفظ الأسرار.</li><li>إظهار آخر مزامنة وحالة العمل دون اتصال.</li><li>تصدير سجل الحركة للمراجعة الفنية.</li></ul><button>فهمت، ابدأ الاستخدام</button></div>`;document.body.appendChild(w);w.querySelector('button').onclick=()=>{localStorage.setItem(WHATS_NEW_KEY,VERSION);w.remove();audit('عرض ما الجديد','تم الاطلاع على إصدار الثقة والحوكمة')};
}
function attachActionObserver(){document.addEventListener('click',e=>{const el=e.target.closest('button,a');if(!el)return;const txt=(el.textContent||el.title||'').trim().replace(/\s+/g,' ').slice(0,70);if(!txt)return;if(/مزامن|حفظ|اعتماد|مراجع|حذف|استعاد|تصدير|طباعة|دخول|خروج/.test(txt)){audit('إجراء مستخدم',txt,/حذف/.test(txt)?'warn':'info');if(/مزامن/.test(txt))nativeSet.call(localStorage,LAST_SYNC,new Date().toISOString())}},true)}
function boot(){addButton();attachActionObserver();audit('فتح النظام','بدء جلسة في '+moduleName());if(moduleName()===MODULE_LABELS.home){setTimeout(whatsNew,1200)}setInterval(addButton,3000)}
window.addEventListener('online',()=>audit('عودة الاتصال بالإنترنت'));
window.addEventListener('offline',()=>audit('انقطاع الاتصال بالإنترنت','','warn'));
window.addEventListener('storage',e=>{if(CONFIG_KEYS.includes(e.key))audit('تحديث إعدادات المزامنة من جهاز آخر','','warn')});
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot,{once:true}):boot();
})();
