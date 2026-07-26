/* core-updater.js — تحديث موحّد عبر كل صفحات المنصة (الرئيسية + الأنظمة الثمانية)
   يفحص version.json دوريًا، ويعرض شارة "تحديث متاح" عند وجود إصدار أحدث،
   وعند الضغط عليها يمسح كاش المتصفح وملف الخدمة (service worker) فقط —
   لا يمسّ أي بيانات محلية (localStorage/sessionStorage) ولا بيانات المستخدم أو المزامنة. */
(() => {
  'use strict';
  const INSTALLED_KEY = 'scc-installed-version';
  const ROOT = location.pathname.includes('/apps/') ? '../../' : './';
  const VERSION_URL = ROOT + 'version.json';

  function compare(a, b) {
    const A = String(a || '0').split('.').map(Number);
    const B = String(b || '0').split('.').map(Number);
    for (let i = 0; i < Math.max(A.length, B.length); i++) {
      const d = (A[i] || 0) - (B[i] || 0);
      if (d) return d > 0 ? 1 : -1;
    }
    return 0;
  }

  async function remoteVersion() {
    const sep = VERSION_URL.includes('?') ? '&' : '?';
    const r = await fetch(VERSION_URL + sep + 't=' + Date.now(), { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
    if (!r.ok) throw new Error('تعذر فحص الإصدار');
    return r.json();
  }

  async function clearApplicationCache() {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const reg of regs) { try { reg.active && reg.active.postMessage({ type: 'SKIP_WAITING' }); await reg.update(); } catch (_) {} }
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
    // لا يُحذف أي localStorage أو sessionStorage — بيانات المستخدمين وإعدادات المزامنة تبقى محفوظة.
  }

  function ensureStyle() {
    if (document.getElementById('core-updater-style')) return;
    const s = document.createElement('style');
    s.id = 'core-updater-style';
    s.textContent = `
#coreUpdateBadge{position:fixed;top:14px;left:14px;z-index:999997;display:none;align-items:center;gap:9px;
 background:linear-gradient(135deg,#EBCB6B,#D4AF37);color:#181205;border:0;border-radius:999px;
 padding:10px 16px;font-family:Tajawal,Cairo,sans-serif;font-size:12.5px;font-weight:800;cursor:pointer;
 box-shadow:0 12px 30px rgba(0,0,0,.35);animation:coreUpdatePulse 2.2s ease-in-out infinite}
#coreUpdateBadge.show{display:inline-flex}
#coreUpdateBadge .cu-dot{width:8px;height:8px;border-radius:50%;background:#181205;flex:none}
#coreUpdateBadge.is-busy{animation:none;opacity:.75;cursor:wait}
@keyframes coreUpdatePulse{0%,100%{box-shadow:0 12px 30px rgba(0,0,0,.35)}50%{box-shadow:0 12px 30px rgba(212,175,55,.55)}}
@media(max-width:700px){#coreUpdateBadge{top:auto;bottom:14px;left:14px;font-size:11.5px;padding:9px 13px}}
    `.trim();
    document.head.appendChild(s);
  }

  function ensureBadge() {
    let btn = document.getElementById('coreUpdateBadge');
    if (btn) return btn;
    btn = document.createElement('button');
    btn.id = 'coreUpdateBadge';
    btn.type = 'button';
    btn.innerHTML = '<span class="cu-dot"></span><span class="cu-label">يتوفر تحديث — اضغط للتحديث</span>';
    document.body.appendChild(btn);
    return btn;
  }

  async function applyUpdate(btn, newVersion) {
    btn.classList.add('is-busy');
    btn.querySelector('.cu-label').textContent = 'جارٍ التحديث…';
    try {
      await clearApplicationCache();
      if (newVersion) localStorage.setItem(INSTALLED_KEY, newVersion);
      btn.querySelector('.cu-label').textContent = 'تم، جارٍ إعادة التشغيل…';
      setTimeout(() => location.replace(location.pathname + '?v=' + Date.now() + location.hash), 500);
    } catch (e) {
      btn.classList.remove('is-busy');
      btn.querySelector('.cu-label').textContent = 'تعذر التحديث، أعد المحاولة';
    }
  }

  async function check() {
    try {
      const meta = await remoteVersion();
      const installed = localStorage.getItem(INSTALLED_KEY);
      if (!installed) {
        // أول تشغيل على هذا الجهاز لهذه الصفحة: سجّل الإصدار الحالي كخط أساس دون إزعاج المستخدم.
        localStorage.setItem(INSTALLED_KEY, meta.version);
        return;
      }
      if (compare(meta.version, installed) > 0) {
        ensureStyle();
        const btn = ensureBadge();
        btn.classList.add('show');
        btn.onclick = () => applyUpdate(btn, meta.version);
      }
    } catch (_) { /* لا اتصال أو تعذر الفحص — تجاهل بصمت، لا داعي لإزعاج المستخدم */ }
  }

  function init() {
    check();
    // إعادة فحص كل مرة يعود فيها المستخدم للتبويب (مثلاً بعد فتح نظام آخر ثم الرجوع)
    document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
