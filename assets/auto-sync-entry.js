/* auto-sync-entry.js — v28.18.53
   Unified entry/resume/realtime safety net for every operational app.
   Pulls AND applies the remote row immediately; retries after resume/network changes;
   periodically refreshes and re-subscribes so missed realtime events cannot leave a device stale. */
(()=>{'use strict';
 let running=false,lastRun=0,lastSubscribe=0,timer=null;
 const MIN_GAP=2500;
 function workspace(){try{if(typeof cloudCfg!=='undefined'&&cloudCfg){return String(cloudCfg.workspaceId||cloudCfg.binId||'')} }catch(_){} const m={licenses:'alandiyah-licenses',projects:'alandiyah-projects',contracts:'alandiyah-contracts',cases:'alandiyah-cases',correspondence:'alandiyah-correspondence',violations:'alandiyah-violations',shomoos:'alandiyah-shomoos'};return m[appName()]||''}
 function pendingKey(){const ws=workspace();return ws?'scc-pending-cloud-push:'+ws:''}
 function hasPending(){const k=pendingKey();return !!(k&&localStorage.getItem(k)==='1')}
 function markPending(v){const k=pendingKey();if(!k)return;try{if(v)localStorage.setItem(k,'1');else localStorage.removeItem(k)}catch(_){}}
 function wrapPush(){try{if(typeof cloudPush!=='function'||cloudPush.__sccPendingWrapped)return;const original=cloudPush;const wrapped=async function(...args){markPending(true);const r=await original.apply(this,args);const ok=(r===true)||!!(r&&r.ok===true);if(ok)markPending(false);return r};wrapped.__sccPendingWrapped=true;cloudPush=wrapped}catch(_){}}
 function appName(){try{return location.pathname.split('/').filter(Boolean).slice(-2,-1)[0]||'app'}catch(_){return'app'}}
 function currentRevision(){try{
   if(typeof lastCloudVersion!=='undefined')return Number(lastCloudVersion||0);
   if(typeof lastRemoteRevision!=='undefined')return Number(lastRemoteRevision||0);
   if(typeof revision!=='undefined')return Number(revision||0);
 }catch(_){} return 0}
 async function applyPulled(result,reason){
   if(!result)return false;
   try{
     if(typeof shomoosApplyRemoteSafely==='function' && (result.branches||result?.payload?.branches)){
       const p=result.payload&&result.payload.branches?result.payload:result;
       const ok=await shomoosApplyRemoteSafely(p,reason);
       if(ok){try{renderNavCounts();renderView(currentView);updateBell();checkReminders&&checkReminders()}catch(_){}}
       return !!ok;
     }
   }catch(e){console.warn('auto sync shomoos apply',e)}
   try{
     if(typeof applyCloudState==='function'){
       // correspondence/violations return an envelope; the other classic apps return payload directly.
       if(result && result.payload && typeof result.revision!=='undefined'){
         applyCloudState(result.payload,Number(result.revision||currentRevision()),result.updatedBy||result.updated_by||'');
       }else{
         applyCloudState(result,currentRevision(),'');
       }
       return true;
     }
   }catch(e){console.warn('auto sync apply',e)}
   return false;
 }
 async function refresh(reason='entry',force=false){
   if(running)return false;
   const now=Date.now(); if(!force&&now-lastRun<MIN_GAP)return false;
   running=true;
   try{
     if(typeof syncCredentials==='function')try{syncCredentials()}catch(_){}
     wrapPush();
     // If a prior save was local-only because the network failed, publish it first. cloudPush itself performs a safe pre-push merge.
     if(hasPending()&&typeof cloudPush==='function'&&navigator.onLine!==false){try{await cloudPush()}catch(_){}}
     // Daily Work owns a dedicated conflict-aware synchronizer.
     if(window.DailyCloudSync&&typeof window.DailyCloudSync.pullNow==='function'){
       try{await window.DailyCloudSync.pushNow?.()}catch(_){}
       try{await window.DailyCloudSync.pullNow();lastRun=Date.now();return true}catch(e){console.warn('daily entry sync',e);return false}
     }
     if(typeof isCloudConfigured==='function'&&!isCloudConfigured())return false;
     if(typeof cloudPull==='function'){
       const result=await cloudPull(true);
       await applyPulled(result,reason);
     }
     // Realtime is primary; polling is a fallback. Refresh the subscription periodically as a self-heal.
     const subNow=Date.now();
     if(subNow-lastSubscribe>45000){
       try{if(typeof subscribeRealtime==='function')subscribeRealtime();else if(typeof startRealtimeSync==='function')startRealtimeSync()}catch(_){}
       lastSubscribe=subNow;
     }
     lastRun=Date.now();
     try{window.dispatchEvent(new CustomEvent('scc:auto-sync-complete',{detail:{app:appName(),reason,at:new Date().toISOString()}}))}catch(_){}
     return true;
   }catch(e){console.warn('automatic sync refresh',e);return false}
   finally{running=false}
 }
 function boot(){
   wrapPush();
   setTimeout(()=>refresh('entry',true),250);
   setTimeout(()=>refresh('entry-retry',true),1400);
   setTimeout(()=>refresh('entry-confirm',true),4200);
   clearInterval(timer);timer=setInterval(()=>{if(!document.hidden&&navigator.onLine!==false)refresh('heartbeat',true)},12000);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
 window.addEventListener('pageshow',()=>setTimeout(()=>refresh('pageshow',true),180));
 window.addEventListener('focus',()=>setTimeout(()=>refresh('focus',true),180));
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(()=>refresh('resume',true),180)});
 window.addEventListener('online',()=>setTimeout(()=>refresh('online',true),250));
 window.SCCAutoSync={refreshNow:()=>refresh('manual-api',true),status:()=>({running,lastRun,lastSubscribe})};
})();
