/* v28.18.31 — robust desktop wheel scrolling for the HOME page only. */
(()=>{
 'use strict';
 const desktop=()=>innerWidth>=850;
 const editable=t=>!!t?.closest?.('input,textarea,select,[contenteditable=\"true\"]');
 const dialog=t=>!!t?.closest?.('.portal-modal.show,.v17-users-modal.show,.v4-settings.show,.v4-settings.open,.local-ai-panel.open,[role=\"dialog\"]');
 const scrollable=(el,dy)=>{if(!el||el===document.body||el===document.documentElement)return false;const s=getComputedStyle(el);if(!/(auto|scroll)/.test(s.overflowY)||el.scrollHeight<=el.clientHeight+2)return false;return dy>0?el.scrollTop+el.clientHeight<el.scrollHeight-2:el.scrollTop>2};
 document.addEventListener('wheel',e=>{
   if(!desktop()||e.ctrlKey||e.metaKey||editable(e.target)||dialog(e.target))return;
   const dy=e.deltaMode===1?e.deltaY*38:e.deltaMode===2?e.deltaY*innerHeight:e.deltaY;if(!dy)return;
   let n=e.target instanceof Element?e.target:null;while(n&&n!==document.body){if(scrollable(n,dy))return;n=n.parentElement}
   const root=document.scrollingElement||document.documentElement,max=Math.max(0,root.scrollHeight-innerHeight);if(max<2)return;
   const before=root.scrollTop,next=Math.max(0,Math.min(max,before+dy));if(next===before)return;
   e.preventDefault();window.scrollTo({top:next,left:0,behavior:'auto'});
 },{capture:true,passive:false});
})();
