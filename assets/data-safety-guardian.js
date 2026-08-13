/* data-safety-guardian.js — v28.18.25
   Additive, conflict-aware synchronization protection.
   Goals: never let a sparse/old device erase richer data; merge concurrent additions;
   keep rolling local snapshots before every cloud transition. */
(()=>{'use strict';
 const DB='scc-data-safety-v2', STORE='snapshots', META_PREFIX='scc-safety-meta:';
 const IGNORE=new Set(['users','activityLog','settings','notifications','auditLog','logs']);
 const ID_FIELDS=['id','uuid','recordId','branchId','violationNumber','outgoingNumber','incomingNumber','contractNumber','caseNumber','projectId','taskId','licenseNumber','name','branchName'];
 const TS_FIELDS=['updatedAt','updated_at','modifiedAt','modified_at','lastUpdated','timestamp','ts','createdAt','created_at'];
 function clone(v){try{return JSON.parse(JSON.stringify(v))}catch(_){return v}}
 function isObj(v){return !!v&&typeof v==='object'&&!Array.isArray(v)}
 function empty(v){return v===undefined||v===null||v===''||(Array.isArray(v)&&v.length===0)}
 function arrKey(x,i){if(isObj(x)){for(const k of ID_FIELDS){if(x[k]!=null&&String(x[k]).trim())return k+':'+String(x[k]).trim()}}return 'idx:'+i+':'+JSON.stringify(x).slice(0,160)}
 function stamp(x){if(!isObj(x))return 0;for(const k of TS_FIELDS){const v=x[k];if(v!==undefined&&v!==null&&v!==''){const n=typeof v==='number'?v:Date.parse(v);if(Number.isFinite(n)&&n>0)return n}}return 0}
 function businessCount(p){if(!isObj(p))return 0;let n=0;for(const [k,v] of Object.entries(p)){if(IGNORE.has(k))continue;if(Array.isArray(v))n+=v.length;else if(isObj(v)&&k==='entities'){for(const vv of Object.values(v)){if(Array.isArray(vv))n+=vv.length;else if(isObj(vv))n+=Object.keys(vv).length}}}return n}
 function mainCounts(p){const o={};if(!isObj(p))return o;for(const [k,v] of Object.entries(p)){if(IGNORE.has(k))continue;if(Array.isArray(v))o[k]=v.length;else if(k==='entities'&&isObj(v))o[k]=Object.keys(v).length}return o}
 function mergeRecord(primary,secondary){
   if(!isObj(primary))return clone(secondary); if(!isObj(secondary))return clone(primary);
   const tp=stamp(primary),ts=stamp(secondary); let a=primary,b=secondary;
   if(ts>tp){a=secondary;b=primary}
   const out=clone(a);
   for(const [k,v] of Object.entries(b)){
     if(out[k]===undefined||empty(out[k]))out[k]=clone(v);
     else if(isObj(out[k])&&isObj(v))out[k]=mergeObject(out[k],v);
   }
   return out;
 }
 function mergeArray(primary,secondary){
   const out=[], map=new Map();
   const add=(x,i,prefer)=>{const k=arrKey(x,i);if(!map.has(k)){map.set(k,clone(x));return}const cur=map.get(k);map.set(k,prefer?mergeRecord(x,cur):mergeRecord(cur,x))};
   (Array.isArray(primary)?primary:[]).forEach((x,i)=>add(x,i,true));
   (Array.isArray(secondary)?secondary:[]).forEach((x,i)=>add(x,i,false));
   for(const x of (Array.isArray(primary)?primary:[])){const k=arrKey(x,0);if(map.has(k)){out.push(map.get(k));map.delete(k)}}
   for(const v of map.values())out.push(v);
   return out;
 }
 function mergeObject(primary,secondary){
   const out=clone(isObj(primary)?primary:{}); if(!isObj(secondary))return out;
   for(const [k,v] of Object.entries(secondary)){
     if(out[k]===undefined){out[k]=clone(v);continue}
     if(Array.isArray(out[k])||Array.isArray(v))out[k]=mergeArray(Array.isArray(out[k])?out[k]:[],Array.isArray(v)?v:[]);
     else if(isObj(out[k])&&isObj(v))out[k]=mergeObject(out[k],v);
     else if(empty(out[k])&&!empty(v))out[k]=clone(v);
   }
   return out;
 }
 function mergeFreshest(primary,secondary){return mergeObject(primary,secondary)}
 function mergeMissing(primary,donor){return mergeFreshest(primary,donor)}
 function catastrophic(local,remote){const l=businessCount(local),r=businessCount(remote);if(l>=1&&r===0)return true;if(l>=5&&r<Math.floor(l*.55))return true;const lc=mainCounts(local),rc=mainCounts(remote);for(const [k,n] of Object.entries(lc)){if(n>=5&&(rc[k]||0)<Math.floor(n*.45))return true}return false}
 function openDb(){return new Promise((resolve,reject)=>{try{const q=indexedDB.open(DB,1);q.onupgradeneeded=()=>{const db=q.result;if(!db.objectStoreNames.contains(STORE)){const s=db.createObjectStore(STORE,{keyPath:'key'});s.createIndex('workspace','workspace',{unique:false});s.createIndex('ts','ts',{unique:false})}};q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error)}catch(e){reject(e)}})}
 async function backup(workspace,payload,reason='snapshot'){if(!workspace||!payload)return;try{const db=await openDb();const tx=db.transaction(STORE,'readwrite'),s=tx.objectStore(STORE),ts=Date.now(),key=workspace+':'+ts+':'+Math.random().toString(36).slice(2,7);s.put({key,workspace,ts,reason,count:businessCount(payload),payload:clone(payload)});await new Promise(r=>{tx.oncomplete=r;tx.onerror=r});db.close();localStorage.setItem(META_PREFIX+workspace,JSON.stringify({ts,count:businessCount(payload),reason}));await prune(workspace,12)}catch(_){}}
 async function snapshots(workspace){try{const db=await openDb();const tx=db.transaction(STORE,'readonly'),idx=tx.objectStore(STORE).index('workspace');const req=idx.getAll(IDBKeyRange.only(workspace));const rows=await new Promise(r=>{req.onsuccess=()=>r(req.result||[]);req.onerror=()=>r([])});db.close();return rows.sort((a,b)=>b.ts-a.ts)}catch(_){return[]}}
 async function prune(workspace,max=12){try{const rows=await snapshots(workspace);if(rows.length<=max)return;const db=await openDb(),tx=db.transaction(STORE,'readwrite'),s=tx.objectStore(STORE);rows.slice(max).forEach(x=>s.delete(x.key));await new Promise(r=>{tx.oncomplete=r;tx.onerror=r});db.close()}catch(_){}}
 async function recover(workspace,current,baseline){let best=clone(current||{}),bestCount=businessCount(best),source='current';const candidates=[];if(baseline)candidates.push({payload:baseline,source:'embedded baseline'});for(const s of await snapshots(workspace))candidates.push({payload:s.payload,source:'safety backup '+new Date(s.ts).toLocaleString('ar-SA')});for(const c of candidates){const merged=mergeFreshest(best,c.payload),n=businessCount(merged);if(n>bestCount){best=merged;bestCount=n;source=c.source}}return {payload:best,count:bestCount,source,recovered:bestCount>businessCount(current)}}
 function toast(msg){try{if(typeof window.toast==='function')window.toast(msg,'🛡️');else console.warn(msg)}catch(_){}}
 window.SCCDataSafety={businessCount,mainCounts,mergeMissing,mergeFreshest,mergeRecord,catastrophic,backup,snapshots,recover,toast};
})();