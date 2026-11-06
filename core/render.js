/*!
 * core/render.js — сборщик сайта из content/site.json.
 * Один и тот же код работает в админке (браузер) и в tools/build.js (Node),
 * поэтому опубликованный сайт всегда совпадает с предпросмотром.
 *
 *   SiteRender.renderAll(data, opts) → { files: { 'index.html': '...', ... }, warnings: [...] }
 *
 * В текстах можно использовать подстановки — они заменяются при сборке:
 *   {{phone}} {{phoneHref}} {{phoneLink}} {{phone2}} {{phone2Href}}
 *   {{telegramHref}} {{whatsappHref}} {{maxHref}} {{instagramHref}} {{vkHref}}
 *   {{twogisHref}} {{yandexMapsHref}} {{allLinksHref}}
 *   {{city}} {{street}} {{address}} {{hours}} {{year}} {{brand}} {{rating}} {{domain}}
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SiteRender = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var ASSET_V = '20261106';
  var UI_DEF = { railHint: 'Листайте вбок', close: 'Закрыть', skip: 'К основному содержанию', menu: 'Меню', e404title: 'Такой страницы <em>нет</em>',
    e404text: 'Возможно, ссылка устарела. Все процедуры, цены и контакты — на главной странице.', e404btn: 'На главную', updatedPrefix: 'Информация на сайте актуальна на' };
  var UI = UI_DEF;
  function setUI(d) { UI = {}; for (var k in UI_DEF) UI[k] = d && d.ui && d.ui[k] != null && String(d.ui[k]).trim() !== '' ? d.ui[k] : UI_DEF[k]; }

  /* ===================== утилиты ===================== */
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function attr(s) { return esc(s); }
  var ENT = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', laquo: '«', raquo: '»', mdash: '—', ndash: '–', hellip: '…', rarr: '→', larr: '←', middot: '·', '#39': "'", apos: "'" };
  function decode(s) {
    return String(s).replace(/&(#\d+|#x[0-9a-f]+|\w+);/gi, function (m, e) {
      if (e[0] === '#') {
        var n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return isNaN(n) ? m : String.fromCharCode(n);
      }
      return ENT[e.toLowerCase()] != null ? ENT[e.toLowerCase()] : m;
    });
  }
  /** HTML → обычный текст (для мета-тегов, JSON-LD, llms.txt) */
  function plain(html) {
    if (html == null) return '';
    var s = String(html).replace(/<br\s*\/?>/gi, ' ').replace(/<\/(p|li|h\d|div)>/gi, ' ')
      .replace(/<[^>]+>/g, '');
    return decode(s).replace(/\s+/g, ' ').trim();
  }
  /** HTML → markdown-текст (жирный и абзацы сохраняются) */
  function md(html) {
    if (html == null) return '';
    var s = String(html)
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
      .replace(/<(b|strong)>(.*?)<\/\1>/gi, '**$2**')
      .replace(/<a [^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gi, function (m, h, t) { return /^(tel:|#)/.test(h) ? t : '[' + t + '](' + h + ')'; })
      .replace(/<[^>]+>/g, '');
    return decode(s).replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim();
  }
  function arr(a) { return Array.isArray(a) ? a : []; }
  function nonEmpty(s) { return s != null && String(s).trim() !== ''; }
  function digits(s) { return String(s || '').replace(/[^\d+]/g, ''); }
  function telHref(p) { var d = digits(p); if (!d) return ''; if (d[0] === '8' && d.length === 11) d = '+7' + d.slice(1); if (d[0] !== '+') d = '+' + d; return 'tel:' + d; }
  function priceNum(s) { var t = plain(s); if (!/\d/.test(t)) return null; var n = parseInt(t.replace(/[^\d]/g, ''), 10); return isNaN(n) ? null : n; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /** Домен → https://host/ (кириллица переводится в punycode) */
  function hostOf(domain) {
    var d = String(domain || '').trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
    if (!d) return '';
    try { return new URL('https://' + d).hostname; } catch (e) { return d.toLowerCase(); }
  }
  function siteUrl(data, opts) {
    var h = hostOf(data.settings && data.settings.domain);
    if (h) return 'https://' + h + '/';
    return (opts && opts.fallbackUrl) || '/';
  }
  function abs(url, p) {
    if (!p) return '';
    if (/^(https?:)?\/\//i.test(p) || /^(data|blob):/i.test(p)) return p;
    if (url === '/') return '/' + String(p).replace(/^\//, '');
    return url + String(p).replace(/^\//, '');
  }

  /* ===================== подстановки ===================== */
  function tokens(data) {
    var c = data.contacts || {};
    var phoneHref = telHref(c.phone), phone2Href = telHref(c.phone2);
    var year = String((data.updated || '').slice(0, 4) || new Date().getFullYear());
    return {
      phone: esc(c.phone || ''), phoneHref: phoneHref,
      phoneLink: '<a class="gold" href="' + phoneHref + '" style="border-bottom:1px solid rgba(188,164,120,.4)">' + esc(c.phone || '') + '</a>',
      phone2: esc(c.phone2 || ''), phone2Href: phone2Href,
      telegramHref: c.telegram || '', whatsappHref: c.whatsapp || '', maxHref: c.max || '',
      instagramHref: c.instagram || '', vkHref: c.vk || '', twogisHref: c.twogis || '',
      yandexMapsHref: c.yandexMaps || '', allLinksHref: c.allLinks || '',
      city: esc(c.city || ''), street: esc(c.street || ''),
      address: esc([c.city, c.street].filter(Boolean).join(', ')),
      hours: esc(c.hours || ''), year: '<span id="yr">' + year + '</span>', yearPlain: year,
      brand: esc((data.brand || {}).name || ''), rating: esc(c.rating || ''),
      domain: esc((data.settings || {}).domain || '')
    };
  }
  function applyTokens(o, T, skip) {
    if (typeof o === 'string') {
      if (o.indexOf('{{') < 0) return o;
      return o.replace(/\{\{\s*(\w+)\s*\}\}/g, function (m, k) { return T[k] != null ? T[k] : m; });
    }
    if (Array.isArray(o)) return o.map(function (x) { return applyTokens(x, T, skip); });
    if (o && typeof o === 'object') {
      var r = {};
      for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) r[k] = skip && skip[k] ? o[k] : applyTokens(o[k], T, skip);
      return r;
    }
    return o;
  }

  /* ===================== кирпичики разметки ===================== */
  function img(o, extra, lazy) {
    if (!o || !o.src) return '';
    var a = '<img src="' + attr(o.src) + '" alt="' + attr(o.alt || '') + '"';
    if (o.w && o.h) a += ' width="' + (+o.w) + '" height="' + (+o.h) + '"';
    if (lazy !== false) a += ' loading="lazy"';
    a += ' decoding="async"';
    if (extra) a += ' ' + extra;
    return a + '>';
  }
  function btn(b, extraCls) {
    if (!b || !nonEmpty(b.label)) return '';
    var cls = 'btn' + (b.small ? ' btn-sm' : '') + (b.style === 'fill' ? ' btn-fill' : '') + (extraCls ? ' ' + extraCls : '');
    var inner = '<span>' + b.label + '</span>' + (b.arrow ? '<span class="arw">→</span>' : '');
    if (b.sheet) return '<button class="' + cls + '" type="button" data-sheet="' + attr(b.sheet) + '">' + inner + '</button>';
    var tgt = (b.newTab || /^https?:/i.test(b.href || '')) && !/^#/.test(b.href || '') ? ' target="_blank" rel="noopener"' : '';
    return '<a class="' + cls + '" href="' + attr(b.href || '#') + '"' + tgt + '>' + inner + '</a>';
  }
  function btns(list) { return arr(list).map(function (b) { return btn(b); }).join('\n'); }
  function eyebrow(t, extra) { return nonEmpty(t) ? '<p class="eyebrow rv-t' + (extra ? ' ' + extra : '') + '">' + t + '</p>' : ''; }
  function ticks(list, style) {
    var a = arr(list).filter(nonEmpty);
    if (!a.length) return '';
    return '<ul class="ticks"' + (style ? ' style="' + style + '"' : '') + '>' + a.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ul>';
  }
  function railNav(labelPrev, labelNext) {
    return '<div class="rail-nav">\n<button class="rail-btn prev" type="button" aria-label="' + attr(labelPrev) + '"></button>\n<button class="rail-btn next" type="button" aria-label="' + attr(labelNext) + '"></button>\n</div>';
  }
  var BG = { dark: '', ink2: 'on-ink2', ink3: 'on-ink3', light: 'on-light', cream: 'on-cream' };
  var RAILBG = { dark: '', ink2: 'var(--e-900)', ink3: 'var(--e-850)', light: 'var(--sage)', cream: 'var(--paper)' };
  function bgCls(s, def) { var k = s.bg || def || 'dark'; return BG[k] != null ? BG[k] : ''; }
  function railStyle(s, def) { var v = RAILBG[s.bg || def || 'dark']; return v ? ' style="--rail-bg:' + v + '"' : ''; }
  var DLY = ['', ' d1', ' d1', ' d2', ' d2', ' d3', ' d3'];
  function figure(p, i, lazyFirst) {
    return '<figure class="rail-fig' + (p.wide ? ' w' : '') + ' rv-i' + (DLY[i] || '') + '">' +
      img(p, '', lazyFirst) + (nonEmpty(p.caption) ? '<figcaption>' + esc(p.caption) + '</figcaption>' : '') + '</figure>';
  }
  function secId(s) { return attr(s.id || ''); }

  /* ===================== разделы ===================== */
  var R = {};

  R.hero = function (s) {
    var facts = arr(s.facts).filter(function (f) { return nonEmpty(f.big) || nonEmpty(f.small); });
    var mob = s.imageMobile && s.imageMobile.src ? '<source media="(max-width:760px)" srcset="' + attr(s.imageMobile.src) + '"' +
      (s.imageMobile.w ? ' width="' + s.imageMobile.w + '" height="' + s.imageMobile.h + '"' : '') + '>\n' : '';
    return '<section id="' + secId(s) + '">\n' +
      '<div class="bg px" data-px="0.08">\n<picture>\n' + mob +
      img(s.image, 'fetchpriority="high"', false) + '\n</picture>\n</div>\n' +
      '<div class="glow" aria-hidden="true"></div>\n' +
      '<div class="inner wrap">\n' +
      (s.seal && s.seal.src ? img({ src: s.seal.src, alt: '', w: s.seal.w, h: s.seal.h }, 'class="seal"', false) + '\n' : '') +
      '<h1 class="h-xl">' + (nonEmpty(s.kicker) ? '<span class="kick">' + s.kicker + '</span> ' : '') +
      '<span class="l1"><span>' + (s.line1 || '') + '</span></span> <span class="l2"><span>' + (s.line2 || '') + '</span></span></h1>\n' +
      (nonEmpty(s.sub) ? '<p class="lead sub">' + s.sub + '</p>\n' : '') +
      '<div class="cta">\n' + btns(s.buttons) + '\n</div>\n' +
      (facts.length ? '<div class="facts">\n' + facts.map(function (f) { return '<div><b>' + (f.big || '') + '</b><span>' + (f.small || '') + '</span></div>'; }).join('\n') + '\n</div>\n' : '') +
      '</div>\n' +
      (nonEmpty(s.scrollHint) ? '<div class="scroll-hint">' + esc(s.scrollHint) + '</div>\n' : '') +
      '</section>';
  };

  R.marquee = function (s) {
    var items = arr(s.items).filter(nonEmpty);
    if (!items.length) return '';
    var row = items.map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('');
    return '<section id="' + secId(s) + '" aria-hidden="true">\n<div class="track">\n' + row + '\n' + row + '\n</div>\n</section>';
  };

  R.about = function (s) {
    return '<section id="' + secId(s) + '" class="sec ' + bgCls(s, 'light') + '">\n<div class="wrap">\n<div class="split">\n' +
      '<div class="split-media frame rv rv-i">\n' + img(s.image) + '\n' + (nonEmpty(s.caption) ? '<span class="cap">' + esc(s.caption) + '</span>\n' : '') + '</div>\n' +
      '<div class="rv rv-d1">\n' + eyebrow(s.eyebrow) + '\n<h2 class="h-lg">' + (s.title || '') + '</h2>\n' +
      (nonEmpty(s.lead) ? '<p class="lead" style="margin-top:18px">' + s.lead + '</p>\n' : '') +
      (nonEmpty(s.body) ? '<p class="body" style="margin-top:14px">' + s.body + '</p>\n' : '') +
      ticks(s.ticks, 'margin-top:22px') + '\n' +
      (s.link && nonEmpty(s.link.label) ? '<div style="margin-top:26px"><a class="link-u" href="' + attr(s.link.href) + '"><span>' + esc(s.link.label) + '</span><span class="arw">→</span></a></div>\n' : '') +
      '</div>\n</div>\n</div>\n</section>';
  };

  R.headspa = function (s) {
    var gal = arr(s.gallery).filter(function (p) { return p && p.src; });
    var stages = arr(s.stages);
    return '<section id="' + secId(s) + '" class="sec">\n<div class="mist" aria-hidden="true"></div>\n<div class="wrap">\n' +
      '<div class="hs-head rv">\n' + eyebrow(s.eyebrow, 'c') + '\n' +
      '<h2 class="h-lg hs-title">' + (nonEmpty(s.titleEn) ? '<span class="en">' + esc(s.titleEn) + '</span>' : '') + (s.title || '') + '</h2>\n' +
      (nonEmpty(s.lead) ? '<p class="lead hs-lead">' + s.lead + '</p>\n' : '') + '</div>\n' +
      (gal.length ? '<div class="rv rv-d1" style="margin-top:clamp(26px,3.4vw,42px)">\n<div class="rail-head">\n<p class="small" style="margin:0">' + esc(s.galleryNote || '') + '</p>\n' +
        railNav('Предыдущие кадры', 'Следующие кадры') + '\n</div>\n<div class="rail-wrap" style="--rail-bg:var(--e-900)">\n' +
        '<div class="rail" data-lb tabindex="0" role="group" aria-label="Фотографии процедуры Head SPA">\n' +
        gal.map(function (p, i) { return figure(p, i); }).join('\n') + '\n</div>\n</div>\n<p class="rail-hint">' + UI.railHint + ' <span>→</span></p>\n</div>\n' : '') +
      '<div class="split rev" style="margin-top:clamp(42px,6vw,84px);align-items:start">\n' +
      '<div class="split-media rv rv-i" style="position:sticky;top:calc(var(--header-h) + 26px)">\n' + img(s.splitImage) + '\n</div>\n' +
      '<div class="rv rv-d1">\n' + eyebrow(s.splitEyebrow) + '\n<h3 class="h-md">' + (s.splitTitle || '') + '</h3>\n' +
      (nonEmpty(s.splitBody) ? '<p class="body" style="margin-top:14px">' + s.splitBody + '</p>\n' : '') +
      ticks(s.splitTicks, 'margin-top:20px') + '\n' +
      (s.quote && nonEmpty(s.quote.text) ? '<div class="pull" style="margin-top:28px">\n<p>' + s.quote.text + '</p>\n' + (nonEmpty(s.quote.cite) ? '<cite>' + esc(s.quote.cite) + '</cite>\n' : '') + '</div>\n' : '') +
      '</div>\n</div>\n' +
      (stages.length ? '<div class="rv" style="margin-top:clamp(42px,6vw,80px)">\n<div class="rail-head">\n<div>\n' + eyebrow(s.stagesEyebrow) + '\n<h3 class="h-md">' + (s.stagesTitle || '') + '</h3>\n</div>\n' +
        railNav('Предыдущие этапы', 'Следующие этапы') + '\n</div>\n<div class="rail-wrap" style="--rail-bg:var(--e-900)">\n' +
        '<ol class="stages rail" tabindex="0" role="group" aria-label="Этапы ритуала Head SPA">\n' +
        stages.map(function (t) { return '<li><h4>' + (t.title || '') + '</h4><p>' + (t.text || '') + '</p></li>'; }).join('\n') +
        '\n</ol>\n</div>\n<p class="rail-hint">' + UI.railHint + ' <span>→</span></p>\n</div>\n' : '') +
      (nonEmpty(s.bottomText) || (s.bottomButton && nonEmpty(s.bottomButton.label)) ? '<div class="rv" style="margin-top:clamp(32px,4.4vw,56px);text-align:center">\n' +
        (nonEmpty(s.bottomText) ? '<p class="body" style="max-width:660px;margin:0 auto 20px">' + s.bottomText + '</p>\n' : '') + btn(s.bottomButton) + '\n</div>\n' : '') +
      '</div>\n</section>';
  };

  R.doctor = function (s) {
    var pr = arr(s.principles);
    var ims = arr(s.images).filter(function (p) { return p && p.src; });
    return '<section id="' + secId(s) + '" class="sec">\n<div class="mist" aria-hidden="true"></div>\n<div class="wrap">\n<div class="split">\n<div class="rv">\n' +
      eyebrow(s.eyebrow) + '\n<h2 class="h-lg">' + (s.title || '') + '</h2>\n' +
      (nonEmpty(s.lead) ? '<p class="lead" style="margin-top:20px">' + s.lead + '</p>\n' : '') +
      (nonEmpty(s.body) ? '<p class="body" style="margin-top:14px">' + s.body + '</p>\n' : '') +
      (pr.length ? '<ul class="princ">\n' + pr.map(function (p, i) {
        return '<li><span class="n">' + (i < 9 ? '0' : '') + (i + 1) + '</span><div><h4>' + (p.title || '') + '</h4><p>' + (p.text || '') + '</p></div></li>';
      }).join('\n') + '\n</ul>\n' : '') +
      '</div>\n<div class="rv rv-d1">\n' +
      (ims.length ? '<div class="pair frame rv-i">\n' + ims.map(function (p) { return img(p); }).join('\n') + '\n</div>\n' : '') +
      (nonEmpty(s.credTitle) ? '<ul class="cred" style="border-left:0;border-right:0">\n<li style="grid-column:1/-1"><b>' + s.credTitle + '</b><p>' + (s.credText || '') + '</p></li>\n</ul>\n' : '') +
      (s.quote && nonEmpty(s.quote.text) ? '<div class="pull" style="margin-top:24px">\n<p>' + s.quote.text + '</p>\n' + (nonEmpty(s.quote.cite) ? '<cite>' + esc(s.quote.cite) + '</cite>\n' : '') + '</div>\n' : '') +
      '</div>\n</div>\n</div>\n</section>';
  };

  function sectionHead(s, maxw, leadMt) {
    return '<div class="rv" style="max-width:' + (maxw || 800) + 'px">\n' + eyebrow(s.eyebrow) + '\n<h2 class="h-lg">' + (s.title || '') + '</h2>\n' +
      (nonEmpty(s.lead) ? '<p class="lead" style="margin-top:' + (leadMt || 18) + 'px">' + s.lead + '</p>\n' : '') +
      (nonEmpty(s.hint) ? '<p class="small" style="margin-top:12px">' + s.hint + '</p>\n' : '') + '</div>\n';
  }

  R.programs = function (s) {
    var items = arr(s.items);
    return '<section id="' + secId(s) + '" class="sec ' + bgCls(s, 'light') + '">\n<div class="wrap">\n' + sectionHead(s) +
      '<div class="prog rv rv-d1">\n' + items.map(function (p, i) {
        var tag = p.sheet ? 'button' : 'div';
        return '<' + tag + ' class="prow"' + (p.sheet ? ' type="button" data-sheet="' + attr(p.sheet) + '"' : '') + '>\n' +
          '<span class="p-n">' + (i < 9 ? '0' : '') + (i + 1) + '</span>\n' +
          '<span class="p-name">' + (p.name || '') + (nonEmpty(p.badge) ? '<span class="badge">' + esc(p.badge) + '</span>' : '') + (nonEmpty(p.sub) ? '<i>' + esc(p.sub) + '</i>' : '') + '</span>\n' +
          '<span class="p-dur">' + esc(p.dur || '') + '</span><span class="p-price">' + esc(p.price || '') + '</span>\n' +
          '<span class="p-go" aria-hidden="true"></span>\n</' + tag + '>';
      }).join('\n') + '\n</div>\n' +
      ((s.button && nonEmpty(s.button.label)) || nonEmpty(s.note) ? '<div class="rv" style="margin-top:clamp(26px,3.4vw,40px);display:flex;flex-wrap:wrap;gap:14px;align-items:center">\n' +
        btn(s.button) + '\n' + (nonEmpty(s.note) ? '<p class="small" style="max-width:440px;margin:0">' + s.note + '</p>\n' : '') + '</div>\n' : '') +
      '</div>\n</section>';
  };

  R.tiles = function (s) {
    var items = arr(s.items);
    var ims = arr(s.images).filter(function (p) { return p && p.src; });
    return '<section id="' + secId(s) + '" class="sec ' + bgCls(s, 'dark') + '">\n' + (s.mist ? '<div class="mist" aria-hidden="true"></div>\n' : '') + '<div class="wrap">\n' + sectionHead(s) +
      '<div class="tiles' + (+s.cols === 3 ? ' t3' : '') + ' rv rv-d1">\n' + items.map(function (t) {
        var tag = t.sheet ? 'button' : 'div';
        return '<' + tag + ' class="tile"' + (t.sheet ? ' type="button" data-sheet="' + attr(t.sheet) + '"' : ' style="cursor:default"') + '>\n' +
          '<div class="tile-h"><h3>' + (t.title || '') + '</h3>' + (nonEmpty(t.price) ? '<span class="t-price">' + t.price + '</span>' : '') + '</div>\n' +
          (nonEmpty(t.dur) ? '<span class="t-dur">' + t.dur + '</span>\n' : '') +
          (nonEmpty(t.lead) ? '<p class="t-lead">' + t.lead + '</p>\n' : '') +
          (t.sheet ? '<span class="t-more"><span>' + esc(t.more || 'Подробно') + '</span><span>→</span></span>\n' : '') +
          '</' + tag + '>';
      }).join('\n') + '\n</div>\n' +
      (nonEmpty(s.note) ? '<p class="small rv" style="margin-top:clamp(18px,2.4vw,26px);max-width:820px">' + s.note + '</p>\n' : '') +
      (ims.length ? '<div class="rv" style="margin-top:clamp(38px,5vw,58px)">\n<div class="split">\n' + ims.map(function (p, i) {
        return '<div class="split-media wide rv rv-i' + (i ? ' rv-d1' : '') + '">' + img(p) + '</div>';
      }).join('\n') + '\n</div>\n</div>\n' : '') +
      '</div>\n</section>';
  };

  R.band = function (s) {
    return '<section class="band" id="' + secId(s) + '">\n<div class="band-bg px" data-px="0.08">\n' + img(s.image) + '\n</div>\n' +
      '<div class="wrap band-in">\n<div class="rv">\n' + eyebrow(s.eyebrow) + '\n<h2 class="h-lg">' + (s.title || '') + '</h2>\n' +
      (nonEmpty(s.lead) ? '<p class="lead" style="margin-top:16px">' + s.lead + '</p>\n' : '') +
      (s.button && nonEmpty(s.button.label) ? '<div style="margin-top:24px">' + btn(s.button) + '</div>\n' : '') +
      '</div>\n</div>\n</section>';
  };

  R.laser = function (s) {
    var tabs = arr(s.tabs);
    var uid = secId(s);
    var tabBtns = tabs.map(function (t, i) {
      return '<button role="tab" id="tab-' + uid + '-' + i + '" aria-controls="pan-' + uid + '-' + i + '" aria-selected="' + (i ? 'false' : 'true') + '">' + esc(t.label || ('Вкладка ' + (i + 1))) + '</button>';
    }).join('\n');
    var panels = tabs.map(function (t, i) {
      var cols = arr(t.columns);
      return '<div class="tabpanel" id="pan-' + uid + '-' + i + '" role="tabpanel" aria-labelledby="tab-' + uid + '-' + i + '"' + (i ? ' hidden' : '') + '>\n<div class="ptbl-wrap">\n<table class="ptbl">\n' +
        (nonEmpty(t.caption) ? '<caption>' + esc(t.caption) + '</caption>\n' : '') +
        '<thead><tr>' + cols.map(function (c) { return '<th scope="col">' + esc(c) + '</th>'; }).join('') + '</tr></thead>\n<tbody>\n' +
        arr(t.rows).map(function (r) {
          var vals = arr(r.values), olds = arr(r.old);
          return '<tr' + (r.best ? ' class="best"' : '') + '><td>' + (r.name || '') + (nonEmpty(r.sub) ? '<small>' + esc(r.sub) + '</small>' : '') + '</td>' +
            vals.map(function (v, j) {
              return '<td data-l="' + attr(cols[j + 1] || '') + '"><span class="v">' + esc(v) + (nonEmpty(olds[j]) ? '<s>вместо ' + esc(olds[j]) + '</s>' : '') + '</span></td>';
            }).join('') + '</tr>';
        }).join('\n') + '\n</tbody>\n</table>\n</div>\n' +
        (nonEmpty(t.note) ? '<p class="tbl-note">' + t.note + '</p>\n' : '') + '</div>';
    }).join('\n');
    var ims = arr(s.images).filter(function (p) { return p && p.src; });
    return '<section id="' + uid + '" class="sec ' + bgCls(s, 'ink3') + '">\n<div class="mist" aria-hidden="true"></div>\n<div class="wrap">\n' +
      '<div class="split rev">\n<div class="split-media frame rv rv-i">\n' + img(s.image) + '\n</div>\n<div class="rv rv-d1">\n' +
      eyebrow(s.eyebrow) + '\n<h2 class="h-lg">' + (s.title || '') + '</h2>\n' +
      (nonEmpty(s.lead) ? '<p class="lead" style="margin-top:24px">' + s.lead + '</p>\n' : '') + ticks(s.ticks, 'margin-top:26px') + '\n</div>\n</div>\n' +
      (tabs.length ? '<div class="rv" style="margin-top:clamp(52px,7vw,90px)">\n<h3 class="h-md">' + (s.priceTitle || '') + '</h3>\n' +
        (tabs.length > 1 ? '<div class="tabs" role="tablist" aria-label="Прайс">\n' + tabBtns + '\n</div>\n' : '') + panels + '\n' +
        (nonEmpty(s.note) ? '<p class="tbl-note">' + s.note + '</p>\n' : '') +
        (s.button && nonEmpty(s.button.label) ? '<div style="margin-top:clamp(18px,2.4vw,26px)">' + btn(s.button) + '</div>\n' : '') + '</div>\n' : '') +
      (ims.length ? '<div class="grid g3 rv" style="margin-top:clamp(40px,5vw,64px)">\n' + ims.map(function (p, i) {
        return '<figure class="rv rv-i' + (i ? ' rv-d' + i : '') + '" style="margin:0">' + img(p, 'style="aspect-ratio:4/5;object-fit:cover;width:100%"') + '</figure>';
      }).join('\n') + '\n</div>\n' : '') +
      '</div>\n</section>';
  };

  R.brands = function (s) {
    var items = arr(s.items);
    return '<section id="' + secId(s) + '" class="sec-sm ' + bgCls(s, 'ink2') + '">\n<div class="wrap">\n<div class="rv" style="max-width:760px">\n' +
      eyebrow(s.eyebrow) + '\n<h2 class="h-md">' + (s.title || '') + '</h2>\n' + (nonEmpty(s.body) ? '<p class="body" style="margin-top:18px">' + s.body + '</p>\n' : '') + '</div>\n' +
      (items.length ? '<div class="rail-wrap"' + (railStyle(s, 'ink2') ? ' style="--rail-bg:' + RAILBG[s.bg || 'ink2'] + ';margin-top:clamp(22px,2.8vw,34px)"' : ' style="margin-top:clamp(22px,2.8vw,34px)"') + '>\n' +
        '<ul class="brands rail rv rv-d1" tabindex="0" role="group" aria-label="Профессиональные линии">\n' +
        items.map(function (b) { return '<li><b>' + (b.name || '') + '</b><span>' + (b.sub || '') + '</span></li>'; }).join('\n') +
        '\n</ul>\n</div>\n<p class="rail-hint">' + UI.railHint + ' <span>→</span></p>\n' : '') +
      (s.image && s.image.src ? '<div class="rv rv-i" style="margin-top:clamp(22px,2.6vw,32px)">\n' + img(s.image, 'class="rv-shelf" style="width:100%;aspect-ratio:16/9;object-fit:cover"') + '\n</div>\n' : '') +
      '</div>\n</section>';
  };

  R.gallery = function (s) {
    var ph = arr(s.photos).filter(function (p) { return p && p.src; });
    return '<section id="' + secId(s) + '" class="sec ' + bgCls(s, 'dark') + '">\n<div class="mist" aria-hidden="true"></div>\n<div class="wrap">\n' +
      '<div class="rv" style="max-width:840px">\n' + eyebrow(s.eyebrow) + '\n<h2 class="h-lg">' + (s.title || '') + '</h2>\n' +
      (nonEmpty(s.lead) ? '<p class="lead" style="margin-top:24px">' + s.lead + '</p>\n' : '') + '</div>\n' +
      '<div class="rv rv-d1" style="margin-top:clamp(24px,3.2vw,40px)">\n<div class="rail-head">\n<p class="small" style="margin:0">' + esc(s.note || '') + '</p>\n' +
      railNav('Предыдущие фотографии', 'Следующие фотографии') + '\n</div>\n<div class="rail-wrap"' + railStyle(s, 'dark') + '>\n' +
      '<div class="rail" data-lb tabindex="0" role="group" aria-label="' + attr(plain(s.title) || 'Фотографии') + '">\n' +
      ph.map(function (p, i) { return figure(p, i); }).join('\n') + '\n</div>\n</div>\n<p class="rail-hint">' + UI.railHint + ' <span>→</span></p>\n' +
      (nonEmpty(s.footnote) ? '<p class="small rv" style="margin-top:14px;max-width:760px">' + s.footnote + '</p>\n' : '') +
      '</div>\n</div>\n</section>';
  };

  R.timeline = function (s) {
    var st = arr(s.steps);
    return '<section id="' + secId(s) + '" class="sec ' + bgCls(s, 'light') + '">\n<div class="wrap">\n' + sectionHead(s, 820) +
      '<div class="rv rv-d1" style="margin-top:clamp(22px,3vw,34px)">\n<div class="rail-head">\n<p class="small" style="margin:0">' + esc(s.note || '') + '</p>\n' +
      railNav('Предыдущие шаги', 'Следующие шаги') + '\n</div>\n<div class="rail-wrap"' + railStyle(s, 'light') + '>\n' +
      '<ol class="tl rail" tabindex="0" role="group" aria-label="' + attr(plain(s.title) || 'Шаги') + '">\n' +
      st.map(function (t) { return '<li><span class="t">' + esc(t.time || '') + '</span><h4>' + (t.title || '') + '</h4><p>' + (t.text || '') + '</p></li>'; }).join('\n') +
      '\n</ol>\n</div>\n<p class="rail-hint">' + UI.railHint + ' <span>→</span></p>\n</div>\n</div>\n</section>';
  };

  R.gift = function (s) {
    return '<section id="' + secId(s) + '" class="sec-sm ' + bgCls(s, 'ink3') + '">\n<div class="wrap">\n<div class="gift">\n<div class="rv">\n' +
      eyebrow(s.eyebrow) + '\n<h2 class="h-md">' + (s.title || '') + '</h2>\n' +
      (nonEmpty(s.body) ? '<p class="body" style="margin-top:20px">' + s.body + '</p>\n' : '') + ticks(s.ticks, 'margin-top:24px') + '\n' +
      (arr(s.buttons).length ? '<div style="margin-top:30px;display:flex;flex-wrap:wrap;gap:14px">\n' + btns(s.buttons) + '\n</div>\n' : '') +
      '</div>\n' + (s.image && s.image.src ? '<div class="rv rv-i rv-d1 frame">\n' + img(s.image, 'style="width:100%;aspect-ratio:4/3;object-fit:cover"') + '\n</div>\n' : '') +
      '</div>\n</div>\n</section>';
  };

  R.faq = function (s) {
    var it = arr(s.items).filter(function (q) { return nonEmpty(q.q); });
    return '<section id="' + secId(s) + '" class="sec ' + bgCls(s, 'ink3') + '">\n<div class="wrap">\n' + sectionHead(s, 840, 22) +
      '<div class="faq rv rv-d1">\n' + it.map(function (q, i) {
        var a = String(q.a || '').trim();
        if (a && !/^<p[\s>]/i.test(a)) a = '<p>' + a + '</p>';
        return '<details' + (i === 0 ? ' open' : '') + '>\n<summary><h3>' + q.q + '</h3><span class="q-tog" aria-hidden="true"></span></summary>\n<div class="a">' + a + '</div>\n</details>';
      }).join('\n') + '\n</div>\n</div>\n</section>';
  };

  R.geo = function (s) {
    var facts = arr(s.facts).filter(function (f) { return nonEmpty(f.label) || nonEmpty(f.value); });
    var groups = arr(s.groups).filter(function (g) { return arr(g.items).length; });
    function dist(it) {
      var a = [];
      if (nonEmpty(it.km)) a.push(esc(it.km) + ' км');
      if (nonEmpty(it.min)) a.push('≈' + esc(it.min) + ' мин');
      return a.join(' · ');
    }
    return '<section id="' + secId(s) + '" class="sec ' + bgCls(s, 'light') + '">\n<div class="wrap">\n' + sectionHead(s, 860) +
      '<div class="geo rv rv-d1">\n' +
      (facts.length ? '<div class="geo-facts">\n' + (nonEmpty(s.factsTitle) ? '<h3>' + esc(s.factsTitle) + '</h3>\n' : '') + '<dl>\n' +
        facts.map(function (f) { return '<div><dt>' + esc(f.label) + '</dt><dd>' + (f.value || '') + '</dd></div>'; }).join('\n') + '\n</dl>\n</div>\n' : '') +
      (groups.length ? '<div class="geo-groups">\n' + groups.map(function (g) {
        return '<div class="geo-group">\n<h3>' + esc(g.title || '') + '</h3>\n<ul class="geo-list">\n' +
          arr(g.items).map(function (it) { return '<li><b>' + esc(it.name || '') + '</b><span>' + dist(it) + '</span></li>'; }).join('\n') + '\n</ul>\n</div>';
      }).join('\n') + '\n</div>\n' : '') +
      '</div>\n' + (nonEmpty(s.note) ? '<p class="small geo-note rv">' + s.note + '</p>\n' : '') +
      '</div>\n</section>';
  };

  R.contacts = function (s) {
    var rows = arr(s.rows).filter(function (r) { return nonEmpty(r.label) || nonEmpty(r.html); });
    return '<section id="' + secId(s) + '" class="sec">\n<div class="mist" aria-hidden="true"></div>\n<div class="wrap">\n' + sectionHead(s, 840, 22) +
      '<div class="ct rv rv-d1">\n<dl class="ct-rows">\n' + rows.map(function (r) {
        return '<div class="ct-row"><dt>' + esc(r.label || '') + '</dt><dd>' + (r.html || '') + (nonEmpty(r.small) ? '<small>' + r.small + '</small>' : '') + '</dd></div>';
      }).join('\n') + '\n</dl>\n' +
      '<div class="map-card">\n<div>\n<div class="map-pin"><i></i><b>' + (s.mapTitle || '') + '</b></div>\n' +
      (nonEmpty(s.mapText) ? '<p class="body" style="margin-top:22px">' + s.mapText + '</p>\n' : '') + '</div>\n<div>\n' +
      '<div class="map-links">\n' + arr(s.mapButtons).map(function (b) { return btn(Object.assign({}, b, { small: true })); }).join('\n') + '\n</div>\n' +
      '<div style="margin-top:22px;display:flex;flex-wrap:wrap;gap:14px">\n' + btns(s.buttons) + '\n</div>\n' +
      '</div>\n</div>\n</div>\n</div>\n</section>';
  };

  R.text = function (s) {
    var hasImg = s.image && s.image.src;
    var textCol = '<div class="rv' + (hasImg ? ' rv-d1' : '') + '"' + (hasImg ? '' : ' style="max-width:840px"') + '>\n' + eyebrow(s.eyebrow) + '\n<h2 class="h-lg">' + (s.title || '') + '</h2>\n' +
      (nonEmpty(s.lead) ? '<p class="lead" style="margin-top:20px">' + s.lead + '</p>\n' : '') +
      (nonEmpty(s.body) ? '<div class="body txt-body" style="margin-top:14px">' + (/^\s*</.test(s.body) ? s.body : '<p>' + s.body + '</p>') + '</div>\n' : '') +
      ticks(s.ticks, 'margin-top:22px') + '\n' +
      (arr(s.buttons).length ? '<div class="txt-btns">\n' + btns(s.buttons) + '\n</div>\n' : '') + '</div>\n';
    var body = hasImg ? '<div class="split' + (s.imageRight ? ' rev' : '') + '">\n<div class="split-media frame rv rv-i">\n' + img(s.image) + '\n</div>\n' + textCol + '</div>\n' : textCol;
    return '<section id="' + secId(s) + '" class="sec ' + bgCls(s, 'dark') + '">\n' + (s.mist ? '<div class="mist" aria-hidden="true"></div>\n' : '') +
      '<div class="wrap">\n' + body + '</div>\n</section>';
  };

  /* ===================== мини-страницы процедур ===================== */
  function renderSheet(sh) {
    var meta = arr(sh.meta).filter(function (m) { return nonEmpty(m.label) || nonEmpty(m.value); });
    return '<article class="sheet-src" id="' + attr(sh.id) + '"' + (sh.image ? ' data-img="' + attr(sh.image) + '"' : '') + '>\n' +
      (nonEmpty(sh.eyebrow) ? '<span class="sh-eyebrow">' + esc(sh.eyebrow) + '</span>\n' : '') +
      '<h2 class="sh-title">' + (sh.title || '') + '</h2>\n' +
      (nonEmpty(sh.lead) ? '<p class="sh-lead">' + sh.lead + '</p>\n' : '') +
      (meta.length ? '<div class="sh-meta">\n' + meta.map(function (m) { return '<div><span>' + esc(m.label) + '</span><b>' + (m.value || '') + '</b></div>'; }).join('\n') + '\n</div>\n' : '') +
      arr(sh.blocks).map(function (b) {
        var items = arr(b.items).filter(nonEmpty);
        var inner = b.kind === 'text' ? items.map(function (p) { return '<p>' + p + '</p>'; }).join('\n')
          : (b.kind === 'steps' ? '<ol class="sh-steps">' : '<ul class="sh-list">') + '\n' + items.map(function (p) { return '<li>' + p + '</li>'; }).join('\n') + '\n' + (b.kind === 'steps' ? '</ol>' : '</ul>') +
            arr(b.after).filter(nonEmpty).map(function (p) { return '\n<p style="margin-top:12px">' + p + '</p>'; }).join('');
        return '<section class="sh-blk' + (b.warn ? ' sh-warn' : '') + '"><h3>' + esc(b.title || '') + '</h3>\n' + inner + '\n</section>';
      }).join('\n') + '\n</article>';
  }

  /* ===================== JSON-LD ===================== */
  function collectOffers(d, url) {
    var out = [], sheets = {};
    arr(d.sheets).forEach(function (s) { sheets[s.id] = s; });
    function desc(id) { var s = sheets[id]; return s ? plain(s.lead) : ''; }
    arr(d.sections).forEach(function (s) {
      if (s.enabled === false) return;
      if (s.type === 'programs') arr(s.items).forEach(function (p) {
        out.push({ cat: plain(s.title) || 'SPA-программы', name: 'SPA-программа «' + plain(p.name) + '»' + (p.dur ? ', ' + plain(p.dur) : ''), price: p.price, desc: desc(p.sheet) || plain(p.sub), sheet: p.sheet });
      });
      if (s.type === 'tiles') arr(s.items).forEach(function (t) {
        out.push({ cat: plain(s.title) || plain(s.eyebrow), name: plain(t.title) + (t.dur && /\d/.test(plain(t.dur)) ? ', ' + plain(t.dur) : ''), price: t.price, desc: plain(t.lead), sheet: t.sheet });
      });
      if (s.type === 'laser') arr(s.tabs).forEach(function (tab) {
        var c1 = arr(tab.columns)[1] || '';
        arr(tab.rows).forEach(function (r) {
          out.push({ cat: plain(s.title) || 'Лазерная эпиляция', name: plain(s.title) + ': ' + plain(r.name) + (r.sub ? ' (' + plain(r.sub) + ')' : '') + (c1 ? ', ' + plain(c1) : ''), price: arr(r.values)[0], desc: '', sheet: '' });
        });
      });
    });
    return out;
  }
  function buildJsonLd(d, url, T) {
    var c = d.contacts || {}, o = d.org || {}, seo = d.seo || {}, b = d.brand || {};
    var id = url + '#salon';
    var images = [];
    var hero = arr(d.sections).filter(function (s) { return s.type === 'hero'; })[0];
    if (seo.ogImage) images.push(abs(url, seo.ogImage));
    if (hero && hero.image && hero.image.src) images.push(abs(url, hero.image.src));
    var offers = collectOffers(d, url);
    var cats = {};
    offers.forEach(function (of) {
      (cats[of.cat] = cats[of.cat] || []).push(of);
    });
    var catalog = Object.keys(cats).map(function (k) {
      return {
        '@type': 'OfferCatalog', name: k,
        itemListElement: cats[k].map(function (of) {
          var n = priceNum(of.price), from = /от/i.test(plain(of.price));
          var offer = { '@type': 'Offer', itemOffered: { '@type': 'Service', name: of.name, provider: { '@id': id } } };
          if (of.desc) offer.itemOffered.description = of.desc;
          if (of.sheet) offer.url = url + '#' + of.sheet;
          if (n != null) {
            offer.priceCurrency = 'RUB';
            if (from) offer.priceSpecification = { '@type': 'PriceSpecification', minPrice: n, priceCurrency: 'RUB' };
            else offer.price = n;
          }
          return offer;
        })
      };
    });
    var area = arr(seo.areaServed).filter(nonEmpty).map(function (n, i) {
      if (/муниципальный округ|район/i.test(n)) return { '@type': 'AdministrativeArea', name: n };
      if (i === 0) return { '@type': 'City', name: n };
      return { '@type': 'Place', name: n };
    });
    var same = [c.telegram, c.max, c.twogis, c.allLinks, c.vk, c.instagram].filter(nonEmpty);
    var salon = {
      '@type': ['BeautySalon', 'DaySpa'], '@id': id,
      name: b.name, alternateName: arr(b.alternateNames).filter(nonEmpty),
      description: plain(seo.llmsSummary || seo.description),
      url: url, image: images,
      logo: b.logo && b.logo.src ? { '@type': 'ImageObject', url: abs(url, b.logo.src), width: b.logo.w, height: b.logo.h } : undefined,
      telephone: c.phone, priceRange: o.priceRange, currenciesAccepted: 'RUB', paymentAccepted: o.payment,
      address: {
        '@type': 'PostalAddress', streetAddress: [c.street, c.addressNote].filter(nonEmpty).join(', '),
        addressLocality: c.city, addressRegion: c.region, postalCode: c.postalCode, addressCountry: c.country || 'RU'
      },
      geo: c.lat && c.lon ? { '@type': 'GeoCoordinates', latitude: +c.lat, longitude: +c.lon } : undefined,
      hasMap: [c.twogis, c.yandexMaps].filter(nonEmpty),
      openingHoursSpecification: c.opens ? [{ '@type': 'OpeningHoursSpecification', dayOfWeek: arr(c.days).map(function (x) {
        return { Mo: 'Monday', Tu: 'Tuesday', We: 'Wednesday', Th: 'Thursday', Fr: 'Friday', Sa: 'Saturday', Su: 'Sunday' }[x] || x;
      }), opens: c.opens, closes: c.closes }] : undefined,
      contactPoint: [c.phone, c.phone2].filter(nonEmpty).map(function (p) {
        return { '@type': 'ContactPoint', telephone: p, contactType: 'reservations', areaServed: 'RU', availableLanguage: 'ru' };
      }),
      areaServed: area, sameAs: same,
      founder: o.founder ? { '@id': url + '#founder' } : undefined,
      knowsAbout: arr(seo.knowsAbout).filter(nonEmpty),
      amenityFeature: [
        { '@type': 'LocationFeatureSpecification', name: 'Парковка рядом', value: true },
        { '@type': 'LocationFeatureSpecification', name: 'Отдельный вход с улицы', value: true }
      ],
      taxID: o.inn || undefined,
      identifier: [o.inn ? { '@type': 'PropertyValue', name: 'ИНН', value: o.inn } : null, o.ogrnip ? { '@type': 'PropertyValue', name: 'ОГРНИП', value: o.ogrnip } : null].filter(Boolean),
      hasOfferCatalog: catalog.length ? { '@type': 'OfferCatalog', name: 'Услуги и цены', itemListElement: catalog } : undefined
    };
    var graph = [salon];
    if (o.founder) graph.push({ '@type': 'Person', '@id': url + '#founder', name: o.founder, jobTitle: o.founderTitle, worksFor: { '@id': id } });
    graph.push({ '@type': 'WebSite', '@id': url + '#website', url: url, name: b.name, inLanguage: 'ru-RU', publisher: { '@id': id } });
    graph.push({
      '@type': 'WebPage', '@id': url + '#webpage', url: url, name: seo.title, description: seo.description,
      isPartOf: { '@id': url + '#website' }, about: { '@id': id }, inLanguage: 'ru-RU',
      primaryImageOfPage: images[0] ? { '@type': 'ImageObject', url: images[0] } : undefined,
      dateModified: d.updated || undefined
    });
    var faq = arr(d.sections).filter(function (s) { return s.type === 'faq' && s.enabled !== false; })[0];
    if (faq && arr(faq.items).length) graph.push({
      '@type': 'FAQPage', '@id': url + '#faq',
      mainEntity: arr(faq.items).filter(function (q) { return nonEmpty(q.q); }).map(function (q) {
        return { '@type': 'Question', name: plain(q.q), acceptedAnswer: { '@type': 'Answer', text: plain(q.a) } };
      })
    });
    return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, function (k, v) {
      if (v === undefined || v === '' || (Array.isArray(v) && !v.length)) return undefined;
      return v;
    }, 1).replace(/<\//g, '<\\/');
  }

  /* ===================== страница целиком ===================== */
  function renderIndex(D, opts) {
    opts = opts || {};
    var url = siteUrl(D, opts);
    var T = tokens(D);
    var d = applyTokens(D, T, { code: true, updated: true });
    setUI(d);
    var st = d.settings || {}, seo = d.seo || {}, b = d.brand || {}, c = d.contacts || {}, nav = d.nav || {}, f = d.footer || {}, m = d.music || {};
    var sections = arr(d.sections).filter(function (s) { return s && s.enabled !== false && R[s.type]; });
    var hero = sections.filter(function (s) { return s.type === 'hero'; })[0];
    var splashOn = st.splash && st.splash.enabled !== false && !opts.preview;
    var musicOn = m.enabled && m.src && !opts.noMusic;
    var colors = (d.theme && d.theme.colors) || {};
    var themeCss = Object.keys(colors).filter(function (k) { return /^[\w-]+$/.test(k) && /^#[0-9a-f]{3,8}$|^rgba?\(/i.test(colors[k]); })
      .map(function (k) { return '--' + k + ':' + colors[k]; }).join(';');
    var ogImg = abs(url, seo.ogImage || 'og-image.jpg');
    var label = [m.artist, m.title].filter(nonEmpty).join(' — ');
    var cfg = {
      splash: { min: (st.splash && +st.splash.minMs) || 2400 },
      card: [b.name, plain((d.brand || {}).headerSub || ''), '', o('ИНН', d.org && d.org.inn), o('ОГРНИП', d.org && d.org.ogrnip), '',
        o('Телефон', c.phone), o('Доп. телефон', c.phone2), o('Адрес', [c.city && ('г. ' + c.city), c.street, c.addressNote].filter(nonEmpty).join(', ')),
        o('Режим работы', c.hours), '', o('Telegram', c.telegram), o('WhatsApp', c.whatsapp), o('MAX', c.max), o('2ГИС', c.twogis), o('Все ссылки', c.allLinks), o('Сайт', url)]
        .filter(function (x) { return x !== null; }).join('\n').replace(/\n{3,}/g, '\n\n').trim(),
      music: musicOn ? { src: m.src, label: label, autoplay: m.autoplay !== false, volume: +m.volume || 0.35, loop: m.loop !== false,
        fadeMs: +m.fadeMs || 2500, rememberPause: m.rememberPause !== false, pauseOnHide: m.pauseOnHide !== false } : null
    };
    function o(k, v) { return nonEmpty(v) ? k + ': ' + v : null; }

    var H = [];
    H.push('<!DOCTYPE html>\n<html lang="ru" class="no-js">\n<head>\n<meta charset="utf-8">');
    H.push('<script>(function(){var r=document.documentElement;r.className=\'js' + (splashOn ? ' splash-on' : '') + '\';\n' +
      'try{if(window.self!==window.top)r.classList.add(\'is-embedded\')}catch(e){r.classList.add(\'is-embedded\')}\n' +
      'window.__spashStart=Date.now();' + (splashOn ? '\nsetTimeout(function(){r.classList.remove(\'splash-on\')},7000);' : '') + '})();</script>');
    H.push('<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">');
    H.push('<title>' + esc(plain(seo.title)) + '</title>');
    if (nonEmpty(seo.description)) H.push('<meta name="description" content="' + attr(plain(seo.description)) + '">');
    if (nonEmpty(seo.keywords)) H.push('<meta name="keywords" content="' + attr(seo.keywords) + '">');
    H.push('<meta name="robots" content="' + attr(opts.preview ? 'noindex, nofollow' : (seo.robots || 'index, follow')) + '">');
    H.push('<meta name="author" content="' + attr(b.name) + '">');
    H.push('<meta name="theme-color" content="' + attr(st.themeColor || '#04120E') + '">');
    H.push('<meta name="format-detection" content="telephone=no">');
    if (url !== '/') H.push('<link rel="canonical" href="' + attr(url) + '">');
    H.push('<meta name="geo.region" content="RU-IRK">');
    if (nonEmpty(c.city)) H.push('<meta name="geo.placename" content="' + attr(c.city) + '">');
    if (c.lat && c.lon) { H.push('<meta name="geo.position" content="' + c.lat + ';' + c.lon + '">'); H.push('<meta name="ICBM" content="' + c.lat + ', ' + c.lon + '">'); }
    H.push('');
    H.push('<meta property="og:type" content="website">');
    H.push('<meta property="og:site_name" content="' + attr(b.name) + '">');
    H.push('<meta property="og:locale" content="ru_RU">');
    H.push('<meta property="og:title" content="' + attr(plain(seo.ogTitle || seo.title)) + '">');
    H.push('<meta property="og:description" content="' + attr(plain(seo.ogDescription || seo.description)) + '">');
    if (url !== '/') H.push('<meta property="og:url" content="' + attr(url) + '">');
    H.push('<meta property="og:image" content="' + attr(ogImg) + '">');
    H.push('<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">');
    H.push('<meta property="og:image:alt" content="' + attr(b.name) + '">');
    H.push('<meta name="twitter:card" content="summary_large_image">');
    H.push('<meta name="twitter:title" content="' + attr(plain(seo.ogTitle || seo.title)) + '">');
    H.push('<meta name="twitter:description" content="' + attr(plain(seo.ogDescription || seo.description)) + '">');
    H.push('<meta name="twitter:image" content="' + attr(ogImg) + '">');
    if (nonEmpty(seo.yandexVerification)) H.push('<meta name="yandex-verification" content="' + attr(seo.yandexVerification) + '">');
    if (nonEmpty(seo.googleVerification)) H.push('<meta name="google-site-verification" content="' + attr(seo.googleVerification) + '">');
    if (nonEmpty(seo.bingVerification)) H.push('<meta name="msvalidate.01" content="' + attr(seo.bingVerification) + '">');
    H.push('');
    H.push('<link rel="icon" href="favicon.ico" sizes="any">\n<link rel="icon" type="image/png" sizes="32x32" href="favicon-32.png">\n<link rel="apple-touch-icon" href="apple-touch-icon.png">\n<link rel="manifest" href="site.webmanifest">');
    H.push('<link rel="preload" href="assets/fonts/inter-normal-cyr.woff2" as="font" type="font/woff2" crossorigin>\n<link rel="preload" href="assets/fonts/cormorant-garamond-normal-cyr.woff2" as="font" type="font/woff2" crossorigin>');
    if (hero && hero.image && hero.image.src) {
      if (hero.imageMobile && hero.imageMobile.src) {
        H.push('<link rel="preload" as="image" href="' + attr(hero.imageMobile.src) + '" media="(max-width:760px)" fetchpriority="high">');
        H.push('<link rel="preload" as="image" href="' + attr(hero.image.src) + '" media="(min-width:761px)" fetchpriority="high">');
      } else H.push('<link rel="preload" as="image" href="' + attr(hero.image.src) + '" fetchpriority="high">');
    }
    H.push('<link rel="stylesheet" href="assets/css/site.css?v=' + ASSET_V + '">');
    if (themeCss || nonEmpty(d.theme && d.theme.customCss)) H.push('<style id="theme">' + (themeCss ? ':root{' + themeCss + '}' : '') + (d.theme && d.theme.customCss ? '\n' + String(d.theme.customCss).replace(/<\/style/gi, '<\\/style') : '') + '</style>');
    if (url !== '/') H.push('<script type="application/ld+json">\n' + buildJsonLd(d, url, T) + '\n</script>');
    if (!opts.preview && nonEmpty(d.code && d.code.head)) H.push(d.code.head);
    H.push('</head>\n<body>\n');

    if (splashOn) H.push('<div id="splash" aria-hidden="true">\n<div class="sp-in">\n' +
      (b.logo && b.logo.src ? '<img src="' + attr(b.logo.src) + '" alt=""' + (b.logo.w ? ' width="' + b.logo.w + '" height="' + b.logo.h + '"' : '') + '>\n' : '') +
      '<span class="sp-line"></span>\n<span class="sp-name">' + (st.splash.name || '') + '</span>\n<span class="sp-sub">' + esc(st.splash.sub || '') + '</span>\n</div>\n</div>\n');
    if (st.progressBar !== false) H.push('<div id="prog" aria-hidden="true"><i></i></div>\n');
    H.push('<a href="#main" class="skip">' + esc(plain(UI.skip)) + '</a>\n<style>.skip{position:absolute;left:-9999px;top:0;z-index:200;background:var(--e-050);color:var(--e-900);padding:11px 18px;font-size:11px;letter-spacing:.1em}\n.skip:focus{left:var(--pad);top:12px}</style>\n');

    // шапка
    var homeHref = hero ? '#' + hero.id : '#main';
    H.push('<header id="hdr">\n<a href="' + attr(homeHref) + '" class="brand" aria-label="' + attr(b.name + ' — на главную') + '">\n' +
      img(b.logo, '', false) + '\n<span class="brand-txt">\n<b>' + esc(b.headerTop || '') + '</b>\n<span>' + esc(b.headerSub || '') + '</span>\n</span>\n</a>\n' +
      '<nav id="nav" aria-label="Основное меню">\n' + arr(nav.main).map(function (a) { return '<a href="' + attr(a.href) + '">' + esc(a.label) + '</a>'; }).join('\n') + '\n</nav>\n' +
      '<div class="hdr-act">\n' + (nonEmpty(c.phone) ? '<a class="hdr-tel" href="' + attr(T.phoneHref) + '">' + esc(c.phone) + '</a>\n' : '') +
      (nav.cta && nonEmpty(nav.cta.label) ? '<a class="btn btn-sm btn-fill" href="' + attr(nav.cta.href) + '"><span>' + esc(nav.cta.label) + '</span></a>\n' : '') +
      '</div>\n<button id="burger" aria-label="' + attr(plain(UI.menu)) + '" aria-expanded="false" aria-controls="mob"><i></i></button>\n</header>\n');
    H.push('<div id="mob" hidden>\n<nav aria-label="Мобильное меню">\n' + arr(nav.mobile).map(function (a) { return '<a href="' + attr(a.href) + '">' + esc(a.label) + '</a>'; }).join('\n') + '\n</nav>\n' +
      '<div class="mob-foot">\n' + (nonEmpty(c.phone) ? '<a class="btn btn-fill" href="' + attr(T.phoneHref) + '"><span>' + esc(c.phone) + '</span></a>\n' : '') +
      (nonEmpty(nav.mobileNote) ? '<p class="small" style="margin:0">' + nav.mobileNote + '</p>\n' : '') + '</div>\n</div>\n');

    H.push('<main id="main">\n');
    sections.forEach(function (s) {
      var html = R[s.type](s);
      if (html) H.push('<!-- ' + esc(s.type) + ' · #' + esc(s.id) + ' -->\n' + html + '\n');
    });
    H.push('</main>\n');

    // подвал
    var socials = arr(f.socials).filter(function (s) { return nonEmpty(s.href) && nonEmpty(s.label); });
    var legal = [];
    if (d.org) {
      if (nonEmpty(d.org.legalName)) legal.push('<div><dt>' + esc(d.org.legalForm || '') + '</dt><dd>' + esc(d.org.legalName) + '</dd></div>');
      if (nonEmpty(d.org.inn)) legal.push('<div><dt>ИНН</dt><dd><button type="button" id="innBtn" class="inn" data-copied="' + attr(d.org.innCopied || 'Скопировано') + '"><span>' + esc(d.org.inn) + '</span></button></dd></div>');
      if (nonEmpty(d.org.ogrnip)) legal.push('<div><dt>ОГРНИП</dt><dd>' + esc(d.org.ogrnip) + '</dd></div>');
    }
    H.push('<footer id="foot">\n<div class="wrap">\n<div class="foot-top">\n<div class="foot-brand">\n' +
      img(b.footerLogo && b.footerLogo.src ? b.footerLogo : b.logo) + '\n' +
      (nonEmpty(f.text) ? '<p class="small" style="max-width:340px">' + f.text + '</p>\n' : '') +
      (socials.length ? '<div class="socials">\n' + socials.map(function (s) {
        var ext = /^https?:/i.test(s.href);
        return '<a href="' + attr(s.href) + '"' + (ext ? ' target="_blank" rel="noopener' + (s.nofollow ? ' nofollow' : '') + '"' : '') + '>' + esc(s.label) + '</a>';
      }).join('\n') + '\n</div>\n' : '') + '</div>\n' +
      arr(f.columns).map(function (col) {
        return '<div class="foot-col">\n<h5>' + esc(col.title || '') + '</h5>\n<ul>\n' + arr(col.links).map(function (a) { return '<li><a href="' + attr(a.href) + '">' + esc(a.label) + '</a></li>'; }).join('\n') + '\n</ul>\n</div>';
      }).join('\n') + '\n' +
      '<div class="foot-col">\n<h5>' + esc(f.contactsTitle || 'Контакты') + '</h5>\n<ul>\n' +
      (nonEmpty(c.phone) ? '<li><a href="' + attr(T.phoneHref) + '">' + esc(c.phone) + '</a></li>\n' : '') +
      (nonEmpty(c.phone2) ? '<li><a href="' + attr(T.phone2Href) + '">' + esc(c.phone2) + '</a></li>\n' : '') +
      (nonEmpty(c.street) ? '<li><a href="' + attr(c.twogis || '#contacts') + '"' + (c.twogis ? ' target="_blank" rel="noopener"' : '') + '>' + esc([c.city, c.street].filter(nonEmpty).join(', ')) + '</a></li>\n' : '') +
      (nonEmpty(c.hours) ? '<li style="color:var(--on-dark-mute);font-size:14.5px">' + esc(c.hours) + '</li>\n' : '') +
      '</ul>\n' + (nonEmpty(f.ctaLabel) ? '<div style="margin-top:22px"><a class="btn btn-sm btn-fill" href="' + attr(f.ctaHref || T.phoneHref) + '"><span>' + esc(f.ctaLabel) + '</span></a></div>\n' : '') +
      '</div>\n</div>\n' +
      '<div class="foot-bot">\n<p>' + (f.copyright || '') + '</p>\n' + (nonEmpty(f.offer) ? '<p>' + f.offer + '</p>\n' : '') + '</div>\n' +
      (nonEmpty(f.disclaimer) ? '<p class="disclaimer">' + f.disclaimer + '</p>\n' : '') +
      (nonEmpty(f.note) ? '<p class="foot-note">' + f.note + '</p>\n' : '') +
      (st.showUpdated !== false && d.updated ? '<p class="foot-note">' + UI.updatedPrefix + ' ' + esc(fmtDate(d.updated)) + '</p>\n' : '') +
      '<div class="legal">\n' + (legal.length ? '<dl class="legal-rows">\n' + legal.join('\n') + '\n</dl>\n' : '') +
      (d.org && d.org.madeBy && nonEmpty(d.org.madeBy.label) ? '<p class="made"><a href="' + attr(d.org.madeBy.href || '#') + '" target="_blank" rel="noopener">' + esc(d.org.madeBy.label) + '</a></p>\n' : '') +
      '</div>\n</div>\n</footer>\n');

    if (st.fab && st.fab.enabled !== false && nonEmpty(st.fab.label)) H.push('<div id="fab"><a class="btn btn-fill" href="' + attr(st.fab.href || T.phoneHref) + '"><span>' + esc(st.fab.label) + '</span></a></div>\n');

    // мини-страницы
    H.push('<!-- Тексты процедур лежат в разметке, чтобы их видели поисковики и нейросети; на экране открываются в панели -->\n<div id="sheets" hidden>\n' +
      arr(d.sheets).map(renderSheet).join('\n\n') + '\n</div>\n');
    var sp = d.sheetPanel || {};
    H.push('<div id="sheet" role="dialog" aria-modal="true" aria-labelledby="shTitleRef" hidden>\n<div class="sh-back" data-close></div>\n<div class="sh-panel" role="document">\n' +
      '<button class="sh-x" type="button" id="shX" data-close><span>' + esc(plain(UI.close)) + '</span><i aria-hidden="true"></i></button>\n' +
      '<figure class="sh-img" id="shImg" hidden></figure>\n<div class="sh-body" id="shBody"></div>\n<div class="sh-body" style="padding-top:0">\n<div class="sh-cta">\n' +
      (nonEmpty(sp.text) ? '<p class="small">' + sp.text + '</p>\n' : '') + btns(sp.buttons) + '\n</div>\n</div>\n</div>\n</div>\n');
    H.push('<div id="lb" role="dialog" aria-modal="true" aria-label="Просмотр фотографии" hidden>\n<span class="lb-i" id="lbI"></span>\n' +
      '<button class="lb-x" id="lbX" aria-label="Закрыть">✕</button>\n<button class="lb-p" id="lbP" aria-label="Предыдущее фото">‹</button>\n' +
      '<img id="lbImg" src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" alt="">\n' +
      '<button class="lb-n" id="lbN" aria-label="Следующее фото">›</button>\n<p class="lb-cap" id="lbC"></p>\n</div>\n');
    if (musicOn && m.showButton !== false) H.push('<div id="music"' + (m.position === 'right' ? ' class="right"' : '') + '><button class="mu-btn" type="button" aria-pressed="false" aria-label="Включить музыку: ' + attr(label) + '"><i></i><i></i><i></i><i></i></button><span class="mu-cap">' + esc(label || m.hint || 'Музыка') + '</span></div>\n');
    else if (musicOn) H.push('<div id="music" hidden><button class="mu-btn" type="button"></button></div>\n');
    H.push('<style>\nhtml.is-embedded #hdr{position:sticky}\nhtml.is-embedded #fab{display:none}\nhtml.is-embedded #hero{min-height:84vh}\n</style>\n');
    H.push('<script id="site-cfg" type="application/json">' + JSON.stringify(cfg).replace(/<\//g, '<\\/') + '</script>\n');
    H.push('<script src="assets/js/site.js?v=' + ASSET_V + '" defer></script>\n');
    if (!opts.preview && nonEmpty(d.code && d.code.bodyEnd)) H.push(d.code.bodyEnd + '\n');
    H.push('</body>\n</html>\n');
    return H.join('\n');
  }

  var MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  function fmtDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
    return m ? (+m[3]) + ' ' + MONTHS[+m[2] - 1] + ' ' + m[1] + ' г.' : iso;
  }

  /* ===================== служебные файлы ===================== */
  var AI_BOTS = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot', 'Perplexity-User',
    'Google-Extended', 'Applebot-Extended', 'YandexAdditional', 'YandexAdditionalBot', 'GigaBot', 'Bingbot', 'CCBot'];
  function robots(d, url) {
    var dis = 'Disallow: /admin/\nDisallow: /content/\nDisallow: /core/\nDisallow: /tools/\n';
    var out = '# robots.txt — ' + ((d.brand || {}).name || '') + '\n\nUser-agent: *\nAllow: /\n' + dis + '\n' +
      'User-agent: Yandex\nAllow: /\n' + dis + 'Clean-param: utm_source&utm_medium&utm_campaign&utm_content&utm_term&yclid&gclid&fbclid&from&ysclid /\n\n' +
      'User-agent: Googlebot\nAllow: /\n' + dis + '\n';
    var allow = (d.seo || {}).allowAiBots !== false;
    out += '# Нейросети и ИИ-поиск: ' + (allow ? 'разрешено читать сайт, чтобы студия попадала в ответы' : 'запрещено') + '\n';
    AI_BOTS.forEach(function (b) { out += 'User-agent: ' + b + '\n' + (allow ? 'Allow: /\n' + dis : 'Disallow: /\n') + '\n'; });
    if (url !== '/') out += 'Sitemap: ' + url + 'sitemap.xml\n';
    return out;
  }
  function collectImages(d) {
    var set = [], seen = {};
    (function walk(o) {
      if (!o) return;
      if (typeof o === 'string') {
        if (/^assets\/img\/[^"'\s]+\.(webp|jpe?g|png|avif|gif|svg)$/i.test(o) && !seen[o]) { seen[o] = 1; set.push(o); }
        return;
      }
      if (Array.isArray(o)) { o.forEach(walk); return; }
      if (typeof o === 'object') for (var k in o) if (k !== 'code') walk(o[k]);
    })(d);
    return set;
  }
  function sitemap(d, url) {
    if (url === '/') return '';
    var imgs = collectImages(d);
    return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n' +
      '<url>\n<loc>' + esc(url) + '</loc>\n' + (d.updated ? '<lastmod>' + esc(d.updated) + '</lastmod>\n' : '') + '<changefreq>weekly</changefreq>\n<priority>1.0</priority>\n' +
      imgs.map(function (p) { return '<image:image><image:loc>' + esc(abs(url, p)) + '</image:loc></image:image>'; }).join('\n') +
      '\n</url>\n</urlset>\n';
  }

  function llms(d, url, full) {
    var T = tokens(d);
    d = applyTokens(d, T, { code: true });
    var c = d.contacts || {}, o = d.org || {}, seo = d.seo || {}, b = d.brand || {};
    var L = [];
    L.push('# ' + b.name);
    L.push('');
    L.push('> ' + plain(seo.llmsSummary || seo.description));
    L.push('');
    L.push('Сайт: ' + url + (d.updated ? ' · Данные актуальны на ' + d.updated : ''));
    L.push('');
    L.push('## Главное');
    var alt = arr(b.alternateNames).filter(nonEmpty);
    L.push('- Что это: ' + b.name + (alt.length ? ' (также: ' + alt.join('; ') + ')' : '') + ' — SPA-салон и кабинет косметологии');
    L.push('- Адрес: ' + [c.region, 'г. ' + c.city, c.street, c.addressNote].filter(nonEmpty).join(', ') + (c.postalCode ? ', индекс ' + c.postalCode : ''));
    if (c.district || c.microdistrict) L.push('- Район: ' + [c.district, c.microdistrict && ('микрорайон ' + c.microdistrict)].filter(nonEmpty).join(', ') + ', набережная Ангары');
    if (c.lat) L.push('- Координаты: ' + c.lat + ', ' + c.lon);
    L.push('- Режим работы: ' + plain(c.hours) + ', по предварительной записи');
    L.push('- Телефоны: ' + [c.phone, c.phone2].filter(nonEmpty).join(', '));
    var ms = [['Telegram', c.telegram], ['WhatsApp', c.whatsapp], ['MAX', c.max]].filter(function (x) { return nonEmpty(x[1]); });
    if (ms.length) L.push('- Мессенджеры: ' + ms.map(function (x) { return x[0] + ' ' + x[1]; }).join(', '));
    if (c.rating) L.push('- Рейтинг: ' + c.rating + ' из 5 в ' + (c.ratingSource || '2ГИС') + (c.ratingCount ? ' (' + c.ratingCount + ' оценки, ' + c.reviewCount + ' отзывов' + (c.ratingChecked ? '; проверено: ' + c.ratingChecked : '') + ')' : ''));
    if (o.payment) L.push('- Оплата: ' + o.payment);
    if (o.founder) L.push('- Владелец и врач: ' + o.founder + ' — ' + (o.founderTitle || ''));
    if (o.inn) L.push('- Реквизиты: ' + (o.legalForm || 'ИП') + ', ИНН ' + o.inn + (o.ogrnip ? ', ОГРНИП ' + o.ogrnip : ''));
    if (arr(seo.areaServed).length) L.push('- Откуда приезжают: ' + arr(seo.areaServed).join(', '));
    L.push('');

    var secs = arr(d.sections).filter(function (s) { return s.enabled !== false; });
    L.push('## Услуги и цены');
    secs.forEach(function (s) {
      if (s.type === 'programs') {
        L.push('### ' + plain(s.title));
        arr(s.items).forEach(function (p) { L.push('- ' + plain(p.name) + ' — ' + plain(p.dur) + ' — ' + plain(p.price) + (p.sub ? ' — ' + plain(p.sub) : '') + (p.sheet ? ' (' + url + '#' + p.sheet + ')' : '')); });
        L.push('');
      }
      if (s.type === 'tiles') {
        L.push('### ' + (plain(s.eyebrow) && plain(s.title).length < 4 ? plain(s.eyebrow) : plain(s.title)));
        arr(s.items).forEach(function (t) { L.push('- ' + plain(t.title) + (t.price ? ' — ' + plain(t.price) : '') + (t.dur ? ' — ' + plain(t.dur) : '') + (full && t.lead ? '. ' + plain(t.lead) : '')); });
        L.push('');
      }
      if (s.type === 'laser') {
        L.push('### ' + plain(s.title));
        arr(s.tabs).forEach(function (tab) {
          var cols = arr(tab.columns);
          L.push(plain(tab.label || tab.caption) + ' (' + cols.slice(1).join(' / ') + ', ₽):');
          arr(tab.rows).forEach(function (r) {
            L.push('- ' + plain(r.name) + (r.sub ? ' (' + plain(r.sub) + ')' : '') + ': ' + arr(r.values).join(' / '));
          });
        });
        L.push('');
      }
    });
    var faq = secs.filter(function (s) { return s.type === 'faq'; })[0];
    var geo = secs.filter(function (s) { return s.type === 'geo'; })[0];
    if (geo) {
      L.push('## Как добраться');
      L.push(plain(geo.lead));
      arr(geo.groups).forEach(function (g) {
        L.push('- ' + plain(g.title) + ': ' + arr(g.items).map(function (it) { return plain(it.name) + ' — ' + it.km + ' км (≈' + it.min + ' мин)'; }).join('; '));
      });
      if (geo.note) L.push(plain(geo.note));
      L.push('');
    }
    if (!full) {
      if (faq) {
        L.push('## Частые вопросы');
        arr(faq.items).forEach(function (q) { var a = plain(q.a); L.push('- ' + plain(q.q) + ' — ' + (a.length > 260 ? a.slice(0, 257).replace(/\s+\S*$/, '') + '…' : a)); });
        L.push('');
      }
      L.push('## Ссылки');
      L.push('- [Полная информация для ИИ-ассистентов: все процедуры, показания и противопоказания](' + url + 'llms-full.txt)');
      L.push('- [Сайт](' + url + ')');
      if (c.twogis) L.push('- [Карточка и отзывы в 2ГИС](' + c.twogis + ')');
      if (c.yandexMaps) L.push('- [Яндекс Карты](' + c.yandexMaps + ')');
      if (c.allLinks) L.push('- [Все ссылки и онлайн-запись](' + c.allLinks + ')');
      if (c.telegram) L.push('- [Telegram](' + c.telegram + ')');
      L.push('');
      return L.join('\n');
    }
    // полная версия: тексты разделов и мини-страниц
    L.push('## О студии');
    secs.forEach(function (s) {
      if (['about', 'doctor', 'headspa', 'band', 'gallery', 'timeline', 'gift', 'text', 'brands'].indexOf(s.type) < 0) return;
      L.push('### ' + plain(s.title || s.eyebrow));
      ['lead', 'body', 'splitBody', 'bottomText'].forEach(function (k) { if (nonEmpty(s[k])) L.push(md(s[k])); });
      arr(s.ticks).concat(arr(s.splitTicks)).forEach(function (t) { L.push('- ' + md(t)); });
      arr(s.principles).forEach(function (p) { L.push('- **' + plain(p.title) + '.** ' + md(p.text)); });
      arr(s.stages).forEach(function (p, i) { L.push((i + 1) + '. **' + plain(p.title) + '.** ' + md(p.text)); });
      arr(s.steps).forEach(function (p) { L.push('- ' + plain(p.time) + ' — **' + plain(p.title) + '.** ' + md(p.text)); });
      arr(s.items).forEach(function (p) { if (p && p.name) L.push('- ' + plain(p.name) + ' — ' + plain(p.sub)); });
      L.push('');
    });
    L.push('## Процедуры подробно');
    arr(d.sheets).forEach(function (sh) {
      L.push('### ' + plain(sh.title));
      if (sh.eyebrow) L.push(plain(sh.eyebrow));
      if (sh.lead) L.push(md(sh.lead));
      arr(sh.meta).forEach(function (m) { L.push('- ' + plain(m.label) + ': ' + plain(m.value)); });
      arr(sh.blocks).forEach(function (bl) {
        L.push('#### ' + plain(bl.title));
        arr(bl.items).forEach(function (it, i) { L.push(bl.kind === 'text' ? md(it) : (bl.kind === 'steps' ? (i + 1) + '. ' : '- ') + md(it)); });
        arr(bl.after).forEach(function (it) { L.push(md(it)); });
      });
      L.push('Подробнее: ' + url + '#' + sh.id);
      L.push('');
    });
    if (faq) {
      L.push('## Вопросы и ответы');
      arr(faq.items).forEach(function (q) { L.push('### ' + plain(q.q)); L.push(md(q.a)); L.push(''); });
    }
    if (d.footer && d.footer.disclaimer) { L.push('## Важно'); L.push(plain(d.footer.disclaimer)); L.push(''); }
    return L.join('\n').replace(/\n{3,}/g, '\n\n');
  }

  function manifest(d) {
    var b = d.brand || {}, st = d.settings || {};
    return JSON.stringify({
      name: b.name, short_name: 'Студия Толмачевой', lang: 'ru', start_url: '/', display: 'standalone',
      background_color: (d.theme && d.theme.colors && d.theme.colors['e-950']) || '#04120E', theme_color: st.themeColor || '#04120E',
      icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }]
    }, null, 1) + '\n';
  }

  function page404(d, url) {
    setUI(d);
    var b = d.brand || {}, c = d.contacts || {};
    var base = url === '/' ? '' : '<base href="' + attr(url) + '">\n';
    return '<!DOCTYPE html>\n<html lang="ru">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n' + base +
      '<title>Страница не найдена — ' + esc(b.name) + '</title>\n<meta name="robots" content="noindex">\n<link rel="icon" href="favicon.ico" sizes="any">\n' +
      '<link rel="stylesheet" href="assets/css/site.css?v=' + ASSET_V + '">\n</head>\n<body>\n' +
      '<main class="sec" style="min-height:100vh;display:flex;align-items:center">\n<div class="wrap-n" style="text-align:center">\n' +
      (b.logo && b.logo.src ? '<img src="' + attr(b.logo.src) + '" alt="" width="84" height="84" style="margin:0 auto 26px;width:84px;opacity:.95">\n' : '') +
      '<p class="eyebrow c">Ошибка 404</p>\n<h1 class="h-lg">' + UI.e404title + '</h1>\n' +
      '<p class="lead" style="margin:18px auto 0;max-width:520px">' + UI.e404text + '</p>\n' +
      '<div style="margin-top:28px;display:flex;flex-wrap:wrap;gap:12px;justify-content:center">\n<a class="btn btn-fill" href="./"><span>' + esc(plain(UI.e404btn)) + '</span><span class="arw">→</span></a>\n' +
      (c.phone ? '<a class="btn" href="' + attr(telHref(c.phone)) + '"><span>' + esc(c.phone) + '</span></a>\n' : '') +
      '</div>\n</div>\n</main>\n</body>\n</html>\n';
  }

  /* ===================== проверки ===================== */
  function validate(d) {
    var w = [];
    var seo = d.seo || {};
    var t = plain(seo.title), ds = plain(seo.description);
    if (!t) w.push({ level: 'error', msg: 'Не заполнен заголовок страницы (SEO → Title).' });
    else if (t.length > 75) w.push({ level: 'warn', msg: 'Title длиннее 75 символов (' + t.length + ') — в выдаче обрежется.' });
    if (!ds) w.push({ level: 'error', msg: 'Не заполнено описание (SEO → Description).' });
    else if (ds.length > 200) w.push({ level: 'warn', msg: 'Description длиннее 200 символов (' + ds.length + ').' });
    if (!hostOf(d.settings && d.settings.domain)) w.push({ level: 'warn', msg: 'Не указан домен — canonical, sitemap и разметка будут без адреса.' });
    var ids = {}, sheetIds = {};
    arr(d.sheets).forEach(function (s) {
      if (!s.id) w.push({ level: 'error', msg: 'У процедуры «' + plain(s.title) + '» нет ID.' });
      else if (sheetIds[s.id]) w.push({ level: 'error', msg: 'Повторяется ID процедуры: ' + s.id });
      sheetIds[s.id] = 1;
    });
    arr(d.sections).forEach(function (s) {
      if (!s.id) w.push({ level: 'error', msg: 'У раздела типа «' + s.type + '» нет якоря (ID).' });
      else if (ids[s.id]) w.push({ level: 'error', msg: 'Повторяется якорь раздела: #' + s.id });
      ids[s.id] = 1;
      (function walk(o, path) {
        if (!o || typeof o !== 'object') return;
        if (Array.isArray(o)) { o.forEach(function (x, i) { walk(x, path); }); return; }
        if (o.sheet && !sheetIds[o.sheet]) w.push({ level: 'error', msg: 'Раздел #' + s.id + ': кнопка ссылается на несуществующую процедуру «' + o.sheet + '».' });
        if (o.src && /^assets\/img\//.test(o.src) && !nonEmpty(o.alt) && path.indexOf('seal') < 0 && path.indexOf('imageMobile') < 0)
          w.push({ level: 'info', msg: 'Раздел #' + s.id + ': у фото нет описания (alt) — ' + o.src.split('/').pop() });
        for (var k in o) if (o[k] && typeof o[k] === 'object') walk(o[k], path + '.' + k);
      })(s, s.id);
    });
    var h1 = arr(d.sections).filter(function (s) { return s.type === 'hero' && s.enabled !== false; });
    if (!h1.length) w.push({ level: 'warn', msg: 'Первый экран выключен — на странице не будет заголовка H1.' });
    return w;
  }

  /* ===================== всё вместе ===================== */
  function renderAll(data, opts) {
    opts = opts || {};
    var d = clone(data);
    var url = siteUrl(d, opts);
    var files = {};
    files['index.html'] = renderIndex(d, opts);
    if (!opts.preview) {
      files['404.html'] = page404(d, url);
      files['robots.txt'] = robots(d, url);
      var sm = sitemap(d, url); if (sm) files['sitemap.xml'] = sm;
      files['llms.txt'] = llms(d, url, false) + '\n';
      files['llms-full.txt'] = llms(d, url, true) + '\n';
      files['site.webmanifest'] = manifest(d);
      files['.nojekyll'] = '';
      var host = hostOf(d.settings && d.settings.domain);
      if (host && !/\.github\.io$/i.test(host)) files['CNAME'] = host + '\n';
      var key = d.seo && d.seo.indexNowKey;
      if (key && /^[a-zA-Z0-9-]{8,128}$/.test(key)) files[key + '.txt'] = key;
    }
    return { files: files, warnings: validate(d), url: url };
  }

  return {
    version: ASSET_V, renderAll: renderAll, renderIndex: renderIndex, validate: validate,
    plain: plain, esc: esc, hostOf: hostOf, siteUrl: siteUrl, collectImages: collectImages, telHref: telHref,
    sectionTypes: Object.keys(R)
  };
});
