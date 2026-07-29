/* core-prayer.js — تذكير أوقات الصلاة لمدينة الرياض
   يجلب مواقيت اليوم مرة واحدة (ويُخزّنها محليًا ليوم واحد)، ثم يراقب الوقت
   الحالي ويعرض تذكيرًا لطيفًا عند دخول كل وقت صلاة. يعمل على كل صفحات المنصة. */
(() => {
  'use strict';
  const CACHE_KEY = 'scc-prayer-times-cache';
  const NOTIFIED_KEY = 'scc-prayer-notified-date';
  const SETTINGS_KEY = 'scc-prayer-mode-settings-v1';
  const AUDIO_URL = new URL('adhan-nasser-alqatami.mp3', document.currentScript?.src || location.href).href;
  const DEFAULT_SETTINGS = { enabled: true, volume: 0.85, city: 'الرياض', lockMode: true };
  let audioUnlocked = false;
  let activePrayer = null;
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

  function getSettings() {
    try { return { ...DEFAULT_SETTINGS, ...(JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')) }; }
    catch (_) { return { ...DEFAULT_SETTINGS }; }
  }

  function saveSettings(next) {
    const value = { ...getSettings(), ...next };
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(value)); } catch (_) {}
    return value;
  }

  function ensureStyle() {
    if (document.getElementById('core-prayer-style')) return;
    const s = document.createElement('style');
    s.id = 'core-prayer-style';
    s.textContent = `
#corePrayerToast{position:fixed;top:64px;left:50%;transform:translateX(-50%) translateY(-10px);z-index:999994;background:linear-gradient(135deg,#1c2a22,#141d18);border:1px solid rgba(72,199,142,.4);border-radius:14px;padding:12px 20px;box-shadow:0 16px 40px rgba(0,0,0,.4);color:#eafaf1;font-family:Tajawal,Cairo,sans-serif;font-size:13px;font-weight:700;display:flex;align-items:center;gap:10px;opacity:0;pointer-events:none;transition:opacity .4s ease,transform .4s ease;direction:rtl}
#corePrayerToast.show{opacity:1;transform:translateX(-50%) translateY(0)}
#corePrayerOverlay{position:fixed;inset:0;z-index:2147483000;display:none;align-items:center;justify-content:center;padding:24px;background:radial-gradient(circle at 50% 20%,rgba(34,94,71,.55),transparent 42%),linear-gradient(145deg,#07130f 0%,#10271e 52%,#07100d 100%);color:#fff;font-family:Tajawal,Cairo,sans-serif;direction:rtl;overflow:hidden}
#corePrayerOverlay.show{display:flex;animation:prayerFadeIn .8s ease both}
#corePrayerOverlay::before{content:'';position:absolute;inset:-30%;background:repeating-radial-gradient(circle at center,transparent 0 52px,rgba(255,255,255,.018) 53px 54px);animation:prayerGlow 14s linear infinite;pointer-events:none}
.core-prayer-card{position:relative;width:min(680px,94vw);text-align:center;padding:38px 28px 30px;border:1px solid rgba(219,190,117,.34);border-radius:30px;background:rgba(7,20,15,.76);box-shadow:0 32px 90px rgba(0,0,0,.52),inset 0 1px 0 rgba(255,255,255,.08);backdrop-filter:blur(16px)}
.core-prayer-mosque{font-size:56px;filter:drop-shadow(0 8px 22px rgba(219,190,117,.25));margin-bottom:10px}
.core-prayer-kicker{font-size:14px;color:#d8bd78;font-weight:800;letter-spacing:.4px}
.core-prayer-title{font-size:clamp(28px,5vw,48px);margin:8px 0 10px;font-weight:900}
.core-prayer-message{font-size:16px;line-height:1.9;color:#e5ece8;margin:0 auto 22px;max-width:530px}
.core-prayer-progress{height:6px;background:rgba(255,255,255,.1);border-radius:99px;overflow:hidden;margin:18px auto 12px;max-width:480px}
.core-prayer-progress span{display:block;height:100%;width:0;background:linear-gradient(90deg,#a88339,#f4dfa0);border-radius:inherit;transition:width .4s linear}
.core-prayer-timeleft{font-size:13px;color:#cbd8d1;font-variant-numeric:tabular-nums}
.core-prayer-audio-note{margin-top:16px;font-size:12px;color:#aebdb5;display:none}
.core-prayer-audio-note.show{display:block}
.core-prayer-emergency{display:none;margin:18px auto 0;border:1px solid rgba(255,255,255,.16);background:transparent;color:#dce8e1;padding:8px 14px;border-radius:10px;font-family:inherit;cursor:pointer}
body.core-prayer-locked{overflow:hidden!important}
@keyframes prayerFadeIn{from{opacity:0}to{opacity:1}}
@keyframes prayerGlow{to{transform:rotate(360deg)}}
@media(max-width:600px){.core-prayer-card{padding:30px 18px 24px;border-radius:24px}.core-prayer-message{font-size:14px}.core-prayer-mosque{font-size:46px}}
    `.trim();
    document.head.appendChild(s);
  }

  function ensureOverlay() {
    ensureStyle();
    let overlay = document.getElementById('corePrayerOverlay');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'corePrayerOverlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML = `<div class="core-prayer-card">
      <div class="core-prayer-mosque">🕌</div>
      <div class="core-prayer-kicker">منصة العلاقات العامة والحكومية</div>
      <h2 class="core-prayer-title" id="corePrayerTitle">حان الآن وقت الصلاة</h2>
      <p class="core-prayer-message">حيّ على الصلاة، حيّ على الفلاح<br>نسأل الله أن يتقبل منا ومنكم صالح الأعمال.</p>
      <div class="core-prayer-progress"><span id="corePrayerProgress"></span></div>
      <div class="core-prayer-timeleft" id="corePrayerTimeLeft">جاري تشغيل الأذان…</div>
      <div class="core-prayer-audio-note" id="corePrayerAudioNote">تعذّر بدء الصوت تلقائيًا بسبب إعدادات المتصفح. المس الشاشة مرة واحدة لتشغيل الأذان.</div>
      <button class="core-prayer-emergency" id="corePrayerEmergency" type="button">دخول اضطراري للمدير</button>
    </div>`;
    document.body.appendChild(overlay);
    return overlay;
  }

  function isManager() {
    try {
      const values = [localStorage.getItem('userRole'), localStorage.getItem('role'), sessionStorage.getItem('userRole')].filter(Boolean).join(' ').toLowerCase();
      return /مدير|admin|manager/.test(values);
    } catch (_) { return false; }
  }

  function formatRemaining(seconds) {
    seconds = Math.max(0, Math.ceil(seconds));
    const m = Math.floor(seconds / 60), sec = seconds % 60;
    return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  }

  function closePrayerMode(audio, timer) {
    if (timer) clearInterval(timer);
    try { audio.pause(); audio.currentTime = 0; } catch (_) {}
    const overlay = document.getElementById('corePrayerOverlay');
    if (overlay) overlay.classList.remove('show');
    document.body.classList.remove('core-prayer-locked');
    activePrayer = null;
    setTimeout(() => {
      const msg = document.createElement('div');
      msg.id = 'corePrayerToast';
      msg.innerHTML = '🤲 <span>تقبل الله طاعتكم، وبارك لكم في أعمالكم.</span>';
      document.body.appendChild(msg);
      requestAnimationFrame(() => msg.classList.add('show'));
      setTimeout(() => { msg.classList.remove('show'); setTimeout(() => msg.remove(), 500); }, 5000);
    }, 350);
  }

  async function startPrayerMode(name, key) {
    const settings = getSettings();
    if (!settings.enabled || activePrayer) return;
    activePrayer = key;
    const overlay = ensureOverlay();
    document.getElementById('corePrayerTitle').textContent = `حان الآن وقت صلاة ${name}`;
    const note = document.getElementById('corePrayerAudioNote');
    const emergency = document.getElementById('corePrayerEmergency');
    emergency.style.display = isManager() ? 'inline-block' : 'none';
    overlay.classList.add('show');
    if (settings.lockMode) document.body.classList.add('core-prayer-locked');

    const audio = new Audio(AUDIO_URL);
    audio.preload = 'auto';
    audio.volume = Math.max(0, Math.min(1, Number(settings.volume) || .85));
    let duration = 240;
    let startedAt = Date.now();
    let timer = null;

    const update = () => {
      const elapsed = audio.currentTime || ((Date.now() - startedAt) / 1000);
      const total = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : duration;
      document.getElementById('corePrayerProgress').style.width = `${Math.min(100, (elapsed / total) * 100)}%`;
      document.getElementById('corePrayerTimeLeft').textContent = `الوقت المتبقي من الأذان ${formatRemaining(total - elapsed)}`;
    };
    audio.addEventListener('loadedmetadata', () => { if (Number.isFinite(audio.duration)) duration = audio.duration; update(); });
    audio.addEventListener('ended', () => closePrayerMode(audio, timer), { once: true });
    audio.addEventListener('error', () => {
      note.textContent = 'تعذّر تحميل ملف الأذان. ستغلق الشاشة تلقائيًا بعد لحظات.';
      note.classList.add('show');
      setTimeout(() => closePrayerMode(audio, timer), 12000);
    }, { once: true });
    emergency.onclick = () => closePrayerMode(audio, timer);

    const playNow = async () => {
      try {
        await audio.play();
        audioUnlocked = true;
        note.classList.remove('show');
        startedAt = Date.now() - (audio.currentTime * 1000);
        if (!timer) timer = setInterval(update, 500);
      } catch (_) {
        note.classList.add('show');
      }
    };
    overlay.addEventListener('pointerdown', playNow, { once: true });
    await playNow();
    if (!timer) timer = setInterval(update, 500);
  }

  function showPrayerToast(name, key) {
    startPrayerMode(name, key);
  }

  function unlockAudio() {
    if (audioUnlocked) return;
    const a = new Audio(AUDIO_URL);
    a.volume = 0;
    a.play().then(() => { a.pause(); a.currentTime = 0; audioUnlocked = true; }).catch(() => {});
  }
  ['pointerdown','keydown','touchstart'].forEach(ev => window.addEventListener(ev, unlockAudio, { once:true, passive:true }));

  window.GRPrayerMode = {
    getSettings,
    saveSettings,
    test(prayerName='الظهر') { startPrayerMode(prayerName, `test-${Date.now()}`); }
  };

  function checkNow(timings) {
    if (!timings) return;
    const now = new Date();
    const hhmm = now.toTimeString().slice(0, 5);
    const notifiedRaw = (() => { try { return JSON.parse(localStorage.getItem(NOTIFIED_KEY) || 'null'); } catch (_) { return null; } })();
    const notified = (notifiedRaw && notifiedRaw.day === todayKey()) ? notifiedRaw.set : [];
    for (const key of ORDER) {
      const t = (timings[key] || '').slice(0, 5);
      if (t && t === hhmm && !notified.includes(key)) {
        showPrayerToast(PRAYER_NAMES[key], key);
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
