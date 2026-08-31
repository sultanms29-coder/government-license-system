/* SCC Lifecycle Guardian v28.18.10
   Single-source boot/session recovery for iOS/Android PWA and browsers.
   Guarantees that the UI always resolves to exactly one state: APP or LOGIN.
   Never clears business data, users, sync settings, or attachments. */
(() => {
  'use strict';

  const VERSION = '28.18.10';
  const KEYS = Object.freeze({
    users: 'scc-v17-users',
    current: 'scc-v17-current-user',
    remember: 'scc-v17-remember'
  });
  const $ = id => document.getElementById(id);
  const parse = (raw, fallback = null) => { try { return JSON.parse(raw); } catch (_) { return fallback; } };

  let bootFinished = false;
  let reconcileTimer = 0;

  function getUsers() {
    const value = parse(localStorage.getItem(KEYS.users) || '[]', []);
    return Array.isArray(value) ? value : [];
  }

  function getValidUser() {
    const remembered = parse(localStorage.getItem(KEYS.remember), null);
    const session = parse(sessionStorage.getItem(KEYS.current), null);
    const candidate = remembered || session;
    if (!candidate || !candidate.id) return null;
    const match = getUsers().find(u => u && u.id === candidate.id);
    if (!match) return null;
    const safe = { ...match };
    delete safe.passwordHash;
    return safe;
  }

  function hardHide(el) {
    if (!el) return;
    el.hidden = true;
    el.classList.remove('show', 'active', 'open');
    el.classList.add('hide', 'hidden');
    el.style.setProperty('display', 'none', 'important');
    el.style.setProperty('visibility', 'hidden', 'important');
    el.style.setProperty('opacity', '0', 'important');
    el.style.setProperty('pointer-events', 'none', 'important');
    el.removeAttribute('aria-modal');
  }

  function hardShow(el, display = 'flex') {
    if (!el) return;
    el.hidden = false;
    el.classList.remove('hide', 'hidden');
    el.classList.add('show');
    el.style.setProperty('display', display, 'important');
    el.style.setProperty('visibility', 'visible', 'important');
    el.style.setProperty('opacity', '1', 'important');
    el.style.setProperty('pointer-events', 'auto', 'important');
  }

  function clearVisualBlockers({ keepLaunchSplash = false } = {}) {
    ['welcomeOverlay', 'introSeal'].forEach(id => hardHide($(id)));
    if (!keepLaunchSplash) hardHide($('sportsSplash'));

    const prayer = $('corePrayerOverlay');
    if (prayer && prayer.dataset.activePrayer !== '1') {
      prayer.classList.remove('show');
      prayer.style.setProperty('display', 'none', 'important');
      prayer.style.setProperty('pointer-events', 'none', 'important');
    }

    document.body?.removeAttribute('aria-hidden');
    document.body?.removeAttribute('inert');
    if (document.body) {
      document.body.style.setProperty('visibility', 'visible', 'important');
      document.body.style.setProperty('opacity', '1', 'important');
    }
  }

  function exposeUser(user) {
    window.SCC_CURRENT_USER = user;
    try {
      localStorage.setItem('v4-last-user', user.name || user.username || 'المستخدم');
      localStorage.setItem('scc-current-user-name', user.name || user.username || 'المستخدم');
    } catch (_) {}
  }

  function renderApp(user) {
    clearVisualBlockers();
    const root = document.documentElement;
    root.classList.remove('app-locked');
    root.dataset.lifecycleState = 'ready';
    hardHide($('v17Auth'));
    hardHide($('biometricLock'));
    exposeUser(user);
  }

  function renderLogin() {
    clearVisualBlockers();
    const root = document.documentElement;
    root.classList.add('app-locked');
    root.dataset.lifecycleState = 'login';
    window.SCC_CURRENT_USER = null;
    hardHide($('biometricLock'));

    const auth = $('v17Auth');
    if (!auth) return;
    hardShow(auth, 'flex');

    const hasUsers = getUsers().length > 0;
    const setup = $('v17FirstSetup');
    const login = $('v17LoginForm');
    const subtitle = $('v17AuthSubtitle');
    if (setup) setup.hidden = hasUsers;
    if (login) login.hidden = !hasUsers;
    if (subtitle) subtitle.textContent = hasUsers ? 'تسجيل الدخول الآمن' : 'تهيئة حساب مدير النظام لأول مرة';
  }

  function reconcile(reason = 'manual', forceNoSplash = false) {
    try {
      const now = Date.now();
      const launchDeadline = Number(document.documentElement.dataset.launchSplashUntil || 0);
      const launchAllowed = !forceNoSplash && !bootFinished &&
        document.documentElement.dataset.launchContext === 'app-open' && now < launchDeadline;

      clearVisualBlockers({ keepLaunchSplash: launchAllowed });
      if (launchAllowed) return;

      bootFinished = true;
      const user = getValidUser();
      if (user) renderApp(user); else renderLogin();
      document.documentElement.dataset.lifecycleReason = String(reason).slice(0, 48);
    } catch (error) {
      console.error('Lifecycle recovery failed:', error);
      bootFinished = true;
      renderLogin();
    }
  }

  function schedule(reason, forceNoSplash = false) {
    clearTimeout(reconcileTimer);
    reconcileTimer = setTimeout(() => reconcile(reason, forceNoSplash), 0);
    setTimeout(() => reconcile(reason + ':250', forceNoSplash), 250);
  }

  function finishLaunchSplash() {
    bootFinished = true;
    hardHide($('sportsSplash'));
    reconcile('splash-finished', true);
  }

  function onResume(reason) {
    // A restored iOS PWA must never replay or preserve launch overlays.
    bootFinished = true;
    document.documentElement.dataset.launchSplashUntil = '0';
    schedule(reason, true);
  }

  window.SCC_FORCE_LOGIN_SCREEN = () => {
    bootFinished = true;
    renderLogin();
  };
  window.SCC_LIFECYCLE_GUARDIAN = Object.freeze({ version: VERSION, reconcile: () => reconcile('api', true) });

  const start = () => {
    const deadline = Number(document.documentElement.dataset.launchSplashUntil || 0);
    if (document.documentElement.dataset.launchContext === 'app-open' && deadline > Date.now()) {
      const wait = Math.min(Math.max(deadline - Date.now(), 0), 4300);
      setTimeout(finishLaunchSplash, wait + 50);
      // Absolute failsafe independent of CSS animation/audio/network.
      setTimeout(finishLaunchSplash, 4800);
    } else {
      bootFinished = true;
      reconcile('dom-ready', true);
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();

  window.addEventListener('pageshow', event => onResume(event.persisted ? 'bfcache-resume' : 'pageshow'));
  window.addEventListener('focus', () => onResume('focus'));
  window.addEventListener('online', () => onResume('online'));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) onResume('visibility-resume'); });
  window.addEventListener('scc:unlocked', () => onResume('unlocked'));

  // Recovery after long background suspension / frozen timers.
  let lastBeat = Date.now();
  setInterval(() => {
    const now = Date.now();
    const slept = now - lastBeat > 15000;
    lastBeat = now;
    if (!document.hidden && slept) onResume('timer-resume');
  }, 4000);

  // Visual invariant watchdog: never allow a third (blank) state.
  setInterval(() => {
    if (document.hidden || !document.body) return;
    const root = document.documentElement;
    const auth = $('v17Auth');
    const authVisible = !!(auth && !auth.hidden && getComputedStyle(auth).display !== 'none' && getComputedStyle(auth).visibility !== 'hidden');
    const valid = !!getValidUser();
    const splashVisible = !!($('sportsSplash') && getComputedStyle($('sportsSplash')).display !== 'none' && getComputedStyle($('sportsSplash')).visibility !== 'hidden');
    const launchStillAllowed = !bootFinished && Date.now() < Number(root.dataset.launchSplashUntil || 0);

    if (splashVisible && !launchStillAllowed) hardHide($('sportsSplash'));
    if ((valid && (root.classList.contains('app-locked') || authVisible)) || (!valid && (!root.classList.contains('app-locked') || !authVisible))) {
      reconcile('invariant-watchdog', true);
    }
  }, 2000);
})();
