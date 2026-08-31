(()=>{'use strict';
const css=document.createElement('style');css.id='scc-silent-background-sync-style';css.textContent=`
#coreUpdateBar{display:none!important}
/* مؤشرات المزامنة المتغيرة في الواجهة العامة مخفية؛ المزامنة نفسها تعمل في الخلفية. */
#syncStatusBox,#lastSyncFoot,#coreUpdateBar,[data-live-sync-status]{display:none!important}
`;
document.head.appendChild(css);
// لا نعرض إشعارات تقنية صادرة من النظام نفسه. الإشعارات المنسوبة لمستخدم حقيقي تبقى كما هي.
window.SCCIsRealOtherUserUpdate=function(updatedBy,currentUser){try{const name=String(updatedBy||'').trim();if(!name||['جهاز آخر','جهاز غير معروف','مزامنة النظام','النظام','system','auto-sync'].includes(name))return false;const users=JSON.parse(localStorage.getItem('scc-v17-users')||'[]');if(!Array.isArray(users))return false;const real=users.find(u=>u&&u.name===name&&u.role&&u.role!=='system');if(!real)return false;const currentName=(currentUser&&currentUser.name)||window.SCC_CURRENT_USER?.name||'';return name!==currentName}catch(_){return false}};
window.addEventListener('scc:background-version-ready',()=>{},false);
})();