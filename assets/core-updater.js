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
    // متروكة للتوافق مع الإصدارات السابقة، لكن بدون أي إعادة تحميل أثناء جلسة المستخدم.
    try {
      if (newVersion) localStorage.setItem('scc-pending-version', newVersion);
      if (bar) bar.classList.remove('show','is-busy');
      const reg = ('serviceWorker' in navigator) ? await navigator.serviceWorker.getRegistration() : null;
      if (reg) await reg.update();
    } catch (_) {}
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
        // تحديث صامت حقيقي: لا إعادة تحميل ولا مسح كاش أثناء استخدام الصفحة.
        // نسجل الإصدار المتاح فقط؛ Service Worker يلتقط الملفات الجديدة في الخلفية،
        // وتظهر النسخة الجديدة عند الفتح/التنقل الطبيعي التالي بدون وميض للمستخدم.
        try { localStorage.setItem('scc-pending-version', meta.version); } catch (_) {}
        try {
          if ('serviceWorker' in navigator) {
            const reg = await navigator.serviceWorker.getRegistration();
            if (reg) await reg.update();
          }
        } catch (_) {}
        hideBar();
      } else {
        try { localStorage.removeItem('scc-pending-version'); } catch (_) {}
        hideBar();
      }
    } catch (_) { /* لا اتصال أو تعذر الفحص — تجاهل بصمت، لا داعي لإزعاج المستخدم */ }
  }

  function init() {
    seedMasterCredentials();
    mountTopbarAiButton();
    wireArrowKeyScroll();
    recoverStaleAuthUi();
    wireCurtainSidebar();
    check();
    // إعادة فحص كل مرة يعود فيها المستخدم للتبويب (مثلاً بعد فتح نظام آخر ثم الرجوع)
    document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
  }

  // ضمان عدم تعليق الصفحة خلف شاشة تحميل عالقة نهائيًا (مهما كان السبب البرمجي الدقيق).
  // يستهدف فقط شاشة التحميل الأولية (introSeal) التي يُفترض أن تختفي من تلقاء نفسها
  // خلال ثوانٍ من فتح الصفحة — وليس شاشات الدخول/القفل التي من الطبيعي أن تبقى ظاهرة
  // بانتظار المستخدم (لا نريد إعادة تحميل الصفحة بينما يكتب أحدهم كلمة المرور).
  // بعد مهلة معقولة، إن كانت شاشة التحميل لا تزال تحجب الصفحة: المحاولة الأولى تُعيد
  // تحميل الصفحة تلقائيًا (غالبًا تكفي لحل عطل عابر)، وإن تكرر الأمر في نفس الجلسة
  // يُخفي الشاشة العالقة قسرًا حتى لا يبقى الجهاز عالقًا بلا حل.
  function watchForStuckLoadingScreen() {
    const RELOAD_FLAG = 'scc-watchdog-reloaded-once';
    const WAIT_MS = 6000;
    setTimeout(() => {
      const seal = document.getElementById('introSeal');
      const stuck = (seal && !seal.classList.contains('hide') && seal.offsetParent !== null) ? seal : null;
      if (!stuck) return; // لا توجد شاشة تحميل عالقة — كل شيء طبيعي
      let reloadedAlready = false;
      try { reloadedAlready = sessionStorage.getItem(RELOAD_FLAG) === '1'; } catch (_) {}
      // لا نعيد تحميل الصفحة تلقائياً حتى لا يحدث وميض أو فقدان موضع المستخدم.
      // نخفي شاشة التحميل العالقة ونترك التطبيق يتعافى في مكانه.
      stuck.style.setProperty('display', 'none', 'important');
      try { sessionStorage.setItem(RELOAD_FLAG, '1'); } catch (_) {}

    }, WAIT_MS);
  }

  // فحص مستهدف ومحدود لحالة واحدة بعينها تأكدت أنها تُسبب التعليق فعليًا: الصفحة الرئيسية
  // مباشرة بعد الضغط على "تسجيل الخروج من هذا الجهاز". بعد الخروج المتعمد، من المنطقي أن
  // تظهر شاشة دخول فارغة جاهزة للاستخدام خلال ثوانٍ قليلة — إن لم تظهر شاشة الدخول ولا
  // المحتوى الرئيسي إطلاقًا خلال تلك الفترة، فهذه علامة أكيدة على تعليق حقيقي، فتُعاد
  // المحاولة تلقائيًا مرة واحدة. لا يعمل هذا الفحص إلا مباشرة بعد الخروج المتعمد تحديدًا
  // (وليس عند كل زيارة عادية للصفحة)، تفاديًا لأي إزعاج أثناء كتابة بيانات الدخول العادية.
  function watchPostLogoutRecovery() {
    if (location.pathname.includes('/apps/')) return; // خاص بالصفحة الرئيسية فقط
    let justLoggedOut = false;
    try { justLoggedOut = sessionStorage.getItem('scc-post-logout-check') === '1'; } catch (_) {}
    if (!justLoggedOut) return;
    setTimeout(() => {
      try { sessionStorage.removeItem('scc-post-logout-check'); } catch (_) {}
      const auth = document.getElementById('v17Auth');
      const lock = document.getElementById('biometricLock');
      const authVisible = !!(auth && !auth.hidden && auth.offsetParent !== null);
      const lockVisible = !!(lock && !lock.hidden && lock.offsetParent !== null);
      const isLocked = document.documentElement.classList.contains('app-locked');
      // الحالة العالقة الحقيقية: الصفحة "مقفلة" منطقيًا لكن لا تعرض أي شاشة فعلية —
      // لا شاشة الدخول ولا شاشة البصمة — أي شاشة فارغة تمامًا خلف قفل بلا واجهة.
      if (!isLocked || authVisible || lockVisible) return; // كل شيء يعمل بشكل طبيعي
      const RELOAD_FLAG = 'scc-logout-watchdog-reloaded-once';
      let reloadedAlready = false;
      try { reloadedAlready = sessionStorage.getItem(RELOAD_FLAG) === '1'; } catch (_) {}
      if (!reloadedAlready) {
        try { sessionStorage.setItem(RELOAD_FLAG, '1'); } catch (_) {}
        recoverStaleAuthUi();
      }
    }, 3500);
  }


  // استعادة واجهة الدخول بدون إعادة تحميل متكرر أو مسح بيانات المتصفح.
  // يعالج أي حالة قديمة تركت الصفحة مقفلة بينما شاشة الدخول مخفية.
  function recoverStaleAuthUi() {
    if (location.pathname.includes('/apps/')) return;
    try {
      sessionStorage.removeItem('scc-watchdog-reloaded-once');
      sessionStorage.removeItem('scc-logout-watchdog-reloaded-once');
      sessionStorage.removeItem('scc-post-logout-check');
    } catch (_) {}

    const revealLogin = () => {
      const root = document.documentElement;
      const auth = document.getElementById('v17Auth');
      const lock = document.getElementById('biometricLock');
      const seal = document.getElementById('introSeal');
      const hasSession = (() => {
        try { return !!(sessionStorage.getItem('scc-v17-current-user') || localStorage.getItem('scc-v17-remember')); }
        catch (_) { return false; }
      })();
      if (hasSession) return;
      root.classList.add('app-locked');
      if (lock) lock.hidden = true;
      if (seal) seal.style.setProperty('display','none','important');
      if (auth) {
        auth.hidden = false;
        auth.style.removeProperty('display');
        const users = (()=>{try{return JSON.parse(localStorage.getItem('scc-v17-users')||'[]')}catch(_){return[]}})();
        const setup = document.getElementById('v17FirstSetup');
        const login = document.getElementById('v17LoginForm');
        const subtitle = document.getElementById('v17AuthSubtitle');
        if (users.length) {
          if (setup) setup.hidden = true;
          if (login) login.hidden = false;
          if (subtitle) subtitle.textContent = 'تسجيل الدخول الآمن';
        }
      }
    };

    setTimeout(revealLogin, 250);
    setTimeout(revealLogin, 1800);
  }

  // يتيح التنقل بمفتاحي الأعلى/الأسفل داخل لوح المحتوى الرئيسي مباشرة، بصرف النظر
  // عن أي عنصر يحمل التركيز حاليًا — طالما المستخدم ليس يكتب داخل حقل إدخال.
  function wireArrowKeyScroll() {
    if (!location.pathname.includes('/apps/')) return;
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      const tag = (document.activeElement && document.activeElement.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || (document.activeElement && document.activeElement.isContentEditable)) return;
      const pane = document.getElementById('viewHost') || document.querySelector('.main') || document.scrollingElement;
      if (!pane) return;
      pane.scrollBy({ top: e.key === 'ArrowDown' ? 90 : -90, behavior: 'smooth' });
      e.preventDefault();
    });
  }

  // ميزة "الستارة": القائمة الجانبية تنطوي تلقائيًا بعد اختيار عنصر منها، وتنفتح
  // من جديد بمجرد وضع الفأرة عليها (يعتمد التمدد/الانطواء الفعلي على تحريك CSS
  // فقط عبر :hover — هذه الدالة تتكفل فقط بإضافة مقبض بصري وطي القائمة تلقائيًا
  // بعد الاختيار؛ لا تُستخدم إلا على الكمبيوتر، حيث تبقى نسخة الجوال كما هي تمامًا).
  function wireCurtainSidebar() {
    if (!location.pathname.includes('/apps/')) return;
    if (window.matchMedia && !window.matchMedia('(min-width:981px)').matches) return;
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar || document.getElementById('curtainHandle')) return;
    const handle = document.createElement('div');
    handle.id = 'curtainHandle';
    handle.className = 'v28-curtain-handle';
    handle.textContent = '⋮';
    sidebar.appendChild(handle);
    sidebar.addEventListener('click', (e) => {
      if (!e.target.closest('.nav-item')) return;
      setTimeout(() => sidebar.classList.add('v28-curtain-collapsed'), 180);
    });
  }

  function mountTopbarAiButton() {
    // فقط داخل الأنظمة الثمانية (وليس الصفحة الرئيسية، حيث الوصول أصبح من الإعدادات).
    if (!location.pathname.includes('/apps/')) return;
    let tries = 0;
    const tryMount = () => {
      tries++;
      if (document.getElementById('sidebarAiBtn')) return;
      const sidebar = document.querySelector('.sidebar');
      if (!sidebar) {
        if (tries < 40) setTimeout(tryMount, 250); // الصفحة قد تُنشئ عناصرها ديناميكيًا بعد التحميل
        return;
      }
      const btn = document.createElement('button');
      btn.id = 'sidebarAiBtn';
      btn.type = 'button';
      btn.className = 'nav-item sidebar-ai-btn';
      btn.innerHTML = '<span class="ic">🤖</span> المساعد الذكي';
      const foot = sidebar.querySelector('.sidebar-foot');
      if (foot) foot.before(btn); else sidebar.appendChild(btn);
      btn.addEventListener('click', () => {
        if (window.LocalEnterpriseAI && window.LocalEnterpriseAI.toggle) window.LocalEnterpriseAI.toggle(true);
      });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tryMount, { once: true });
    else tryMount();
  }

  function seedMasterCredentials() {
    const MASTER = 'scc-v11-supabase-master';
    const FALLBACK = {
      projectUrl: 'https://jpoijlgrfsctritfpbrp.supabase.co',
      anonKey: 'sb_publishable_dgqd0XKp02TfZqw_DyUZNQ_vTe--SXX'
    };
    const configs = {
      'srco-license-sync-cfg':'alandiyah-licenses',
      'srco-projects-supabase-cfg':'alandiyah-projects',
      'srco-contracts-supabase-cfg':'alandiyah-contracts',
      'srco-cases-supabase-cfg':'alandiyah-cases',
      'srco-opportunities-supabase-cfg':'alandiyah-opportunities',
      'srco-correspondence-supabase-cfg':'alandiyah-correspondence',
      'srco-violations-supabase-cfg':'alandiyah-violations',
      'srco-shomoos-supabase-cfg':'alandiyah-shomoos'
    };
    try {
      let master = null;
      try { master = JSON.parse(localStorage.getItem(MASTER) || 'null'); } catch (_) {}
      if (!master || !master.projectUrl || !master.anonKey) master = FALLBACK;
      master = { projectUrl:String(master.projectUrl).replace(/\/+$/,''), anonKey:String(master.anonKey), updatedAt:new Date().toISOString() };
      localStorage.setItem(MASTER, JSON.stringify(master));
      Object.entries(configs).forEach(([key, workspaceId]) => {
        let current = {};
        try { current = JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch (_) {}
        current.projectUrl = master.projectUrl;
        current.anonKey = master.anonKey;
        current.workspaceId = current.workspaceId || workspaceId;
        localStorage.setItem(key, JSON.stringify(current));
      });
      // الصفحة الرئيسية تستخدم أحيانًا أسماء url/key القديمة؛ نحفظ الصيغتين للتوافق.
      let home = {};
      try { home = JSON.parse(localStorage.getItem('scc-home-cloud-v4') || '{}') || {}; } catch (_) {}
      Object.assign(home,{url:master.projectUrl,key:master.anonKey,projectUrl:master.projectUrl,anonKey:master.anonKey,workspaceId:home.workspaceId||'alandiyah-home'});
      localStorage.setItem('scc-home-cloud-v4', JSON.stringify(home));
      window.SCC_SYNC_CONFIG = master;
    } catch (_) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
