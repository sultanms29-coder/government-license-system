(()=>{
 const VERSION='28.18.22';
 const THEMES={formal:{a:'#D4AF37',a2:'#EBCB6B',rgb:'212,175,55',bg:'#0F1419'},executive:{a:'#2F80ED',a2:'#76B5FF',rgb:'47,128,237',bg:'#F4F7FB'},sport:{a:'#2EAD67',a2:'#7DE3A7',rgb:'46,173,103',bg:'#F4F8F5'},royal:{a:'#8E5CFF',a2:'#C4A9FF',rgb:'142,92,255',bg:'#151020'},ocean:{a:'#19B8C7',a2:'#75E4EE',rgb:'25,184,199',bg:'#071B24'},burgundy:{a:'#B6495A',a2:'#EE8B9A',rgb:'182,73,90',bg:'#211014'},white:{a:'#B88913',a2:'#D5A92E',rgb:'184,137,19',bg:'#FFFFFF'}};
 function apply(name){const t=THEMES[name]||THEMES.formal,r=document.documentElement;const key=THEMES[name]?name:'formal';r.dataset.theme=key;r.style.setProperty('--accent',t.a);r.style.setProperty('--accent2',t.a2);r.style.setProperty('--accent-rgb',t.rgb);const vars={'--bg':'#F6F8FB','--bg-elevated':'#FFFFFF','--surface':'#FFFFFF','--surface-hi':'#F1F4F8','--border':'#D7E0EA','--border-soft':'#E5EAF0','--gold':'#B88913','--gold-bright':'#D5A92E','--gold-dim':'#8C6710','--gold-glass':'rgba(184,137,19,.09)','--text':'#172033','--text-muted':'#667085','--text-faint':'#98A2B3','--page-bg':'#F6F8FB','--page-bg2':'#FFFFFF','--page-surface':'#FFFFFF','--page-text':'#172033','--page-muted':'#667085','--page-border':'#D7E0EA'};if(key==='white'){Object.entries(vars).forEach(([k,v])=>r.style.setProperty(k,v));}else{Object.keys(vars).forEach(k=>r.style.removeProperty(k));}document.querySelector('meta[name="theme-color"]')?.setAttribute('content',t.bg)}
 apply(localStorage.getItem('scc_theme_v2')||'formal');
 addEventListener('storage',e=>{if(e.key==='scc_theme_v2')apply(e.newValue||'formal')});
 addEventListener('scc:theme-changed',e=>apply(e.detail||localStorage.getItem('scc_theme_v2')||'formal'));

 function cleanLegacyUi(){
  document.querySelectorAll('.v25-share-tools,[data-v25-share],.v12-version-footer,.v25-version-footer,.v251-version-footer').forEach(el=>el.remove());
  const bad=/^\s*n\s*\/\s*n\s*\/?\s*$/i;
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
  const remove=[];
  while(walker.nextNode()){
   const node=walker.currentNode;
   if(bad.test(node.nodeValue||'')) remove.push(node);
  }
  remove.forEach(node=>{
   const parent=node.parentElement;
   node.nodeValue='';
   if(parent&&parent.children.length===0&&!parent.textContent.trim()) parent.remove();
  });
 }
 function init(){cleanLegacyUi()}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
