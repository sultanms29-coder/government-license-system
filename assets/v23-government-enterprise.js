(() => {
  'use strict';
  const VERSION = '23.0';
  const safeStorage = {
    get(k){ try{return localStorage.getItem(k)}catch(_){return null} },
    set(k,v){ try{localStorage.setItem(k,v)}catch(_){} }
  };
  const ready = (fn) => document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', fn, {once:true}) : fn();
  ready(() => {
    document.documentElement.lang = 'ar';
    document.documentElement.dir = 'rtl';
    const firstMain = document.querySelector('main,.main,.container,.page,.app-shell') || document.body;
    if (!firstMain.id) firstMain.id = 'main-content';
    const skip = document.createElement('a');
    skip.className = 'gov-skip-link';
    skip.href = '#main-content';
    skip.textContent = 'انتقل إلى المحتوى الرئيسي';
    document.body.prepend(skip);

    const bar = document.createElement('div');
    bar.className = 'gov-utility-bar';
    bar.setAttribute('role','region');
    bar.setAttribute('aria-label','أدوات الوصول وحالة المنصة');
    bar.innerHTML = `
      <div class="gov-utility-right">
        <span class="gov-compliance-chip"><span class="gov-status-dot" aria-hidden="true"></span> منصة داخلية مؤسسية</span>
        <span>تصنيف المعلومات: <strong>داخلي</strong></span>
      </div>
      <div class="gov-utility-left">
        <button type="button" class="gov-mini-btn" data-gov-action="text" aria-pressed="false">تكبير النص</button>
        <button type="button" class="gov-mini-btn" data-gov-action="contrast" aria-pressed="false">تباين مرتفع</button>
        <button type="button" class="gov-mini-btn" data-gov-action="motion" aria-pressed="false">تقليل الحركة</button>
      </div>`;
    const splash = document.getElementById('sportsSplash');
    (splash ? splash.insertAdjacentElement('afterend',bar) : document.body.prepend(bar));

    const actions = {text:'gov-large-text',contrast:'gov-high-contrast',motion:'gov-no-motion'};
    Object.entries(actions).forEach(([key,cls]) => {
      const enabled = safeStorage.get('gov_ui_'+key) === '1';
      document.body.classList.toggle(cls, enabled);
      const btn = bar.querySelector(`[data-gov-action="${key}"]`);
      btn?.setAttribute('aria-pressed', String(enabled));
    });
    bar.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-gov-action]');
      if (!btn) return;
      const key = btn.dataset.govAction, cls = actions[key];
      const enabled = !document.body.classList.contains(cls);
      document.body.classList.toggle(cls, enabled);
      btn.setAttribute('aria-pressed', String(enabled));
      safeStorage.set('gov_ui_'+key, enabled ? '1':'0');
    });

    document.querySelectorAll('img:not([alt])').forEach(img => img.setAttribute('alt',''));
    document.querySelectorAll('button:not([type])').forEach(btn => btn.setAttribute('type','button'));
    document.querySelectorAll('[role="dialog"],.modal,.dialog').forEach(el => {
      el.setAttribute('aria-modal','true');
      if (!el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby')) el.setAttribute('aria-label','نافذة منبثقة');
    });
    document.querySelectorAll('input,select,textarea').forEach((el,i) => {
      if (!el.id) el.id = 'gov-field-'+i;
      if (!el.getAttribute('autocomplete')) {
        const type = (el.getAttribute('type') || '').toLowerCase();
        el.setAttribute('autocomplete', type === 'password' ? 'current-password' : 'off');
      }
    });

    const footer = document.createElement('footer');
    footer.className = 'gov-enterprise-footer';
    footer.innerHTML = `<span><b>منصة العلاقات العامة والحكومية</b> — الإصدار ${VERSION}</span><span class="gov-classification">الاستخدام الداخلي المصرح به فقط</span><span>الخصوصية والأمن مسؤولية مشتركة</span>`;
    document.body.appendChild(footer);
  });
})();
