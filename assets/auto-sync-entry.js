(()=>{
  'use strict';
  const COOLDOWN=30*60*1000;
  let running=false,lastRun=Date.now();
  async function syncNow(reason='resume'){
    if(running)return;
    const now=Date.now();
    if(reason!=='online'&&now-lastRun<COOLDOWN)return;
    running=true;
    try{
      if(typeof syncCredentials==='function')try{syncCredentials()}catch(_){}
      if(typeof isCloudConfigured==='function'&&!isCloudConfigured())return;
      // كل نظام يبدأ مزامنته الأساسية مرة واحدة. هذه الطبقة تعيد الاتصال فقط
      // بعد انقطاع الشبكة أو عودة طويلة، ولا تكرر السحب عند كل دخول أو تنقل.
      if(typeof startAutoSync==='function')try{await startAutoSync()}catch(_){}
      else if(typeof subscribeRealtime==='function')try{await subscribeRealtime()}catch(_){}
      lastRun=Date.now();
      try{window.dispatchEvent(new CustomEvent('scc:auto-sync-complete',{detail:{reason,at:new Date().toISOString()}}))}catch(_){}
    }finally{running=false}
  }
  window.addEventListener('pageshow',e=>{if(e.persisted)setTimeout(()=>syncNow('bfcache'),350)});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(()=>syncNow('resume'),350)});
  window.addEventListener('online',()=>setTimeout(()=>syncNow('online'),450));
})();
