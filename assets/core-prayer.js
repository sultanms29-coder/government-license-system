/* core-prayer.js — تذكير أوقات الصلاة لمدينة الرياض
   يجلب مواقيت اليوم مرة واحدة (ويُخزّنها محليًا ليوم واحد)، ثم يراقب الوقت
   الحالي ويعرض تذكيرًا لطيفًا عند دخول كل وقت صلاة. يعمل على كل صفحات المنصة. */
(() => {
  'use strict';
  const CACHE_KEY = 'scc-prayer-times-cache';
  const NOTIFIED_KEY = 'scc-prayer-notified-date';
  const PRAYER_NAMES = { Fajr: 'الفجر', Dhuhr: 'الظهر', Asr: 'العصر', Maghrib: 'المغرب', Isha: 'العشاء' };
  const ORDER = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  }

  async function fetchTimings() {
    const cached = (() => { try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch (_) { return null; } })();
    if (cached && cached.day === todayKey() && cached.timings) return cached.timings;
    try {
      const r = await fetch('https://api.aladhan.com/v1/timingsByCity?city=Riyadh&country=Saudi%20Arabia&method=4', { cache: 'no-store' });
      if (!r.ok) throw new Error('bad response');
      const data = await r.json();
      const timings = data && data.data && data.data.timings;
      if (!timings) throw new Error('no timings');
      localStorage.setItem(CACHE_KEY, JSON.stringify({ day: todayKey(), timings }));
      return timings;
    } catch (_) {
      return cached ? cached.timings : null; // استخدم آخر نسخة محفوظة إن تعذّر الاتصال
    }
  }

  function ensureStyle() {
    if (document.getElementById('core-prayer-style')) return;
    const s = document.createElement('style');
    s.id = 'core-prayer-style';
    s.textContent = `
#corePrayerToast{position:fixed;top:64px;left:50%;transform:translateX(-50%) translateY(-10px);z-index:999994;
 background:linear-gradient(135deg,#1c2a22,#141d18);border:1px solid rgba(72,199,142,.4);border-radius:14px;
 padding:12px 20px;box-shadow:0 16px 40px rgba(0,0,0,.4);color:#eafaf1;font-family:Tajawal,Cairo,sans-serif;
 font-size:13px;font-weight:700;display:flex;align-items:center;gap:10px;opacity:0;pointer-events:none;
 transition:opacity .4s ease,transform .4s ease;direction:rtl}
#corePrayerToast.show{opacity:1;transform:translateX(-50%) translateY(0)}
    `.trim();
    document.head.appendChild(s);
  }

  function showPrayerToast(name) {
    ensureStyle();
    let box = document.getElementById('corePrayerToast');
    if (!box) {
      box = document.createElement('div');
      box.id = 'corePrayerToast';
      document.body.appendChild(box);
    }
    box.innerHTML = `🕌 <span>حان الآن موعد صلاة ${name} — الرياض</span>`;
    box.classList.add('show');
    setTimeout(() => box.classList.remove('show'), 10000);
  }

  function checkNow(timings) {
    if (!timings) return;
    const now = new Date();
    const hhmm = now.toTimeString().slice(0, 5);
    const notifiedRaw = (() => { try { return JSON.parse(localStorage.getItem(NOTIFIED_KEY) || 'null'); } catch (_) { return null; } })();
    const notified = (notifiedRaw && notifiedRaw.day === todayKey()) ? notifiedRaw.set : [];
    for (const key of ORDER) {
      const t = (timings[key] || '').slice(0, 5);
      if (t && t === hhmm && !notified.includes(key)) {
        showPrayerToast(PRAYER_NAMES[key]);
        notified.push(key);
        localStorage.setItem(NOTIFIED_KEY, JSON.stringify({ day: todayKey(), set: notified }));
      }
    }
  }

  // يعرض المواقيت في أي عنصر بالصفحة يحمل id="prayerTimesWidget" إن وُجد (الصفحة الرئيسية تحديدًا)
  function renderWidget(timings) {
    const host = document.getElementById('prayerTimesWidget');
    if (!host || !timings) return;
    host.innerHTML = ORDER.map(k => `<div class="pt-item"><b>${(timings[k] || '').slice(0, 5)}</b><span>${PRAYER_NAMES[k]}</span></div>`).join('');
  }

  const WEATHER_ICONS = {
    0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️', 45: '🌫️', 48: '🌫️',
    51: '🌦️', 61: '🌧️', 63: '🌧️', 65: '🌧️', 71: '🌨️', 80: '🌦️', 95: '⛈️'
  };
  async function fetchWeather() {
    const host = document.getElementById('weatherWidget');
    if (!host) return; // يظهر فقط في الصفحة التي تحتوي هذا العنصر (الرئيسية)
    try {
      const r = await fetch('https://api.open-meteo.com/v1/forecast?latitude=24.7136&longitude=46.6753&current_weather=true', { cache: 'no-store' });
      if (!r.ok) throw new Error('bad response');
      const data = await r.json();
      const cw = data && data.current_weather;
      if (!cw) throw new Error('no weather');
      const icon = WEATHER_ICONS[cw.weathercode] || '🌡️';
      host.innerHTML = `<span class="wt-icon">${icon}</span><b>${Math.round(cw.temperature)}°</b><span class="wt-label">الرياض</span>`;
    } catch (_) { /* تجاهل بصمت — لا شبكة أو تعذّر الجلب */ }
  }

  async function init() {
    const timings = await fetchTimings();
    renderWidget(timings);
    checkNow(timings);
    setInterval(() => checkNow(timings), 30 * 1000);
    fetchWeather();
    setInterval(fetchWeather, 30 * 60 * 1000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
