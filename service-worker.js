const CACHE='scc-v28.18.48';
const SHELL=[
 './assets/enterprise-themes.css','./assets/enterprise-themes.js',
 './','./index.html','./manifest.webmanifest','./version.json',
 './assets/security-hardening.js','./assets/core-shared.css','./assets/core-home-extra.css','./assets/core-home-extra.js',
 './assets/core-updater.js','./assets/lifecycle-guardian.js','./assets/desktop-wheel-scroll-fix.js','./assets/mobile-enterprise.css','./assets/platform-user-bridge.js','./assets/auto-sync-entry.js','./assets/silent-background-sync.js',
  './assets/data-safety-guardian.js','./assets/edge-case-guard.js',
 './assets/core-motivator.js','./assets/full-language.js',
 './assets/core-prayer.js','./assets/adhan-nasser-alqatami.mp3',
 './assets/v25-shared.js',
 './assets/local-ai-engine.css','./assets/local-ai-engine.js',
 './icons/icon-192.png','./icons/icon-512.png','./icons/apple-touch-icon.png',
 './assets/system-icons/licenses.png','./assets/system-icons/projects.jpeg','./assets/system-icons/cases.png',
 './assets/system-icons/contracts.png',
'./assets/system-icons/correspondence.jpeg','./assets/system-icons/violations.jpeg','./assets/system-icons/shomoos.jpeg','./assets/system-icons/daily-work.svg','./assets/team/sultan_hazzazi_v28.jpg',
 './apps/licenses/index.html','./apps/projects/index.html','./apps/contracts/index.html',
 './apps/cases/index.html','./apps/shomoos/index.html','./apps/correspondence/index.html',
 './apps/violations/index.html','./apps/daily-work/index.html','./apps/opportunities/index.html'
];
self.addEventListener('install',event=>event.waitUntil(
 caches.open(CACHE).then(async cache=>{
  // تحميل كل ملف على حدة بدل addAll() الذي يفشل بالكامل إذا تعذّر ملف واحد فقط —
  // هذا كان بابًا حقيقيًا لتعليق التثبيت على أجهزة بشبكة غير مستقرة، تاركًا الجهاز
  // عالقًا على نسخة قديمة أو غير مكتملة من الملفات دون أي تنبيه.
  const results = await Promise.allSettled(SHELL.map(url => cache.add(url)));
  results.forEach((r, i) => { if (r.status === 'rejected') console.warn('SW precache failed for', SHELL[i], r.reason); });
 }).then(()=>self.skipWaiting())
));
self.addEventListener('activate',event=>event.waitUntil(
 caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())
));
self.addEventListener('message',event=>{if(event.data&&event.data.type==='SKIP_WAITING')self.skipWaiting()});
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const url=new URL(event.request.url);
 if(url.hostname.includes('supabase.co')||url.hostname.includes('jsonbin.io'))return;
 if(url.pathname.endsWith('/version.json')||url.pathname.endsWith('version.json')){
  event.respondWith(fetch(event.request,{cache:'no-store'}));return;
 }
 if(event.request.mode==='navigate'){
  const network=fetch(event.request).then(response=>{
   const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return response;
  });
  const timeout=new Promise((_,reject)=>setTimeout(()=>reject(new Error('navigation timeout')),8000));
  event.respondWith(Promise.race([network,timeout]).catch(()=>caches.match(event.request).then(hit=>hit||caches.match('./index.html'))));return;
 }
 if(url.origin===self.location.origin){
  event.respondWith(fetch(event.request).then(response=>{
   const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return response;
  }).catch(()=>caches.match(event.request)));
 }
});
