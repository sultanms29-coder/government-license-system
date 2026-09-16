(()=>{'use strict';
 const mq=matchMedia('(max-width:820px)'),root=document.documentElement;
 const isHome=()=>!location.pathname.includes('/apps/');
 function keepMobileCssLast(){const link=document.querySelector('link[href*="mobile-app-v76.css"]');if(link&&document.body&&link.parentNode!==document.body)document.body.appendChild(link)}
 function viewport(){if(!mq.matches)return;const vv=window.visualViewport,h=Math.round(vv?.height||innerHeight);root.style.setProperty('--scc-mobile-vh',h+'px');root.classList.toggle('scc-keyboard-open',!!vv&&h<innerHeight*.78)}
 function drawerState(){if(!mq.matches)return;const open=!!document.querySelector('.sidebar.open');document.body?.classList.toggle('scc-mobile-drawer-open',open)}
 function mode(){root.classList.toggle('scc-mobile-app',mq.matches);root.classList.toggle('scc-mobile-home',mq.matches&&isHome());root.classList.toggle('scc-mobile-system',mq.matches&&!isHome());if(!mq.matches){root.classList.remove('scc-keyboard-open');document.body?.classList.remove('scc-mobile-drawer-open')}viewport();drawerState()}
 function animatePage(target){if(!mq.matches)return;const host=target?.closest?.('.main,.content,#viewHost,main')||document.querySelector('#viewHost,.content,.main,main');if(!host)return;host.classList.remove('scc-mobile-page-enter');requestAnimationFrame(()=>{host.classList.add('scc-mobile-page-enter');setTimeout(()=>host.classList.remove('scc-mobile-page-enter'),210)})}
 mq.addEventListener?.('change',mode);addEventListener('resize',viewport,{passive:true});addEventListener('orientationchange',()=>setTimeout(viewport,120),{passive:true});
 window.visualViewport?.addEventListener('resize',viewport,{passive:true});window.visualViewport?.addEventListener('scroll',viewport,{passive:true});
 document.addEventListener('click',e=>{if(!mq.matches)return;const nav=e.target.closest('.nav-item,.nav button,.mobile-nav button,.tabs .tab,[data-view]');if(nav)animatePage(nav);setTimeout(drawerState,0)},true);
 document.addEventListener('focusin',e=>{if(!mq.matches||!e.target.matches?.('input,select,textarea,[contenteditable="true"]'))return;setTimeout(()=>{const vv=window.visualViewport,rect=e.target.getBoundingClientRect(),bottom=vv?.height||innerHeight;if(rect.bottom>bottom-18||rect.top<10)e.target.scrollIntoView({block:'center',inline:'nearest',behavior:'smooth'})},260)},true);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{keepMobileCssLast();mode();new MutationObserver(drawerState).observe(document.body,{subtree:true,attributes:true,attributeFilter:['class']})},{once:true});else{keepMobileCssLast();mode();new MutationObserver(drawerState).observe(document.body,{subtree:true,attributes:true,attributeFilter:['class']})}
})();
