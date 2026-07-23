/* SCC Platform Security Hardening v22 — non-breaking browser layer.
   Server-side controls remain mandatory for production. */
(() => {
  'use strict';
  const SEC = Object.freeze({
    idleMs: 30 * 60 * 1000,
    authKeys: ['scc-v17-current-user', 'scc-v17-remember'],
    configKeyPattern: /(supabase|cloud|sync|master|cfg)/i
  });

  // Prevent embedding in another site (server X-Frame-Options/CSP is still authoritative).
  try { if (window.top !== window.self) window.top.location = window.self.location.href; } catch (_) { document.documentElement.innerHTML = ''; }

  // Reject accidentally storing privileged Supabase service-role tokens in the browser.
  const originalSetItem = Storage.prototype.setItem;
  function jwtRole(value) {
    try {
      const token = String(value || '').match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/)?.[0];
      if (!token) return '';
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return String(payload.role || payload.user_role || '');
    } catch (_) { return ''; }
  }
  Storage.prototype.setItem = function secureSetItem(key, value) {
    const k = String(key || '');
    const v = String(value || '');
    if (SEC.configKeyPattern.test(k)) {
      if (/service[_-]?role/i.test(v) || jwtRole(v) === 'service_role') {
        throw new DOMException('تم منع حفظ مفتاح Service Role داخل المتصفح.', 'SecurityError');
      }
      const urls = v.match(/https?:\/\/[^"'\s}]+/g) || [];
      const insecure = urls.some(u => u.startsWith('http://') && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(u));
      if (insecure) throw new DOMException('يجب استخدام HTTPS لحماية الاتصال.', 'SecurityError');
    }
    return originalSetItem.call(this, key, value);
  };

  // Production must use HTTPS. Localhost/file mode remains available for testing.
  const localDev = location.protocol === 'file:' || /^(localhost|127\.0\.0\.1)$/i.test(location.hostname);
  if (!localDev && location.protocol !== 'https:') {
    const target = 'https://' + location.host + location.pathname + location.search + location.hash;
    location.replace(target);
    return;
  }

  // Automatic session lock after inactivity.
  let idleTimer;
  const resetIdle = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(lockSession, SEC.idleMs);
  };
  function lockSession() {
    try {
      SEC.authKeys.forEach(k => { sessionStorage.removeItem(k); localStorage.removeItem(k); });
      sessionStorage.setItem('scc-security-lock-reason', 'idle');
    } catch (_) {}
    location.replace(new URL('./index.html', location.href).href);
  }
  ['pointerdown', 'keydown', 'touchstart', 'scroll'].forEach(evt => addEventListener(evt, resetIdle, {passive: true}));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) resetIdle(); });
  resetIdle();

  // Reduce sensitive data leakage through referrers and browser autocomplete.
  document.querySelectorAll('input[type="password"]').forEach(el => {
    el.setAttribute('autocomplete', 'current-password');
    el.setAttribute('spellcheck', 'false');
  });
  document.querySelectorAll('input,textarea').forEach(el => el.setAttribute('autocapitalize', 'off'));

  // Mark security layer for diagnostics without exposing secrets.
  Object.defineProperty(window, 'SCC_SECURITY', {
    value: Object.freeze({ version: '22.0', idleMinutes: SEC.idleMs / 60000, https: location.protocol === 'https:' }),
    writable: false,
    configurable: false
  });
})();
