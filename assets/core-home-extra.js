/* ==========================================================================
   core-home-extra.js — سكربتات إضافية خاصة بالصفحة الرئيسية فقط
   دمج v23-government-enterprise.js + v24-updater.js، بنفس ترتيب التنفيذ الأصلي
   تمامًا (كلاهما defer، وبنفس تسلسل الظهور الأصلي في index.html). كل ملف كان
   ومازال مغلّفًا بدالة IIFE مستقلة، فلا تعارض في المتغيرات بينهما.
   ========================================================================== */

/* -------------------- الطبقة 1 — الهوية المؤسسية الحكومية (شريط الأدوات، الإعدادات، الوصولية) (v23-government-enterprise.js سابقًا) -------------------- */
(() => {
  'use strict';
  const VERSION = '23.0';
  const safeStorage = {
    get(k){ try{return localStorage.getItem(k)}catch(_){return null} },
    set(k,v){ try{localStorage.setItem(k,v)}catch(_){} }
  };
  const ready = (fn) => document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', fn, {once:true}) : fn();
  ready(() => {
    document.documentElement.lang = 'ar';
    document.documentElement.dir = 'rtl';
    const firstMain = document.querySelector('main,.main,.container,.page,.app-shell') || document.body;
    if (!firstMain.id) firstMain.id = 'main-content';
    const skip = document.createElement('a');
    skip.className = 'gov-skip-link';
    skip.href = '#main-content';
    skip.textContent = 'انتقل إلى المحتوى الرئيسي';
    document.body.prepend(skip);

    const bar = document.createElement('div');
    bar.className = 'gov-utility-bar';
    bar.setAttribute('role','region');
    bar.setAttribute('aria-label','أدوات الوصول وحالة المنصة');
    bar.innerHTML = `
      <div class="gov-utility-right">
        <span class="gov-compliance-chip"><span class="gov-status-dot" aria-hidden="true"></span> منصة داخلية مؤسسية</span>
        <span>تصنيف المعلومات: <strong>داخلي</strong></span>
      </div>
      <div class="gov-utility-left">
        <button type="button" class="gov-mini-btn" data-gov-action="text" aria-pressed="false">تكبير النص</button>
        <button type="button" class="gov-mini-btn" data-gov-action="contrast" aria-pressed="false">تباين مرتفع</button>
        <button type="button" class="gov-mini-btn" data-gov-action="motion" aria-pressed="false">تقليل الحركة</button>
      </div>`;
    const splash = document.getElementById('sportsSplash');
    (splash ? splash.insertAdjacentElement('afterend',bar) : document.body.prepend(bar));

    const actions = {text:'gov-large-text',contrast:'gov-high-contrast',motion:'gov-no-motion'};
    Object.entries(actions).forEach(([key,cls]) => {
      const enabled = safeStorage.get('gov_ui_'+key) === '1';
      document.body.classList.toggle(cls, enabled);
      const btn = bar.querySelector(`[data-gov-action="${key}"]`);
      btn?.setAttribute('aria-pressed', String(enabled));
    });
    bar.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-gov-action]');
      if (!btn) return;
      const key = btn.dataset.govAction, cls = actions[key];
      const enabled = !document.body.classList.contains(cls);
      document.body.classList.toggle(cls, enabled);
      btn.setAttribute('aria-pressed', String(enabled));
      safeStorage.set('gov_ui_'+key, enabled ? '1':'0');
    });

    document.querySelectorAll('img:not([alt])').forEach(img => img.setAttribute('alt',''));
    document.querySelectorAll('button:not([type])').forEach(btn => btn.setAttribute('type','button'));
    document.querySelectorAll('[role="dialog"],.modal,.dialog').forEach(el => {
      el.setAttribute('aria-modal','true');
      if (!el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby')) el.setAttribute('aria-label','نافذة منبثقة');
    });
    document.querySelectorAll('input,select,textarea').forEach((el,i) => {
      if (!el.id) el.id = 'gov-field-'+i;
      if (!el.getAttribute('autocomplete')) {
        const type = (el.getAttribute('type') || '').toLowerCase();
        el.setAttribute('autocomplete', type === 'password' ? 'current-password' : 'off');
      }
    });

    const footer = document.createElement('footer');
    footer.className = 'gov-enterprise-footer';
    footer.innerHTML = `<span><b>منصة العلاقات العامة والحكومية</b> — الإصدار ${VERSION}</span><span class="gov-classification">الاستخدام الداخلي المصرح به فقط</span><span>الخصوصية والأمن مسؤولية مشتركة</span>`;
    document.body.appendChild(footer);
  });
})();

/* -------------------- الطبقة 2 — فحص وزر التحديث السحابي (v24-updater.js سابقًا) -------------------- */
(()=>{
'use strict';
const CURRENT='24.0.0';
const VERSION_URL='./version.json';
const UPDATE_KEY='scc-v24-last-update-check';
const qs=(s,r=document)=>r.querySelector(s);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function compare(a,b){const A=String(a).split('.').map(Number),B=String(b).split('.').map(Number);for(let i=0;i<Math.max(A.length,B.length);i++){const d=(A[i]||0)-(B[i]||0);if(d)return d>0?1:-1}return 0}
async function remoteVersion(){const sep=VERSION_URL.includes('?')?'&':'?';const r=await fetch(VERSION_URL+sep+'t='+Date.now(),{cache:'no-store',headers:{'Cache-Control':'no-cache'}});if(!r.ok)throw new Error('تعذر فحص الإصدار');return r.json()}
async function clearApplicationCache(){
  if('serviceWorker' in navigator){const regs=await navigator.serviceWorker.getRegistrations();for(const reg of regs){try{reg.active&&reg.active.postMessage({type:'SKIP_WAITING'});await reg.update()}catch(_){}}}
  if('caches' in window){const keys=await caches.keys();await Promise.all(keys.map(k=>caches.delete(k)))}
  // مهم: لا يتم حذف localStorage أو sessionStorage حتى تبقى بيانات المستخدم والمزامنة محفوظة.
}
async function applyUpdate(btn,status){
  btn.classList.add('is-busy');btn.disabled=true;status.className='v24-update-status';status.textContent='جاري تحديث ملفات النظام…';
  try{await clearApplicationCache();status.textContent='تم التحديث، جاري إعادة تشغيل المنصة…';status.classList.add('ok');await sleep(700);location.replace(location.pathname+'?v='+Date.now()+location.hash)}
  catch(e){status.textContent='تعذر إكمال التحديث. تحقق من الاتصال ثم حاول مرة أخرى.';status.classList.add('err');btn.disabled=false;btn.classList.remove('is-busy')}
}
async function check(btn,status,manual=false){
  if(!navigator.onLine){status.textContent='لا يوجد اتصال بالإنترنت.';status.className='v24-update-status err';return}
  btn.classList.add('is-busy');status.textContent=manual?'جاري فحص آخر إصدار…':'';
  try{const meta=await remoteVersion();localStorage.setItem(UPDATE_KEY,new Date().toISOString());const newer=compare(meta.version,CURRENT)>0;btn.classList.toggle('has-update',newer);btn.title=newer?'يتوفر تحديث جديد':'النظام محدث';
    if(newer){status.textContent=`يتوفر الإصدار ${meta.version}`;status.className='v24-update-status';if(meta.mandatory) await applyUpdate(btn,status)}
    else if(manual){status.textContent='أنت تستخدم آخر إصدار ✓';status.className='v24-update-status ok'}
  }catch(e){if(manual){status.textContent='تعذر التحقق من التحديث حاليًا.';status.className='v24-update-status err'}}
  finally{btn.classList.remove('is-busy')}
}
function mount(){
  const login=qs('#v17LoginForm');if(!login||qs('#v24UpdateBtn'))return;
  const wrap=document.createElement('div');wrap.className='v24-update-wrap';wrap.innerHTML=`<button type="button" class="v24-update-btn" id="v24UpdateBtn" aria-label="تحديث ومزامنة النظام" title="تحديث ومزامنة النظام"><span class="v24-update-dot"></span><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 6v5h-5M4 18v-5h5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M18.5 9A7 7 0 0 0 6.2 6.2L4 9m2 6a7 7 0 0 0 11.8 2.8L20 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button><span class="v24-update-label">تحديث ومزامنة النظام</span>`;
  const status=document.createElement('div');status.id='v24UpdateStatus';status.className='v24-update-status';
  login.append(wrap,status);const btn=qs('#v24UpdateBtn');btn.addEventListener('click',async()=>{await check(btn,status,true);if(btn.classList.contains('has-update'))await applyUpdate(btn,status);else if(status.classList.contains('ok')){await clearApplicationCache();status.textContent='تم تحديث ملفات النظام ✓';setTimeout(()=>location.reload(),450)}});
  check(btn,status,false);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
new MutationObserver(mount).observe(document.documentElement,{childList:true,subtree:true});
if('serviceWorker' in navigator){navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!window.__v24Reloading){window.__v24Reloading=true;location.reload()}})}
})();

