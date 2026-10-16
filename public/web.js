/* Version en ligne : remplace les services intégrés à Claude (base de données, téléchargement)
   par l'API du site, avec connexion par compte. L'appli elle-même n'est pas modifiée. */
(function () {
  'use strict';
  var API = '/api/';
  var POLL_FAST = 5000, POLL_SLOW = 20000, SLOW_AFTER = 6; // rythme de vérification : rapide tant que ça bouge, lent au repos
  var quiet = 0;             // nombre de vérifications consécutives sans nouveauté
  var cache = {};            // col -> { id: data }
  var colCbs = {};           // col -> [{ok, err}]
  var docCbs = {};           // 'col/id' -> [{ok, err}]
  var lastSeq = 0, loaded = false, epoch = 0, timer = 0, syncing = false, failCount = 0;
  var me = null;
  var readyResolve, ready = new Promise(function (r) { readyResolve = r; });

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function api(method, path, body) {
    return fetch(API + path, {
      method: method, credentials: 'same-origin',
      headers: { 'content-type': 'application/json', 'x-requested-with': 'regie' },
      body: body === undefined ? undefined : JSON.stringify(body)
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { return { status: r.status, body: j }; });
    });
  }

  /* ---------- Base de données (même interface que celle de Claude) ---------- */
  function snapCol(col) {
    var m = cache[col] || {};
    return { docs: Object.keys(m).map(function (id) { return { id: id, data: function () { return m[id]; } }; }) };
  }
  function snapDoc(col, id) {
    var d = (cache[col] || {})[id];
    return { id: id, exists: d !== undefined, data: function () { return d; } };
  }
  function fire(cols) {
    cols.forEach(function (col) {
      (colCbs[col] || []).forEach(function (l) { try { l.ok(snapCol(col)); } catch (e) { console.error(e); } });
      Object.keys(docCbs).forEach(function (k) {
        if (k.split('/')[0] !== col) return;
        var p = k.split('/');
        docCbs[k].forEach(function (l) { try { l.ok(snapDoc(p[0], p[1])); } catch (e) { console.error(e); } });
      });
    });
  }
  function apply(docs) {
    var changed = {};
    docs.forEach(function (d) {
      var m = cache[d.col] || (cache[d.col] = {});
      if (d.deleted) { delete m[d.id]; } else { m[d.id] = d.data; }
      changed[d.col] = 1;
    });
    return Object.keys(changed);
  }
  function sync() {
    if (syncing || !me) return Promise.resolve();
    syncing = true;
    var startEpoch = epoch;
    var changedAll = {};
    function page() {
      return api('GET', 'sync?since=' + Math.max(0, lastSeq - 25) + '&limit=400').then(function (r) {
        if (r.status === 401) { var e = new Error('auth'); e.auth = true; throw e; }
        if (r.status !== 200) throw new Error('sync ' + r.status);
        apply(r.body.docs).forEach(function (c) { changedAll[c] = 1; });
        if (r.body.max > lastSeq) { lastSeq = r.body.max; quiet = 0; }
        if (r.body.more) return page();
      });
    }
    return page().then(function () {
      syncing = false; failCount = 0; quiet++;
      if (!loaded) {
        loaded = true;
        fire(Object.keys(colCbs).concat(Object.keys(docCbs).map(function (k) { return k.split('/')[0]; })).filter(function (v, i, a) { return a.indexOf(v) === i; }));
      } else { fire(Object.keys(changedAll)); }
      if (startEpoch !== epoch) setTimeout(sync, 50);
    }).catch(function (e) {
      syncing = false; failCount++;
      if (e && e.auth) { showLogin(); return; }
      if (failCount === 3) Object.keys(colCbs).forEach(function (c) { colCbs[c].forEach(function (l) { if (l.err) l.err({ code: 'hors-ligne' }); }); });
    });
  }
  function startPolling() {
    if (timer) return;
    timer = 1;
    function tick() {
      var wait = quiet >= SLOW_AFTER ? POLL_SLOW : POLL_FAST;
      setTimeout(function () { if (!document.hidden) sync().then(tick, tick); else tick(); }, wait);
    }
    tick();
    function wake() { quiet = 0; }
    ['click', 'keydown', 'touchstart'].forEach(function (ev) { document.addEventListener(ev, wake, { passive: true }); });
    document.addEventListener('visibilitychange', function () { if (!document.hidden) { quiet = 0; sync(); } });
    window.addEventListener('online', sync);
  }
  function write(ops) {
    epoch++;
    return api('POST', 'write', { ops: ops }).then(function (r) {
      if (r.status === 401) { showLogin(); throw { code: 'non-connecte' }; }
      if (r.status !== 200) throw { code: r.body && r.body.error === 'quota' ? 'quota_exceeded' : (r.body && r.body.error || 'erreur') };
      quiet = 0; setTimeout(sync, 30);
      return r.body;
    }, function () { throw { code: 'hors-ligne' }; });
  }
  function localApply(col, id, op, data) {
    var m = cache[col] || (cache[col] = {});
    if (op === 'delete') delete m[id];
    else if (op === 'set') m[id] = JSON.parse(JSON.stringify(data));
    else m[id] = Object.assign({}, m[id] || {}, JSON.parse(JSON.stringify(data)));
    fire([col]);
  }
  /* Collections lourdes (photos, PDF) : jamais dans la synchro, chargées à la demande. */
  var HEAVY = { photos: 1, certifs: 1 };
  function heavyGet(qs) {
    return api('GET', 'heavy?' + qs).then(function (r) {
      if (r.status === 401) { showLogin(); throw { code: 'non-connecte' }; }
      if (r.status !== 200) throw { code: (r.body && r.body.error) || 'erreur' };
      return r.body.docs || [];
    }, function () { throw { code: 'hors-ligne' }; });
  }
  function docRef(col, id) {
    return {
      id: id,
      set: function (data) { localApply(col, id, 'set', data); return write([{ op: 'set', col: col, id: id, data: data }]).catch(function (e) { if (HEAVY[col]) localApply(col, id, 'delete'); throw e; }); },
      update: function (data) { localApply(col, id, 'update', data); return write([{ op: 'update', col: col, id: id, data: data }]); },
      delete: function () { localApply(col, id, 'delete'); return write([{ op: 'delete', col: col, id: id }]); },
      onSnapshot: function (ok, err) {
        var k = col + '/' + id; (docCbs[k] = docCbs[k] || []).push({ ok: ok, err: err });
        if (HEAVY[col] && (cache[col] || {})[id] === undefined) {
          heavyGet('col=' + col + '&id=' + encodeURIComponent(id)).then(function (docs) { apply(docs); try { ok(snapDoc(col, id)); } catch (e) { console.error(e); } }, function (e) { if (err) err(e); });
        } else if (loaded) setTimeout(function () { ok(snapDoc(col, id)); }, 0);
        return function () { docCbs[k] = (docCbs[k] || []).filter(function (l) { return l.ok !== ok; }); };
      }
    };
  }
  function newId() {
    var a = new Uint8Array(15); crypto.getRandomValues(a);
    return Array.prototype.map.call(a, function (b) { return 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]; }).join('');
  }
  var dbApi = {
    collection: function (col) {
      return {
        where: function (f, op, v) {
          return {
            onSnapshot: function (ok, err) {
              var filt = function (snap) { return { docs: snap.docs.filter(function (d) { var x = d.data(); return x && x[f] === v; }) }; };
              var l = { ok: function (snap) { ok(filt(snap)); }, err: err };
              (colCbs[col] = colCbs[col] || []).push(l);
              var go = function () { try { ok(filt(snapCol(col))); } catch (e) { console.error(e); } };
              if (HEAVY[col] && f === 'dossierId' && op === '==') heavyGet('col=' + col + '&dossierId=' + encodeURIComponent(v)).then(function (docs) { apply(docs); go(); }, function (e) { if (err) err(e); });
              else if (loaded) setTimeout(go, 0);
              return function () { colCbs[col] = (colCbs[col] || []).filter(function (x) { return x !== l; }); };
            }
          };
        },
        doc: function (id) { return docRef(col, id || newId()); },
        get: function () { // lecture complète (sauvegarde) : par pages pour les collections lourdes
          if (!HEAVY[col]) return Promise.resolve(snapCol(col));
          var all = [];
          var page = function (after) {
            return heavyGet('col=' + col + '&all=1&after=' + encodeURIComponent(after)).then(function (docs) {
              all = all.concat(docs);
              return docs.length >= 15 ? page(docs[docs.length - 1].id) : { docs: all.map(function (d) { return { id: d.id, data: function () { return d.data; } }; }) };
            });
          };
          return page('');
        },
        onSnapshot: function (ok, err) {
          (colCbs[col] = colCbs[col] || []).push({ ok: ok, err: err });
          if (loaded) setTimeout(function () { ok(snapCol(col)); }, 0);
          return function () { colCbs[col] = (colCbs[col] || []).filter(function (l) { return l.ok !== ok; }); };
        }
      };
    },
    doc: function (path) { var p = String(path).split('/'); return docRef(p[0], p[1]); }
  };

  /* ---------- Téléchargement ---------- */
  var dlApi = {
    save: function (o) {
      return new Promise(function (resolve, reject) {
        try {
          var blob = o.data instanceof Blob ? o.data : new Blob([o.data], { type: /\.csv$/i.test(o.filename) ? 'text/csv;charset=utf-8' : 'application/json' });
          var a = document.createElement('a');
          a.href = URL.createObjectURL(blob); a.download = o.filename; a.rel = 'noopener';
          document.body.appendChild(a); a.click();
          setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
          resolve({ ok: true });
        } catch (e) { reject({ code: 'erreur' }); }
      });
    }
  };

  /* ---------- Connexion ---------- */
  var CSS = '#web-login,#web-modal{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;padding:16px;overflow:auto;background:var(--bg,#F3F6F9)}' +
    '#web-modal{background:rgba(2,27,40,.55)}' +
    '.web-card{width:100%;max-width:420px;background:var(--surface,#fff);color:var(--ink,#023047);border:1px solid var(--line,#DCE5EB);border-radius:16px 4px 16px 4px;padding:22px;box-shadow:var(--shadow,0 10px 28px rgba(2,48,71,.12));display:grid;gap:12px;font-family:var(--font-body,system-ui,sans-serif)}' +
    '.web-card.wide{max-width:640px}.web-card h2{font-family:var(--font-display,inherit);margin:0;font-size:22px}' +
    '.web-card label{display:grid;gap:4px;font-size:13px;font-weight:600}.web-card input,.web-card select{padding:10px 12px;border:1px solid var(--line,#DCE5EB);border-radius:10px;background:var(--bg,#fff);color:inherit;font:inherit}' +
    '.web-card .btn{padding:10px 14px;border-radius:10px;border:1px solid var(--line,#DCE5EB);background:var(--surface,#fff);color:inherit;font:inherit;cursor:pointer}' +
    '.web-card .btn.p{background:var(--gold,#D0BB63);color:var(--gold-ink,#023047);border-color:transparent;font-weight:700}' +
    '.web-card .err{color:var(--bad,#B93232);font-size:13px;min-height:1.2em}.web-card .muted{color:var(--muted,#51697A);font-size:13px}' +
    '.web-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:space-between;padding:8px 0;border-top:1px solid var(--line,#DCE5EB)}.web-logo{max-width:180px;max-height:64px;object-fit:contain}';
  function injectCss() { if (document.getElementById('web-css')) return; var s = document.createElement('style'); s.id = 'web-css'; s.textContent = CSS; document.head.appendChild(s); }
  function msgFor(code) {
    return ({ identifiants: 'E-mail ou mot de passe incorrect.', 'trop-de-tentatives': 'Trop de tentatives : réessayez dans 10 minutes.', code: 'Code de première configuration incorrect.', email: 'Adresse e-mail invalide.', 'mot-de-passe-court': 'Le mot de passe doit faire au moins 8 caractères.', 'deja-configure': 'Le site est déjà configuré : connectez-vous.', existe: 'Cette adresse a déjà un compte.', 'ancien-mot-de-passe': 'Ancien mot de passe incorrect.', 'soi-meme': 'Action impossible sur votre propre compte.' })[code] || 'Une erreur est survenue. Réessayez.';
  }
  function showLogin(needSetup) {
    injectCss();
    var el = document.getElementById('web-login'); if (el) el.remove();
    el = document.createElement('div'); el.id = 'web-login';
    var setup = !!needSetup;
    el.innerHTML = '<form class="web-card" id="web-form" autocomplete="on"><h2>Loc en poche</h2>' +
      '<div class="muted">' + (setup ? 'Première configuration : créez le compte administrateur.' : 'Connectez-vous pour accéder à votre gestion.') + '</div>' +
      (setup ? '<label>Code de première configuration<input id="w-code" autocomplete="off" required></label><label>Votre nom<input id="w-name" autocomplete="name" required></label>' : '') +
      '<label>Adresse e-mail<input id="w-email" type="email" autocomplete="username" required></label>' +
      '<label>Mot de passe' + (setup ? ' (8 caractères minimum)' : '') + '<input id="w-pass" type="password" autocomplete="' + (setup ? 'new-password' : 'current-password') + '" required minlength="' + (setup ? 8 : 1) + '"></label>' +
      '<div class="err" id="w-err" role="alert"></div><button class="btn p" type="submit">' + (setup ? 'Créer le compte' : 'Se connecter') + '</button>' + (!setup && window.WEB_LANDING ? '<button class="btn" type="button" id="w-back">← Retour à l’accueil</button>' : '') + '</form>';
    document.body.appendChild(el);
    var f = document.getElementById('web-form');
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = function (i) { var x = document.getElementById(i); return x ? x.value : ''; };
      var btn = f.querySelector('button'); btn.disabled = true;
      var p = setup ? api('POST', 'setup', { code: v('w-code'), name: v('w-name'), email: v('w-email'), password: v('w-pass') }) : api('POST', 'login', { email: v('w-email'), password: v('w-pass') });
      p.then(function (r) {
        if (r.status === 200) { me = r.body.user; el.remove(); begin(); }
        else { btn.disabled = false; document.getElementById('w-err').textContent = msgFor(r.body && r.body.error); }
      }, function () { btn.disabled = false; document.getElementById('w-err').textContent = 'Connexion impossible : vérifiez votre accès à Internet.'; });
    });
    var back = document.getElementById('w-back'); if (back) back.addEventListener('click', function () { el.remove(); showHome(); });
    var first = document.getElementById(setup ? 'w-code' : 'w-email'); if (first) first.focus();
  }
  function showHome() { if (window.WEB_LANDING) window.WEB_LANDING.show(function () { showLogin(false); }); else showLogin(false); }
  function begin() { WEB.user = me; startPolling(); sync().then(function () { readyResolve(); }); }
  function boot() {
    api('GET', 'me').then(function (r) {
      if (r.status === 200) { me = r.body.user; begin(); }
      else if (r.body && r.body.needSetup) showLogin(true); else showHome();
    }, function () { injectCss(); document.body.insertAdjacentHTML('beforeend', '<div id="web-login"><div class="web-card"><h2>Hors connexion</h2><div class="muted">Impossible de joindre le serveur. Vérifiez votre connexion puis rechargez la page.</div></div></div>'); });
  }

  /* ---------- Comptes et import (fenêtre simple) ---------- */
  function modal(html) {
    injectCss(); closeModal();
    var m = document.createElement('div'); m.id = 'web-modal';
    m.innerHTML = '<div class="web-card wide" role="dialog" aria-modal="true">' + html + '</div>';
    m.addEventListener('click', function (e) { if (e.target === m) closeModal(); });
    document.body.appendChild(m); return m;
  }
  function closeModal() { var m = document.getElementById('web-modal'); if (m) m.remove(); }
  function accounts() {
    api('GET', 'users').then(function (r) {
      if (r.status !== 200) { alert_(msgFor(r.body && r.body.error)); return; }
      var rows = r.body.users.map(function (u) {
        return '<div class="web-row"><div><b>' + esc(u.name || u.email) + '</b><div class="muted">' + esc(u.email) + ' · ' + (u.role === 'admin' ? 'administrateur' : 'utilisateur') + (u.active ? '' : ' · désactivé') + '</div></div><div>' +
          '<button class="btn" data-w="reset" data-id="' + u.id + '">Nouveau mot de passe</button> ' +
          (u.id !== me.id ? '<button class="btn" data-w="toggle" data-id="' + u.id + '" data-a="' + (u.active ? 0 : 1) + '">' + (u.active ? 'Désactiver' : 'Réactiver') + '</button> <button class="btn" data-w="del" data-id="' + u.id + '">Supprimer</button>' : '') + '</div></div>';
      }).join('');
      var m = modal('<h2>Comptes</h2><div class="muted">Chaque personne se connecte avec son e-mail et son mot de passe.</div>' + rows +
        '<h3 style="margin:10px 0 0;font-size:16px">Ajouter un compte</h3><label>Nom<input id="n-name"></label><label>E-mail<input id="n-email" type="email"></label><label>Mot de passe (8 caractères minimum)<input id="n-pass" type="text" autocomplete="off"></label>' +
        '<label>Droits<select id="n-role"><option value="user">Utilisateur</option><option value="admin">Administrateur (gère les comptes)</option></select></label><div class="err" id="n-err"></div>' +
        '<div class="web-row"><button class="btn" data-w="close">Fermer</button><button class="btn p" data-w="add">Ajouter le compte</button></div>');
      m.addEventListener('click', function (e) {
        var b = e.target.closest('[data-w]'); if (!b) return; var w = b.dataset.w, id = b.dataset.id;
        if (w === 'close') closeModal();
        else if (w === 'add') api('POST', 'users', { name: document.getElementById('n-name').value, email: document.getElementById('n-email').value, password: document.getElementById('n-pass').value, role: document.getElementById('n-role').value }).then(function (x) { if (x.status === 200) accounts(); else document.getElementById('n-err').textContent = msgFor(x.body && x.body.error); });
        else if (w === 'toggle') api('POST', 'users/' + id, { active: b.dataset.a === '1' }).then(accounts);
        else if (w === 'del') { if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'Confirmer'; } else api('DELETE', 'users/' + id).then(accounts); }
        else if (w === 'reset') resetPw(id);
      });
    });
  }
  function resetPw(id) {
    var m = modal('<h2>Nouveau mot de passe</h2><label>Mot de passe (8 caractères minimum)<input id="r-pass" type="text" autocomplete="off"></label><div class="err" id="r-err"></div><div class="web-row"><button class="btn" data-w="back">Annuler</button><button class="btn p" data-w="ok">Enregistrer</button></div>');
    m.addEventListener('click', function (e) {
      var b = e.target.closest('[data-w]'); if (!b) return;
      if (b.dataset.w === 'back') accounts();
      if (b.dataset.w === 'ok') api('POST', 'users/' + id, { password: document.getElementById('r-pass').value }).then(function (x) { if (x.status === 200) accounts(); else document.getElementById('r-err').textContent = msgFor(x.body && x.body.error); });
    });
  }
  function changePassword() {
    var m = modal('<h2>Changer mon mot de passe</h2><label>Mot de passe actuel<input id="p-old" type="password" autocomplete="current-password"></label><label>Nouveau mot de passe (8 caractères minimum)<input id="p-new" type="password" autocomplete="new-password"></label><div class="err" id="p-err"></div><div class="web-row"><button class="btn" data-w="close">Annuler</button><button class="btn p" data-w="ok">Enregistrer</button></div>');
    m.addEventListener('click', function (e) {
      var b = e.target.closest('[data-w]'); if (!b) return;
      if (b.dataset.w === 'close') closeModal();
      if (b.dataset.w === 'ok') api('POST', 'me/password', { old: document.getElementById('p-old').value, password: document.getElementById('p-new').value }).then(function (x) { if (x.status === 200) closeModal(); else document.getElementById('p-err').textContent = msgFor(x.body && x.body.error); });
    });
  }
  function alert_(t) { var m = modal('<h2>Information</h2><div>' + esc(t) + '</div><div class="web-row"><span></span><button class="btn p" data-w="close">OK</button></div>'); m.addEventListener('click', function (e) { if (e.target.closest('[data-w]')) closeModal(); }); }
  function importData() {
    var m = modal('<h2>Importer des données</h2><div class="muted">Choisissez le fichier d\'export (JSON) de l\'ancienne version. Les éléments ayant le même identifiant sont remplacés.</div><label>Fichier<input id="i-file" type="file" accept=".json,application/json"></label><div id="i-msg" class="muted"></div><div class="web-row"><button class="btn" data-w="close">Fermer</button><button class="btn p" data-w="go">Importer</button></div>');
    m.addEventListener('click', function (e) {
      var b = e.target.closest('[data-w]'); if (!b) return;
      if (b.dataset.w === 'close') { closeModal(); return; }
      var f = document.getElementById('i-file').files[0], msg = document.getElementById('i-msg');
      if (!f) { msg.textContent = 'Choisissez d\'abord un fichier.'; return; }
      b.disabled = true; msg.textContent = 'Lecture du fichier…';
      f.text().then(function (t) {
        var j = JSON.parse(t), ops = [];
        Object.keys(j.collections || {}).forEach(function (col) { (j.collections[col] || []).forEach(function (d) { var id = d.id; var o = Object.assign({}, d); delete o.id; ops.push({ op: 'set', col: col, id: id, data: o }); }); });
        Object.keys(j.docs || {}).forEach(function (k) { var p = k.split('/'); ops.push({ op: 'set', col: p[0], id: p[1], data: j.docs[k] }); });
        var i = 0, total = ops.length;
        function next() {
          if (i >= total) { msg.textContent = total + ' éléments importés.'; b.disabled = false; sync(); return; }
          var chunk = ops.slice(i, i + 40);
          api('POST', 'write', { ops: chunk }).then(function (r) {
            if (r.status !== 200) { msg.textContent = 'Échec de l\'import (' + (r.body && r.body.error || r.status) + ') après ' + i + ' éléments.'; b.disabled = false; return; }
            i += chunk.length; msg.textContent = 'Import en cours : ' + Math.min(i, total) + ' / ' + total; next();
          });
        }
        next();
      }).catch(function () { msg.textContent = 'Fichier illisible.'; b.disabled = false; });
    });
  }
  function logout() { api('POST', 'logout', {}).then(function () { location.reload(); }); }
  function fmtMo(n) { return n >= 1073741824 ? (n / 1073741824).toFixed(1).replace('.', ',') + ' Go' : Math.max(0.1, n / 1048576).toFixed(n < 10485760 ? 1 : 0).replace('.', ',') + ' Mo'; }
  function storageLine() {
    var el = document.getElementById('web-storage'); if (!el) return;
    api('GET', 'storage').then(function (r) {
      if (r.status !== 200 || !el.isConnected) return;
      var p = Math.min(100, Math.round(100 * r.body.used / r.body.quota));
      el.innerHTML = 'Espace photos et PDF : <b>' + fmtMo(r.body.used) + '</b> utilisés sur ' + fmtMo(r.body.quota) + ' (' + p + ' %)' +
        '<div style="height:6px;border-radius:3px;background:var(--line,#dde3e8);margin-top:5px;overflow:hidden"><div style="height:100%;width:' + p + '%;background:' + (p > 90 ? 'var(--bad,#c0392b)' : 'var(--primary,#023047)') + '"></div></div>';
    }, function () {});
  }
  function card() {
    if (!me) return '';
    setTimeout(storageLine, 80);
    return '<h3>Compte</h3><div class="card card-pad" style="display:grid;gap:10px"><div>Connecté en tant que <b>' + esc(me.name || me.email) + '</b> <span class="muted small">(' + esc(me.email) + ' · ' + (me.role === 'admin' ? 'administrateur' : 'utilisateur') + ')</span></div>' +
      '<div class="toolbar" style="margin:0"><button class="btn btn-sm" data-action="web-password">Changer mon mot de passe</button>' +
      (me.role === 'admin' ? '<button class="btn btn-sm" data-action="web-accounts">Gérer les comptes</button><button class="btn btn-sm" data-action="web-import">Importer des données</button>' : '') +
      '<button class="btn btn-sm" data-action="web-logout">Se déconnecter</button></div><div id="web-storage" class="small muted"></div></div>';
  }

  var WEB = window.WEB = { user: null, card: card, accounts: accounts, password: changePassword, logout: logout, importData: importData };
  window.claude = {
    use: function (name) {
      if (name === 'db') return ready.then(function () { return dbApi; });
      if (name === 'downloads') return Promise.resolve(dlApi);
      return Promise.resolve(null);
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
