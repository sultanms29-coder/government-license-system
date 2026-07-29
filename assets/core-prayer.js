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

  // حساب محلي مستقل لمواقيت الرياض حتى تظهر على كل الأجهزة، حتى عند حجب API الخارجي.
  function localRiyadhTimings(date = new Date()) {
    const lat = 24.7136, lng = 46.6753, tz = 3;
    const rad = Math.PI / 180, deg = 180 / Math.PI;
    const fix = a => ((a % 360) + 360) % 360;
    const julian = (y,m,d) => {
      if (m <= 2) { y--; m += 12; }
      const A = Math.floor(y/100), B = 2 - A + Math.floor(A/4);
      return Math.floor(365.25*(y+4716)) + Math.floor(30.6001*(m+1)) + d + B - 1524.5;
    };
    const jd = julian(date.getFullYear(), date.getMonth()+1, date.getDate());
    function solar(j){
      const D=j-2451545.0;
      const g=fix(357.529+0.98560028*D)*rad;
      const q=fix(280.459+0.98564736*D);
      const L=fix(q+1.915*Math.sin(g)+0.020*Math.sin(2*g))*rad;
      const e=(23.439-0.00000036*D)*rad;
      const ra=fix(Math.atan2(Math.cos(e)*Math.sin(L),Math.cos(L))*deg)/15;
      const eq=q/15-ra;
      const decl=Math.asin(Math.sin(e)*Math.sin(L));
      return {eq: ((eq+12)%24)-12, decl};
    }
    const sol=solar(jd+0.5);
    const noon=12 + tz - lng/15 - sol.eq;
    function hourAngle(alt){
      const a=alt*rad, phi=lat*rad;
      const c=(Math.sin(a)-Math.sin(phi)*Math.sin(sol.decl))/(Math.cos(phi)*Math.cos(sol.decl));
      return Math.acos(Math.max(-1,Math.min(1,c)))*deg/15;
    }
    function asrHour(){
      const phi=lat*rad;
      const alt=Math.atan(1/(1+Math.tan(Math.abs(phi-sol.decl))))*deg;
      return hourAngle(alt);
    }
    const fmt=h=>{
      h=((h%24)+24)%24;
      let hh=Math.floor(h), mm=Math.round((h-hh)*60);
      if(mm===60){hh=(hh+1)%24;mm=0;}
      return String(hh).padStart(2,'0')+':'+String(mm).padStart(2,'0');
    };
    return {
      Fajr:fmt(noon-hourAngle(-18.5)),
      Sunrise:fmt(noon-hourAngle(-0.833)),
      Dhuhr:fmt(noon+2/60),
      Asr:fmt(noon+asrHour()),
      Maghrib:fmt(noon+hourAngle(-0.833)),
      Isha:fmt(noon+hourAngle(-17))
    };
  }

  async function fetchTimings() {
    const cached = (() => { try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch (_) { return null; } })();
    if (cached && cached.day === todayKey() && cached.timings) return cached.timings;

    // اعرض الحساب المحلي فورًا واحفظه؛ ثم حاول تحسينه من المصدر الخارجي إن كان متاحًا.
    const fallback = localRiyadhTimings();
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ day: todayKey(), timings: fallback, source:'local' })); } catch (_) {}
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4500);
      const r = await fetch('https://api.aladhan.com/v1/timingsByCity?city=Riyadh&country=Saudi%20Arabia&method=4', { cache: 'no-store', signal:controller.signal });
      clearTimeout(timer);
      if (!r.ok) throw new Error('bad response');
      const data = await r.json();
      const timings = data && data.data && data.data.timings;
      if (!timings) throw new Error('no timings');
      localStorage.setItem(CACHE_KEY, JSON.stringify({ day: todayKey(), timings, source:'api' }));
      return timings;
    } catch (_) {
      return fallback;
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
    const en=document.documentElement.lang==='en';
    const enNames={Fajr:'Fajr',Dhuhr:'Dhuhr',Asr:'Asr',Maghrib:'Maghrib',Isha:'Isha'};
    host.innerHTML = ORDER.map(k => `<div class="pt-item"><b>${(timings[k] || '').slice(0, 5)}</b><span>${en?enNames[k]:PRAYER_NAMES[k]}</span></div>`).join('');
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

  let currentTimings = null;
  async function init() {
    const timings = await fetchTimings();
    currentTimings = timings;
    renderWidget(timings);
    checkNow(timings);
    setInterval(() => checkNow(timings), 30 * 1000);
    fetchWeather();
    setInterval(fetchWeather, 30 * 60 * 1000);
  }

  window.addEventListener('gr-language-changed',()=>{ if(currentTimings) renderWidget(currentTimings); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
