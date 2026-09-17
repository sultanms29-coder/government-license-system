/* data-safety-guardian.js — v28.18.26
   Conflict-aware synchronization + deletion tombstones.
   Prevents stale devices from resurrecting records deleted by an administrator,
   while continuing to merge concurrent additions and keeping rolling snapshots. */
(()=>{'use strict';
 const DB='scc-data-safety-v3', STORE='snapshots', META_PREFIX='scc-safety-meta:', TOMBSTONE_KEY='_sccDeletes';
 const IGNORE=new Set(['users','activityLog','settings','notifications','auditLog','logs',TOMBSTONE_KEY]);
 const DIFF_IGNORE=new Set(['activityLog','notifications','auditLog','logs']);
 const ID_FIELDS=['id','uuid','recordId','branchId','violationNumber','outgoingNumber','incomingNumber','contractNumber','caseNumber','requestNumber','projectId','taskId','licenseNumber','name','branchName','username','fileName','filename'];
 const TS_FIELDS=['updatedAt','updated_at','modifiedAt','modified_at','lastUpdated','timestamp','ts','createdAt','created_at'];
 function clone(v){try{return JSON.parse(JSON.stringify(v))}catch(_){return v}}
 function isObj(v){return !!v&&typeof v==='object'&&!Array.isArray(v)}
 function empty(v){return v===undefined||v===null||v===''||(Array.isArray(v)&&v.length===0)}
 function stableKey(x){if(!isObj(x))return null;for(const k of ID_FIELDS){if(x[k]!=null&&String(x[k]).trim())return k+':'+String(x[k]).trim()}return null}
 function arrKey(x,i){return stableKey(x)||('idx:'+i+':'+JSON.stringify(x).slice(0,160))}
 function stamp(x){if(!isObj(x))return 0;for(const k of TS_FIELDS){const v=x[k];if(v!==undefined&&v!==null&&v!==''){const n=typeof v==='number'?v:Date.parse(v);if(Number.isFinite(n)&&n>0)return n}}return 0}
 function businessCount(p){if(!isObj(p))return 0;let n=0;for(const [k,v] of Object.entries(p)){if(IGNORE.has(k))continue;if(Array.isArray(v))n+=v.length;else if(isObj(v)&&k==='entities'){for(const vv of Object.values(v)){if(Array.isArray(vv))n+=vv.length;else if(isObj(vv))n+=Object.keys(vv).length}}}return n}
 function mainCounts(p){const o={};if(!isObj(p))return o;for(const [k,v] of Object.entries(p)){if(IGNORE.has(k))continue;if(Array.isArray(v))o[k]=v.length;else if(k==='entities'&&isObj(v))o[k]=Object.keys(v).length}return o}
 function tombId(path,key){return String(path||'')+'|'+String(key||'')}
 function tombMapFrom(...payloads){const m=new Map();for(const p of payloads){const rows=isObj(p)&&Array.isArray(p[TOMBSTONE_KEY])?p[TOMBSTONE_KEY]:[];for(const t of rows){if(!t||!t.path||!t.key)continue;const id=tombId(t.path,t.key),ts=Number(t.ts||0);if(!m.has(id)||Number(m.get(id).ts||0)<ts)m.set(id,{path:String(t.path),key:String(t.key),ts,by:t.by||''})}}return m}
 function tombList(m){return [...m.values()].sort((a,b)=>b.ts-a.ts).slice(0,2500)}
 function mergeRecord(primary,secondary,path,tombs){
   if(!isObj(primary))return clone(secondary); if(!isObj(secondary))return clone(primary);
   const tp=stamp(primary),ts=stamp(secondary); let a=primary,b=secondary;
   if(ts>tp){a=secondary;b=primary}
   const out=clone(a);
   for(const [k,v] of Object.entries(b)){
     if(k===TOMBSTONE_KEY)continue;
     const child=path?path+'.'+k:k;
     if(out[k]===undefined||empty(out[k]))out[k]=clone(v);
     else if(Array.isArray(out[k])||Array.isArray(v))out[k]=mergeArray(Array.isArray(out[k])?out[k]:[],Array.isArray(v)?v:[],child,tombs);
     else if(isObj(out[k])&&isObj(v))out[k]=mergeObjectInternal(out[k],v,child,tombs);
   }
   return out;
 }
 function mergeArray(primary,secondary,path,tombs){
   const out=[],map=new Map(),order=[];
   const add=(x,i,prefer)=>{const k=arrKey(x,i);if(!map.has(k)){map.set(k,clone(x));order.push(k);return}const cur=map.get(k);map.set(k,prefer?mergeRecord(x,cur,path,tombs):mergeRecord(cur,x,path,tombs))};
   (Array.isArray(primary)?primary:[]).forEach((x,i)=>add(x,i,true));
   (Array.isArray(secondary)?secondary:[]).forEach((x,i)=>add(x,i,false));
   for(const k of order){if(!map.has(k))continue;const item=map.get(k),stable=stableKey(item);if(stable){const t=tombs.get(tombId(path,stable));if(t&&stamp(item)<=Number(t.ts||0))continue}out.push(item)}
   return out;
 }
 function mergeObjectInternal(primary,secondary,path,tombs){
   const out=clone(isObj(primary)?primary:{}); if(!isObj(secondary))return out;
   for(const [k,v] of Object.entries(secondary)){
     if(k===TOMBSTONE_KEY)continue;
     const child=path?path+'.'+k:k;
     if(out[k]===undefined){out[k]=clone(v);continue}
     if(Array.isArray(out[k])||Array.isArray(v))out[k]=mergeArray(Array.isArray(out[k])?out[k]:[],Array.isArray(v)?v:[],child,tombs);
     else if(isObj(out[k])&&isObj(v))out[k]=mergeObjectInternal(out[k],v,child,tombs);
     else if(empty(out[k])&&!empty(v))out[k]=clone(v);
   }
   return out;
 }
 function mergeFreshest(primary,secondary){const tombs=tombMapFrom(primary,secondary);const out=mergeObjectInternal(primary,secondary,'',tombs);if(tombs.size)out[TOMBSTONE_KEY]=tombList(tombs);return out}
 function mergeMissing(primary,donor){return mergeFreshest(primary,donor)}
 function collectDeletions(prev,curr,path,tombs,now){
   if(!prev)return;
   if(Array.isArray(prev)&&Array.isArray(curr)){
     const pk=prev.map(stableKey),ck=new Set(curr.map(stableKey).filter(Boolean));
     if(pk.some(Boolean))prev.forEach((item)=>{const k=stableKey(item);if(k&&!ck.has(k)){const id=tombId(path,k);const old=tombs.get(id);if(!old||Number(old.ts||0)<now)tombs.set(id,{path,key:k,ts:now})}});
     return;
   }
   if(isObj(prev)&&isObj(curr))for(const [k,v] of Object.entries(prev)){
     if(k===TOMBSTONE_KEY||DIFF_IGNORE.has(k))continue;
     if(!(k in curr))continue;
     const child=path?path+'.'+k:k;
     collectDeletions(v,curr[k],child,tombs,now);
   }
 }
 function prepareForPersist(workspace,previous,current){
   if(!isObj(current))return current;
   const out=clone(current),tombs=tombMapFrom(previous,current);const now=Date.now();
   try{collectDeletions(previous||{},current||{},'',tombs,now)}catch(_){}
   // Keep deletion decisions for six months so an old device cannot resurrect them later.
   const cutoff=now-180*24*60*60*1000;for(const [id,t] of tombs)if(Number(t.ts||0)<cutoff)tombs.delete(id);
   if(tombs.size)out[TOMBSTONE_KEY]=tombList(tombs);else delete out[TOMBSTONE_KEY];
   try{if(workspace)localStorage.setItem('scc-delete-meta:'+workspace,JSON.stringify(out[TOMBSTONE_KEY]||[]))}catch(_){}
   return out;
 }
 function catastrophic(local,remote){const l=businessCount(local),r=businessCount(remote);if(l>=1&&r===0)return true;if(l>=5&&r<Math.floor(l*.55))return true;const lc=mainCounts(local),rc=mainCounts(remote);for(const [k,n] of Object.entries(lc)){if(n>=5&&(rc[k]||0)<Math.floor(n*.45))return true}return false}
 function openDb(){return new Promise((resolve,reject)=>{try{const q=indexedDB.open(DB,1);q.onupgradeneeded=()=>{const db=q.result;if(!db.objectStoreNames.contains(STORE)){const s=db.createObjectStore(STORE,{keyPath:'key'});s.createIndex('workspace','workspace',{unique:false});s.createIndex('ts','ts',{unique:false})}};q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error)}catch(e){reject(e)}})}
 async function backup(workspace,payload,reason='snapshot'){if(!workspace||!payload)return;try{const db=await openDb();const tx=db.transaction(STORE,'readwrite'),s=tx.objectStore(STORE),ts=Date.now(),key=workspace+':'+ts+':'+Math.random().toString(36).slice(2,7);s.put({key,workspace,ts,reason,count:businessCount(payload),payload:clone(payload)});await new Promise(r=>{tx.oncomplete=r;tx.onerror=r});db.close();localStorage.setItem(META_PREFIX+workspace,JSON.stringify({ts,count:businessCount(payload),reason}));await prune(workspace,18)}catch(_){} }
 async function snapshots(workspace){try{const db=await openDb();const tx=db.transaction(STORE,'readonly'),idx=tx.objectStore(STORE).index('workspace');const req=idx.getAll(IDBKeyRange.only(workspace));const rows=await new Promise(r=>{req.onsuccess=()=>r(req.result||[]);req.onerror=()=>r([])});db.close();return rows.sort((a,b)=>b.ts-a.ts)}catch(_){return[]}}
 async function prune(workspace,max=18){try{const rows=await snapshots(workspace);if(rows.length<=max)return;const db=await openDb(),tx=db.transaction(STORE,'readwrite'),s=tx.objectStore(STORE);rows.slice(max).forEach(x=>s.delete(x.key));await new Promise(r=>{tx.oncomplete=r;tx.onerror=r});db.close()}catch(_){} }
 async function recover(workspace,current,baseline){let best=clone(current||{}),bestCount=businessCount(best),source='current';const candidates=[];if(baseline)candidates.push({payload:baseline,source:'embedded baseline'});for(const s of await snapshots(workspace))candidates.push({payload:s.payload,source:'safety backup '+new Date(s.ts).toLocaleString('ar-SA')});for(const c of candidates){const merged=mergeFreshest(best,c.payload),n=businessCount(merged);if(n>bestCount){best=merged;bestCount=n;source=c.source}else best=merged}return {payload:best,count:businessCount(best),source,recovered:businessCount(best)>businessCount(current)}}
 function toast(msg){try{if(typeof window.toast==='function')window.toast(msg,'🛡️');else console.warn(msg)}catch(_){} }
 window.SCCDataSafety={businessCount,mainCounts,mergeMissing,mergeFreshest,mergeRecord,catastrophic,backup,snapshots,recover,prepareForPersist,toast,TOMBSTONE_KEY};
})();
