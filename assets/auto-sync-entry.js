/* auto-sync-entry.js — v28.18.55
   Unified entry/resume/realtime safety net for every operational app.
   Pulls/applies the latest remote row automatically and surfaces the true latest cloud update
   inside the app (not on the platform home). */
(()=>{'use strict';
 let running=false,lastRun=0,lastSubscribe=0,timer=null,lastMetaCheck=0;const MIN_GAP=2500;
 function appName(){try{return location.pathname.split('/').filter(Boolean).slice(-2,-1)[0]||'app'}catch(_){return'app'}}
 function workspace(){try{if(typeof cloudCfg!=='undefined'&&cloudCfg)return String(cloudCfg.workspaceId||cloudCfg.binId||'')}catch(_){}const m={licenses:'alandiyah-licenses',projects:'alandiyah-projects',contracts:'alandiyah-contracts',cases:'alandiyah-cases',correspondence:'alandiyah-correspondence',violations:'alandiyah-violations',shomoos:'alandiyah-shomoos','daily-work':'alandiyah-daily-work'};return m[appName()]||''}
 function pendingKey(){const ws=workspace();return ws?'scc-pending-cloud-push:'+ws:''}function hasPending(){const k=pendingKey();return!!(k&&localStorage.getItem(k)==='1')}function markPending(v){const k=pendingKey();if(!k)return;try{if(v)localStorage.setItem(k,'1');else localStorage.removeItem(k)}catch(_){}}
 function currentUser(){try{return window.SCC_CURRENT_USER||window.currentUser||JSON.parse(sessionStorage.getItem('scc-v17-current-user')||'null')||JSON.parse(localStorage.getItem('scc-v17-remember')||'null')}catch(_){return null}}
 function currentRevision(){try{if(typeof lastCloudVersion!=='undefined')return Number(lastCloudVersion||0);if(typeof lastRemoteRevision!=='undefined')return Number(lastRemoteRevision||0);if(typeof revision!=='undefined')return Number(revision||0)}catch(_){}return 0}
 function wrapPush(){try{if(typeof cloudPush!=='function'||cloudPush.__sccPendingWrapped)return;const original=cloudPush;const wrapped=async function(...args){markPending(true);const r=await original.apply(this,args);const ok=(r===true)||!!(r&&r.ok===true);if(ok)markPending(false);return r};wrapped.__sccPendingWrapped=true;cloudPush=wrapped}catch(_){}}
 function fmt(iso){const d=new Date(iso);if(!Number.isFinite(d.getTime()))return'';try{return d.toLocaleString('ar-SA',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}catch(_){return d.toLocaleString()}}
 function showFreshness(meta){if(!meta)return;const when=fmt(meta.updated_at||meta.at);const by=String(meta.updated_by||meta.updatedBy||'').trim();const text=when+(by&& !['النظام','مزامنة النظام','system','auto-sync'].includes(by)?' — '+by:'');
   const foot=document.getElementById('lastSyncFoot');if(foot&&text)foot.textContent=text;
   document.querySelectorAll('[data-last-sync],[data-latest-update]').forEach(el=>{if(text)el.textContent=text});
   try{localStorage.setItem('scc-last-cloud-meta:'+workspace(),JSON.stringify({updated_at:meta.updated_at||meta.at||'',updated_by:by,revision:Number(meta.revision||0)}))}catch(_){}
 }
 async function fetchFreshness(force=false){const now=Date.now();if(!force&&now-lastMetaCheck<12000)return null;lastMetaCheck=now;const ws=workspace();if(!ws)return null;
   try{
     let sb=null;try{if(typeof supabaseClient!=='undefined'&&supabaseClient)sb=supabaseClient}catch(_){};if(!sb)return null;
     const {data,error}=await sb.from('app_state').select('revision,updated_at,updated_by,client_id').eq('workspace_id',ws).maybeSingle();if(error)throw error;if(!data)return null;showFreshness(data);
     const u=currentUser(),seenKey='scc-last-seen-rev:'+ws+':'+String(u?.username||u?.name||'default'),seen=Number(localStorage.getItem(seenKey)||0),rev=Number(data.revision||0);
     if(rev>seen){localStorage.setItem(seenKey,String(rev));const by=String(data.updated_by||'').trim();const mine=by&&u&&(by===u.name||by===u.username);if(seen>0&&!mine&&by&&typeof toast==='function')try{toast('آخر تحديث من '+by,'☁')}catch(_){}}
     return data;
   }catch(e){console.warn('freshness metadata',e?.message||e);const cached=JSON.parse(localStorage.getItem('scc-last-cloud-meta:'+ws)||'null');if(cached)showFreshness(cached);return cached}
 }
 async function applyPulled(result,reason){if(!result)return false;try{if(typeof shomoosApplyRemoteSafely==='function'&&(result.branches||result?.payload?.branches)){const p=result.payload&&result.payload.branches?result.payload:result;const ok=await shomoosApplyRemoteSafely(p,reason);if(ok){try{renderNavCounts();renderView(currentView);updateBell();typeof checkReminders==='function'&&checkReminders()}catch(_){}}return!!ok}}catch(e){console.warn('auto sync shomoos apply',e)}
   try{if(typeof applyCloudState==='function'){if(result&&result.payload&&typeof result.revision!=='undefined')applyCloudState(result.payload,Number(result.revision||currentRevision()),result.updatedBy||result.updated_by||'');else applyCloudState(result,currentRevision(),'');return true}}catch(e){console.warn('auto sync apply',e)}return false}
 async function refresh(reason='entry',force=false){if(running)return false;const now=Date.now();if(!force&&now-lastRun<MIN_GAP)return false;running=true;try{
   if(typeof syncCredentials==='function')try{syncCredentials()}catch(_){}wrapPush();if(hasPending()&&typeof cloudPush==='function'&&navigator.onLine!==false){try{await cloudPush()}catch(_){}}
   if(window.DailyCloudSync&&typeof window.DailyCloudSync.pullNow==='function'){try{await window.DailyCloudSync.pushNow?.()}catch(_){}try{await window.DailyCloudSync.pullNow();await fetchFreshness(true);lastRun=Date.now();return true}catch(e){console.warn('daily entry sync',e);return false}}
   if(typeof isCloudConfigured==='function'&&!isCloudConfigured())return false;if(typeof cloudPull==='function'){const result=await cloudPull(true);await applyPulled(result,reason)}
   await fetchFreshness(reason!=='heartbeat');const subNow=Date.now();if(subNow-lastSubscribe>45000){try{if(typeof subscribeRealtime==='function')subscribeRealtime();else if(typeof startRealtimeSync==='function')startRealtimeSync()}catch(_){}lastSubscribe=subNow}
   lastRun=Date.now();try{window.dispatchEvent(new CustomEvent('scc:auto-sync-complete',{detail:{app:appName(),reason,at:new Date().toISOString()}}))}catch(_){}return true
 }catch(e){console.warn('automatic sync refresh',e);return false}finally{running=false}}
 function boot(){wrapPush();const cached=(()=>{try{return JSON.parse(localStorage.getItem('scc-last-cloud-meta:'+workspace())||'null')}catch(_){return null}})();if(cached)showFreshness(cached);setTimeout(()=>refresh('entry',true),250);setTimeout(()=>refresh('entry-retry',true),1400);setTimeout(()=>refresh('entry-confirm',true),4200);clearInterval(timer);timer=setInterval(()=>{if(!document.hidden&&navigator.onLine!==false)refresh('heartbeat',true)},12000)}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();window.addEventListener('pageshow',()=>setTimeout(()=>refresh('pageshow',true),180));window.addEventListener('focus',()=>setTimeout(()=>refresh('focus',true),180));document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(()=>refresh('resume',true),180)});window.addEventListener('online',()=>setTimeout(()=>refresh('online',true),250));
 window.SCCAutoSync={refreshNow:()=>refresh('manual-api',true),status:()=>({running,lastRun,lastSubscribe})};
})();
