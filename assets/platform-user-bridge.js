/* platform-user-bridge.js — v28.18.56
   Platform session is authoritative across operational apps.
   Fixes stale user IDs, late module boot, and re-opened role gates after cloud initialization. */
(()=>{'use strict';
 const USERS='scc-v17-users',BACK='scc-v17-users-backup-v1',CURRENT='scc-v17-current-user',REMEMBER='scc-v17-remember';
 const parse=(v,f=null)=>{try{return JSON.parse(v)}catch(_){return f}};
 const norm=x=>String(x||'').trim().replace(/\s+/g,' ');
 function directory(){let d=parse(localStorage.getItem(USERS)||'null',null);if(!Array.isArray(d)||!d.length)d=parse(localStorage.getItem(BACK)||'[]',[]);return Array.isArray(d)?d:[]}
 function sessionUser(){return parse(sessionStorage.getItem(CURRENT)||'null',null)||parse(localStorage.getItem(REMEMBER)||'null',null)||window.SCC_CURRENT_USER||null}
 function findDirectoryUser(s){if(!s)return null;const d=directory();if(!d.length)return s;return d.find(x=>x&&s.id&&x.id===s.id)||d.find(x=>x&&s.username&&norm(x.username)===norm(s.username))||d.find(x=>x&&norm(x.name)===norm(s.name))||null}
 function signedIn(){const s=sessionUser(),u=findDirectoryUser(s);if(!u)return null;const safe={...u,passwordHash:undefined};try{sessionStorage.setItem(CURRENT,JSON.stringify(safe));if(localStorage.getItem(REMEMBER))localStorage.setItem(REMEMBER,JSON.stringify(safe));localStorage.setItem('v4-last-user',safe.name||'');localStorage.setItem('scc-current-user-name',safe.name||'')}catch(_){}window.SCC_CURRENT_USER=safe;return safe}
 function moduleKey(){return(location.pathname.match(/\/apps\/([^/]+)/)||[])[1]||''}
 function roleFor(module,u){if(u.role==='admin')return'admin';if(module==='shomoos'&&u.role==='hr')return'hr';if(module==='contracts'&&u.role==='finance')return'finance';if(module==='licenses'||module==='projects')return'employee';if(module==='correspondence'||module==='violations')return'officer';if(module==='shomoos')return'pr';return'employee'}
 function permissionsFor(u){if(u.role==='admin')return{add:true,edit:true,delete:true,export:true,settings:true};return{add:true,edit:true,delete:false,export:true,settings:false}}
 function deny(){try{sessionStorage.setItem('scc-access-denied','1');localStorage.setItem('scc-access-denied-pending','1')}catch(_){}location.replace('../../index.html?denied=1')}
 function appReady(){try{if(typeof state==='undefined'||!state)return false;if(!Array.isArray(state.users))return false;const gate=document.getElementById('roleGate');const app=document.getElementById('app');return !!(gate||app)}catch(_){return false}}
 function moduleUserFor(u,module){
   const desiredRole=roleFor(module,u);let mu=null,changed=false;
   try{mu=state.users.find(x=>x&&(x.id===u.id||(u.username&&norm(x.username)===norm(u.username))||norm(x.name)===norm(u.name)))}catch(_){}
   if(!mu){mu={id:u.id||('platform-'+(u.username||Date.now())),name:u.name,username:u.username||u.name,pin:'',role:desiredRole,active:true,createdAt:new Date().toISOString().slice(0,10)};if(module==='cases'||module==='contracts')mu.permissions=permissionsFor(u);state.users.push(mu);changed=true}
   else{
     if(u.id&&mu.id!==u.id){mu.id=u.id;changed=true} if(mu.name!==u.name){mu.name=u.name;changed=true} if(u.username&&mu.username!==u.username){mu.username=u.username;changed=true}
     if(mu.active===false){mu.active=true;changed=true}
     const regular=!['admin','hr','finance'].includes(u.role);
     if(u.role==='admin'||u.role==='hr'||u.role==='finance'||regular){if(mu.role!==desiredRole){mu.role=desiredRole;changed=true}}
     if((module==='cases'||module==='contracts')&&!mu.permissions){mu.permissions=permissionsFor(u);changed=true}
     if(mu.pin){mu.pin='';changed=true}
   }
   return {mu,changed};
 }
 let running=false,lastReadyUser='';
 async function bridge(reason='boot',attempt=0){if(running)return false;const u=signedIn();if(!u){if(attempt<30)setTimeout(()=>bridge(reason,attempt+1),180);else location.replace('../../index.html');return false}
   const module=moduleKey();if((u.role==='hr'&&module!=='shomoos')||(u.role==='finance'&&module!=='contracts')){deny();return false}
   if(!appReady()){if(attempt<50)setTimeout(()=>bridge(reason,attempt+1),160);return false}
   running=true;try{
     const {mu,changed}=moduleUserFor(u,module);
     if(changed){try{if(typeof saveState==='function')saveState();else if(typeof safeLocalSet==='function'&&typeof LOCAL_CACHE_KEY!=='undefined')safeLocalSet(LOCAL_CACHE_KEY,JSON.stringify(state))}catch(_){}
       // Do not block entry on a cloud save. Queueing layers will sync the user record later.
       try{window.dispatchEvent(new CustomEvent('scc:module-user-provisioned',{detail:{module,user:u}}))}catch(_){}
     }
     window.SCC_CURRENT_USER=u;
     if(typeof enterApp==='function')enterApp(mu,true);else if(typeof enterUser==='function')enterUser(mu,true);else if(typeof authenticateUser==='function')authenticateUser(mu,true);
     // Enforce the authenticated view after late setupRoleGate()/cloud boot finishes.
     const gate=document.getElementById('roleGate'),app=document.getElementById('app');if(gate)gate.style.display='none';if(app)app.style.display='flex';
     lastReadyUser=u.username||u.name||'';
     try{window.dispatchEvent(new CustomEvent('scc:module-user-ready',{detail:{module,user:u,moduleUser:mu,reason}}))}catch(_){}
     return true;
   }catch(e){console.warn('Platform user bridge:',e);if(attempt<50)setTimeout(()=>bridge(reason,attempt+1),180);return false}finally{running=false}
 }
 function ensure(reason){setTimeout(()=>bridge(reason,0),80);setTimeout(()=>bridge(reason+'-confirm',0),500);setTimeout(()=>bridge(reason+'-late',0),1800)}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>ensure('dom'),{once:true});else ensure('ready');
 window.addEventListener('pageshow',()=>ensure('pageshow'));window.addEventListener('focus',()=>{if(!document.hidden)ensure('focus')});document.addEventListener('visibilitychange',()=>{if(!document.hidden)ensure('resume')});
 window.addEventListener('scc:auto-sync-complete',()=>ensure('sync-complete'));window.addEventListener('scc:workspace-cache-updated',()=>ensure('cache-update'));
 // For the first few seconds, protect against module boot re-opening its own legacy role gate after platform entry.
 let guardTicks=0;const guard=setInterval(()=>{guardTicks++;const u=signedIn();if(u&&appReady()){const gate=document.getElementById('roleGate'),app=document.getElementById('app');if((gate&&getComputedStyle(gate).display!=='none')|| (app&&getComputedStyle(app).display==='none'))bridge('guard',0)}if(guardTicks>30)clearInterval(guard)},350);
 window.SCCPlatformUserBridge={refresh:()=>bridge('api',0),current:signedIn};
})();
