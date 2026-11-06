/* Студия красоты Елены Толмачевой — поведение страницы.
   Настройки (музыка, заставка, реквизиты) приходят из <script id="site-cfg">,
   который собирает админка. Здесь ничего править не нужно. */
(function () {
  'use strict';
  var root = document.documentElement;
  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var CFG = {};
  try { CFG = JSON.parse(($('#site-cfg') || {}).textContent || '{}'); } catch (e) { CFG = {}; }

  /* ---------- 1. Приветственный экран ---------- */
  var splashEl = $('#splash');
  var MIN_MS = calm ? 300 : ((CFG.splash && CFG.splash.min) || 2400);
  var MAX_MS = calm ? 600 : Math.max(MIN_MS + 1500, 5500);
  var splashStart = window.__spashStart || Date.now();
  var splashHidden = !splashEl, splashArmed = false, splashCbs = [];
  function onSplashGone(fn) { if (splashHidden) fn(); else splashCbs.push(fn); }
  function hideSplash() {
    if (splashHidden) return;
    splashHidden = true;
    root.classList.add('splash-out');
    root.classList.remove('splash-on');
    setTimeout(function () { root.classList.add('splash-done'); }, 1100);
    splashCbs.forEach(function (fn) { try { fn(); } catch (e) {} });
    splashCbs = [];
  }
  function armSplash() {
    if (splashArmed || splashHidden) return;
    splashArmed = true;
    var waited = Date.now() - splashStart;
    setTimeout(hideSplash, Math.max(0, MIN_MS - waited));
  }
  if (splashEl) {
    if (document.readyState === 'complete') armSplash();
    else window.addEventListener('load', armSplash);
    setTimeout(armSplash, MAX_MS);
    setTimeout(hideSplash, MAX_MS + 1200);
  } else {
    root.classList.remove('splash-on');
  }

  /* ---------- 2. Год в подвале ---------- */
  var yr = $('#yr'); if (yr) yr.textContent = new Date().getFullYear();

  /* ---------- 3. Шапка и полоса прогресса ---------- */
  var hdr = $('#hdr'), progBar = $('#prog i'), lastY = 0, fab = $('#fab');
  function onScrollHeader(y) {
    if (hdr) {
      if (y > 36) hdr.classList.add('solid'); else hdr.classList.remove('solid');
      if (!root.classList.contains('menu-open')) {
        if (y > 420 && y > lastY + 6) hdr.classList.add('hide');
        else if (y < lastY - 6) hdr.classList.remove('hide');
      }
    }
    if (fab) { if (y > 700) fab.classList.add('show'); else fab.classList.remove('show'); }
    if (progBar) {
      var max = (document.documentElement.scrollHeight - window.innerHeight) || 1;
      progBar.style.transform = 'scaleX(' + Math.min(1, Math.max(0, y / max)) + ')';
    }
    lastY = y;
  }

  /* ---------- 4. Появление блоков ---------- */
  var revs = $$('.rv, .rv-i, .rv-l, .rv-t');
  function onScrollReveal() {
    var vh = window.innerHeight || document.documentElement.clientHeight;
    for (var i = revs.length - 1; i >= 0; i--) {
      var el = revs[i];
      var r = el.getBoundingClientRect();
      if (r.top < vh * 0.9 && r.bottom > -100) { el.classList.add('in'); revs.splice(i, 1); }
    }
  }

  /* ---------- 5. Параллакс ---------- */
  var pxs = calm ? [] : $$('.px').map(function (el) {
    return { el: el, k: parseFloat(el.getAttribute('data-px') || '0.14') };
  });
  function onScrollParallax() {
    var vh = window.innerHeight || 800;
    for (var i = 0; i < pxs.length; i++) {
      var p = pxs[i], host = p.el.parentNode;
      var r = host.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) continue;
      var t = (r.top + r.height / 2 - vh / 2) / (vh / 2 + r.height / 2);
      if (t > 1) t = 1; else if (t < -1) t = -1;
      p.el.style.transform = 'translate3d(0,' + (t * p.k * r.height).toFixed(1) + 'px,0)';
    }
  }

  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    setTimeout(function () {
      ticking = false;
      var y = window.pageYOffset || document.documentElement.scrollTop || 0;
      onScrollHeader(y); onScrollReveal(); onScrollParallax();
    }, 50);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  onScrollHeader(window.pageYOffset || 0); onScrollReveal(); onScrollParallax();
  setTimeout(onScrollReveal, 260);
  setTimeout(function () { onScrollReveal(); onScrollParallax(); }, 900);
  setTimeout(function () { for (var i = 0; i < revs.length; i++) revs[i].classList.add('in'); revs.length = 0; }, 6000);

  /* ---------- 6. Мобильное меню ---------- */
  var burger = $('#burger'), mob = $('#mob');
  function openMenu() {
    if (!mob) return;
    mob.hidden = false;
    void mob.offsetWidth;
    root.classList.add('menu-open');
    if (burger) burger.setAttribute('aria-expanded', 'true');
    if (hdr) hdr.classList.remove('hide');
    $$('#mob nav a').forEach(function (a, i) { a.style.transitionDelay = (0.05 + i * 0.035).toFixed(3) + 's'; });
  }
  function closeMenu() {
    root.classList.remove('menu-open');
    if (burger) burger.setAttribute('aria-expanded', 'false');
    $$('#mob nav a').forEach(function (a) { a.style.transitionDelay = '0s'; });
    setTimeout(function () { if (!root.classList.contains('menu-open') && mob) mob.hidden = true; }, 620);
  }
  if (burger) burger.addEventListener('click', function () {
    root.classList.contains('menu-open') ? closeMenu() : openMenu();
  });
  $$('#mob a').forEach(function (a) { a.addEventListener('click', closeMenu); });

  /* ---------- 7. Плавная прокрутка + работа во фрейме ---------- */
  function scrollToEl(el) {
    if (!el) return;
    var hdrH = hdr ? hdr.getBoundingClientRect().height : 0;
    var top = el.getBoundingClientRect().top + (window.pageYOffset || 0) - hdrH - 6;
    if (top < 0) top = 0;
    try { window.scrollTo({ top: top, behavior: calm ? 'auto' : 'smooth' }); }
    catch (e) { window.scrollTo(0, top); }
    setTimeout(onScroll, 400); setTimeout(onScroll, 900); setTimeout(onScroll, 1500);
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a') : null;
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (href.charAt(0) === '#' && href.length > 1) {
      var t = document.getElementById(href.slice(1));
      if (t) { e.preventDefault(); if (root.classList.contains('menu-open')) closeMenu(); scrollToEl(t); }
      return;
    }
    if (root.classList.contains('is-embedded') && /^(tel:|mailto:|https?:)/i.test(href)) {
      e.preventDefault();
      try { window.open(href, a.target === '_blank' ? '_blank' : '_top', 'noopener'); }
      catch (err) { window.top.location.href = href; }
    }
  }, false);

  /* ---------- 8. Вкладки прайса ---------- */
  $$('.tabs [role="tab"]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var group = btn.closest('.tabs');
      $$('[role="tab"]', group).forEach(function (b) {
        var on = b === btn;
        b.setAttribute('aria-selected', on ? 'true' : 'false');
        var p = document.getElementById(b.getAttribute('aria-controls'));
        if (p) p.hidden = !on;
      });
      setTimeout(onScrollReveal, 60);
    });
    btn.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      var group = $$('[role="tab"]', btn.closest('.tabs'));
      var i = group.indexOf(btn) + (e.key === 'ArrowRight' ? 1 : -1);
      var next = group[(i + group.length) % group.length];
      if (next) { next.focus(); next.click(); }
    });
  });

  /* ---------- 9. Аккордеоны: открыт один за раз ---------- */
  $$('.faq').forEach(function (group) {
    var items = $$('details', group);
    items.forEach(function (d) {
      d.addEventListener('toggle', function () {
        if (!d.open) return;
        items.forEach(function (o) { if (o !== d) o.open = false; });
        setTimeout(onScrollReveal, 60);
      });
    });
  });

  /* ---------- 10. Лайтбокс: работает для каждой фотоленты с data-lb ---------- */
  var lb = $('#lb'), lbImg = $('#lbImg'), lbC = $('#lbC'), lbI = $('#lbI'), figs = [], cur = 0;
  function lbShow(i) {
    if (!figs.length) return;
    cur = (i + figs.length) % figs.length;
    var im = figs[cur].querySelector('img');
    var cap = figs[cur].querySelector('figcaption');
    lbImg.src = im.currentSrc || im.src;
    lbImg.alt = im.alt || '';
    lbC.textContent = cap ? cap.textContent : (im.alt || '');
    lbI.textContent = (cur + 1) + ' / ' + figs.length;
  }
  function lbOpen(list, i) {
    if (!lb) return;
    figs = list;
    lbShow(i);
    lb.hidden = false;
    void lb.offsetWidth;
    lb.classList.add('open');
    root.classList.add('lock');
    var x = $('#lbX'); if (x) x.focus();
  }
  function lbClose() {
    if (!lb) return;
    lb.classList.remove('open');
    root.classList.remove('lock');
    setTimeout(function () { lb.hidden = true; }, 560);
  }
  $$('[data-lb]').forEach(function (rail) {
    var list = $$('figure', rail);
    list.forEach(function (f, i) {
      f.setAttribute('tabindex', '0');
      f.setAttribute('role', 'button');
      f.addEventListener('click', function () { if (rail._justDragged) return; lbOpen(list, i); });
      f.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); lbOpen(list, i); }
      });
    });
  });
  var bX = $('#lbX'), bP = $('#lbP'), bN = $('#lbN');
  if (bX) bX.addEventListener('click', lbClose);
  if (bP) bP.addEventListener('click', function () { lbShow(cur - 1); });
  if (bN) bN.addEventListener('click', function () { lbShow(cur + 1); });
  if (lb) lb.addEventListener('click', function (e) { if (e.target === lb) lbClose(); });
  document.addEventListener('keydown', function (e) {
    if (lb && lb.classList.contains('open')) {
      if (e.key === 'Escape') lbClose();
      else if (e.key === 'ArrowRight') lbShow(cur + 1);
      else if (e.key === 'ArrowLeft') lbShow(cur - 1);
      return;
    }
    if (e.key === 'Escape' && root.classList.contains('menu-open')) closeMenu();
  });
  var tx = 0;
  if (lb) {
    lb.addEventListener('touchstart', function (e) { tx = e.changedTouches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', function (e) {
      var d = e.changedTouches[0].clientX - tx;
      if (Math.abs(d) > 55) lbShow(cur + (d < 0 ? 1 : -1));
    }, { passive: true });
  }

  /* ---------- 10a. Магнитные кнопки ---------- */
  if (!calm && window.matchMedia && window.matchMedia('(hover:hover) and (pointer:fine)').matches) {
    $$('.btn').forEach(function (b) {
      b.addEventListener('mousemove', function (e) {
        var r = b.getBoundingClientRect();
        var dx = (e.clientX - (r.left + r.width / 2)) / r.width;
        var dy = (e.clientY - (r.top + r.height / 2)) / r.height;
        b.style.transform = 'translate3d(' + (dx * 7).toFixed(1) + 'px,' + (dy * 4).toFixed(1) + 'px,0)';
      });
      b.addEventListener('mouseleave', function () {
        b.style.transition = 'transform .8s var(--e-out)';
        b.style.transform = '';
        setTimeout(function () { b.style.transition = ''; }, 820);
      });
    });
  }

  /* ---------- 10b. Горизонтальные ленты ---------- */
  $$('.rail').forEach(function (rail) {
    var wrap = rail.closest('.rail-wrap');
    var head = wrap && wrap.parentNode.querySelector('.rail-nav');
    var prev = head && head.querySelector('.prev');
    var next = head && head.querySelector('.next');
    function step() {
      var first = rail.firstElementChild;
      var w = first ? first.getBoundingClientRect().width : 300;
      var visible = Math.max(1, Math.floor(rail.clientWidth / (w + 10)));
      return (w + 10) * Math.max(1, visible - 1);
    }
    function sync() {
      var max = rail.scrollWidth - rail.clientWidth;
      var x = rail.scrollLeft;
      if (wrap) { wrap.classList.toggle('can-l', x > 4); wrap.classList.toggle('can-r', x < max - 4); }
      if (prev) prev.disabled = x <= 4;
      if (next) next.disabled = x >= max - 4;
    }
    function go(dir) {
      try { rail.scrollBy({ left: dir * step(), behavior: calm ? 'auto' : 'smooth' }); }
      catch (e) { rail.scrollLeft += dir * step(); }
    }
    if (prev) prev.addEventListener('click', function () { go(-1); });
    if (next) next.addEventListener('click', function () { go(1); });
    rail.addEventListener('scroll', function () {
      if (rail._t) return;
      rail._t = setTimeout(function () { rail._t = null; sync(); }, 90);
    }, { passive: true });
    window.addEventListener('resize', sync, { passive: true });
    setTimeout(sync, 60); setTimeout(sync, 700); sync();
    rail.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    });
    var down = false, startX = 0, startL = 0, moved = 0, lastX = 0, lastT = 0, vel = 0;
    rail.addEventListener('mousedown', function (e) {
      if (e.button !== 0) return;
      down = true; moved = 0; vel = 0;
      startX = lastX = e.pageX; startL = rail.scrollLeft; lastT = Date.now();
    });
    window.addEventListener('mousemove', function (e) {
      if (!down) return;
      var d = e.pageX - startX;
      if (Math.abs(d) > 4 && !rail.classList.contains('dragging')) rail.classList.add('dragging');
      if (!rail.classList.contains('dragging')) return;
      e.preventDefault();
      rail.scrollLeft = startL - d;
      moved = Math.abs(d);
      var now = Date.now(), dt = now - lastT;
      if (dt > 0) { vel = (e.pageX - lastX) / dt; lastX = e.pageX; lastT = now; }
    });
    window.addEventListener('mouseup', function () {
      if (!down) return;
      down = false;
      if (!rail.classList.contains('dragging')) return;
      rail._justDragged = moved > 6;
      rail.classList.remove('dragging');
      if (!calm && Math.abs(vel) > 0.15 && Date.now() - lastT < 120) {
        var glide = Math.max(-900, Math.min(900, -vel * 260));
        try { rail.scrollBy({ left: glide, behavior: 'smooth' }); }
        catch (e) { rail.scrollLeft += glide; }
      }
      setTimeout(function () { rail._justDragged = false; }, 80);
    });
  });

  /* ---------- 11. Мини-страница процедуры ----------
     Текст лежит в разметке (для поисковиков и нейросетей) и на время
     показа переносится в выдвижную панель. */
  var sheet = $('#sheet'), shBody = $('#shBody'), shImg = $('#shImg'),
      sheetsStore = $('#sheets'), shOpenNode = null, shLastFocus = null, shCloseTimer = null;

  function sheetOpen(id, trigger) {
    var src = document.getElementById(id);
    if (!src || !sheet || !shBody) return;
    if (shCloseTimer) { clearTimeout(shCloseTimer); shCloseTimer = null; }
    if (shOpenNode) sheetReturn();
    shBody.appendChild(src);
    shOpenNode = src;
    var h = src.querySelector('.sh-title');
    if (h) h.id = 'shTitleRef';
    var path = src.getAttribute('data-img');
    shImg.innerHTML = '';
    if (path) {
      var im = document.createElement('img');
      im.src = path; im.alt = ''; im.setAttribute('aria-hidden', 'true'); im.decoding = 'async';
      shImg.appendChild(im);
      shImg.hidden = false;
    } else {
      shImg.hidden = true;
    }
    shLastFocus = trigger || document.activeElement;
    sheet.hidden = false;
    void sheet.offsetWidth;
    sheet.classList.add('open');
    root.classList.add('lock');
    sheet.querySelector('.sh-panel').scrollTop = 0;
    var x = $('#shX'); if (x) x.focus();
    try { if (history.replaceState) history.replaceState(null, '', '#' + id); } catch (e) {}
  }
  function sheetReturn() {
    if (shOpenNode && sheetsStore) {
      var h = shOpenNode.querySelector('#shTitleRef');
      if (h) h.removeAttribute('id');
      sheetsStore.appendChild(shOpenNode);
      shOpenNode = null;
    }
  }
  function sheetClose() {
    if (!sheet || sheet.hidden) return;
    sheet.classList.remove('open');
    root.classList.remove('lock');
    if (shCloseTimer) clearTimeout(shCloseTimer);
    shCloseTimer = setTimeout(function () {
      shCloseTimer = null; sheet.hidden = true; sheetReturn(); shImg.innerHTML = '';
    }, 950);
    try { if (history.replaceState && /^#s-/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
    if (shLastFocus && shLastFocus.focus) { try { shLastFocus.focus(); } catch (e) {} }
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('[data-sheet]') : null;
    if (t) { e.preventDefault(); sheetOpen(t.getAttribute('data-sheet'), t); return; }
    if (sheet && !sheet.hidden && e.target.closest && e.target.closest('[data-close]')) {
      e.preventDefault(); sheetClose();
    }
  }, false);
  document.addEventListener('keydown', function (e) {
    if (!sheet || sheet.hidden) return;
    if (e.key === 'Escape') { e.preventDefault(); sheetClose(); return; }
    if (e.key !== 'Tab') return;
    var f = sheet.querySelectorAll('a[href],button:not([disabled])');
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  if (sheet) {
    var sy = 0, sMoved = 0, panel = sheet.querySelector('.sh-panel');
    panel.addEventListener('touchstart', function (e) { sy = e.changedTouches[0].clientY; sMoved = 0; }, { passive: true });
    panel.addEventListener('touchmove', function (e) { sMoved = e.changedTouches[0].clientY - sy; }, { passive: true });
    panel.addEventListener('touchend', function () { if (sMoved > 110 && panel.scrollTop <= 0) sheetClose(); }, { passive: true });
  }
  // ссылка вида beauty38.ru/#s-lite сразу открывает нужную процедуру
  if (/^#s-[\w-]+$/.test(location.hash) && document.getElementById(location.hash.slice(1))) {
    onSplashGone(function () { setTimeout(function () { sheetOpen(location.hash.slice(1)); }, 300); });
  }

  /* ---------- 11b. Реквизиты в буфер ---------- */
  var innBtn = $('#innBtn');
  if (innBtn) {
    var card = CFG.card || '';
    function legacyCopy(text) {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0';
      document.body.appendChild(ta);
      var sel = document.getSelection(), saved = sel.rangeCount ? sel.getRangeAt(0) : null;
      ta.select(); ta.setSelectionRange(0, text.length);
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      if (saved) { sel.removeAllRanges(); sel.addRange(saved); }
      return ok;
    }
    function confirmCopy(ok) {
      var say = innBtn.querySelector('.say');
      if (!say) { say = document.createElement('span'); say.className = 'say'; innBtn.appendChild(say); }
      say.textContent = ok ? (innBtn.getAttribute('data-copied') || 'Скопировано') : 'Выделите и скопируйте';
      innBtn.classList.add('done');
      clearTimeout(innBtn._t);
      innBtn._t = setTimeout(function () { innBtn.classList.remove('done'); }, 2600);
    }
    innBtn.addEventListener('click', function () {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(card).then(function () { confirmCopy(true); }, function () { confirmCopy(legacyCopy(card)); });
      } else confirmCopy(legacyCopy(card));
    });
  }

  /* ---------- 12. Подсветка активного пункта меню ---------- */
  var navLinks = $$('#nav a'), secs = [];
  navLinks.forEach(function (a) {
    var id = (a.getAttribute('href') || '').slice(1);
    var el = id && document.getElementById(id);
    if (el) secs.push({ a: a, el: el });
  });
  function markActive() {
    var y = (window.pageYOffset || 0) + (hdr ? hdr.getBoundingClientRect().height : 0) + 30;
    var best = null;
    secs.forEach(function (s) {
      var top = s.el.getBoundingClientRect().top + (window.pageYOffset || 0);
      if (top <= y) best = s;
    });
    secs.forEach(function (s) { s.a.style.color = (s === best) ? 'var(--e-050)' : ''; });
  }
  window.addEventListener('scroll', function () {
    if (markActive._t) return;
    markActive._t = setTimeout(function () { markActive._t = null; markActive(); }, 180);
  }, { passive: true });
  markActive();

  /* ---------- 13. Музыка ----------
     Браузеры запрещают звук без действия посетителя. Поэтому: пробуем
     запустить сразу; если браузер не дал — включаем при первом касании,
     клике или нажатии клавиши в любом месте страницы. Кнопка внизу —
     пауза/продолжить; выбор паузы запоминается до конца визита. */
  var M = CFG.music;
  var box = $('#music');
  if (M && M.src && box) {
    var btn = box.querySelector('.mu-btn');
    var KEY = 'music-paused';
    var audio = new Audio();
    audio.preload = 'none';
    audio.loop = M.loop !== false;
    audio.src = M.src;
    var target = Math.max(0, Math.min(1, +M.volume || 0.35));
    var userPaused = false, started = false, fadeT = null, hiddenPaused = false;
    try { userPaused = M.rememberPause !== false && sessionStorage.getItem(KEY) === '1'; } catch (e) {}

    function setUI(on) {
      box.classList.toggle('playing', on);
      if (btn) {
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
        btn.setAttribute('aria-label', (on ? 'Выключить музыку: ' : 'Включить музыку: ') + (M.label || ''));
        btn.title = on ? 'Пауза' : 'Включить музыку';
      }
    }
    function fadeTo(v, done) {
      clearInterval(fadeT);
      var ms = calm ? 0 : (+M.fadeMs || 2000), stepMs = 50;
      if (!ms) { audio.volume = v; if (done) done(); return; }
      var from = audio.volume, n = Math.max(1, Math.round(ms / stepMs)), i = 0;
      fadeT = setInterval(function () {
        i++;
        audio.volume = Math.max(0, Math.min(1, from + (v - from) * (i / n)));
        if (i >= n) { clearInterval(fadeT); if (done) done(); }
      }, stepMs);
    }
    function play() {
      if (!audio.paused) return Promise.resolve(true);
      audio.volume = 0;
      var p;
      try { p = audio.play(); } catch (e) { return Promise.resolve(false); }
      if (!p || !p.then) { started = true; setUI(true); fadeTo(target); return Promise.resolve(true); }
      return p.then(function () { started = true; setUI(true); fadeTo(target); return true; },
                    function () { setUI(false); return false; });
    }
    function pause(byUser) {
      fadeTo(0, function () { audio.pause(); });
      setUI(false);
      if (byUser) {
        userPaused = true;
        try { if (M.rememberPause !== false) sessionStorage.setItem(KEY, '1'); } catch (e) {}
      }
    }
    if (btn) btn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (!audio.paused && !box.classList.contains('playing')) { setUI(true); return; }
      if (box.classList.contains('playing')) pause(true);
      else {
        userPaused = false;
        try { sessionStorage.removeItem(KEY); } catch (er) {}
        play();
      }
    });
    // первое действие посетителя «разрешает» звук
    var gestures = ['pointerdown', 'keydown', 'touchend'];
    function onGesture(e) {
      if (e && e.target && e.target.closest && e.target.closest('#music')) { unbind(); return; }
      if (userPaused || M.autoplay === false || !audio.paused) { unbind(); return; }
      // на телефоне pointerdown ещё не даёт права на звук — тогда сработает touchend
      play().then(function (ok) { if (ok) unbind(); });
    }
    function unbind() { gestures.forEach(function (g) { document.removeEventListener(g, onGesture, true); }); }
    function arm() {
      box.classList.add('show');
      if (M.autoplay === false || userPaused) { setUI(false); return; }
      play().then(function (ok) {
        if (ok) return;
        gestures.forEach(function (g) { document.addEventListener(g, onGesture, true); });
        box.classList.add('hint');
        setTimeout(function () { box.classList.remove('hint'); }, 4200);
      });
    }
    setUI(false);
    onSplashGone(function () { setTimeout(arm, 250); });
    if (M.pauseOnHide !== false) {
      document.addEventListener('visibilitychange', function () {
        if (document.hidden && !audio.paused) { hiddenPaused = true; audio.pause(); setUI(false); }
        else if (!document.hidden && hiddenPaused && !userPaused) { hiddenPaused = false; play(); }
      });
    }
    audio.addEventListener('ended', function () { if (!audio.loop) setUI(false); });
  }
})();
