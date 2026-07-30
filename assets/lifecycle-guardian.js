/* SCC Lifecycle Guardian v28.18.7
   Prevents blank/black screens after iOS/Android app resume, BFCache restore,
   refresh, logout and interrupted script execution. It never clears business data. */
(() => {
  'use strict';
  const K = Object.freeze({
    users: 'scc-v17-users',
    current: 'scc-v17-current-user',
    remember: 'scc-v17-remember'
  });
  const $ = id => document.getElementById(id);
  const parse = (raw, fallback = null) => { try { return JSON.parse(raw); } catch (_) { return fallback; } };
  const users = () => {
    const list = parse(localStorage.getItem(K.users) || '[]', []);
    return Array.isArray(list) ? list : [];
  };
  const storedUser = () => parse(localStorage.getItem(K.remember), null) || parse(sessionStorage.getItem(K.current), null);
  const validUser = () => {
    const user = storedUser();
    if (!user || !user.id) return null;
    const match = users().find(x => x && x.id === user.id);
    return match ? { ...match, passwordHash: undefined } : null;
  };

  function neutralizeBlockers() {
    ['sportsSplash', 'welcomeOverlay', 'introSeal'].forEach(id => {
      const el = $(id);
      if (!el) return;
      el.hidden = true;
      el.classList.remove('show');
      el.classList.add('hide', 'hidden');
      el.style.setProperty('display', 'none', 'important');
      el.style.setProperty('visibility', 'hidden', 'important');
      el.style.setProperty('opacity', '0', 'important');
      el.style.setProperty('pointer-events', 'none', 'important');
    });
    const prayer = $('corePrayerOverlay');
    if (prayer && !prayer.dataset.activePrayer) {
      prayer.classList.remove('show');
      prayer.style.removeProperty('display');
    }
  }

  function showApp(user) {
    neutralizeBlockers();
    const root = document.documentElement;
    const auth = $('v17Auth');
    const lock = $('biometricLock');
    root.classList.remove('app-locked');
    if (auth) {
      auth.hidden = true;
      auth.classList.remove('show');
      auth.style.setProperty('display', 'none', 'important');
      auth.style.setProperty('visibility', 'hidden', 'important');
      auth.style.setProperty('opacity', '0', 'important');
      auth.style.setProperty('pointer-events', 'none', 'important');
    }
    if (lock) {
      lock.hidden = true;
      lock.style.setProperty('display', 'none', 'important');
    }
    if (user) {
      window.SCC_CURRENT_USER = user;
      try {
        localStorage.setItem('v4-last-user', user.name || user.username || 'المستخدم');
        localStorage.setItem('scc-current-user-name', user.name || user.username || 'المستخدم');
      } catch (_) {}
    }
    document.body?.removeAttribute('aria-hidden');
  }

  function showLogin() {
    neutralizeBlockers();
    const root = document.documentElement;
    const auth = $('v17Auth');
    const lock = $('biometricLock');
    root.classList.add('app-locked');
    window.SCC_CURRENT_USER = null;
    if (lock) {
      lock.hidden = true;
      lock.style.setProperty('display', 'none', 'important');
    }
    if (!auth) return;
    auth.hidden = false;
    auth.classList.add('show');
    auth.style.setProperty('display', 'flex', 'important');
    auth.style.setProperty('visibility', 'visible', 'important');
    auth.style.setProperty('opacity', '1', 'important');
    auth.style.setProperty('pointer-events', 'auto', 'important');
    const hasUsers = users().length > 0;
    const setup = $('v17FirstSetup');
    const login = $('v17LoginForm');
    const subtitle = $('v17AuthSubtitle');
    if (setup) setup.hidden = hasUsers;
    if (login) login.hidden = !hasUsers;
    if (subtitle) subtitle.textContent = hasUsers ? 'تسجيل الدخول الآمن' : 'تهيئة حساب مدير النظام لأول مرة';
  }

  function reconcile(reason) {
    try {
      const user = validUser();
      if (user) showApp(user); else showLogin();
      document.documentElement.dataset.lifecycleState = user ? 'ready' : 'login';
      document.documentElement.dataset.lifecycleReason = String(reason || 'check').slice(0, 40);
    } catch (err) {
      console.error('Lifecycle Guardian recovery:', err);
      showLogin();
    }
  }

  function schedule(reason) {
    requestAnimationFrame(() => reconcile(reason));
    setTimeout(() => reconcile(reason + ':250'), 250);
    setTimeout(() => reconcile(reason + ':1500'), 1500);
  }

  window.SCC_FORCE_LOGIN_SCREEN = () => showLogin();
  window.SCC_LIFECYCLE_GUARDIAN = Object.freeze({ version: '28.18.7', reconcile: () => reconcile('manual') });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => schedule('dom'), { once: true });
  else schedule('ready');
  window.addEventListener('pageshow', e => schedule(e.persisted ? 'bfcache' : 'pageshow'));
  window.addEventListener('focus', () => schedule('focus'));
  window.addEventListener('online', () => schedule('online'));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) schedule('visible'); });
  window.addEventListener('scc:unlocked', () => schedule('unlocked'));
  window.addEventListener('error', () => setTimeout(() => reconcile('error'), 0));
  window.addEventListener('unhandledrejection', () => setTimeout(() => reconcile('rejection'), 0));

  // Last-resort visual watchdog: a locked root must always show auth; an unlocked
  // root must never remain covered by obsolete splash/auth layers.
  setInterval(() => {
    if (document.hidden) return;
    const root = document.documentElement;
    const auth = $('v17Auth');
    const appLocked = root.classList.contains('app-locked');
    const authVisible = !!(auth && !auth.hidden && getComputedStyle(auth).display !== 'none' && getComputedStyle(auth).visibility !== 'hidden');
    if ((appLocked && !authVisible) || (!appLocked && authVisible) || !document.body) reconcile('watchdog');
  }, 5000);
})();
