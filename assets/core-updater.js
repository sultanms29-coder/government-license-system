/* core-updater.js — تحديث موحّد عبر كل صفحات المنصة (الرئيسية + الأنظمة الثمانية)
   يفحص version.json دوريًا، ويعرض شريطًا علويًا رفيعًا عند وجود إصدار أحدث فقط
   (شريط كامل العرض أعلى الصفحة — لا يتصادم مع أي زر عائم في زوايا الصفحة مثل
   زر الرئيسية أو زر المساعد الذكي). يختفي تلقائيًا فور عدم الحاجة له.
   عند الضغط عليه يمسح كاش المتصفح وملف الخدمة فقط — لا يمسّ أي بيانات محلية
   (localStorage/sessionStorage) ولا بيانات المستخدم أو إعدادات المزامنة. */
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
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const reg of regs) { try { reg.active && reg.active.postMessage({ type: 'SKIP_WAITING' }); await reg.update(); } catch (_) {} }
      } catch (_) {}
    }
    if ('caches' in window) {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      } catch (_) {}
    }
    // لا يُحذف أي localStorage أو sessionStorage — بيانات المستخدمين وإعدادات المزامنة تبقى محفوظة.
  }

  function ensureStyle() {
    if (document.getElementById('core-updater-style')) return;
    const s = document.createElement('style');
    s.id = 'core-updater-style';
    s.textContent = `
#coreUpdateBar{position:fixed;top:0;left:0;right:0;z-index:999998;display:none;align-items:center;justify-content:center;gap:12px;
 background:linear-gradient(90deg,#B8912E,#D4AF37,#B8912E);color:#181205;border:0;border-bottom:1px solid rgba(0,0,0,.15);
 padding:9px 16px;font-family:Tajawal,Cairo,sans-serif;font-size:12.5px;font-weight:800;cursor:pointer;
 box-shadow:0 6px 18px rgba(0,0,0,.25)}
#coreUpdateBar.show{display:flex}
#coreUpdateBar .cu-dot{width:7px;height:7px;border-radius:50%;background:#181205;flex:none;animation:coreUpdateDot 1.4s ease-in-out infinite}
#coreUpdateBar.is-busy{cursor:wait;opacity:.85}
#coreUpdateBar .cu-btn{background:#181205;color:#EBCB6B;border:0;border-radius:999px;padding:5px 14px;font:inherit;font-size:11.5px;font-weight:800}
@keyframes coreUpdateDot{0%,100%{opacity:1}50%{opacity:.25}}
@media(max-width:600px){#coreUpdateBar{font-size:11px;padding:8px 10px}#coreUpdateBar .cu-btn{padding:5px 10px}}
    `.trim();
    document.head.appendChild(s);
  }

  function ensureBar() {
    let bar = document.getElementById('coreUpdateBar');
    if (bar) return bar;
    bar = document.createElement('div');
    bar.id = 'coreUpdateBar';
    bar.innerHTML = '<span class="cu-dot"></span><span class="cu-label">يتوفر إصدار أحدث من المنصة</span><button type="button" class="cu-btn">تحديث الآن</button>';
    document.body.appendChild(bar);
    return bar;
  }

  function hideBar() {
    const bar = document.getElementById('coreUpdateBar');
    if (bar) bar.classList.remove('show');
  }

  async function applyUpdate(bar, newVersion) {
    bar.classList.add('is-busy');
    bar.querySelector('.cu-label').textContent = 'جارٍ التحديث…';
    bar.querySelector('.cu-btn').style.visibility = 'hidden';
    try {
      await clearApplicationCache();
      if (newVersion) localStorage.setItem(INSTALLED_KEY, newVersion);
      bar.querySelector('.cu-label').textContent = 'تم التحديث، جارٍ إعادة التشغيل…';
      setTimeout(() => location.replace(location.pathname + '?v=' + Date.now() + location.hash), 500);
    } catch (e) {
      bar.classList.remove('is-busy');
      bar.querySelector('.cu-btn').style.visibility = '';
      bar.querySelector('.cu-label').textContent = 'تعذر التحديث، أعد المحاولة';
    }
  }

  function updateVersionDisplays(version) {
    if (!version) return;
    const settingsEl = document.getElementById('settingsVersionText');
    if (settingsEl) settingsEl.textContent = 'الإصدار ' + version;
    const footerEl = document.getElementById('govFooterVersion');
    if (footerEl) footerEl.textContent = 'الإصدار ' + version;
  }

  async function check() {
    try {
      const meta = await remoteVersion();
      updateVersionDisplays(meta.version);
      const installed = localStorage.getItem(INSTALLED_KEY);
      if (!installed) {
        // أول تشغيل على هذا الجهاز لهذه الصفحة: سجّل الإصدار الحالي كخط أساس دون إزعاج المستخدم.
        localStorage.setItem(INSTALLED_KEY, meta.version);
        hideBar();
        return;
      }
      if (compare(meta.version, installed) > 0) {
        ensureStyle();
        const bar = ensureBar();
        bar.classList.add('show');
        bar.onclick = () => applyUpdate(bar, meta.version);
      } else {
        // لا يوجد تحديث (أو تم تثبيته بالفعل) — تأكد أن الشريط مخفي دائمًا في هذه الحالة.
        hideBar();
      }
    } catch (_) { /* لا اتصال أو تعذر الفحص — تجاهل بصمت، لا داعي لإزعاج المستخدم */ }
  }

  function init() {
    seedMasterCredentials();
    mountTopbarAiButton();
    check();
    // إعادة فحص كل مرة يعود فيها المستخدم للتبويب (مثلاً بعد فتح نظام آخر ثم الرجوع)
    document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
  }

  function mountTopbarAiButton() {
    // فقط داخل الأنظمة الثمانية (وليس الصفحة الرئيسية، حيث الوصول أصبح من الإعدادات).
    if (!location.pathname.includes('/apps/')) return;
    let tries = 0;
    const tryMount = () => {
      tries++;
      if (document.getElementById('topbarAiBtn')) return;
      const anchor = document.querySelector('.topbar .search-box, .search-box') || document.querySelector('header a.back, header');
      if (!anchor) {
        if (tries < 40) setTimeout(tryMount, 250); // الصفحة قد تُنشئ عناصرها ديناميكيًا بعد التحميل
        return;
      }
      const btn = document.createElement('button');
      btn.id = 'topbarAiBtn';
      btn.type = 'button';
      btn.className = 'topbar-ai-btn';
      btn.title = 'المساعد الذكي';
      btn.setAttribute('aria-label', 'فتح المساعد الذكي');
      btn.innerHTML = '<span>🤖</span>';
      anchor.insertAdjacentElement('afterend', btn);
      btn.addEventListener('click', () => {
        if (window.LocalEnterpriseAI && window.LocalEnterpriseAI.toggle) window.LocalEnterpriseAI.toggle(true);
      });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tryMount, { once: true });
    else tryMount();
  }

  function seedMasterCredentials() {
    // بيانات الاتصال السحابي الموحّدة (مفتاح publishable آمن للاستخدام في المتصفح حسب تصميم Supabase
    // نفسه — وليس مفتاح service_role السري). تُزرع مرة واحدة فقط إن لم تكن موجودة، ثم تنتشر تلقائيًا
    // لكل الأنظمة الثمانية عبر آلية المزامنة الموجودة أصلاً (syncCredentials) في كل نظام.
    const MASTER = 'scc-v11-supabase-master';
    try {
      const existing = JSON.parse(localStorage.getItem(MASTER) || 'null');
      if (existing && existing.projectUrl && existing.anonKey) return; // موجود مسبقًا، لا نكتب فوقه
      localStorage.setItem(MASTER, JSON.stringify({
        projectUrl: 'https://jpoijlgrfsctritfpbrp.supabase.co',
        anonKey: 'sb_publishable_dgqd0XKp02TfZqw_DyUZNQ_vTe--SXX',
        updatedAt: new Date().toISOString()
      }));
    } catch (_) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
