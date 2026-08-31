/* edge-case-guard.js — v28.18.40
   Non-invasive resilience layer: duplicate-action protection, stale-tab awareness,
   connectivity recovery, storage quota/error diagnostics, and safe error isolation.
   It never deletes or rewrites business records. */
(()=>{'use strict';
 const W=window, D=document, NS='SCCEdgeGuard'; if(W[NS])return;
 const state={online:navigator.onLine,lastVisible:Date.now(),errors:[],pending:new WeakSet()};
 const now=()=>Date.now();
 function emit(type,detail={}){try{W.dispatchEvent(new CustomEvent('scc:edge:'+type,{detail}))}catch(_){}}
 function log(kind,detail){const row={kind,at:new Date().toISOString(),detail:String(detail||'').slice(0,500)};state.errors.push(row);if(state.errors.length>30)state.errors.shift();try{sessionStorage.setItem('scc-edge-diagnostics',JSON.stringify(state.errors))}catch(_){} }
 function toast(msg,icon='🛡️'){try{if(typeof W.toast==='function')W.toast(msg,icon)}catch(_){} }
 function isAction(el){if(!el)return false;const t=(el.textContent||'').trim();return /حفظ|إضافة|اعتماد|حذف|إرسال|تحديث|مزامنة|Save|Add|Approve|Delete|Send|Sync/i.test(t)||el.matches?.('[data-save],[data-delete],[data-submit]')}
 // Prevent accidental double clicks without changing the application's own handlers.
 D.addEventListener('click',e=>{const el=e.target?.closest?.('button,[role="button"],a.btn');if(!el||!isAction(el))return;const last=Number(el.dataset.sccLastAction||0),t=now();if(t-last<650){e.preventDefault();e.stopImmediatePropagation();log('duplicate-action',el.textContent);return}el.dataset.sccLastAction=String(t)},true);
 // Prevent duplicate native form submissions for 1.2 seconds.
 D.addEventListener('submit',e=>{const f=e.target;if(!f||f.nodeName!=='FORM')return;const last=Number(f.dataset.sccLastSubmit||0),t=now();if(t-last<1200){e.preventDefault();e.stopImmediatePropagation();log('duplicate-submit',f.id||f.name||'form');return}f.dataset.sccLastSubmit=String(t)},true);
 // Connectivity: never pretend a cloud save succeeded; tell existing sync layers to retry.
 W.addEventListener('offline',()=>{state.online=false;log('offline','network unavailable');emit('offline');toast('الاتصال بالإنترنت غير متاح مؤقتاً؛ سيتم استكمال المزامنة عند عودة الاتصال.','📡')});
 W.addEventListener('online',()=>{state.online=true;emit('online');setTimeout(()=>emit('retry-sync'),350);toast('عاد الاتصال بالإنترنت، جاري التحقق من المزامنة.','✓')});
 // Long background/sleep recovery (important for iOS/PWA). No forced reload.
 D.addEventListener('visibilitychange',()=>{if(D.hidden){state.lastVisible=now();return}const away=now()-state.lastVisible;if(away>45000){emit('resume',{awayMs:away});setTimeout(()=>emit('retry-sync'),250)}});
 W.addEventListener('pageshow',e=>{if(e.persisted){emit('resume',{bfcache:true});setTimeout(()=>emit('retry-sync'),250)}});
 // Quota/storage errors are surfaced diagnostically without clearing storage.
 W.addEventListener('error',e=>{log('error',e?.error?.message||e?.message||'unknown');emit('error',{message:e?.message||''})});
 W.addEventListener('unhandledrejection',e=>{log('promise',e?.reason?.message||e?.reason||'unhandled rejection');emit('error',{message:String(e?.reason?.message||e?.reason||'')})});
 function storageHealth(){try{const k='__scc_edge_probe__';localStorage.setItem(k,'1');localStorage.removeItem(k);return true}catch(e){log('storage',e?.name||e);emit('storage-error',{name:e?.name||''});return false}}
 storageHealth();
 // Helper API for current/future modules. Explicitly non-destructive.
 W[NS]={version:'28.18.40',state,storageHealth,isOnline:()=>navigator.onLine,diagnostics:()=>state.errors.slice(),emit,
   validateRecord(record,required=[]){const missing=required.filter(k=>record==null||record[k]==null||String(record[k]).trim()==='');return {ok:missing.length===0,missing}},
   datesLogical(start,end){if(!start||!end)return true;const a=Date.parse(start),b=Date.parse(end);return !Number.isFinite(a)||!Number.isFinite(b)||b>=a},
   uniqueBy(list,key,value,ignoreId){return !(Array.isArray(list)?list:[]).some(x=>x&&String(x[key]??'').trim()===String(value??'').trim()&&(ignoreId==null||x.id!==ignoreId))}
 };
 emit('ready',{version:'28.18.40'});
})();
