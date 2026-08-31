/* platform-user-bridge.js — v28.18.55
   Makes the platform user directory authoritative across every operational app.
   Tolerates old/stale remembered session IDs by reconciling with username/name,
   then auto-provisions the module user and enters the app without a second login. */
(()=>{'use strict';
 const USERS='scc-v17-users',BACK='scc-v17-users-backup-v1',CURRENT='scc-v17-current-user',REMEMBER='scc-v17-remember';
 const parse=(v,f=null)=>{try{return JSON.parse(v)}catch(_){return f}};
 function directory(){let d=parse(localStorage.getItem(USERS)||'null',null);if(!Array.isArray(d)||!d.length)d=parse(localStorage.getItem(BACK)||'[]',[]);return Array.isArray(d)?d:[]}
 function sessionUser(){return parse(sessionStorage.getItem(CURRENT)||'null',null)||parse(localStorage.getItem(REMEMBER)||'null',null)||window.SCC_CURRENT_USER||null}
 function signedIn(){const s=sessionUser();if(!s)return null;const d=directory();if(!d.length)return s;
   // Exact match first, then username, then normalized display name. This repairs stale IDs after platform updates.
   const norm=x=>String(x||'').trim().replace(/\s+/g,' ');
   const u=d.find(x=>x&&s.id&&x.id===s.id) || d.find(x=>x&&s.username&&x.username===s.username) || d.find(x=>x&&norm(x.name)===norm(s.name));
   if(!u)return null;
   try{sessionStorage.setItem(CURRENT,JSON.stringify(u));if(localStorage.getItem(REMEMBER))localStorage.setItem(REMEMBER,JSON.stringify(u));localStorage.setItem('v4-last-user',u.name||'');localStorage.setItem('scc-current-user-name',u.name||'')}catch(_){}
   window.SCC_CURRENT_USER=u;return u;
 }
 function moduleKey(){return(location.pathname.match(/\/apps\/([^/]+)/)||[])[1]||''}
 function roleFor(module,u){if(u.role==='admin')return'admin';if(module==='shomoos'&&u.role==='hr')return'hr';if(module==='contracts'&&u.role==='finance')return'finance';if(module==='licenses'||module==='projects')return'employee';if(module==='correspondence'||module==='violations')return'officer';if(module==='shomoos')return'pr';return'employee'}
 function permissionsFor(u){if(u.role==='admin')return{add:true,edit:true,delete:true,export:true,settings:true};return{add:true,edit:true,delete:false,export:true,settings:false}}
 function deny(){try{sessionStorage.setItem('scc-access-denied','1');localStorage.setItem('scc-access-denied-pending','1')}catch(_){}location.replace('../../index.html?denied=1')}
 async function bridge(attempt=0){const u=signedIn();if(!u){if(attempt<6)return setTimeout(()=>bridge(attempt+1),250);location.replace('../../index.html');return}
   const module=moduleKey();if((u.role==='hr'&&module!=='shomoos')||(u.role==='finance'&&module!=='contracts')){deny();return}
   try{
     if(typeof state==='undefined'||!state||!Array.isArray(state.users)){if(attempt<24)return setTimeout(()=>bridge(attempt+1),160);return}
     const norm=x=>String(x||'').trim().replace(/\s+/g,' ');
     let mu=state.users.find(x=>x&&(x.id===u.id||(u.username&&x.username===u.username)||norm(x.name)===norm(u.name)));
     let changed=false;const desiredRole=roleFor(module,u);
     if(!mu){mu={id:u.id||('platform-'+(u.username||Date.now())),name:u.name,username:u.username||u.name,pin:'',role:desiredRole,active:true,createdAt:new Date().toISOString().slice(0,10)};if(module==='cases'||module==='contracts')mu.permissions=permissionsFor(u);state.users.push(mu);changed=true}
     else{
       if(mu.id!==u.id&&u.id){mu.id=u.id;changed=true} if(mu.name!==u.name){mu.name=u.name;changed=true} if(mu.username!==u.username&&u.username){mu.username=u.username;changed=true}
       if(mu.active===false){mu.active=true;changed=true} if(mu.role!==desiredRole && (u.role==='admin'||u.role==='hr'||u.role==='finance')){mu.role=desiredRole;changed=true}
       // Regular platform staff must always be able to enter operational apps as employees/officers.
       if(!['admin','hr','finance'].includes(u.role)&&['licenses','projects','correspondence','violations','shomoos','cases','contracts'].includes(module)){
         const allowed=roleFor(module,u); if(!mu.role||mu.role==='inactive'){mu.role=allowed;changed=true}
       }
       if((module==='cases'||module==='contracts')&&!mu.permissions){mu.permissions=permissionsFor(u);changed=true}
     }
     // Never require a second module PIN when the platform session is already authenticated.
     if(mu.pin){mu.pin='';changed=true}
     if(changed){try{if(typeof persist==='function')await persist(true);else if(typeof saveState==='function')saveState()}catch(_){}}
     window.SCC_CURRENT_USER=u;
     if(typeof enterApp==='function')enterApp(mu,true);else if(typeof enterUser==='function')enterUser(mu,true);else if(typeof authenticateUser==='function')authenticateUser(mu,true);
     try{window.dispatchEvent(new CustomEvent('scc:module-user-ready',{detail:{module,user:u,moduleUser:mu}}))}catch(_){}
   }catch(e){console.warn('Platform user bridge:',e);if(attempt<24)setTimeout(()=>bridge(attempt+1),180)}
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>bridge(),220),{once:true});else setTimeout(()=>bridge(),220);
 window.addEventListener('pageshow',()=>setTimeout(()=>bridge(),180));
})();
