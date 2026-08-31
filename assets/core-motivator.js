/* core-motivator.js — رسائل تحفيزية دورية للموظف باسمه
   تظهر كل 15 دقيقة أثناء استخدام النظام (أي نظام من التسعة)، ثم تختفي تلقائيًا
   بعد ثوانٍ. لا تُخزَّن أي بيانات جديدة، ولا تعتمد إلا على اسم آخر مستخدم
   مسجَّل دخوله فعليًا (نفس المصدر المستخدم في بقية المنصة). */
(() => {
  'use strict';
  const INTERVAL_MS = 15 * 60 * 1000; // 15 دقيقة
  const SHOW_MS = 9000; // مدة ظهور الرسالة قبل الاختفاء

  const MESSAGES = [
    'أنت تصنع فرقًا حقيقيًا اليوم، استمر بنفس الزخم.',
    'كل مهمة تُنجزها الآن تقرّبك خطوة من هدف أكبر.',
    'وقتك وجهدك اليوم لهما قيمة حقيقية — شكرًا لجديتك.',
    'خذ نفسًا عميقًا، أنت تسير في الاتجاه الصحيح.',
    'التفاصيل الصغيرة التي تتقنها هي ما يصنع الفرق الكبير.',
    'استمرارك وتركيزك اليوم أمر يُحتذى به.',
    'إنجازك حتى الآن يستحق التقدير، تابع بثقة.',
    'فريقك يعتمد عليك، وأنت في المكان الصحيح تمامًا.',
    'لحظة تركيز بسيطة الآن تُوفر عليك جهدًا مضاعفًا لاحقًا.',
    'أنت أقرب لإنهاء يومك بنجاح مما تظن.',
    'جودة عملك تتحدث عنك، واصل بنفس الإتقان.',
    'لا بأس بأخذ استراحة قصيرة — عقل مرتاح يُنجز أكثر.',
    'شكرًا لالتزامك، هذا ما يجعل العمل يسير بسلاسة.',
    'كل يوم عمل جيد هو لبنة في مسار مهني أفضل.',
    'أنت جزء أساسي من نجاح هذه الإدارة.'
  ];

  function currentUserName() {
    try {
      return localStorage.getItem('v4-last-user') || localStorage.getItem('scc-current-user-name') || '';
    } catch (_) { return ''; }
  }

  function ensureStyle() {
    if (document.getElementById('core-motivator-style')) return;
    const s = document.createElement('style');
    s.id = 'core-motivator-style';
    s.textContent = `
#coreMotivator{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) scale(.94);z-index:999996;max-width:min(400px,calc(100vw - 32px));
 background:linear-gradient(160deg,#171f27,#10161c);border:1px solid rgba(212,175,55,.4);border-radius:20px;
 padding:22px 26px;box-shadow:0 30px 80px rgba(0,0,0,.55);color:#f2f0e8;font-family:Tajawal,Cairo,sans-serif;
 display:flex;gap:14px;align-items:flex-start;opacity:0;
 transition:opacity .45s ease,transform .45s ease;pointer-events:none;direction:rtl}
#coreMotivator.show{opacity:1;transform:translate(-50%,-50%) scale(1);pointer-events:auto}
#coreMotivator .cm-icon{font-size:26px;flex:none}
#coreMotivator b{display:block;font-size:14px;color:#EBCB6B;margin-bottom:5px}
#coreMotivator p{margin:0;font-size:13px;line-height:1.8;color:#d9dde1}
#coreMotivator .cm-close{position:absolute;top:10px;left:12px;background:none;border:0;color:#8a929a;font-size:15px;cursor:pointer}
#coreMotivatorBackdrop{position:fixed;inset:0;z-index:999995;background:rgba(6,9,12,.45);backdrop-filter:blur(2px);
 opacity:0;pointer-events:none;transition:opacity .45s ease}
#coreMotivatorBackdrop.show{opacity:1;pointer-events:auto}
@media(max-width:520px){#coreMotivator{max-width:calc(100vw - 40px);padding:20px}}
    `.trim();
    document.head.appendChild(s);
  }

  function showMessage() {
    const name = currentUserName();
    if (!name) return; // لا نعرض رسالة عامة بدون اسم حقيقي — تجنبًا لأي رسالة غير شخصية
    ensureStyle();
    let backdrop = document.getElementById('coreMotivatorBackdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'coreMotivatorBackdrop';
      document.body.appendChild(backdrop);
    }
    let box = document.getElementById('coreMotivator');
    if (!box) {
      box = document.createElement('div');
      box.id = 'coreMotivator';
      box.innerHTML = '<span class="cm-icon">💛</span><div><b></b><p></p></div><button type="button" class="cm-close" aria-label="إغلاق">✕</button>';
      document.body.appendChild(box);
      const closeIt = () => { box.classList.remove('show'); backdrop.classList.remove('show'); };
      box.querySelector('.cm-close').addEventListener('click', closeIt);
      backdrop.addEventListener('click', closeIt);
    }
    const msg = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
    box.querySelector('b').textContent = `${name}،`;
    box.querySelector('p').textContent = msg;
    box.classList.add('show');
    backdrop.classList.add('show');
    clearTimeout(box._hideTimer);
    box._hideTimer = setTimeout(() => { box.classList.remove('show'); backdrop.classList.remove('show'); }, SHOW_MS);
  }

  function init() {
    setInterval(showMessage, INTERVAL_MS);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
