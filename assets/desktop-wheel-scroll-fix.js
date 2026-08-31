/* v28.18.11 — إصلاح تمرير عجلة الفأرة في الصفحة الرئيسية فقط
   لا يغيّر أي تنسيق مكتبي؛ يعيد توجيه عجلة الفأرة إلى أقرب حاوية قابلة للتمرير
   أو إلى نافذة الصفحة عندما تعترضها طبقة/عنصر غير قابل للتمرير. */
(()=>{
  'use strict';
  const DESKTOP_MIN = 981;
  const isDesktop = () => window.innerWidth >= DESKTOP_MIN && matchMedia('(pointer:fine)').matches;
  const isEditable = el => !!el?.closest?.('input,textarea,select,[contenteditable="true"]');
  const isOpenDialog = el => !!el?.closest?.('.portal-modal.show,.v17-users-modal.show,.v4-settings.open,.local-ai-panel.open,.ai-analytics-modal.open,[role="dialog"]');
  const canScroll = (el, dy) => {
    if(!el || el === document.body || el === document.documentElement) return false;
    const cs = getComputedStyle(el);
    if(!/(auto|scroll)/.test(cs.overflowY)) return false;
    if(el.scrollHeight <= el.clientHeight + 1) return false;
    return dy > 0 ? el.scrollTop + el.clientHeight < el.scrollHeight - 1 : el.scrollTop > 1;
  };
  const nearestScrollable = (start, dy) => {
    let el = start instanceof Element ? start : null;
    while(el && el !== document.body){
      if(canScroll(el,dy)) return el;
      el = el.parentElement;
    }
    return null;
  };
  document.addEventListener('wheel', e => {
    if(!isDesktop() || e.ctrlKey || e.metaKey || isEditable(e.target)) return;
    const dy = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY;
    if(!dy) return;
    const nested = nearestScrollable(e.target,dy);
    if(nested){
      // اترك السلوك الطبيعي للحاويات الداخلية مثل الإعدادات والنوافذ.
      return;
    }
    if(isOpenDialog(e.target)) return;
    const root = document.scrollingElement || document.documentElement;
    const max = Math.max(0, root.scrollHeight - window.innerHeight);
    const next = Math.max(0, Math.min(max, root.scrollTop + dy));
    if(next === root.scrollTop) return;
    e.preventDefault();
    root.scrollTop = next;
  }, {capture:true, passive:false});
})();
