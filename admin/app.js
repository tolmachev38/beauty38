/* admin/app.js — админка сайта. Без сборщиков и зависимостей.
   Данные: content/site.json в репозитории. Публикация: один коммит со всеми изменёнными файлами. */
(function () {
  'use strict';

  var SR = window.SiteRender, SCH = window.AdminSchema, GH = window.GitHub, GU = window.GitUtil;
  var LS_CFG = 'b38-admin-cfg', LS_API = 'b38-admin-api';
  var CONTENT = 'content/site.json';
  var SITE_BASE = new URL('../', location.href).href;

  var S = {
    cfg: null, gh: null, data: null, baseText: '', baseSha: null, repo: null,
    pending: {}, deletes: {}, repoFiles: null,
    view: { page: 'overview' }, undo: [], redo: [], snap: '',
    previewOn: window.innerWidth >= 1280, device: 'desktop', previewTarget: null
  };

  /* ===================== мелкие помощники ===================== */
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      var v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (var i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function add(el, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { add(el, x); }); return; }
    el.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
  }
  function $(s, c) { return (c || document).querySelector(s); }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function plain(s) { return SR.plain(s); }
  function slug(s) {
    var tr = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya' };
    return String(s || '').toLowerCase().split('').map(function (c) { return tr[c] != null ? tr[c] : c; }).join('')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48).replace(/-+$/, '') || 'file';
  }
  function rand() { return Math.random().toString(36).slice(2, 7); }
  function today() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function fmtTime(iso) { try { return new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }); } catch (e) { return iso; } }
  function kb(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + ' МБ' : Math.max(1, Math.round(n / 1024)) + ' КБ'; }
  function debounce(fn, ms) { var t; return function () { var a = arguments, s = this; clearTimeout(t); t = setTimeout(function () { fn.apply(s, a); }, ms); }; }
  function imgUrl(p) { if (!p) return ''; if (S.pending[p]) return S.pending[p].url; if (/^(https?:|data:|blob:)/.test(p)) return p; return SITE_BASE + p; }

  function toast(msg, kind) {
    var box = $('#toasts') || document.body.appendChild(h('div', { id: 'toasts' }));
    var t = h('div', { class: 'toast ' + (kind || '') }, msg);
    box.appendChild(t);
    setTimeout(function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 400); }, kind === 'err' ? 7000 : 3200);
  }
  function modal(o) {
    var back = h('div', { class: 'modal-back' });
    var box = h('div', { class: 'modal' + (o.wide ? ' wide' : '') });
    var close = function () { back.remove(); document.removeEventListener('keydown', esc); if (o.onClose) o.onClose(); };
    var esc = function (e) { if (e.key === 'Escape' && !o.locked) close(); };
    document.addEventListener('keydown', esc);
    box.appendChild(h('div', { class: 'modal-h' }, h('h3', null, o.title || ''), o.locked ? null : h('button', { class: 'x', type: 'button', 'aria-label': 'Закрыть', onclick: close }, '✕')));
    var body = h('div', { class: 'modal-b' });
    if (typeof o.body === 'function') o.body(body, close); else add(body, o.body);
    box.appendChild(body);
    if (o.actions) {
      var f = h('div', { class: 'modal-f' });
      o.actions.forEach(function (a) {
        f.appendChild(h('button', { type: 'button', class: 'btn ' + (a.primary ? 'primary' : a.danger ? 'danger' : 'ghost'), onclick: function () { if (a.onClick && a.onClick(close) === false) return; if (!a.keep) close(); } }, a.label));
      });
      box.appendChild(f);
    }
    back.appendChild(box);
    back.addEventListener('mousedown', function (e) { if (e.target === back && !o.locked) close(); });
    document.body.appendChild(back);
    var first = box.querySelector('input,textarea,select');
    if (first) setTimeout(function () { first.focus(); }, 30);
    return { close: close, box: box, body: body };
  }
  function confirmBox(title, text, okLabel, danger) {
    return new Promise(function (res) {
      modal({ title: title, body: h('p', null, text), onClose: function () { res(false); }, actions: [
        { label: 'Отмена' }, { label: okLabel || 'Да', primary: !danger, danger: danger, onClick: function () { res(true); } }
      ] });
    });
  }

  /* ===================== настройки подключения ===================== */
  function loadCfg() {
    var c = null;
    try { c = JSON.parse(localStorage.getItem(LS_CFG) || sessionStorage.getItem(LS_CFG) || 'null'); } catch (e) {}
    return c || {};
  }
  function saveCfg(c, remember) {
    var s = JSON.stringify(c);
    try {
      localStorage.removeItem(LS_CFG); sessionStorage.removeItem(LS_CFG);
      (remember ? localStorage : sessionStorage).setItem(LS_CFG, s);
    } catch (e) {}
  }
  function apiBase() { try { return localStorage.getItem(LS_API) || 'https://api.github.com'; } catch (e) { return 'https://api.github.com'; } }

  function guessRepo() {
    var m = /^([\w-]+)\.github\.io$/i.exec(location.hostname);
    if (!m) return null;
    var seg = location.pathname.split('/').filter(Boolean)[0];
    return { owner: m[1], repo: seg && seg !== 'admin' ? seg : m[1] + '.github.io' };
  }

  /* ===================== вход ===================== */
  function showLogin(err) {
    var app = clear($('#app'));
    document.body.className = 'login-page';
    var saved = loadCfg();
    var def = Object.assign({ branch: 'main' }, guessRepo() || {}, S.fileCfg || {}, saved);
    var repoIn = h('input', { type: 'text', value: def.owner && def.repo ? def.owner + '/' + def.repo : '', placeholder: 'например: elena-studio/beauty38', autocomplete: 'off', spellcheck: 'false' });
    var brIn = h('input', { type: 'text', value: def.branch || 'main', autocomplete: 'off' });
    var tokIn = h('input', { type: 'password', value: '', placeholder: 'github_pat_…', autocomplete: 'off', spellcheck: 'false' });
    var rem = h('input', { type: 'checkbox', checked: saved.remember !== false });
    var msg = h('div', { class: 'login-err' }, err || '');
    var btn = h('button', { class: 'btn primary wide', type: 'submit' }, 'Войти');
    var form = h('form', { class: 'login-card', onsubmit: function (e) {
      e.preventDefault();
      var r = GH.parseRepo(repoIn.value);
      if (!r) { msg.textContent = 'Укажите репозиторий в виде «владелец/название».'; return; }
      if (!tokIn.value.trim() && !saved.token) { msg.textContent = 'Вставьте токен GitHub.'; return; }
      var cfg = { owner: r.owner, repo: r.repo, branch: brIn.value.trim() || 'main', token: tokIn.value.trim() || saved.token, remember: rem.checked };
      btn.disabled = true; btn.textContent = 'Проверяю…'; msg.textContent = '';
      connect(cfg).then(function () { saveCfg(cfg, cfg.remember); }, function (e) {
        btn.disabled = false; btn.textContent = 'Войти'; msg.textContent = e.message;
      });
    } },
      h('div', { class: 'login-logo' }, h('img', { src: '../favicon-32.png', alt: '' }), h('div', null, h('b', null, 'Админка сайта'), h('span', null, 'Студия красоты Елены Толмачевой'))),
      h('label', null, h('span', null, 'Репозиторий на GitHub'), repoIn),
      h('label', null, h('span', null, 'Ветка'), brIn),
      h('label', null, h('span', null, 'Токен доступа' + (saved.token ? ' (сохранён — можно оставить пустым)' : '')), tokIn),
      h('label', { class: 'check' }, rem, h('span', null, 'Запомнить на этом устройстве')),
      msg, btn,
      h('details', { class: 'login-help' }, h('summary', null, 'Где взять токен?'),
        h('ol', null,
          h('li', null, 'GitHub → аватар → Settings → Developer settings → Personal access tokens → ', h('b', null, 'Fine-grained tokens'), ' → Generate new token.'),
          h('li', null, 'Repository access: ', h('b', null, 'Only select repositories'), ' → выберите репозиторий сайта.'),
          h('li', null, 'Permissions → Repository permissions → ', h('b', null, 'Contents: Read and write'), '. По желанию ', h('b', null, 'Pages: Read-only'), ' — чтобы видеть статус сборки.'),
          h('li', null, 'Generate token → скопируйте строку github_pat_… и вставьте сюда.')),
        h('p', null, 'Токен хранится только в этом браузере и отправляется только на api.github.com. На чужих компьютерах снимайте галочку «Запомнить».'))
    );
    app.appendChild(h('div', { class: 'login-wrap' }, form));
    (def.owner ? tokIn : repoIn).focus();
  }

  function connect(cfg) {
    var gh = new GH({ token: cfg.token, owner: cfg.owner, repo: cfg.repo, branch: cfg.branch, api: apiBase() });
    return gh.repoInfo().then(function (repo) {
      S.repo = repo;
      if (repo.permissions && repo.permissions.push === false) throw new Error('У этого аккаунта нет прав на запись в репозиторий.');
      return gh.getFile(CONTENT).catch(function (e) {
        if (e.status === 404) throw new Error('В ветке «' + cfg.branch + '» нет файла ' + CONTENT + '. Загрузите в репозиторий всё содержимое папки ИТОГ.');
        throw e;
      });
    }).then(function (f) {
      var data;
      try { data = JSON.parse(f.text); } catch (e) { throw new Error('content/site.json повреждён: ' + e.message); }
      S.cfg = cfg; S.gh = gh; S.baseSha = f.sha;
      S.baseText = JSON.stringify(data);
      S.data = data; S.snap = S.baseText; S.undo = []; S.redo = [];
      boot();
      checkDraft(f.sha);
      refreshRepoFiles();
    });
  }

  /* ===================== черновик ===================== */
  function draftKey() { return 'b38-draft:' + S.cfg.owner + '/' + S.cfg.repo + '@' + S.cfg.branch; }
  var saveDraft = debounce(function () {
    try {
      if (isDirty()) localStorage.setItem(draftKey(), JSON.stringify({ data: S.data, baseSha: S.baseSha, at: new Date().toISOString() }));
      else localStorage.removeItem(draftKey());
    } catch (e) {}
  }, 800);
  function checkDraft(sha) {
    var d = null;
    try { d = JSON.parse(localStorage.getItem(draftKey()) || 'null'); } catch (e) {}
    if (!d || !d.data || JSON.stringify(d.data) === S.baseText) return;
    modal({
      title: 'Найден неопубликованный черновик',
      body: h('div', null, h('p', null, 'В этом браузере остались изменения от ' + fmtTime(d.at) + ', которые не были опубликованы.'),
        d.baseSha !== sha ? h('p', { class: 'warn-text' }, 'Внимание: с тех пор сайт уже обновляли. Если восстановить черновик и опубликовать, те обновления заменятся черновиком.') : null,
        h('p', { class: 'muted' }, 'Загруженные, но не опубликованные фото в черновике не сохраняются.')),
      actions: [
        { label: 'Удалить черновик', onClick: function () { try { localStorage.removeItem(draftKey()); } catch (e) {} } },
        { label: 'Восстановить', primary: true, onClick: function () { setData(d.data, true); toast('Черновик восстановлен'); } }
      ]
    });
  }

  /* ===================== состояние и изменения ===================== */
  function isDirty() { return JSON.stringify(S.data) !== S.baseText || Object.keys(S.pending).length > 0 || Object.keys(S.deletes).length > 0; }
  var pushUndo = debounce(function () {
    var cur = JSON.stringify(S.data);
    if (cur === S.snap) return;
    S.undo.push(S.snap); if (S.undo.length > 80) S.undo.shift();
    S.redo = []; S.snap = cur; updateBar();
  }, 450);
  function changed(opts) {
    opts = opts || {};
    pushUndo(); saveDraft(); updateBar();
    if (!opts.noPreview) schedulePreview();
    if (opts.rerender) renderMain();
    if (opts.nav) renderSide();
  }
  function setData(d, rerender) {
    S.data = d; S.snap = JSON.stringify(d);
    if (rerender !== false) { renderSide(); renderMain(); }
    updateBar(); schedulePreview(); saveDraft();
  }
  function undo() {
    if (!S.undo.length) return;
    S.redo.push(JSON.stringify(S.data));
    var prev = S.undo.pop(); S.data = JSON.parse(prev); S.snap = prev;
    renderSide(); renderMain(); updateBar(); schedulePreview(); saveDraft();
  }
  function redo() {
    if (!S.redo.length) return;
    S.undo.push(JSON.stringify(S.data));
    var nx = S.redo.pop(); S.data = JSON.parse(nx); S.snap = nx;
    renderSide(); renderMain(); updateBar(); schedulePreview(); saveDraft();
  }

  /* ===================== каркас ===================== */
  var NAV = [
    { id: 'overview', label: 'Обзор', icon: '⌂' },
    { id: 'sections', label: 'Разделы страницы', icon: '▤' },
    { id: 'sheets', label: 'Процедуры', icon: '❏' },
    { id: 'contacts', label: 'Контакты и реквизиты', icon: '☏' },
    { id: 'brand', label: 'Бренд и логотип', icon: '◎' },
    { id: 'nav', label: 'Меню и подвал', icon: '☰' },
    { id: 'seo', label: 'SEO и нейропоиск', icon: '⌕' },
    { id: 'music', label: 'Музыка', icon: '♪' },
    { id: 'media', label: 'Медиатека', icon: '▣' },
    { id: 'design', label: 'Дизайн и заставка', icon: '◑' },
    { id: 'code', label: 'Код и счётчики', icon: '</>' },
    { id: 'history', label: 'История версий', icon: '↺' },
    { id: 'settings', label: 'Подключение', icon: '⚙' }
  ];

  function boot() {
    document.body.className = 'app-page';
    var app = clear($('#app'));
    app.appendChild(h('header', { id: 'bar' }));
    app.appendChild(h('div', { id: 'shell' },
      h('aside', { id: 'side' }),
      h('main', { id: 'main' }),
      h('section', { id: 'pv' })
    ));
    renderBar(); renderSide(); renderMain(); renderPreviewPane();
    window.addEventListener('beforeunload', function (e) { if (isDirty()) { e.preventDefault(); e.returnValue = ''; } });
    document.addEventListener('keydown', function (e) {
      var inField = /INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '');
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); openPublish(); return; }
      if (inField) return;
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) { e.preventDefault(); redo(); }
    });
  }

  function renderBar() {
    var bar = clear($('#bar'));
    bar.appendChild(h('div', { class: 'bar-l' },
      h('button', { class: 'icon-btn menu-tg', type: 'button', title: 'Меню', onclick: function () { document.body.classList.toggle('side-open'); } }, '☰'),
      h('a', { class: 'bar-brand', href: SITE_BASE, target: '_blank', rel: 'noopener', title: 'Открыть сайт' }, h('img', { src: '../favicon-32.png', alt: '' }), h('span', null, h('b', null, 'Админка'), h('i', null, (S.data.settings && S.data.settings.domain) || S.cfg.repo)))
    ));
    bar.appendChild(h('div', { class: 'bar-c' }, h('span', { id: 'dirty' })));
    bar.appendChild(h('div', { class: 'bar-r' },
      h('button', { class: 'icon-btn', id: 'bUndo', type: 'button', title: 'Отменить (Ctrl+Z)', onclick: undo }, '↶'),
      h('button', { class: 'icon-btn', id: 'bRedo', type: 'button', title: 'Вернуть (Ctrl+Y)', onclick: redo }, '↷'),
      h('button', { class: 'btn ghost', id: 'bPv', type: 'button', onclick: togglePreview }, 'Предпросмотр'),
      h('button', { class: 'btn primary', id: 'bPub', type: 'button', onclick: openPublish }, 'Опубликовать')
    ));
    updateBar();
  }
  function updateBar() {
    var d = $('#dirty'); if (!d) return;
    var dirty = isDirty();
    var n = Object.keys(S.pending).length;
    d.className = dirty ? 'st dirty' : 'st ok';
    d.textContent = dirty ? 'Есть неопубликованные изменения' + (n ? ' · новых файлов: ' + n : '') : 'Всё опубликовано';
    var u = $('#bUndo'), r = $('#bRedo'), p = $('#bPv');
    if (u) u.disabled = !S.undo.length;
    if (r) r.disabled = !S.redo.length;
    if (p) p.classList.toggle('on', S.previewOn);
    var pub = $('#bPub'); if (pub) pub.classList.toggle('pulse', dirty);
  }

  function renderSide() {
    var side = clear($('#side'));
    var nav = h('nav', { class: 'side-nav' });
    NAV.forEach(function (n) {
      var active = S.view.page === n.id || (n.id === 'sections' && S.view.page === 'section') || (n.id === 'sheets' && S.view.page === 'sheet');
      var badge = n.id === 'sheets' ? (S.data.sheets || []).length : n.id === 'sections' ? (S.data.sections || []).length : null;
      nav.appendChild(h('button', { type: 'button', class: 'nav-i' + (active ? ' on' : ''), onclick: function () { go({ page: n.id }); } },
        h('span', { class: 'ic' }, n.icon), h('span', null, n.label), badge != null ? h('em', null, badge) : null));
      if (n.id === 'sections' && (S.view.page === 'sections' || S.view.page === 'section')) {
        var sub = h('div', { class: 'side-sub' });
        (S.data.sections || []).forEach(function (s, i) {
          var def = SCH.SECTIONS[s.type] || { name: s.type };
          sub.appendChild(h('button', { type: 'button', class: 'sub-i' + (S.view.page === 'section' && S.view.index === i ? ' on' : '') + (s.enabled === false ? ' off' : ''), onclick: function () { go({ page: 'section', index: i }); } },
            h('span', { class: 'ic' }, def.icon || '·'), h('span', null, sectionLabel(s))));
        });
        nav.appendChild(sub);
      }
    });
    side.appendChild(nav);
    side.appendChild(h('div', { class: 'side-foot' },
      h('a', { href: SITE_BASE, target: '_blank', rel: 'noopener' }, 'Открыть сайт ↗'),
      S.repo ? h('a', { href: S.repo.html_url, target: '_blank', rel: 'noopener' }, 'Репозиторий ↗') : null));
  }
  function sectionLabel(s) {
    var def = SCH.SECTIONS[s.type] || { name: s.type };
    var t = plain(s.title || s.eyebrow || '');
    if (s.type === 'hero') t = def.name;
    return (t || def.name) + (s.id ? '' : '');
  }

  function go(v) {
    S.view = v; document.body.classList.remove('side-open');
    renderSide(); renderMain();
    if (v.page === 'section' && S.data.sections[v.index]) S.previewTarget = { id: S.data.sections[v.index].id };
    else if (v.page === 'sheet') S.previewTarget = { sheet: v.id };
    else S.previewTarget = null;
    if (S.previewOn) schedulePreview(true);
    $('#main').scrollTop = 0;
  }

  function renderMain() {
    var main = clear($('#main'));
    var p = S.view.page;
    var fn = PAGES[p] || PAGES.overview;
    fn(main);
  }

  function pageHead(title, sub, actions) {
    return h('div', { class: 'page-h' }, h('div', null, h('h1', null, title), sub ? h('p', null, sub) : null), actions ? h('div', { class: 'page-act' }, actions) : null);
  }
  function card(title, body, extra) { return h('section', { class: 'card' + (extra ? ' ' + extra : '') }, title ? h('h2', null, title) : null, body); }

  /* ===================== поля форм ===================== */
  function fields(container, obj, defs) {
    var grid = h('div', { class: 'fields' });
    defs.forEach(function (d) {
      if (d.group) { grid.appendChild(h('h3', { class: 'f-group' }, d.group)); return; }
      var el = field(obj, d);
      if (el) grid.appendChild(el);
    });
    container.appendChild(grid);
    return grid;
  }
  function wrap(d, input, extra) {
    return h('div', { class: 'f' + (d.half ? ' half' : '') + (extra ? ' ' + extra : '') },
      d.label ? h('label', { class: 'f-l' }, d.label) : null, input, d.help ? h('p', { class: 'f-h' }, d.help) : null);
  }
  function autoGrow(ta) { ta.style.height = 'auto'; ta.style.height = Math.min(520, ta.scrollHeight + 2) + 'px'; }

  function field(obj, d) {
    var k = d.k, t = d.t;
    switch (t) {
      case 'text': case 'number': {
        var inp = h('input', { type: t === 'number' ? 'number' : 'text', value: obj[k] == null ? '' : obj[k], class: d.mono ? 'mono' : null, step: d.step || null, spellcheck: d.mono ? 'false' : null });
        var cnt = d.counter ? h('span', { class: 'cnt' }) : null;
        var upd = function () { if (cnt) { var n = plain(inp.value).length; cnt.textContent = n + ' / ' + d.counter; cnt.classList.toggle('over', n > d.counter); } };
        inp.addEventListener('input', function () { obj[k] = t === 'number' ? (inp.value === '' ? '' : +inp.value) : inp.value; upd(); changed(); if (k === 'title' || k === 'name') renderSideSoon(); });
        upd();
        return wrap(d, cnt ? h('div', { class: 'with-cnt' }, inp, cnt) : inp);
      }
      case 'textarea': case 'code': {
        var ta = h('textarea', { rows: t === 'code' ? 8 : 3, class: t === 'code' ? 'mono' : null, spellcheck: t === 'code' ? 'false' : null }, obj[k] || '');
        var c2 = d.counter ? h('span', { class: 'cnt' }) : null;
        var u2 = function () { if (c2) { var n = plain(ta.value).length; c2.textContent = n + ' / ' + d.counter; c2.classList.toggle('over', n > d.counter); } };
        ta.addEventListener('input', function () { obj[k] = ta.value; autoGrow(ta); u2(); changed(); });
        setTimeout(function () { autoGrow(ta); }, 0); u2();
        return wrap(d, c2 ? h('div', { class: 'with-cnt' }, ta, c2) : ta);
      }
      case 'html': return wrap(d, htmlEditor(obj, k));
      case 'toggle': {
        var cb = h('input', { type: 'checkbox', checked: obj[k] !== false && obj[k] != null && obj[k] !== '' });
        if (obj[k] == null && (k === 'enabled' || k === 'loop' || k === 'autoplay')) cb.checked = true;
        cb.addEventListener('change', function () { obj[k] = cb.checked; changed(); });
        return h('div', { class: 'f toggle' + (d.half ? ' half' : '') }, h('label', null, cb, h('i'), h('span', null, d.label)), d.help ? h('p', { class: 'f-h' }, d.help) : null);
      }
      case 'select': {
        var sel = h('select');
        d.options.forEach(function (o) { sel.appendChild(h('option', { value: o[0], selected: String(obj[k]) === String(o[0]) }, o[1])); });
        sel.addEventListener('change', function () { obj[k] = d.num ? +sel.value : sel.value; changed(); });
        return wrap(d, sel);
      }
      case 'range': {
        var r = h('input', { type: 'range', min: d.min, max: d.max, step: d.step, value: obj[k] == null ? d.max / 2 : obj[k] });
        var out = h('output', null, Math.round((+r.value) * 100) + '%');
        r.addEventListener('input', function () { obj[k] = +r.value; out.textContent = Math.round((+r.value) * 100) + '%'; changed({ noPreview: true }); });
        return wrap(d, h('div', { class: 'range' }, r, out));
      }
      case 'color': {
        var col = h('input', { type: 'color', value: obj[k] || '#000000' });
        var tx = h('input', { type: 'text', value: obj[k] || '', class: 'mono', style: { width: '110px' } });
        col.addEventListener('input', function () { obj[k] = col.value; tx.value = col.value; changed(); });
        tx.addEventListener('input', function () { if (/^#[0-9a-f]{6}$/i.test(tx.value)) { obj[k] = tx.value; col.value = tx.value; changed(); } });
        return wrap(d, h('div', { class: 'color' }, col, tx));
      }
      case 'days': {
        var all = [['Mo', 'Пн'], ['Tu', 'Вт'], ['We', 'Ср'], ['Th', 'Чт'], ['Fr', 'Пт'], ['Sa', 'Сб'], ['Su', 'Вс']];
        if (!Array.isArray(obj[k])) obj[k] = [];
        var row = h('div', { class: 'days' });
        all.forEach(function (dd) {
          var b = h('button', { type: 'button', class: obj[k].indexOf(dd[0]) >= 0 ? 'on' : '' }, dd[1]);
          b.addEventListener('click', function () {
            var i = obj[k].indexOf(dd[0]);
            if (i >= 0) obj[k].splice(i, 1); else obj[k].push(dd[0]);
            obj[k].sort(function (a, b2) { return all.map(function (x) { return x[0]; }).indexOf(a) - all.map(function (x) { return x[0]; }).indexOf(b2); });
            b.classList.toggle('on'); changed();
          });
          row.appendChild(b);
        });
        return wrap(d, row);
      }
      case 'sheet': {
        var ss = h('select');
        ss.appendChild(h('option', { value: '' }, '— нет —'));
        (S.data.sheets || []).forEach(function (s) { ss.appendChild(h('option', { value: s.id, selected: obj[k] === s.id }, plain(s.title) + ' (' + s.id + ')')); });
        if (obj[k] && !(S.data.sheets || []).some(function (s) { return s.id === obj[k]; })) ss.appendChild(h('option', { value: obj[k], selected: true }, '⚠ ' + obj[k] + ' — не найдена'));
        ss.addEventListener('change', function () { obj[k] = ss.value; changed(); });
        var goBtn = h('button', { type: 'button', class: 'btn ghost sm', onclick: function () { if (obj[k]) go({ page: 'sheet', id: obj[k] }); } }, 'Открыть');
        return wrap(d, h('div', { class: 'inline' }, ss, goBtn));
      }
      case 'group': {
        if (!obj[k] || typeof obj[k] !== 'object') obj[k] = {};
        var box = h('fieldset', { class: 'group' }, h('legend', null, d.label));
        fields(box, obj[k], d.fields);
        return h('div', { class: 'f full' }, box);
      }
      case 'button': {
        if (!obj[k] || typeof obj[k] !== 'object') obj[k] = { label: '', href: '', style: 'fill', arrow: true };
        var bx = h('fieldset', { class: 'group' }, h('legend', null, d.label));
        fields(bx, obj[k], SCH.BTN);
        return h('div', { class: 'f full' }, bx);
      }
      case 'image': return wrap(d, imageField(obj, k, d), 'full');
      case 'imageInline': return h('div', { class: 'f full' }, imageField(null, null, d, obj));
      case 'imagePath': return wrap(d, imagePathField(obj, k), 'full');
      case 'ogImage': return wrap(d, ogField(obj, k), 'full');
      case 'audio': return wrap(d, audioField(obj, k), 'full');
      case 'strings': return wrap(d, stringsField(obj, k, d), 'full');
      case 'list': return h('div', { class: 'f full' }, listField(obj, k, d));
      case 'table': return h('div', { class: 'f full' }, tableField(obj, d));
    }
    return null;
  }
  var renderSideSoon = debounce(function () { renderSide(); }, 600);

  /* ---------- HTML-поле с панелью ---------- */
  function htmlEditor(obj, k, onInput) {
    var ta = h('textarea', { rows: 2, class: 'html-ta' }, obj[k] == null ? '' : obj[k]);
    function wrapSel(a, b) {
      var s = ta.selectionStart, e = ta.selectionEnd, v = ta.value;
      ta.value = v.slice(0, s) + a + v.slice(s, e) + b + v.slice(e);
      ta.selectionStart = s + a.length; ta.selectionEnd = e + a.length; ta.focus();
      ta.dispatchEvent(new Event('input'));
    }
    var tokSel = h('select', { class: 'tok', title: 'Подстановки' }, h('option', { value: '' }, '{{ }}'));
    SCH.TOKENS.forEach(function (t) { tokSel.appendChild(h('option', { value: t }, t)); });
    tokSel.addEventListener('change', function () { if (tokSel.value) wrapSel(tokSel.value, ''); tokSel.value = ''; });
    var tb = h('div', { class: 'tb' },
      h('button', { type: 'button', title: 'Жирный', onclick: function () { wrapSel('<b>', '</b>'); } }, h('b', null, 'Ж')),
      h('button', { type: 'button', title: 'Курсив (акцентный шрифт)', onclick: function () { wrapSel('<em>', '</em>'); } }, h('i', null, 'К')),
      h('button', { type: 'button', title: 'Перенос строки', onclick: function () { wrapSel('<br>', ''); } }, '↵'),
      h('button', { type: 'button', title: 'Ссылка', onclick: function () { var u = prompt('Адрес ссылки (https://…, tel:…, #раздел)'); if (u) wrapSel('<a href="' + u.replace(/"/g, '&quot;') + '"' + (/^https?:/.test(u) ? ' target="_blank" rel="noopener"' : '') + '>', '</a>'); } }, '🔗'),
      h('button', { type: 'button', title: 'Абзац', onclick: function () { wrapSel('<p>', '</p>'); } }, '¶'),
      tokSel);
    ta.addEventListener('input', function () { obj[k] = ta.value; autoGrow(ta); if (onInput) onInput(); changed(); });
    setTimeout(function () { autoGrow(ta); }, 0);
    return h('div', { class: 'html-ed' }, tb, ta);
  }

  /* ---------- список строк ---------- */
  function stringsField(obj, k, d) {
    if (!Array.isArray(obj[k])) obj[k] = [];
    var arr = obj[k];
    var box = h('div', { class: 'strings' });
    function draw() {
      clear(box);
      arr.forEach(function (s, i) {
        var input;
        if (d.plain) {
          input = h('input', { type: 'text', value: s });
          input.addEventListener('input', function () { arr[i] = input.value; changed(); });
        } else input = htmlEditor(arr, i);
        box.appendChild(h('div', { class: 'str-row' }, input, h('div', { class: 'row-act' },
          h('button', { type: 'button', title: 'Выше', disabled: i === 0, onclick: function () { arr.splice(i - 1, 0, arr.splice(i, 1)[0]); draw(); changed(); } }, '↑'),
          h('button', { type: 'button', title: 'Ниже', disabled: i === arr.length - 1, onclick: function () { arr.splice(i + 1, 0, arr.splice(i, 1)[0]); draw(); changed(); } }, '↓'),
          h('button', { type: 'button', title: 'Удалить', class: 'del', onclick: function () { arr.splice(i, 1); draw(); changed(); } }, '✕'))));
      });
      box.appendChild(h('button', { type: 'button', class: 'btn ghost sm add', onclick: function () { arr.push(''); draw(); changed(); var l = box.querySelectorAll('textarea,input'); if (l.length) l[l.length - 1].focus(); } }, '+ Добавить строку'));
    }
    draw();
    return box;
  }

  /* ---------- повторяющиеся элементы ---------- */
  function itemTitle(it, d, i) {
    var t = '';
    if (d.title && it && typeof it === 'object') t = plain(it[d.title]);
    if (!t && it && typeof it === 'object') t = plain(it.label || it.title || it.name || it.q || it.caption || it.alt || '');
    return (i + 1) + '. ' + (t || 'Без названия');
  }
  function listField(obj, k, d) {
    if (!Array.isArray(obj[k])) obj[k] = [];
    var arr = obj[k];
    var box = h('div', { class: 'list' });
    var open = {};
    function draw() {
      clear(box);
      box.appendChild(h('div', { class: 'list-h' }, h('span', null, d.label), h('em', null, arr.length), d.help ? h('p', { class: 'f-h' }, d.help) : null));
      arr.forEach(function (it, i) {
        var isOpen = !!open[i];
        var body = h('div', { class: 'li-b' });
        var thumb = d.thumb && it && it.src ? h('img', { class: 'li-thumb', src: imgUrl(it.src), alt: '' }) : null;
        var titleEl = h('span', { class: 'li-t' }, itemTitle(it, d, i));
        var head = h('div', { class: 'li-h' },
          h('button', { type: 'button', class: 'li-tg', onclick: function () { open[i] = !open[i]; draw(); } }, h('span', { class: 'chev' + (isOpen ? ' on' : '') }, '›'), thumb, titleEl),
          h('div', { class: 'row-act' },
            h('button', { type: 'button', title: 'Выше', disabled: i === 0, onclick: function () { move(i, -1); } }, '↑'),
            h('button', { type: 'button', title: 'Ниже', disabled: i === arr.length - 1, onclick: function () { move(i, 1); } }, '↓'),
            h('button', { type: 'button', title: 'Дублировать', onclick: function () { arr.splice(i + 1, 0, clone(it)); open = {}; open[i + 1] = true; draw(); changed(); } }, '⧉'),
            h('button', { type: 'button', title: 'Удалить', class: 'del', onclick: function () {
              confirmBox('Удалить элемент?', '«' + itemTitle(it, d, i) + '» будет удалён. Отменить можно кнопкой ↶.', 'Удалить', true).then(function (ok) { if (ok) { arr.splice(i, 1); open = {}; draw(); changed(); } });
            } }, '✕')));
        var li = h('div', { class: 'li' + (isOpen ? ' open' : '') }, head);
        if (isOpen) {
          if (d.item && d.item.t === 'button') fields(body, it, SCH.BTN);
          else fields(body, it, d.item);
          body.addEventListener('input', debounce(function () { titleEl.textContent = itemTitle(it, d, i); }, 300));
          li.appendChild(body);
        }
        box.appendChild(li);
      });
      if (!d.max || arr.length < d.max) box.appendChild(h('button', { type: 'button', class: 'btn ghost sm add', onclick: function () {
        var n = d.item && d.item.t === 'button' ? { label: 'Кнопка', href: '#contacts', style: 'line', arrow: false } : {};
        if (Array.isArray(d.item)) d.item.forEach(function (f) { if (f.t === 'list' || f.t === 'strings') n[f.k] = []; else if (f.t === 'toggle') n[f.k] = false; else if (f.t !== 'imageInline' && f.t !== 'table') n[f.k] = ''; });
        if (Array.isArray(d.item) && d.item.some(function (f) { return f.t === 'table'; })) { n.columns = ['Название', 'Цена']; n.rows = []; }
        arr.push(n); open = {}; open[arr.length - 1] = true; draw(); changed();
      } }, '+ Добавить'));
    }
    function move(i, dir) { arr.splice(i + dir, 0, arr.splice(i, 1)[0]); open = {}; open[i + dir] = true; draw(); changed(); }
    draw();
    return box;
  }

  /* ---------- таблица цен ---------- */
  function tableField(tab, d) {
    if (!Array.isArray(tab.columns)) tab.columns = ['Название', 'Цена'];
    if (!Array.isArray(tab.rows)) tab.rows = [];
    var box = h('div', { class: 'tbl-ed' });
    function norm() {
      var n = tab.columns.length - 1;
      tab.rows.forEach(function (r) {
        r.values = (r.values || []).slice(0, n); while (r.values.length < n) r.values.push('');
        r.old = (r.old || []).slice(0, n); while (r.old.length < n) r.old.push('');
      });
    }
    function draw() {
      norm(); clear(box);
      box.appendChild(h('div', { class: 'list-h' }, h('span', null, d.label), h('p', { class: 'f-h' }, 'Первая колонка — название. «Было» — старая цена (выводится зачёркнутой «вместо …»). Отметка ★ выделяет строку.')));
      var t = h('table');
      var hr = h('tr');
      tab.columns.forEach(function (c, ci) {
        var inp = h('input', { type: 'text', value: c });
        inp.addEventListener('input', function () { tab.columns[ci] = inp.value; changed(); });
        hr.appendChild(h('th', { colspan: ci ? 2 : 1 }, inp, ci > 1 || (ci === 1 && tab.columns.length > 2) ? h('button', { type: 'button', class: 'mini del', title: 'Удалить колонку', onclick: function () { tab.columns.splice(ci, 1); tab.rows.forEach(function (r) { r.values.splice(ci - 1, 1); r.old.splice(ci - 1, 1); }); draw(); changed(); } }, '✕') : null));
      });
      hr.appendChild(h('th', null, h('button', { type: 'button', class: 'mini', title: 'Добавить колонку', onclick: function () { tab.columns.push('Новая'); draw(); changed(); } }, '+ колонка')));
      t.appendChild(h('thead', null, hr));
      var sub = h('tr', { class: 'sub' }, h('td', null, h('small', null, 'Название / уточнение')));
      tab.columns.slice(1).forEach(function () { sub.appendChild(h('td', null, h('small', null, 'Цена'))); sub.appendChild(h('td', null, h('small', null, 'Было'))); });
      sub.appendChild(h('td'));
      var tb = h('tbody', null, sub);
      tab.rows.forEach(function (r, ri) {
        var tr = h('tr', { class: r.best ? 'best' : '' });
        var nm = h('input', { type: 'text', value: plain(r.name), placeholder: 'Название' });
        nm.addEventListener('input', function () { r.name = nm.value; changed(); });
        var sb = h('input', { type: 'text', value: r.sub || '', placeholder: 'уточнение (необязательно)', class: 'sm' });
        sb.addEventListener('input', function () { r.sub = sb.value; changed(); });
        tr.appendChild(h('td', null, nm, sb));
        r.values.forEach(function (v, vi) {
          var a = h('input', { type: 'text', value: v, class: 'num' });
          a.addEventListener('input', function () { r.values[vi] = a.value; changed(); });
          var b = h('input', { type: 'text', value: r.old[vi] || '', class: 'num old' });
          b.addEventListener('input', function () { r.old[vi] = b.value; changed(); });
          tr.appendChild(h('td', null, a)); tr.appendChild(h('td', null, b));
        });
        tr.appendChild(h('td', { class: 'acts' },
          h('button', { type: 'button', class: 'mini' + (r.best ? ' on' : ''), title: 'Выделить строку', onclick: function () { r.best = !r.best; draw(); changed(); } }, '★'),
          h('button', { type: 'button', class: 'mini', title: 'Выше', disabled: ri === 0, onclick: function () { tab.rows.splice(ri - 1, 0, tab.rows.splice(ri, 1)[0]); draw(); changed(); } }, '↑'),
          h('button', { type: 'button', class: 'mini del', title: 'Удалить строку', onclick: function () { tab.rows.splice(ri, 1); draw(); changed(); } }, '✕')));
        tb.appendChild(tr);
      });
      t.appendChild(tb);
      box.appendChild(h('div', { class: 'tbl-scroll' }, t));
      box.appendChild(h('button', { type: 'button', class: 'btn ghost sm add', onclick: function () { tab.rows.push({ name: '', sub: '', values: [], old: [], best: false }); draw(); changed(); } }, '+ Строка'));
    }
    draw();
    return box;
  }

  /* ===================== картинки и файлы ===================== */
  function readFile(file) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { res(new Uint8Array(r.result)); };
      r.onerror = function () { rej(new Error('Не удалось прочитать файл')); };
      r.readAsArrayBuffer(file);
    });
  }
  function loadImage(file) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file);
      var im = new Image();
      im.onload = function () { res({ im: im, url: url }); };
      im.onerror = function () { URL.revokeObjectURL(url); rej(new Error('Это не изображение или формат не поддерживается браузером.')); };
      im.src = url;
    });
  }
  function canvasBlob(cv, type, q) {
    return new Promise(function (res) { cv.toBlob(function (b) { res(b); }, type, q); });
  }
  /** Фото → WebP (или JPEG/PNG, если браузер не умеет WebP), с ограничением размера */
  function processImage(file, opts) {
    opts = opts || {};
    var max = opts.max || 2400;
    if (/svg/.test(file.type)) return readFile(file).then(function (b) { return { bytes: b, w: 0, h: 0, ext: 'svg', type: 'image/svg+xml' }; });
    return loadImage(file).then(function (o) {
      var im = o.im, w = im.naturalWidth, hh = im.naturalHeight;
      var r = Math.min(1, max / Math.max(w, hh));
      var cw = Math.round(w * r), ch = Math.round(hh * r);
      var cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
      var cx = cv.getContext('2d'); cx.imageSmoothingQuality = 'high'; cx.drawImage(im, 0, 0, cw, ch);
      URL.revokeObjectURL(o.url);
      return canvasBlob(cv, 'image/webp', opts.q || 0.86).then(function (b) {
        if (b && b.type === 'image/webp') return { blob: b, ext: 'webp' };
        var png = /png/.test(file.type) && opts.keepPng;
        return canvasBlob(cv, png ? 'image/png' : 'image/jpeg', 0.88).then(function (b2) { return { blob: b2, ext: png ? 'png' : 'jpg' }; });
      }).then(function (x) {
        return x.blob.arrayBuffer().then(function (ab) { return { bytes: new Uint8Array(ab), w: cw, h: ch, ext: x.ext, type: x.blob.type }; });
      });
    });
  }
  function addPending(path, bytes, type) {
    if (S.pending[path] && S.pending[path].url) URL.revokeObjectURL(S.pending[path].url);
    var url = URL.createObjectURL(new Blob([bytes], { type: type || 'application/octet-stream' }));
    S.pending[path] = { bytes: bytes, url: url, type: type, size: bytes.length };
    delete S.deletes[path];
    updateBar();
    return url;
  }
  function pickFile(accept) {
    return new Promise(function (res) {
      var i = h('input', { type: 'file', accept: accept, style: { display: 'none' } });
      i.addEventListener('change', function () { res(i.files && i.files[0]); i.remove(); });
      document.body.appendChild(i); i.click();
    });
  }
  function uploadImage(opts, baseName) {
    return pickFile('image/*').then(function (file) {
      if (!file) return null;
      toast('Обрабатываю фото…');
      return processImage(file, opts).then(function (r) {
        var name = slug(baseName || file.name.replace(/\.[^.]+$/, '')) + '-' + rand() + '.' + r.ext;
        var path = 'assets/img/' + name;
        addPending(path, r.bytes, r.type);
        toast('Фото готово: ' + r.w + '×' + r.h + ', ' + kb(r.bytes.length) + '. Будет загружено при публикации.', 'ok');
        return { src: path, w: r.w, h: r.h };
      });
    }).catch(function (e) { toast(e.message, 'err'); return null; });
  }

  /** поле картинки: obj[k] = {src, alt, w, h}; или сам элемент списка (inline) */
  function imageField(obj, k, d, inline) {
    var get = function () { return inline || obj[k]; };
    var box = h('div', { class: 'img-f' });
    function draw() {
      clear(box);
      var v = get();
      var has = v && v.src;
      box.appendChild(h('div', { class: 'img-prev' + (has ? '' : ' empty') }, has ? h('img', { src: imgUrl(v.src), alt: '' }) : h('span', null, 'Нет фото')));
      var right = h('div', { class: 'img-side' });
      if (has) right.appendChild(h('p', { class: 'img-path mono' }, v.src.split('/').pop() + (v.w ? ' · ' + v.w + '×' + v.h : '') + (S.pending[v.src] ? ' · новое' : '')));
      if (!d.noAlt) {
        var alt = h('textarea', { rows: 2, placeholder: 'Описание фото (alt) — что на снимке. Важно для Яндекс/Google Картинок и нейросетей.' }, (v && v.alt) || '');
        alt.addEventListener('input', function () { var o = ensure(); o.alt = alt.value; changed(); });
        right.appendChild(h('label', { class: 'f-l' }, 'Описание (alt)'));
        right.appendChild(alt);
      }
      right.appendChild(h('div', { class: 'inline' },
        h('button', { type: 'button', class: 'btn ghost sm', onclick: function () {
          uploadImage(d.opts, (v && v.alt) || (d.label || 'foto')).then(function (r) { if (!r) return; var o = ensure(); o.src = r.src; o.w = r.w; o.h = r.h; draw(); changed({ nav: false }); });
        } }, has ? 'Заменить фото' : 'Загрузить фото'),
        h('button', { type: 'button', class: 'btn ghost sm', onclick: function () {
          pickFromMedia().then(function (p) { if (!p) return; var o = ensure(); o.src = p.src; o.w = p.w || 0; o.h = p.h || 0; draw(); changed(); });
        } }, 'Из медиатеки'),
        has && !inline ? h('button', { type: 'button', class: 'btn ghost sm danger-t', onclick: function () { obj[k] = null; draw(); changed(); } }, 'Убрать') : null));
      box.appendChild(right);
    }
    function ensure() {
      if (inline) return inline;
      if (!obj[k] || typeof obj[k] !== 'object') obj[k] = { src: '', alt: '' };
      return obj[k];
    }
    draw();
    return box;
  }
  function imagePathField(obj, k) {
    var box = h('div', { class: 'img-f' });
    function draw() {
      clear(box);
      var v = obj[k];
      box.appendChild(h('div', { class: 'img-prev' + (v ? '' : ' empty') }, v ? h('img', { src: imgUrl(v), alt: '' }) : h('span', null, 'Нет фото')));
      box.appendChild(h('div', { class: 'img-side' }, v ? h('p', { class: 'img-path mono' }, v.split('/').pop()) : null,
        h('div', { class: 'inline' },
          h('button', { type: 'button', class: 'btn ghost sm', onclick: function () { uploadImage({ max: 2000 }, 'protsedura').then(function (r) { if (r) { obj[k] = r.src; draw(); changed(); } }); } }, 'Загрузить'),
          h('button', { type: 'button', class: 'btn ghost sm', onclick: function () { pickFromMedia().then(function (p) { if (p) { obj[k] = p.src; draw(); changed(); } }); } }, 'Из медиатеки'),
          v ? h('button', { type: 'button', class: 'btn ghost sm danger-t', onclick: function () { obj[k] = ''; draw(); changed(); } }, 'Убрать') : null)));
    }
    draw();
    return box;
  }
  function ogField(obj, k) {
    var box = h('div', { class: 'img-f og' });
    function draw() {
      clear(box);
      var v = obj[k];
      box.appendChild(h('div', { class: 'img-prev og' }, v ? h('img', { src: imgUrl(v), alt: '' }) : h('span', null, 'Нет')));
      box.appendChild(h('div', { class: 'img-side' }, h('p', { class: 'f-h' }, 'Картинка в превью ссылки (Telegram, ВКонтакте, WhatsApp, Яндекс). Любое фото обрежется по центру до 1200×630 и сохранится в JPEG.'),
        h('button', { type: 'button', class: 'btn ghost sm', onclick: function () {
          pickFile('image/*').then(function (file) {
            if (!file) return;
            return loadImage(file).then(function (o) {
              var W = 1200, H = 630, im = o.im, r = Math.max(W / im.naturalWidth, H / im.naturalHeight);
              var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
              var cx = cv.getContext('2d'); cx.imageSmoothingQuality = 'high';
              var dw = im.naturalWidth * r, dh = im.naturalHeight * r;
              cx.drawImage(im, (W - dw) / 2, (H - dh) / 2, dw, dh); URL.revokeObjectURL(o.url);
              return canvasBlob(cv, 'image/jpeg', 0.88);
            }).then(function (b) { return b.arrayBuffer(); }).then(function (ab) {
              var p = 'og-image-' + rand() + '.jpg';
              addPending(p, new Uint8Array(ab), 'image/jpeg'); obj[k] = p; draw(); changed();
            });
          }).catch(function (e) { toast(e.message, 'err'); });
        } }, 'Загрузить новую')));
    }
    draw();
    return box;
  }
  function audioField(obj, k) {
    var box = h('div', { class: 'audio-f' });
    function draw() {
      clear(box);
      var v = obj[k];
      if (v) box.appendChild(h('audio', { controls: true, preload: 'none', src: imgUrl(v) }));
      box.appendChild(h('p', { class: 'img-path mono' }, v ? v.split('/').pop() + (S.pending[v] ? ' · новый, ' + kb(S.pending[v].size) : '') : 'Трек не выбран'));
      box.appendChild(h('div', { class: 'inline' },
        h('button', { type: 'button', class: 'btn ghost sm', onclick: function () {
          pickFile('audio/*,.mp3,.m4a,.ogg').then(function (file) {
            if (!file) return;
            if (file.size > 40 * 1048576) { toast('Файл больше 40 МБ — сожмите трек до 128–192 кбит/с.', 'err'); return; }
            return readFile(file).then(function (bytes) {
              var ext = (file.name.split('.').pop() || 'mp3').toLowerCase();
              var p = 'assets/audio/' + slug(file.name.replace(/\.[^.]+$/, '')) + '.' + ext;
              addPending(p, bytes, file.type || 'audio/mpeg'); obj[k] = p;
              if (file.size > 12 * 1048576) toast('Трек ' + kb(file.size) + ' — посетители на мобильном будут ждать дольше. Лучше до 6–8 МБ.', 'warn');
              draw(); changed();
            });
          });
        } }, v ? 'Заменить трек' : 'Загрузить трек'),
        v ? h('button', { type: 'button', class: 'btn ghost sm danger-t', onclick: function () { obj[k] = ''; draw(); changed(); } }, 'Убрать') : null));
    }
    draw();
    return box;
  }

  /* ---------- медиатека ---------- */
  function refreshRepoFiles() {
    return S.gh.listFiles().then(function (r) { S.repoFiles = r.files; if (S.view.page === 'media') renderMain(); return r; }).catch(function () {});
  }
  function allImages() {
    var map = {};
    Object.keys(S.repoFiles || {}).forEach(function (p) { if (/^assets\/img\/.+\.(webp|jpe?g|png|gif|svg|avif)$/i.test(p)) map[p] = { src: p, size: S.repoFiles[p].size }; });
    Object.keys(S.pending).forEach(function (p) { if (/\.(webp|jpe?g|png|gif|svg|avif)$/i.test(p) && /^assets\/img\//.test(p)) map[p] = { src: p, size: S.pending[p].size, pending: true }; });
    SR.collectImages(S.data).forEach(function (p) { if (!map[p]) map[p] = { src: p }; });
    Object.keys(S.deletes).forEach(function (p) { delete map[p]; });
    return Object.keys(map).sort().map(function (p) { return map[p]; });
  }
  function usage(path) {
    var n = 0;
    (function walk(o) {
      if (typeof o === 'string') { if (o === path) n++; return; }
      if (Array.isArray(o)) { o.forEach(walk); return; }
      if (o && typeof o === 'object') for (var k in o) walk(o[k]);
    })(S.data);
    return n;
  }
  function dims(path) {
    var r = null;
    (function walk(o) {
      if (r || !o || typeof o !== 'object') return;
      if (o.src === path && o.w) { r = { w: o.w, h: o.h }; return; }
      for (var k in o) walk(o[k]);
    })(S.data);
    return r || {};
  }
  function pickFromMedia() {
    return new Promise(function (res) {
      var chosen = null;
      var m = modal({ title: 'Медиатека — выберите фото', wide: true, onClose: function () { res(chosen); }, body: function (b, close) {
        var grid = h('div', { class: 'media-grid pick' });
        allImages().forEach(function (it) {
          grid.appendChild(h('button', { type: 'button', class: 'media-i', onclick: function () { chosen = Object.assign({ src: it.src }, dims(it.src)); close(); } },
            h('img', { src: imgUrl(it.src), alt: '', loading: 'lazy' }), h('span', null, it.src.split('/').pop())));
        });
        b.appendChild(h('div', { class: 'inline', style: { marginBottom: '12px' } }, h('button', { type: 'button', class: 'btn ghost sm', onclick: function () {
          uploadImage({ max: 2400 }).then(function (r) { if (r) { chosen = r; close(); } });
        } }, '+ Загрузить новое фото')));
        b.appendChild(grid);
      } });
    });
  }

  /* ===================== предпросмотр ===================== */
  function renderPreviewPane() {
    var pv = clear($('#pv'));
    document.body.classList.toggle('pv-on', S.previewOn);
    if (!S.previewOn) return;
    var frame = h('iframe', { id: 'pvFrame', title: 'Предпросмотр сайта' });
    pv.appendChild(h('div', { class: 'pv-bar' },
      h('div', { class: 'seg' },
        h('button', { type: 'button', class: S.device === 'desktop' ? 'on' : '', onclick: function () { S.device = 'desktop'; renderPreviewPane(); } }, 'Компьютер'),
        h('button', { type: 'button', class: S.device === 'mobile' ? 'on' : '', onclick: function () { S.device = 'mobile'; renderPreviewPane(); } }, 'Телефон')),
      h('span', { class: 'pv-note' }, 'черновик, не опубликован'),
      h('button', { type: 'button', class: 'icon-btn', title: 'Обновить', onclick: function () { schedulePreview(true); } }, '⟳'),
      h('button', { type: 'button', class: 'icon-btn', title: 'Скрыть', onclick: togglePreview }, '✕')));
    pv.appendChild(h('div', { class: 'pv-stage ' + S.device }, frame));
    doPreview(true);
  }
  function togglePreview() { S.previewOn = !S.previewOn; renderPreviewPane(); updateBar(); }
  var pvTimer = null;
  function schedulePreview(now) {
    if (!S.previewOn) return;
    clearTimeout(pvTimer);
    pvTimer = setTimeout(function () { doPreview(now); }, now ? 30 : 650);
  }
  var PV_INJECT = '<style>.js .rv,.js .rv-t{opacity:1!important;transform:none!important;letter-spacing:inherit}.js .rv-i img{clip-path:none!important}.js .rv-l{transform:none!important}</style>' +
    '<script>document.addEventListener("click",function(e){var a=e.target.closest&&e.target.closest("a[href]");if(a&&a.getAttribute("href").charAt(0)!=="#"){e.preventDefault();}},true);<\/script>';
  function doPreview(jump) {
    var f = $('#pvFrame'); if (!f) return;
    var html;
    try { html = SR.renderIndex(S.data, { preview: true, noMusic: true, fallbackUrl: SITE_BASE }); }
    catch (e) { console.error(e); toast('Ошибка сборки предпросмотра: ' + e.message, 'err'); return; }
    html = html.replace('<head>', '<head>\n<base href="' + SITE_BASE + '">' + PV_INJECT);
    Object.keys(S.pending).forEach(function (p) { html = html.split(p).join(S.pending[p].url); });
    var y = 0;
    try { y = f.contentWindow ? f.contentWindow.scrollY : 0; } catch (e) {}
    var target = jump ? S.previewTarget : null;
    f.onload = function () {
      try {
        var w = f.contentWindow, doc = f.contentDocument;
        doc.documentElement.style.scrollBehavior = 'auto';
        if (target && target.id && doc.getElementById(target.id)) {
          var el = doc.getElementById(target.id);
          w.scrollTo(0, el.getBoundingClientRect().top + w.scrollY - 60);
        } else if (target && target.sheet) {
          var b = doc.createElement('button'); b.setAttribute('data-sheet', target.sheet); b.style.display = 'none';
          doc.body.appendChild(b); setTimeout(function () { b.click(); b.remove(); }, 120);
        } else w.scrollTo(0, y);
      } catch (e) {}
    };
    f.srcdoc = html;
  }

  /* ===================== страницы ===================== */
  var PAGES = {};

  PAGES.overview = function (m) {
    var d = S.data, warns = SR.validate(d);
    var host = SR.hostOf(d.settings && d.settings.domain);
    m.appendChild(pageHead('Обзор', 'Здесь собрано главное. Слева — все разделы для редактирования.'));
    var siteUrl = host ? 'https://' + host + '/' : SITE_BASE;
    var stats = h('div', { class: 'stats' },
      stat('Разделов', (d.sections || []).filter(function (s) { return s.enabled !== false; }).length + ' из ' + (d.sections || []).length),
      stat('Процедур', (d.sheets || []).length),
      stat('Фото', SR.collectImages(d).length),
      stat('Обновлено', d.updated || '—'));
    m.appendChild(stats);
    m.appendChild(card('Сайт', h('div', { class: 'kv' },
      kv('Адрес', h('a', { href: siteUrl, target: '_blank', rel: 'noopener' }, siteUrl)),
      kv('Репозиторий', h('a', { href: S.repo ? S.repo.html_url : '#', target: '_blank', rel: 'noopener' }, S.cfg.owner + '/' + S.cfg.repo + ' · ' + S.cfg.branch)),
      kv('Служебные файлы', h('span', null, ['robots.txt', 'sitemap.xml', 'llms.txt', 'llms-full.txt'].map(function (f, i) { return [i ? ' · ' : '', h('a', { href: siteUrl + f, target: '_blank', rel: 'noopener' }, f)]; }))),
      kv('Сборка GitHub Pages', h('span', { id: 'pagesSt', class: 'muted' }, 'проверяю…')))));
    S.gh.pagesBuild().then(function (b) {
      var el = $('#pagesSt'); if (!el) return;
      var st = { built: 'опубликован', building: 'собирается…', queued: 'в очереди…', errored: 'ошибка сборки' }[b.status] || b.status;
      el.textContent = st + ' · ' + fmtTime(b.updated_at || b.created_at);
      el.className = b.status === 'errored' ? 'err-text' : b.status === 'built' ? 'ok-text' : 'muted';
    }).catch(function () { var el = $('#pagesSt'); if (el) el.textContent = 'нет доступа (дайте токену «Pages: Read-only», если хотите видеть статус)'; });

    var wl = h('ul', { class: 'warns' });
    if (!warns.length) wl.appendChild(h('li', { class: 'ok' }, 'Ошибок не найдено.'));
    warns.forEach(function (w) { wl.appendChild(h('li', { class: w.level }, w.msg)); });
    m.appendChild(card('Проверка перед публикацией', wl));
    m.appendChild(card('Как пользоваться', h('ol', { class: 'howto' },
      h('li', null, 'Выберите раздел слева и меняйте тексты, цены, фото. Справа — живой предпросмотр.'),
      h('li', null, 'Изменения сохраняются в черновик этого браузера автоматически. Отменить — ↶ или Ctrl+Z.'),
      h('li', null, 'Нажмите «Опубликовать» (или Ctrl+S). Через 1–2 минуты сайт обновится; Яндекс и Bing получат уведомление через IndexNow.'),
      h('li', null, 'Телефон, адрес и мессенджеры меняются в «Контактах» — и сразу везде, где стоят подстановки {{phone}}, {{address}} и т.д.'))));
  };
  function stat(l, v) { return h('div', { class: 'stat' }, h('b', null, v), h('span', null, l)); }
  function kv(k, v) { return h('div', { class: 'kv-r' }, h('span', null, k), h('div', null, v)); }

  PAGES.sections = function (m) {
    var d = S.data;
    m.appendChild(pageHead('Разделы страницы', 'Порядок, видимость и содержимое разделов главной страницы.', addSectionBtn()));
    var list = h('div', { class: 'sec-list' });
    d.sections.forEach(function (s, i) {
      var def = SCH.SECTIONS[s.type] || { name: s.type, icon: '·' };
      var tg = h('input', { type: 'checkbox', checked: s.enabled !== false, title: 'Показывать на сайте' });
      tg.addEventListener('change', function () { s.enabled = tg.checked; row.classList.toggle('off', !tg.checked); changed({ nav: true }); renderSide(); });
      var row = h('div', { class: 'sec-row' + (s.enabled === false ? ' off' : '') },
        h('span', { class: 'ic' }, def.icon),
        h('button', { type: 'button', class: 'sec-name', onclick: function () { go({ page: 'section', index: i }); } }, h('b', null, sectionLabel(s)), h('span', null, def.name + ' · #' + s.id)),
        h('label', { class: 'sw', title: 'Показывать на сайте' }, tg, h('i')),
        h('div', { class: 'row-act' },
          h('button', { type: 'button', title: 'Выше', disabled: i === 0, onclick: function () { d.sections.splice(i - 1, 0, d.sections.splice(i, 1)[0]); changed({ rerender: true, nav: true }); renderSide(); } }, '↑'),
          h('button', { type: 'button', title: 'Ниже', disabled: i === d.sections.length - 1, onclick: function () { d.sections.splice(i + 1, 0, d.sections.splice(i, 1)[0]); changed({ rerender: true }); renderSide(); } }, '↓'),
          h('button', { type: 'button', title: 'Редактировать', onclick: function () { go({ page: 'section', index: i }); } }, '✎')));
      list.appendChild(row);
    });
    m.appendChild(list);
    m.appendChild(h('p', { class: 'muted small' }, 'Выключенный раздел остаётся в данных — его можно вернуть одним переключателем. Якорь (#id) используется в меню и кнопках.'));
  };
  function addSectionBtn() {
    var sel = h('select', { class: 'add-sel' }, h('option', { value: '' }, '+ Добавить раздел…'));
    Object.keys(SCH.TEMPLATES).forEach(function (t) { sel.appendChild(h('option', { value: t }, (SCH.SECTIONS[t] || {}).name || t)); });
    sel.addEventListener('change', function () {
      var t = sel.value; if (!t) return;
      var s = clone(SCH.TEMPLATES[t]);
      var base = t === 'text' ? 'block' : t, id = base, n = 2;
      while (S.data.sections.some(function (x) { return x.id === id; })) id = base + '-' + (n++);
      s.id = id; s.enabled = true;
      var at = S.data.sections.findIndex(function (x) { return x.type === 'contacts'; });
      if (at < 0) at = S.data.sections.length;
      S.data.sections.splice(at, 0, s);
      changed(); go({ page: 'section', index: at });
      toast('Раздел добавлен перед «Контактами». Переместить можно стрелками в списке разделов.');
    });
    return sel;
  }

  PAGES.section = function (m) {
    var i = S.view.index, s = S.data.sections[i];
    if (!s) { go({ page: 'sections' }); return; }
    var def = SCH.SECTIONS[s.type] || { name: s.type, fields: [] };
    m.appendChild(pageHead(sectionLabel(s), def.name + ' · раздел ' + (i + 1) + ' из ' + S.data.sections.length, [
      h('button', { type: 'button', class: 'btn ghost sm', onclick: function () { S.previewTarget = { id: s.id }; if (!S.previewOn) togglePreview(); else schedulePreview(true); } }, 'Показать в предпросмотре'),
      h('button', { type: 'button', class: 'btn ghost sm', onclick: function () {
        var c = clone(s); c.id = s.id + '-copy'; S.data.sections.splice(i + 1, 0, c); changed(); go({ page: 'section', index: i + 1 });
      } }, 'Дублировать'),
      h('button', { type: 'button', class: 'btn ghost sm danger-t', onclick: function () {
        confirmBox('Удалить раздел?', 'Раздел «' + sectionLabel(s) + '» будет удалён со страницы. Если нужно лишь скрыть — выключите переключатель «Показывать». Отменить удаление можно кнопкой ↶.', 'Удалить', true).then(function (ok) {
          if (!ok) return; S.data.sections.splice(i, 1); changed(); go({ page: 'sections' });
        });
      } }, 'Удалить')
    ]));
    var top = h('div', { class: 'card' });
    var base = [
      { k: 'enabled', t: 'toggle', label: 'Показывать на сайте', half: true },
      { k: 'id', t: 'text', label: 'Якорь (ID) для ссылок вида #' + s.id, mono: true, half: true, help: 'Латиница без пробелов. Если поменяете — обновите ссылки в меню.' }
    ];
    if (def.bg) base.push({ k: 'bg', t: 'select', label: 'Фон раздела', options: SCH.BG_OPTS, half: true });
    fields(top, s, base);
    m.appendChild(top);
    var body = h('div', { class: 'card' });
    fields(body, s, def.fields || []);
    m.appendChild(body);
  };

  PAGES.sheets = function (m) {
    m.appendChild(pageHead('Процедуры', 'Мини-страницы, которые открываются по клику на программу или плитку. Их тексты видят поисковики и нейросети.', h('button', { type: 'button', class: 'btn primary sm', onclick: function () {
      var id = 's-new', n = 2; while (S.data.sheets.some(function (x) { return x.id === id; })) id = 's-new-' + (n++);
      S.data.sheets.push({ id: id, eyebrow: 'Процедура', title: 'Новая процедура', lead: '', image: '', meta: [{ label: 'Длительность', value: '' }, { label: 'Стоимость', value: '' }], blocks: [{ title: 'Кому подойдёт', kind: 'list', warn: false, items: [''] }, { title: 'Когда стоит перенести', kind: 'text', warn: true, items: [''] }] });
      changed(); go({ page: 'sheet', id: id });
      toast('Процедура создана. Чтобы её открывали с сайта — выберите её в плитке или программе (поле «Мини-страница»).');
    } }, '+ Новая процедура')));
    var q = h('input', { type: 'search', placeholder: 'Поиск по названию…', class: 'search' });
    var list = h('div', { class: 'sheet-list' });
    function draw() {
      clear(list);
      var needle = q.value.toLowerCase();
      S.data.sheets.forEach(function (s) {
        var t = plain(s.title);
        if (needle && (t + ' ' + s.id).toLowerCase().indexOf(needle) < 0) return;
        var used = sheetUsage(s.id);
        list.appendChild(h('button', { type: 'button', class: 'sheet-row', onclick: function () { go({ page: 'sheet', id: s.id }); } },
          s.image ? h('img', { src: imgUrl(s.image), alt: '', loading: 'lazy' }) : h('span', { class: 'noimg' }),
          h('span', { class: 'sr-t' }, h('b', null, t || '(без названия)'), h('span', null, plain(s.eyebrow) + ' · #' + s.id)),
          h('em', { class: used.length ? '' : 'warn' }, used.length ? 'используется: ' + used.length : 'не привязана')));
      });
    }
    q.addEventListener('input', draw);
    m.appendChild(q); m.appendChild(list); draw();
  };
  function sheetUsage(id) {
    var out = [];
    (S.data.sections || []).forEach(function (s) {
      (function walk(o) {
        if (!o || typeof o !== 'object') return;
        if (Array.isArray(o)) { o.forEach(walk); return; }
        if (o.sheet === id) out.push({ section: s, label: plain(o.title || o.name || o.label || '') });
        for (var k in o) if (o[k] && typeof o[k] === 'object') walk(o[k]);
      })(s);
    });
    return out;
  }
  PAGES.sheet = function (m) {
    var idx = S.data.sheets.findIndex(function (x) { return x.id === S.view.id; });
    var s = S.data.sheets[idx];
    if (!s) { go({ page: 'sheets' }); return; }
    var used = sheetUsage(s.id);
    m.appendChild(pageHead(plain(s.title) || 'Процедура', 'Мини-страница процедуры · #' + s.id, [
      h('button', { type: 'button', class: 'btn ghost sm', onclick: function () { S.previewTarget = { sheet: s.id }; if (!S.previewOn) togglePreview(); else schedulePreview(true); } }, 'Открыть в предпросмотре'),
      h('button', { type: 'button', class: 'btn ghost sm', onclick: function () {
        var c = clone(s), id = s.id + '-2', n = 3; while (S.data.sheets.some(function (x) { return x.id === id; })) id = s.id + '-' + (n++);
        c.id = id; S.data.sheets.splice(idx + 1, 0, c); changed(); go({ page: 'sheet', id: id });
      } }, 'Дублировать'),
      h('button', { type: 'button', class: 'btn ghost sm danger-t', onclick: function () {
        confirmBox('Удалить процедуру?', used.length ? 'На неё ссылаются ' + used.length + ' кнопок/плиток — они перестанут открываться. Всё равно удалить?' : 'Процедура будет удалена.', 'Удалить', true).then(function (ok) {
          if (!ok) return; S.data.sheets.splice(idx, 1); changed(); go({ page: 'sheets' });
        });
      } }, 'Удалить')
    ]));
    if (used.length) m.appendChild(h('p', { class: 'muted small' }, 'Открывается из: ' + used.map(function (u) { return '«' + (u.label || sectionLabel(u.section)) + '» (#' + u.section.id + ')'; }).join(', ')));
    else m.appendChild(h('p', { class: 'warn-text small' }, 'Эту процедуру пока ничто не открывает. Привяжите её в плитке или программе (поле «Мини-страница»). Текст всё равно виден поисковикам.'));
    var c = h('div', { class: 'card' });
    var oldId = s.id;
    fields(c, s, SCH.SHEET);
    // при смене ID обновляем ссылки на процедуру
    c.querySelector('input').addEventListener('change', function () {
      var nid = s.id.trim().replace(/[^\w-]/g, '-');
      if (!/^s-/.test(nid)) nid = 's-' + nid;
      s.id = nid;
      if (nid !== oldId) {
        (function walk(o) { if (!o || typeof o !== 'object') return; if (Array.isArray(o)) { o.forEach(walk); return; } if (o.sheet === oldId) o.sheet = nid; for (var k in o) walk(o[k]); })(S.data.sections);
        S.view.id = nid; oldId = nid; changed(); renderMain();
      }
    });
    m.appendChild(c);
  };

  PAGES.contacts = function (m) {
    m.appendChild(pageHead('Контакты и реквизиты', 'Данные подставляются во все места сайта, разметку для поисковиков и llms.txt.'));
    var c = h('div', { class: 'card' }); fields(c, S.data.contacts, SCH.CONTACTS); m.appendChild(c);
    var o = h('div', { class: 'card' }); o.appendChild(h('h2', null, 'Реквизиты и владелец')); fields(o, S.data.org, SCH.ORG); m.appendChild(o);
  };
  PAGES.brand = function (m) {
    m.appendChild(pageHead('Бренд и логотип'));
    var c = h('div', { class: 'card' }); fields(c, S.data.brand, SCH.BRAND); m.appendChild(c);
    m.appendChild(card('Иконка сайта (фавикон)', faviconTool()));
  };
  function faviconTool() {
    var box = h('div', null, h('p', { class: 'f-h' }, 'Загрузите квадратное изображение (лучше 512×512 и больше). Админка сама сделает favicon.ico, значки 32, 180, 192 и 512 пикселей.'),
      h('div', { class: 'inline' }, h('img', { src: imgUrl('icon-192.png'), alt: '', style: { width: '48px', height: '48px', borderRadius: '10px' }, id: 'favPrev' }),
        h('button', { type: 'button', class: 'btn ghost sm', onclick: function () {
          pickFile('image/*').then(function (file) {
            if (!file) return;
            return loadImage(file).then(function (o) {
              var sizes = [['favicon-32.png', 32], ['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512], ['__ico48', 48]];
              return Promise.all(sizes.map(function (s) {
                var cv = document.createElement('canvas'); cv.width = cv.height = s[1];
                var cx = cv.getContext('2d'); cx.imageSmoothingQuality = 'high';
                var im = o.im, side = Math.min(im.naturalWidth, im.naturalHeight);
                cx.drawImage(im, (im.naturalWidth - side) / 2, (im.naturalHeight - side) / 2, side, side, 0, 0, s[1], s[1]);
                return canvasBlob(cv, 'image/png').then(function (b) { return b.arrayBuffer(); }).then(function (ab) { return [s[0], new Uint8Array(ab), s[1]]; });
              })).then(function (res) {
                var pngs = {};
                res.forEach(function (r) { if (r[0] !== '__ico48') addPending(r[0], r[1], 'image/png'); pngs[r[2]] = r[1]; });
                addPending('favicon.ico', makeIco([[32, pngs[32]], [48, pngs[48]]]), 'image/x-icon');
                URL.revokeObjectURL(o.url);
                $('#favPrev').src = imgUrl('icon-192.png');
                changed(); toast('Иконки готовы и будут загружены при публикации.', 'ok');
              });
            });
          }).catch(function (e) { toast(e.message, 'err'); });
        } }, 'Загрузить новую иконку')));
    return box;
  }
  function makeIco(list) {
    var head = 6 + 16 * list.length, total = head;
    list.forEach(function (x) { total += x[1].length; });
    var out = new Uint8Array(total), dv = new DataView(out.buffer);
    dv.setUint16(0, 0, true); dv.setUint16(2, 1, true); dv.setUint16(4, list.length, true);
    var off = head;
    list.forEach(function (x, i) {
      var p = 6 + i * 16;
      out[p] = x[0] >= 256 ? 0 : x[0]; out[p + 1] = x[0] >= 256 ? 0 : x[0]; out[p + 2] = 0; out[p + 3] = 0;
      dv.setUint16(p + 4, 1, true); dv.setUint16(p + 6, 32, true); dv.setUint32(p + 8, x[1].length, true); dv.setUint32(p + 12, off, true);
      out.set(x[1], off); off += x[1].length;
    });
    return out;
  }

  PAGES.nav = function (m) {
    m.appendChild(pageHead('Меню и подвал'));
    var a = h('div', { class: 'card' }); a.appendChild(h('h2', null, 'Меню')); fields(a, S.data.nav, SCH.NAV); m.appendChild(a);
    var b = h('div', { class: 'card' }); b.appendChild(h('h2', null, 'Подвал')); fields(b, S.data.footer, SCH.FOOTER); m.appendChild(b);
    var c = h('div', { class: 'card' }); c.appendChild(h('h2', null, 'Панель процедуры (низ)')); fields(c, S.data.sheetPanel, SCH.SHEET_PANEL); m.appendChild(c);
  };

  PAGES.seo = function (m) {
    var seo = S.data.seo;
    m.appendChild(pageHead('SEO и нейропоиск', 'Как сайт выглядит в Яндексе, Google и в ответах нейросетей.', [
      h('button', { type: 'button', class: 'btn ghost sm', onclick: pingIndexNow }, 'Сообщить поисковикам (IndexNow)')
    ]));
    var snip = h('div', { class: 'snippet' });
    function drawSnip() {
      var host = SR.hostOf(S.data.settings.domain) || 'сайт';
      clear(snip);
      snip.appendChild(h('div', { class: 'sn-url' }, h('img', { src: '../favicon-32.png', alt: '' }), host));
      snip.appendChild(h('div', { class: 'sn-t' }, plain(seo.title)));
      snip.appendChild(h('div', { class: 'sn-d' }, plain(seo.description)));
    }
    drawSnip();
    m.appendChild(card('Как выглядит в выдаче', snip));
    var c = h('div', { class: 'card' });
    fields(c, S.data.settings, [SCH.SETTINGS[0]]);
    fields(c, seo, SCH.SEO);
    c.addEventListener('input', debounce(drawSnip, 200));
    m.appendChild(c);
    var gen = h('button', { type: 'button', class: 'btn ghost sm', onclick: function () {
      var a = new Uint8Array(16); crypto.getRandomValues(a);
      seo.indexNowKey = Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
      changed({ rerender: true });
    } }, 'Сгенерировать новый ключ IndexNow');
    m.appendChild(card('Что публикуется автоматически', h('div', null,
      h('ul', { class: 'howto' },
        h('li', null, h('b', null, 'robots.txt'), ' — правила для роботов, разрешения для нейросетей, ссылка на карту сайта.'),
        h('li', null, h('b', null, 'sitemap.xml'), ' — карта сайта со всеми фотографиями (для Яндекс/Google Картинок).'),
        h('li', null, h('b', null, 'llms.txt и llms-full.txt'), ' — краткая и полная «справка» о студии для ChatGPT, Алисы, Perplexity, Claude, GigaChat.'),
        h('li', null, h('b', null, 'Разметка Schema.org'), ' — организация (BeautySalon + DaySpa), врач, услуги с ценами, FAQ, часы, координаты.'),
        h('li', null, h('b', null, 'CNAME'), ' — привязка домена для GitHub Pages.')),
      gen)));
  };
  function pingIndexNow(silent) {
    var d = S.data, host = SR.hostOf(d.settings && d.settings.domain), key = d.seo && d.seo.indexNowKey;
    if (!host || !key) { if (silent !== true) toast('Нужны домен и ключ IndexNow (SEO).', 'err'); return; }
    var urls = ['https://' + host + '/', 'https://' + host + '/llms.txt', 'https://' + host + '/llms-full.txt'];
    var eps = ['https://yandex.com/indexnow', 'https://api.indexnow.org/indexnow'];
    var jobs = [];
    eps.forEach(function (ep) { urls.forEach(function (u) { jobs.push(fetch(ep + '?url=' + encodeURIComponent(u) + '&key=' + key, { mode: 'no-cors' }).catch(function () {})); }); });
    Promise.all(jobs).then(function () { if (silent !== true) toast('Яндекс и Bing уведомлены об обновлении (IndexNow).', 'ok'); });
  }

  PAGES.music = function (m) {
    m.appendChild(pageHead('Музыка', 'Фоновая музыка сайта и кнопка «пауза/играть» в углу экрана.'));
    var c = h('div', { class: 'card' }); fields(c, S.data.music, SCH.MUSIC); m.appendChild(c);
    m.appendChild(card('Важно знать', h('ul', { class: 'howto' },
      h('li', null, 'Ни один браузер не даёт сайту включить звук до первого действия посетителя. Поэтому музыка стартует сразу, если браузер разрешил, а иначе — с первым касанием, кликом или нажатием клавиши.'),
      h('li', null, 'Кнопка с эквалайзером в углу — обязательна по правилам доступности: посетитель должен иметь возможность выключить звук.'),
      h('li', null, 'Использование чужой песни на сайте бизнеса требует лицензии правообладателя. Безопаснее — музыка с лицензией для коммерческого использования (стоки).'))));
  };

  PAGES.media = function (m) {
    m.appendChild(pageHead('Медиатека', 'Все фотографии сайта. Замена фото здесь меняет его во всех местах сразу.', h('button', { type: 'button', class: 'btn primary sm', onclick: function () {
      uploadImage({ max: 2400 }).then(function (r) { if (r) renderMain(); });
    } }, '+ Загрузить фото')));
    if (!S.repoFiles) { m.appendChild(h('p', { class: 'muted' }, 'Загружаю список файлов…')); refreshRepoFiles(); }
    var grid = h('div', { class: 'media-grid' });
    allImages().forEach(function (it) {
      var n = usage(it.src);
      grid.appendChild(h('div', { class: 'media-i' + (n ? '' : ' unused') },
        h('img', { src: imgUrl(it.src), alt: '', loading: 'lazy' }),
        h('span', null, it.src.split('/').pop()),
        h('small', null, (it.pending ? 'новое · ' : '') + (it.size ? kb(it.size) + ' · ' : '') + (n ? 'используется: ' + n : 'не используется')),
        h('div', { class: 'inline' },
          h('button', { type: 'button', class: 'btn ghost sm', onclick: function () {
            uploadImage({ max: 2400 }, it.src.split('/').pop().replace(/-\w{5}\.\w+$|\.\w+$/, '')).then(function (r) {
              if (!r) return;
              (function walk(o) {
                if (!o || typeof o !== 'object') return;
                if (Array.isArray(o)) { o.forEach(function (x, i) { if (x === it.src) o[i] = r.src; else walk(x); }); return; }
                for (var k in o) { if (o[k] === it.src) { o[k] = r.src; if (k === 'src' && r.w) { o.w = r.w; o.h = r.h; } } else walk(o[k]); }
              })(S.data);
              changed(); renderMain(); toast('Фото заменено во всех местах (' + n + ').', 'ok');
            });
          } }, 'Заменить'),
          !n && !it.pending ? h('button', { type: 'button', class: 'btn ghost sm danger-t', onclick: function () {
            confirmBox('Удалить файл из репозитория?', it.src + ' не используется на сайте. Файл удалится при следующей публикации.', 'Удалить', true).then(function (ok) {
              if (ok) { S.deletes[it.src] = true; updateBar(); renderMain(); }
            });
          } }, 'Удалить') : null,
          it.pending ? h('button', { type: 'button', class: 'btn ghost sm danger-t', onclick: function () { URL.revokeObjectURL(S.pending[it.src].url); delete S.pending[it.src]; updateBar(); renderMain(); } }, 'Отменить загрузку') : null)));
    });
    m.appendChild(grid);
  };

  PAGES.design = function (m) {
    m.appendChild(pageHead('Дизайн и заставка'));
    var c = h('div', { class: 'card' }); c.appendChild(h('h2', null, 'Общие настройки')); fields(c, S.data.settings, SCH.SETTINGS.slice(1)); m.appendChild(c);
    var colors = S.data.theme.colors;
    var cc = h('div', { class: 'card' }); cc.appendChild(h('h2', null, 'Цвета'));
    cc.appendChild(h('p', { class: 'f-h' }, 'Сайт построен на изумрудной шкале: от самого тёмного фона (950) до почти белого (050). Меняйте аккуратно и смотрите предпросмотр.'));
    fields(cc, colors, Object.keys(colors).map(function (k) { return { k: k, t: 'color', label: (SCH.COLOR_LABELS[k] || k) + ' (--' + k + ')', half: true }; }));
    m.appendChild(cc);
    if (!S.data.ui) S.data.ui = {};
    var cu = h('div', { class: 'card' }); cu.appendChild(h('h2', null, 'Служебные надписи'));
    fields(cu, S.data.ui, SCH.UI);
    m.appendChild(cu);
    var cs = h('div', { class: 'card' }); cs.appendChild(h('h2', null, 'Свои стили CSS'));
    fields(cs, S.data.theme, [{ k: 'customCss', t: 'code', label: 'CSS', help: 'Добавляется после основных стилей. Например: #hero h1{letter-spacing:0}' }]);
    m.appendChild(cs);
  };
  PAGES.code = function (m) {
    m.appendChild(pageHead('Код и счётчики', 'Яндекс Метрика, Google Analytics, виджеты онлайн-записи и чатов.'));
    var c = h('div', { class: 'card' }); fields(c, S.data.code, SCH.CODE); m.appendChild(c);
    m.appendChild(h('p', { class: 'warn-text small' }, 'Код вставляется в сайт без проверки. Если после публикации что-то сломалось — очистите поле и опубликуйте снова. В предпросмотре этот код не выполняется.'));
  };

  PAGES.history = function (m) {
    m.appendChild(pageHead('История версий', 'Каждая публикация — отдельная версия. Любую можно загрузить в редактор и опубликовать заново.'));
    var list = h('div', { class: 'hist' }, h('p', { class: 'muted' }, 'Загружаю…'));
    m.appendChild(list);
    S.gh.history(CONTENT, 40).then(function (items) {
      clear(list);
      if (!items.length) list.appendChild(h('p', { class: 'muted' }, 'История пуста.'));
      items.forEach(function (it, i) {
        list.appendChild(h('div', { class: 'hist-r' },
          h('div', null, h('b', null, (it.commit.message || '').split('\n')[0]), h('span', null, fmtTime(it.commit.author && it.commit.author.date) + ' · ' + ((it.commit.author && it.commit.author.name) || '') + (i === 0 ? ' · текущая' : ''))),
          h('div', { class: 'inline' },
            h('a', { class: 'btn ghost sm', href: it.html_url, target: '_blank', rel: 'noopener' }, 'На GitHub'),
            i ? h('button', { type: 'button', class: 'btn ghost sm', onclick: function () {
              S.gh.getFile(CONTENT, it.sha).then(function (f) {
                var d = JSON.parse(f.text);
                setData(d); go({ page: 'overview' });
                toast('Версия от ' + fmtTime(it.commit.author.date) + ' загружена в редактор. Проверьте и нажмите «Опубликовать», чтобы вернуть её на сайт.', 'ok');
              }).catch(function (e) { toast(e.message, 'err'); });
            } }, 'Загрузить в редактор') : null)));
      });
    }).catch(function (e) { clear(list); list.appendChild(h('p', { class: 'err-text' }, e.message)); });
  };

  PAGES.settings = function (m) {
    m.appendChild(pageHead('Подключение'));
    m.appendChild(card('Репозиторий', h('div', { class: 'kv' },
      kv('Репозиторий', S.cfg.owner + '/' + S.cfg.repo), kv('Ветка', S.cfg.branch), kv('API', apiBase()),
      kv('Токен', S.cfg.remember ? 'сохранён в этом браузере' : 'только до закрытия вкладки')),
      null));
    m.appendChild(h('div', { class: 'inline', style: { margin: '0 0 22px' } },
      h('button', { type: 'button', class: 'btn ghost', onclick: function () {
        confirmBox('Выйти из админки?', 'Токен будет удалён из этого браузера. Неопубликованные изменения останутся в черновике.', 'Выйти').then(function (ok) {
          if (!ok) return; try { localStorage.removeItem(LS_CFG); sessionStorage.removeItem(LS_CFG); } catch (e) {}
          var c = { owner: S.cfg.owner, repo: S.cfg.repo, branch: S.cfg.branch, remember: true };
          try { localStorage.setItem(LS_CFG, JSON.stringify(c)); } catch (e) {}
          location.reload();
        });
      } }, 'Выйти и забыть токен')));
    m.appendChild(card('Резервная копия', h('div', null,
      h('p', { class: 'f-h' }, 'Скачайте все данные сайта одним файлом или загрузите ранее сохранённый.'),
      h('div', { class: 'inline' },
        h('button', { type: 'button', class: 'btn ghost sm', onclick: function () {
          var a = h('a', { href: URL.createObjectURL(new Blob([JSON.stringify(S.data, null, 1)], { type: 'application/json' })), download: 'site-' + today() + '.json' });
          document.body.appendChild(a); a.click(); a.remove();
        } }, 'Скачать site.json'),
        h('button', { type: 'button', class: 'btn ghost sm', onclick: function () {
          pickFile('.json,application/json').then(function (f) {
            if (!f) return; return f.text().then(function (t) { var d = JSON.parse(t); if (!d.sections || !d.sheets) throw new Error('Это не файл данных сайта'); setData(d); toast('Данные загружены в редактор. Опубликуйте, чтобы применить.', 'ok'); });
          }).catch(function (e) { toast(e.message, 'err'); });
        } }, 'Загрузить из файла'),
        h('button', { type: 'button', class: 'btn ghost sm danger-t', onclick: function () {
          confirmBox('Отменить все неопубликованные изменения?', 'Редактор вернётся к версии, которая сейчас на сайте.', 'Отменить изменения', true).then(function (ok) {
            if (!ok) return; Object.keys(S.pending).forEach(function (p) { URL.revokeObjectURL(S.pending[p].url); }); S.pending = {}; S.deletes = {};
            setData(JSON.parse(S.baseText)); try { localStorage.removeItem(draftKey()); } catch (e) {}
          });
        } }, 'Отменить все изменения')))));
  };

  /* ===================== публикация ===================== */
  function openPublish() {
    if (!S.data) return;
    var warns = SR.validate(S.data);
    var errors = warns.filter(function (w) { return w.level === 'error'; });
    var msgIn = h('input', { type: 'text', value: 'Обновление сайта через админку' });
    var log = h('div', { class: 'pub-log' });
    var md = modal({
      title: 'Публикация', body: function (b) {
        b.appendChild(h('p', null, isDirty() ? 'Сайт будет пересобран и загружен в репозиторий одним коммитом. Через 1–2 минуты изменения появятся на сайте.' : 'Изменений нет, но можно пересобрать сайт (например, после обновления файлов вручную).'));
        if (warns.length) {
          var ul = h('ul', { class: 'warns' });
          warns.slice(0, 12).forEach(function (w) { ul.appendChild(h('li', { class: w.level }, w.msg)); });
          if (warns.length > 12) ul.appendChild(h('li', { class: 'info' }, '…и ещё ' + (warns.length - 12)));
          b.appendChild(ul);
        }
        b.appendChild(h('label', { class: 'f-l' }, 'Что изменили (видно в истории версий)'));
        b.appendChild(msgIn);
        b.appendChild(log);
      },
      actions: [
        { label: 'Отмена' },
        { label: errors.length ? 'Опубликовать, несмотря на ошибки' : 'Опубликовать', primary: true, keep: true, onClick: function () { run(); return false; } }
      ]
    });
    var running = false;
    function step(t) { log.appendChild(h('div', null, t)); log.scrollTop = log.scrollHeight; }
    function run() {
      if (running) return; running = true;
      md.box.querySelectorAll('.modal-f button').forEach(function (b) { b.disabled = true; });
      var data = clone(S.data);
      data.updated = today();
      var out = SR.renderAll(data, {});
      var files = out.files;
      files[CONTENT] = JSON.stringify(data, null, 1) + '\n';
      files['admin/config.json'] = JSON.stringify({ owner: S.cfg.owner, repo: S.cfg.repo, branch: S.cfg.branch }, null, 1) + '\n';
      Object.keys(S.pending).forEach(function (p) { files[p] = S.pending[p].bytes; });
      Object.keys(S.deletes).forEach(function (p) { files[p] = null; });
      S.gh.publish(files, msgIn.value.trim() || 'Обновление сайта через админку', step).then(function (r) {
        S.data = data; S.baseText = JSON.stringify(data); S.snap = S.baseText;
        GU.gitBlobSha(GU.enc.encode(files[CONTENT])).then(function (sha) { S.baseSha = sha; });
        Object.keys(S.pending).forEach(function (p) { URL.revokeObjectURL(S.pending[p].url); });
        S.pending = {}; S.deletes = {};
        try { localStorage.removeItem(draftKey()); } catch (e) {}
        updateBar(); renderSide(); renderMain(); refreshRepoFiles();
        clear(md.body);
        var host = SR.hostOf(data.settings.domain), url = host ? 'https://' + host + '/' : SITE_BASE;
        if (!r.changed.length) md.body.appendChild(h('p', null, 'Файлы на сайте уже совпадают с редактором — публиковать нечего.'));
        else {
          md.body.appendChild(h('p', { class: 'ok-text' }, '✓ Опубликовано. Изменено файлов: ' + r.changed.length + '.'));
          md.body.appendChild(h('ul', { class: 'files' }, r.changed.slice(0, 30).map(function (p) { return h('li', { class: 'mono' }, p); })));
          md.body.appendChild(h('p', null, 'GitHub Pages обновит сайт примерно через 1–2 минуты. ', h('a', { href: url, target: '_blank', rel: 'noopener' }, 'Открыть сайт ↗')));
          md.body.appendChild(h('p', { class: 'muted small' }, 'Через 2 минуты админка сообщит Яндексу и Bing об обновлении (IndexNow) — не закрывайте вкладку.'));
          setTimeout(function () { pingIndexNow(true); }, 120000);
        }
        var f = md.box.querySelector('.modal-f'); clear(f);
        f.appendChild(h('button', { type: 'button', class: 'btn primary', onclick: md.close }, 'Готово'));
      }, function (e) {
        running = false;
        step('✖ ' + e.message);
        md.box.querySelectorAll('.modal-f button').forEach(function (b) { b.disabled = false; });
        toast(e.message, 'err');
      });
    }
  }

  /* ===================== старт ===================== */
  function start() {
    fetch('config.json', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }).then(function (fc) {
      if (fc && fc.owner) S.fileCfg = fc;
      var c = loadCfg();
      if (c.token && c.owner && c.repo) {
        connect(c).catch(function (e) { showLogin(e.message); });
      } else showLogin();
    });
  }
  if (!window.SiteRender || !window.GitHub) { document.getElementById('app').textContent = 'Не загрузились файлы админки. Обновите страницу.'; return; }
  // хук для локальной проверки (только когда задан тестовый адрес API)
  try { if (localStorage.getItem(LS_API)) window.AdminDebug = { S: S, go: go, changed: changed, processImage: processImage, addPending: addPending, openPublish: openPublish }; } catch (e) {}
  start();
})();
