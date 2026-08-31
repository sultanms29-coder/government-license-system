/* platform-sync-hub.js — v28.18.55
   Direct central synchronization from the home page. No hidden iframes are required.
   It distributes one verified Supabase configuration, pulls all eight app_state workspaces,
   updates same-origin local caches, subscribes to realtime, and repeats a short health poll. */
(()=>{'use strict';
 const PROJECT_URL='https://jpoijjlgrfsctritfpbrp.supabase.co';
 const MASTER='scc-v11-supabase-master';
 const WORKSPACES={
  'alandiyah-licenses':{cfg:'srco-license-sync-cfg',cache:'srco-license-sync-cache',shape:'standard'},
  'alandiyah-projects':{cfg:'srco-projects-supabase-cfg',cache:'srco-projects-sync-cache',shape:'standard'},
  'alandiyah-contracts':{cfg:'srco-contracts-supabase-cfg',cache:'srco-contract-sync-cache',shape:'standard'},
  'alandiyah-cases':{cfg:'srco-cases-supabase-cfg',cache:'srco-case-sync-cache',shape:'standard'},
  'alandiyah-correspondence':{cfg:'srco-correspondence-supabase-cfg',cache:'srco-mail-sync-cache',shape:'standard'},
  'alandiyah-violations':{cfg:'srco-violations-supabase-cfg',cache:'srco-violations-sync-cache',shape:'standard'},
  'alandiyah-shomoos':{cfg:'srco-shomoos-sync-cfg',cache:'srco-shomoos-sync-cache',shape:'shomoos'},
  'alandiyah-daily-work':{cfg:'srco-daily-work-supabase-cfg',cache:null,shape:'daily'}
 };
 const DAILY_KEYS=['dailyUsersV21','dailyMonthlyWinnersV24','dailyTasksV2','dailyTasks','dailyAuditV2','dailyRecurringV2','dailyManagerNotes','dailyMonthlyGoals','dailyProposedTasksV23','dailyTaskTombstonesV281851'];
 const CLIENT_KEY='scc-platform-sync-hub-client-v1', META='scc-platform-sync-hub-meta-v1';
 let client=null,channel=null,busy=false,timer=null,lastRun=0;
 function parse(raw){try{return raw?JSON.parse(raw):null}catch(_){return null}}
 function config(){
  const candidates=[MASTER,'scc-home-supabase-cfg-v1','scc-home-cloud-v4','srco-license-sync-cfg','srco-projects-supabase-cfg','srco-contracts-supabase-cfg','srco-cases-supabase-cfg','srco-correspondence-supabase-cfg','srco-violations-supabase-cfg','srco-daily-work-supabase-cfg','srco-shomoos-sync-cfg'];
  for(const k of candidates){const c=parse(localStorage.getItem(k));if(!c)continue;const url=String(c.projectUrl||c.url||PROJECT_URL).trim().replace(/\/+$/,'');const key=String(c.anonKey||c.key||c.apiKey||'').trim();if(/^https:\/\/[a-z0-9]+\.supabase\.co$/i.test(url)&&key.length>20)return {projectUrl:url,anonKey:key}}
  return null;
 }
 function distribute(c){if(!c)return;try{localStorage.setItem(MASTER,JSON.stringify({...c,updatedAt:new Date().toISOString()}));}catch(_){}
  for(const [ws,m] of Object.entries(WORKSPACES)){try{let old=parse(localStorage.getItem(m.cfg))||{};if(m.shape==='shomoos'){old={...old,apiKey:c.anonKey,binId:ws,projectUrl:c.projectUrl,anonKey:c.anonKey,workspaceId:ws}}else old={...old,projectUrl:c.projectUrl,anonKey:c.anonKey,workspaceId:ws};localStorage.setItem(m.cfg,JSON.stringify(old))}catch(_){}}
  try{const h=parse(localStorage.getItem('scc-home-supabase-cfg-v1'))||{};localStorage.setItem('scc-home-supabase-cfg-v1',JSON.stringify({...h,url:c.projectUrl,key:c.anonKey,projectUrl:c.projectUrl,anonKey:c.anonKey}))}catch(_){}
 }
 function getClient(){const c=config();if(!c||!window.supabase?.createClient)return null;distribute(c);if(!client)client=window.supabase.createClient(c.projectUrl,c.anonKey,{auth:{persistSession:false,autoRefreshToken:false}});return client}
 function meta(){return parse(localStorage.getItem(META))||{revisions:{},lastRun:0}}
 function saveMeta(m){try{localStorage.setItem(META,JSON.stringify(m))}catch(_){}}
 function safeMerge(remote,local){if(!remote||typeof remote!=='object')return remote;if(!local||typeof local!=='object')return remote;try{if(window.SCCDataSafety?.mergeFreshest)return window.SCCDataSafety.mergeFreshest(remote,local)}catch(_){}return remote}
 function applyDaily(payload,rev){const data=payload?.data||payload||{},dm=parse(localStorage.getItem('dailySyncMetaV26'))||{dirty:{}};for(const k of DAILY_KEYS){if(!(k in data))continue;if(dm.dirty&&dm.dirty[k])continue;try{localStorage.setItem(k,typeof data[k]==='string'?data[k]:JSON.stringify(data[k]))}catch(_){}}try{localStorage.setItem('scc-hub-daily-revision',String(rev||0))}catch(_){}}
 function applyRow(row){if(!row?.workspace_id||!WORKSPACES[row.workspace_id]||!row.payload)return false;const m=WORKSPACES[row.workspace_id],rev=Number(row.revision||0),mm=meta(),prev=Number(mm.revisions?.[row.workspace_id]||0);if(rev&&prev&&rev<prev)return false;
  try{
   if(m.shape==='daily')applyDaily(row.payload,rev);
   else{const local=parse(localStorage.getItem(m.cache));const merged=safeMerge(row.payload,local);localStorage.setItem(m.cache,JSON.stringify(merged));}
   mm.revisions=mm.revisions||{};mm.revisions[row.workspace_id]=Math.max(prev,rev);mm.workspaceMeta=mm.workspaceMeta||{};mm.workspaceMeta[row.workspace_id]={revision:rev,updated_at:row.updated_at||'',updated_by:row.updated_by||''};mm.lastRun=Date.now();try{localStorage.setItem('scc-last-cloud-meta:'+row.workspace_id,JSON.stringify(mm.workspaceMeta[row.workspace_id]))}catch(_){}saveMeta(mm);
   window.dispatchEvent(new CustomEvent('scc:workspace-cache-updated',{detail:{workspaceId:row.workspace_id,revision:rev,updatedBy:row.updated_by||'',at:row.updated_at||''}}));
   return true;
  }catch(e){console.warn('sync hub apply',row.workspace_id,e);return false}
 }
 async function pullAll(reason='home-entry'){
  if(busy||navigator.onLine===false)return false;const sb=getClient();if(!sb)return false;busy=true;
  try{const ids=Object.keys(WORKSPACES);const {data,error}=await sb.from('app_state').select('workspace_id,payload,revision,updated_at,updated_by,client_id').in('workspace_id',ids);if(error)throw error;(data||[]).forEach(applyRow);lastRun=Date.now();const mm=meta();mm.lastRun=lastRun;saveMeta(mm);try{window.dispatchEvent(new CustomEvent('scc:all-workspaces-synced',{detail:{reason,count:(data||[]).length,at:new Date().toISOString()}}))}catch(_){}return true}catch(e){console.warn('platform sync hub pull',e?.message||e);return false}finally{busy=false}
 }
 function subscribe(){const sb=getClient();if(!sb)return;try{if(channel)sb.removeChannel(channel)}catch(_){};channel=sb.channel('scc-platform-sync-hub-'+(localStorage.getItem(CLIENT_KEY)||'home')).on('postgres_changes',{event:'*',schema:'public',table:'app_state'},evt=>{const row=evt.new;if(row&&WORKSPACES[row.workspace_id])applyRow(row)}).subscribe(status=>{if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')setTimeout(subscribe,1800)})}
 function boot(){let id=localStorage.getItem(CLIENT_KEY);if(!id){id='hub-'+Date.now()+'-'+Math.random().toString(36).slice(2);localStorage.setItem(CLIENT_KEY,id)}const c=config();if(c)distribute(c);setTimeout(()=>pullAll('home-entry'),250);setTimeout(()=>pullAll('home-confirm'),2200);setTimeout(subscribe,700);clearInterval(timer);timer=setInterval(()=>{if(!document.hidden)pullAll('health-poll')},12000)}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
 window.addEventListener('online',()=>setTimeout(()=>{pullAll('online');subscribe()},250));window.addEventListener('focus',()=>setTimeout(()=>pullAll('focus'),180));document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(()=>{pullAll('resume');subscribe()},180)});window.addEventListener('pageshow',()=>setTimeout(()=>pullAll('pageshow'),180));
 window.SCCPlatformSyncHub={syncAll:()=>pullAll('manual'),resubscribe:subscribe,status:()=>({configured:!!getClient(),busy,lastRun,meta:meta()})};
})();
