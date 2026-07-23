const CACHE='scc-platform-v24-20260723-1';
const SHELL=['./','./index.html','./manifest.webmanifest','./version.json','./assets/security-hardening.js','./assets/v21-global.css','./assets/v23-government-enterprise.css','./assets/v24-updater.css','./assets/v24-updater.js','./assets/team/fares_alharbi_v24.jpg','./icons/icon-192.png','./icons/icon-512.png','./icons/apple-touch-icon.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('message',e=>{if(e.data&&e.data.type==='SKIP_WAITING')self.skipWaiting()});
self.addEventListener('fetch',e=>{
 if(e.request.method!=='GET')return;const u=new URL(e.request.url);
 if(u.hostname.includes('supabase.co')||u.hostname.includes('jsonbin.io'))return;
 if(u.pathname.endsWith('/version.json')||u.pathname.endsWith('version.json')){e.respondWith(fetch(e.request,{cache:'no-store'}));return}
 if(e.request.mode==='navigate'){
  e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(CACHE).then(x=>x.put(e.request,c));return r}).catch(()=>caches.match(e.request).then(h=>h||caches.match('./index.html'))));return;
 }
 if(u.origin===self.location.origin){e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(CACHE).then(x=>x.put(e.request,c));return r}).catch(()=>caches.match(e.request)))}
});
