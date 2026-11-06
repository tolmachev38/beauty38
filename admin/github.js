/* admin/github.js — работа с репозиторием через GitHub REST API.
   Публикация = один атомарный коммит (Git Data API): blobs → tree → commit → ref.
   Токен хранится только в браузере администратора и уходит только на api.github.com. */
(function (root) {
  'use strict';

  var enc = new TextEncoder();
  var dec = new TextDecoder('utf-8');

  function b64ToBytes(b64) {
    var bin = atob(String(b64 || '').replace(/\s/g, ''));
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function bytesToB64(bytes) {
    var s = '', CH = 0x8000;
    for (var i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return btoa(s);
  }
  function hex(buf) {
    return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }
  /** SHA-1 git-объекта blob — по нему понимаем, изменился ли файл */
  function gitBlobSha(bytes) {
    var head = enc.encode('blob ' + bytes.length + '\0');
    var all = new Uint8Array(head.length + bytes.length);
    all.set(head, 0); all.set(bytes, head.length);
    return crypto.subtle.digest('SHA-1', all).then(hex);
  }

  function GitHub(cfg) {
    this.token = cfg.token;
    this.owner = cfg.owner;
    this.repo = cfg.repo;
    this.branch = cfg.branch || 'main';
    this.api = (cfg.api || 'https://api.github.com').replace(/\/+$/, '');
  }
  GitHub.prototype.base = function () { return '/repos/' + encodeURIComponent(this.owner) + '/' + encodeURIComponent(this.repo); };

  GitHub.prototype.req = function (method, path, body, opts) {
    opts = opts || {};
    var headers = { Accept: opts.accept || 'application/vnd.github+json' };
    if (this.token) headers.Authorization = 'Bearer ' + this.token;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    return fetch(this.api + path, { method: method, headers: headers, body: body !== undefined ? JSON.stringify(body) : undefined, cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) {
          return r.text().then(function (t) {
            var msg = '';
            try { msg = JSON.parse(t).message; } catch (e) { msg = t.slice(0, 200); }
            var err = new Error(GitHub.humanError(r.status, msg));
            err.status = r.status; err.raw = msg;
            throw err;
          });
        }
        if (r.status === 204) return null;
        return opts.text ? r.text() : r.json();
      }, function (e) {
        var err = new Error('Нет связи с GitHub. Проверьте интернет (или VPN/фильтры, блокирующие api.github.com).');
        err.status = 0; throw err;
      });
  };

  GitHub.humanError = function (status, msg) {
    if (status === 401) return 'Токен не подходит или истёк (401). Выпустите новый токен и войдите заново.';
    if (status === 403) return /rate limit/i.test(msg) ? 'Превышен лимит запросов GitHub. Подождите несколько минут.' :
      'Нет прав (403). У токена должно быть разрешение «Contents: Read and write» именно для этого репозитория.';
    if (status === 404) return 'Не найдено (404). Проверьте владельца/название репозитория и ветку, а также что токен выдан на этот репозиторий.';
    if (status === 409) return 'Репозиторий пуст или занят (409). Загрузите файлы сайта хотя бы одним коммитом.';
    if (status === 422) return 'GitHub отклонил изменение (422): ' + msg;
    return 'Ошибка GitHub ' + status + (msg ? ': ' + msg : '');
  };

  GitHub.prototype.repoInfo = function () { return this.req('GET', this.base()); };
  GitHub.prototype.user = function () { return this.req('GET', '/user'); };

  /** Файл как текст + его sha. ref — ветка или коммит. */
  GitHub.prototype.getFile = function (path, ref) {
    var self = this;
    var url = this.base() + '/contents/' + path.split('/').map(encodeURIComponent).join('/') + '?ref=' + encodeURIComponent(ref || this.branch);
    return this.req('GET', url).then(function (j) {
      if (Array.isArray(j)) throw new Error(path + ' — это папка');
      if (j.content && j.encoding === 'base64') return { sha: j.sha, text: dec.decode(b64ToBytes(j.content)), size: j.size };
      // файл больше 1 МБ: берём через blob
      return self.req('GET', self.base() + '/git/blobs/' + j.sha).then(function (b) {
        return { sha: j.sha, text: dec.decode(b64ToBytes(b.content)), size: j.size };
      });
    });
  };

  GitHub.prototype.headSha = function () {
    return this.req('GET', this.base() + '/git/ref/heads/' + encodeURIComponent(this.branch)).then(function (j) { return j.object.sha; });
  };
  GitHub.prototype.commit = function (sha) { return this.req('GET', this.base() + '/git/commits/' + sha); };
  GitHub.prototype.tree = function (sha, recursive) {
    return this.req('GET', this.base() + '/git/trees/' + sha + (recursive ? '?recursive=1' : ''));
  };
  /** Карта путь → sha всех файлов в текущей ветке */
  GitHub.prototype.listFiles = function () {
    var self = this, out = { head: null, tree: null, files: {} };
    return this.headSha().then(function (h) {
      out.head = h; return self.commit(h);
    }).then(function (c) {
      out.tree = c.tree.sha; return self.tree(c.tree.sha, true);
    }).then(function (t) {
      (t.tree || []).forEach(function (e) { if (e.type === 'blob') out.files[e.path] = { sha: e.sha, size: e.size }; });
      out.truncated = !!t.truncated;
      return out;
    });
  };
  GitHub.prototype.createBlob = function (bytes) {
    return this.req('POST', this.base() + '/git/blobs', { content: bytesToB64(bytes), encoding: 'base64' }).then(function (j) { return j.sha; });
  };
  GitHub.prototype.createTree = function (baseTree, entries) {
    return this.req('POST', this.base() + '/git/trees', { base_tree: baseTree, tree: entries }).then(function (j) { return j.sha; });
  };
  GitHub.prototype.createCommit = function (message, tree, parents) {
    return this.req('POST', this.base() + '/git/commits', { message: message, tree: tree, parents: parents }).then(function (j) { return j.sha; });
  };
  GitHub.prototype.updateRef = function (sha) {
    return this.req('PATCH', this.base() + '/git/refs/heads/' + encodeURIComponent(this.branch), { sha: sha, force: false });
  };
  GitHub.prototype.history = function (path, n) {
    return this.req('GET', this.base() + '/commits?sha=' + encodeURIComponent(this.branch) + (path ? '&path=' + encodeURIComponent(path) : '') + '&per_page=' + (n || 30));
  };
  GitHub.prototype.pagesBuild = function () { return this.req('GET', this.base() + '/pages/builds/latest'); };
  GitHub.prototype.pagesInfo = function () { return this.req('GET', this.base() + '/pages'); };

  /**
   * Публикация набора файлов одним коммитом.
   * files: { 'путь': Uint8Array | string | null (null = удалить) }
   * onStep(текст) — для индикатора.
   * Загружаются только файлы, чьё содержимое отличается от текущего в ветке.
   */
  GitHub.prototype.publish = function (files, message, onStep) {
    var self = this;
    onStep = onStep || function () {};
    var paths = Object.keys(files);
    var bytesMap = {};
    paths.forEach(function (p) {
      var v = files[p];
      bytesMap[p] = v == null ? null : (typeof v === 'string' ? enc.encode(v) : v);
    });
    var state, changed = [], blobShas = {};
    onStep('Читаю текущее состояние репозитория…');
    function attempt(tries) {
      return self.listFiles().then(function (s) {
        state = s;
        changed = [];
        return Promise.all(paths.map(function (p) {
          var b = bytesMap[p];
          if (b === null) { if (state.files[p]) changed.push(p); return null; }
          return gitBlobSha(b).then(function (sha) {
            if (!state.files[p] || state.files[p].sha !== sha) { changed.push(p); blobShas[p] = blobShas[p] || null; }
          });
        }));
      }).then(function () {
        if (!changed.length) return { changed: [], commit: null };
        var queue = changed.filter(function (p) { return bytesMap[p] !== null && !blobShas[p]; });
        var done = 0;
        function next() {
          if (!queue.length) return Promise.resolve();
          var p = queue.shift();
          onStep('Загружаю ' + (++done) + ' из ' + (done + queue.length) + ': ' + p);
          return self.createBlob(bytesMap[p]).then(function (sha) { blobShas[p] = sha; return next(); });
        }
        // три потока параллельно
        return Promise.all([next(), next(), next()]).then(function () {
          onStep('Собираю коммит…');
          var entries = changed.map(function (p) {
            return bytesMap[p] === null ? { path: p, mode: '100644', type: 'blob', sha: null } : { path: p, mode: '100644', type: 'blob', sha: blobShas[p] };
          });
          return self.createTree(state.tree, entries);
        }).then(function (treeSha) {
          return self.createCommit(message, treeSha, [state.head]);
        }).then(function (commitSha) {
          onStep('Обновляю ветку ' + self.branch + '…');
          return self.updateRef(commitSha).then(function () { return { changed: changed, commit: commitSha }; });
        });
      }).catch(function (e) {
        // ветку успели изменить с другого устройства — повторяем поверх свежего состояния
        if ((e.status === 422 || e.status === 409) && tries < 2) { onStep('Ветка изменилась, повторяю…'); return attempt(tries + 1); }
        throw e;
      });
    }
    return attempt(0);
  };

  /* Разбор адреса репозитория: «owner/repo», ссылка github.com/owner/repo или owner.github.io/repo */
  GitHub.parseRepo = function (s) {
    s = String(s || '').trim().replace(/\.git$/, '').replace(/\/+$/, '');
    var m = /github\.com[/:]([^/]+)\/([^/?#]+)/i.exec(s);
    if (m) return { owner: m[1], repo: m[2] };
    m = /^([\w.-]+)\.github\.io(?:\/([^/?#]+))?/i.exec(s.replace(/^https?:\/\//, ''));
    if (m) return { owner: m[1], repo: m[2] || (m[1] + '.github.io') };
    m = /^([\w.-]+)\/([\w.-]+)$/.exec(s);
    if (m) return { owner: m[1], repo: m[2] };
    return null;
  };

  root.GitHub = GitHub;
  root.GitUtil = { b64ToBytes: b64ToBytes, bytesToB64: bytesToB64, gitBlobSha: gitBlobSha, enc: enc, dec: dec };
})(window);
