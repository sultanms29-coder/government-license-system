const CACHE='scc-sports-intro-v7';
const SHELL=["./", "./index.html", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png", "./assets/team/mishari.jpg", "./assets/team/sultan.jpg", "./apps/licenses/index.html", "./apps/projects/index.html", "./apps/contracts/index.html", "./apps/cases/index.html"];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
 if(e.request.method!=='GET')return;
 const u=new URL(e.request.url);
 if(u.hostname.includes('supabase.co')||u.hostname.includes('jsonbin.io'))return;
 if(e.request.mode==='navigate')e.respondWith(fetch(e.request).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html'))));
 else if(u.origin===self.location.origin)e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));
});
