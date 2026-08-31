/* SCC Device Recovery Guardian v28.18.58
   Repairs stale per-device session/runtime state without deleting business data. */
(()=>{'use strict';
 const V='28.18.58', MARK='scc-device-recovery-version';
 const parse=(v,f=null)=>{try{return JSON.parse(v)}catch(_){return f}}, norm=v=>String(v||'').trim().replace(/\s+/g,' ');
 const USERS='scc-v17-users', BACK='scc-v17-users-backup-v1', CUR='scc-v17-current-user', REM='scc-v17-remember';
 function users(){let a=parse(localStorage.getItem(USERS),null);if(!Array.isArray(a)||!a.length)a=parse(localStorage.getItem(BACK),[]);return Array.isArray(a)?a:[]}
 function repairIdentity(){const s=parse(sessionStorage.getItem(CUR),null)||parse(localStorage.getItem(REM),null);if(!s)return;const d=users();if(!d.length)return;const u=d.find(x=>x&&s.id&&x.id===s.id)||d.find(x=>x&&s.username&&norm(x.username)===norm(s.username))||d.find(x=>x&&s.name&&norm(x.name)===norm(s.name));if(!u)return;const safe={...u};delete safe.passwordHash;try{sessionStorage.setItem(CUR,JSON.stringify(safe));if(localStorage.getItem(REM))localStorage.setItem(REM,JSON.stringify(safe));localStorage.setItem('scc-v26-last-session',JSON.stringify(safe));localStorage.setItem('v4-last-user',safe.name||safe.username||'');localStorage.setItem('scc-current-user-name',safe.name||safe.username||'')}catch(_){}window.SCC_CURRENT_USER=safe}
 function repairSyncConfig(){try{window.SCC_SYNC_CONFIG&&localStorage.setItem('scc-v11-supabase-master',JSON.stringify({...window.SCC_SYNC_CONFIG,updatedAt:new Date().toISOString()}))}catch(_){} }
 function clearRuntimeOnly(){// Never touch business caches, users, passwords, tombstones, or cloud settings.
   try{sessionStorage.removeItem('scc-post-logout-check');sessionStorage.removeItem('scc-returning-home')}catch(_){}
 }
 async function refreshWorker(){if(!('serviceWorker'in navigator))return;try{const regs=await navigator.serviceWorker.getRegistrations();for(const r of regs)await r.update()}catch(_){} }
 function wakeSync(){setTimeout(()=>{try{window.SCCPlatformSyncHub?.pullAll?.('device-recovery')}catch(_){};try{window.dispatchEvent(new CustomEvent('scc:auto-sync-login'))}catch(_){}},250)}
 function run(){clearRuntimeOnly();repairIdentity();repairSyncConfig();refreshWorker();wakeSync();try{localStorage.setItem(MARK,V)}catch(_){} }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
 addEventListener('online',wakeSync);addEventListener('pageshow',()=>{repairIdentity();wakeSync()});document.addEventListener('visibilitychange',()=>{if(!document.hidden){repairIdentity();wakeSync()}});
 window.SCCDeviceRecovery={run};
})();
