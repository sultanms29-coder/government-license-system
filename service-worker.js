const CACHE='scc-platform-v28-6-0-ai-relocated-20260726';
const SHELL=[
 './','./index.html','./manifest.webmanifest','./version.json',
 './assets/security-hardening.js','./assets/core-shared.css','./assets/core-home-extra.css','./assets/core-home-extra.js',
 './assets/core-updater.js',
 './assets/v25-shared.js',
 './assets/local-ai-engine.css','./assets/local-ai-engine.js',
 './icons/icon-192.png','./icons/icon-512.png','./icons/apple-touch-icon.png',
 './apps/licenses/index.html','./apps/projects/index.html','./apps/contracts/index.html',
 './apps/cases/index.html','./apps/shomoos/index.html','./apps/correspondence/index.html',
 './apps/violations/index.html','./apps/opportunities/index.html'
];
self.addEventListener('install',event=>event.waitUntil(
 caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())
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
  event.respondWith(fetch(event.request).then(response=>{
   const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return response;
  }).catch(()=>caches.match(event.request).then(hit=>hit||caches.match('./index.html'))));return;
 }
 if(url.origin===self.location.origin){
  event.respondWith(fetch(event.request).then(response=>{
   const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return response;
  }).catch(()=>caches.match(event.request)));
 }
});
