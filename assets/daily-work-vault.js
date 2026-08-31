/* Daily Work Recovery Vault v28.18.59
   Persistent, version-independent snapshots for daily-work data.
   Keeps local recovery copies across application updates and can rebuild from legacy keys. */
(()=>{'use strict';
 const DB='scc-daily-work-vault-v1',STORE='snapshots',LIVE='dailyRecoveryVaultV1';
 const KEYS=['dailyUsersV21','dailyMonthlyWinnersV24','dailyTasksV2','dailyTasks','dailyAuditV2','dailyRecurringV2','dailyManagerNotes','dailyMonthlyGoals','dailyProposedTasksV23','dailyTaskTombstonesV281851'];
 const parse=v=>{try{return JSON.parse(v||'')}catch(_){return null}}, clone=v=>{try{return JSON.parse(JSON.stringify(v))}catch(_){return v}};
 function read(){const out={};for(const k of KEYS){const raw=localStorage.getItem(k);if(raw!==null){const p=parse(raw);out[k]=p===null?raw:p}}return out}
 function richness(d){if(!d||typeof d!=='object')return 0;let n=0;for(const k of KEYS){const v=d[k];if(Array.isArray(v))n+=v.length*10;else if(v&&typeof v==='object')n+=Object.keys(v).length*3;else if(v!=null)n+=1}return n}
 function open(){return new Promise((res,rej)=>{try{const q=indexedDB.open(DB,1);q.onupgradeneeded=()=>{const db=q.result;if(!db.objectStoreNames.contains(STORE)){const s=db.createObjectStore(STORE,{keyPath:'id'});s.createIndex('ts','ts')}};q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error)}catch(e){rej(e)}})}
 async function snapshot(reason='save',data=read()){if(!data||!Object.keys(data).length)return;const row={id:Date.now()+'-'+Math.random().toString(36).slice(2),ts:Date.now(),reason,data:clone(data),score:richness(data)};try{localStorage.setItem(LIVE,JSON.stringify(row))}catch(_){}try{const db=await open(),tx=db.transaction(STORE,'readwrite'),s=tx.objectStore(STORE);s.put(row);await new Promise(r=>{tx.oncomplete=r;tx.onerror=r});db.close();await prune(40)}catch(_){} }
 async function all(){try{const db=await open(),tx=db.transaction(STORE,'readonly'),q=tx.objectStore(STORE).getAll(),rows=await new Promise(r=>{q.onsuccess=()=>r(q.result||[]);q.onerror=()=>r([])});db.close();return rows.sort((a,b)=>b.ts-a.ts)}catch(_){return[]}}
 async function prune(max=40){const rows=await all();if(rows.length<=max)return;try{const db=await open(),tx=db.transaction(STORE,'readwrite'),s=tx.objectStore(STORE);rows.slice(max).forEach(r=>s.delete(r.id));await new Promise(r=>{tx.oncomplete=r;tx.onerror=r});db.close()}catch(_){} }
 function mergeArray(a,b,key='id'){const m=new Map();for(const arr of [Array.isArray(a)?a:[],Array.isArray(b)?b:[]])for(const x of arr){const id=x&&typeof x==='object'?(x[key]??x.username??x.name??JSON.stringify(x)):String(x);if(!m.has(String(id)))m.set(String(id),clone(x));else{const old=m.get(String(id));if(old&&x&&typeof old==='object'&&typeof x==='object'){const ta=Date.parse(old.updatedAt||old.lastActivity||old.at||old.createdAt||0)||0,tb=Date.parse(x.updatedAt||x.lastActivity||x.at||x.createdAt||0)||0;m.set(String(id),tb>=ta?{...old,...x}:{...x,...old})}}}return [...m.values()]}
 function merge(a,b){const out={...(a||{})};for(const k of KEYS){const x=out[k],y=b?.[k];if(y===undefined)continue;if(Array.isArray(x)||Array.isArray(y))out[k]=mergeArray(x,y);else if(x&&y&&typeof x==='object'&&typeof y==='object')out[k]={...x,...y};else if(x==null)out[k]=clone(y)}const tomb=out.dailyTaskTombstonesV281851||{};for(const k of ['dailyTasksV2','dailyTasks'])if(Array.isArray(out[k]))out[k]=out[k].filter(t=>!tomb[String(t?.id)]);return out}
 async function bestCandidates(extra=[]){let merged=read();const localVault=parse(localStorage.getItem(LIVE));if(localVault?.data)merged=merge(merged,localVault.data);for(const row of await all())merged=merge(merged,row.data);for(const e of extra)if(e)merged=merge(merged,e);return merged}
 function apply(data){if(!data)return;for(const k of KEYS){if(data[k]!==undefined)try{localStorage.setItem(k,JSON.stringify(data[k]))}catch(_){}}}
 // Capture whatever survived before application code has a chance to initialize defaults.
 if(Object.keys(read()).length)snapshot('pre-boot').catch(()=>{});
 window.DailyWorkVault={KEYS,read,richness,snapshot,all,merge,bestCandidates,apply};
})();
