(()=>{
 const VERSION='25.1.0';
 const THEMES={formal:{a:'#D4AF37',a2:'#EBCB6B',rgb:'212,175,55',bg:'#0F1419'},executive:{a:'#2F80ED',a2:'#76B5FF',rgb:'47,128,237',bg:'#F4F7FB'},sport:{a:'#2EAD67',a2:'#7DE3A7',rgb:'46,173,103',bg:'#F4F8F5'},royal:{a:'#8E5CFF',a2:'#C4A9FF',rgb:'142,92,255',bg:'#151020'},ocean:{a:'#19B8C7',a2:'#75E4EE',rgb:'25,184,199',bg:'#071B24'},burgundy:{a:'#B6495A',a2:'#EE8B9A',rgb:'182,73,90',bg:'#211014'}};
 function apply(name){const t=THEMES[name]||THEMES.formal,r=document.documentElement;r.dataset.theme=THEMES[name]?name:'formal';r.style.setProperty('--accent',t.a);r.style.setProperty('--accent2',t.a2);r.style.setProperty('--accent-rgb',t.rgb);document.querySelector('meta[name="theme-color"]')?.setAttribute('content',t.bg)}
 apply(localStorage.getItem('scc_theme_v2')||'formal');
 addEventListener('storage',e=>{if(e.key==='scc_theme_v2')apply(e.newValue||'formal')});
 addEventListener('scc:theme-changed',e=>apply(e.detail||localStorage.getItem('scc_theme_v2')||'formal'));

 function cleanLegacyUi(){
  document.querySelectorAll('.v25-share-tools,[data-v25-share]').forEach(el=>el.remove());
  const bad=/^\s*n\s*\/\s*n\s*\/?\s*$/i;
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
  const remove=[];
  while(walker.nextNode()){
   const node=walker.currentNode;
   if(bad.test(node.nodeValue||'')) remove.push(node);
  }
  remove.forEach(node=>{
   const p=node.parentElement;
   node.nodeValue='';
   if(p&&p.children.length===0&&!p.textContent.trim())p.remove();
  });
  document.querySelectorAll('.v12-version-footer,.v25-version-footer,.v251-version-footer').forEach(el=>el.remove());
 }
 function mountVersion(){
  const f=document.createElement('div');
  f.className='v251-version-footer';
  f.setAttribute('aria-label',`إصدار النظام ${VERSION}`);
  f.textContent=`الإصدار ${VERSION}`;
  document.body.appendChild(f);
 }
 function init(){cleanLegacyUi();mountVersion()}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
