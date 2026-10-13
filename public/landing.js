/* Page d'accueil vendeuse, affichée aux visiteurs non connectés. */
(function () {
  var CONTACT = 'nathan.blaizot@gmail.com'; // adresse affichée pour « Demander une démo »
  var NOM = 'Loc en poche';
  var SIGNATURE = 'fait par Toutoune';

  var CSS = '' +
    '#web-landing{--l-bg:#F6F8FA;--l-surface:#fff;--l-ink:#0B2A3A;--l-muted:#4F6676;--l-line:#DDE6EC;--l-navy:#023047;--l-navy2:#0A4560;--l-gold:#D0BB63;--l-gold-ink:#1E2A10;--l-soft:#EEF3F6;' +
    'position:fixed;inset:0;z-index:9998;overflow:auto;background:var(--l-bg);color:var(--l-ink);font:16px/1.55 Inter,system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-text-size-adjust:100%}' +
    '@media (prefers-color-scheme:dark){#web-landing{--l-bg:#07161E;--l-surface:#0E2530;--l-ink:#EAF1F5;--l-muted:#9DB3C0;--l-line:#1B3948;--l-navy:#0A4560;--l-navy2:#0E5878;--l-gold:#D8C56F;--l-gold-ink:#1E2A10;--l-soft:#0B1F29}}' +
    '#web-landing *{box-sizing:border-box}#web-landing h1,#web-landing h2,#web-landing h3{font-family:Fraunces,Georgia,"Times New Roman",serif;font-weight:700;letter-spacing:-.01em;margin:0;text-wrap:balance}' +
    '#web-landing p{margin:0}#web-landing a{color:inherit}' +
    '.lp-wrap{width:100%;max-width:1080px;margin:0 auto;padding-inline:20px}' +
    '.lp-head{position:sticky;top:0;z-index:5;background:color-mix(in srgb,var(--l-bg) 88%,transparent);backdrop-filter:blur(10px);border-bottom:1px solid var(--l-line)}' +
    '.lp-head .lp-wrap{display:flex;align-items:center;justify-content:space-between;gap:12px;padding-block:12px}' +
    '.lp-brand{display:flex;align-items:center;gap:10px;font-family:Fraunces,Georgia,serif;font-weight:700;font-size:20px}' +
    '.lp-brand img{width:34px;height:34px;border-radius:9px}.lp-brand small{display:block;font:500 11px Inter,system-ui,sans-serif;color:var(--l-muted);letter-spacing:.04em;text-transform:uppercase}' +
    '.lp-btn{white-space:nowrap;display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:0 20px;border-radius:12px;border:1px solid var(--l-line);background:var(--l-surface);color:var(--l-ink);font:600 15px Inter,system-ui,sans-serif;cursor:pointer;text-decoration:none}' +
    '.lp-btn.gold{background:var(--l-gold);color:var(--l-gold-ink);border-color:transparent}.lp-btn.ghost{background:transparent;color:#fff;border-color:rgba(255,255,255,.35)}' +
    '.lp-btn:focus-visible{outline:3px solid var(--l-gold);outline-offset:2px}' +
    '.lp-hero{background:linear-gradient(160deg,var(--l-navy) 0%,#03223A 100%);color:#fff;overflow:hidden}' +
    '.lp-hero .lp-wrap{display:grid;grid-template-columns:1.05fr .95fr;gap:40px;align-items:center;padding-block:64px 72px}' +
    '.lp-kicker{display:inline-block;font:600 12px Inter,system-ui,sans-serif;letter-spacing:.09em;text-transform:uppercase;color:var(--l-gold);margin-bottom:14px}' +
    '.lp-hero h1{font-size:clamp(32px,5.2vw,52px);line-height:1.08}.lp-hero h1 em{font-style:normal;color:var(--l-gold)}' +
    '#web-landing .lp-hero p.lead{margin-top:18px;font-size:clamp(16px,2vw,19px);color:#C9DAE4;max-width:34em}' +
    '.lp-cta{display:flex;flex-wrap:wrap;gap:12px;margin-top:28px}.lp-note{margin-top:18px;font-size:13px;color:#9FB8C6}' +
    /* maquette devis */
    '.lp-mock{background:var(--l-surface);color:var(--l-ink);border-radius:18px 4px 18px 4px;padding:18px;box-shadow:0 24px 60px rgba(0,0,0,.35);transform:rotate(1.2deg);max-width:420px;margin-left:auto;width:100%}' +
    '.lp-mock .top{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:12px;color:var(--l-muted)}' +
    '.lp-mock .tag{font-weight:700;font-size:11px;letter-spacing:.06em;text-transform:uppercase;background:var(--l-soft);padding:3px 8px;border-radius:999px;color:var(--l-ink)}' +
    '#web-landing .lp-mock h3{font-size:19px;margin:10px 0 2px}.lp-mock .sub{font-size:13px;color:var(--l-muted)}' +
    '.lp-mock .row{display:flex;justify-content:space-between;gap:10px;padding:9px 0;border-top:1px solid var(--l-line);font-size:14px}.lp-mock .row span:last-child{font-variant-numeric:tabular-nums;font-weight:600;white-space:nowrap}' +
    '.lp-mock .tot{display:flex;justify-content:space-between;align-items:baseline;border-top:2px solid var(--l-ink);padding-top:10px;margin-top:2px;font-weight:700}.lp-mock .tot b{font-size:22px;font-variant-numeric:tabular-nums}' +
    '.lp-mock .chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:12px}.lp-mock .chip{font-size:12px;font-weight:600;padding:4px 10px;border-radius:999px;background:var(--l-soft)}.lp-mock .chip.ok{background:#DDF1E3;color:#1B5E32}' +
    '@media (prefers-color-scheme:dark){.lp-mock .chip.ok{background:#173A27;color:#8FD5A8}}' +
    '.lp-mock .ex{margin-top:10px;font-size:11px;color:var(--l-muted);text-align:right}' +
    /* sections */
    '.lp-sec{padding-block:64px}.lp-sec.alt{background:var(--l-soft)}' +
    '.lp-sec h2{font-size:clamp(26px,3.6vw,36px);line-height:1.15}.lp-sec .intro{margin-top:12px;color:var(--l-muted);max-width:40em;font-size:17px}' +
    '.lp-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:32px}' +
    '.lp-card{background:var(--l-surface);border:1px solid var(--l-line);border-radius:16px 4px 16px 4px;padding:20px;min-width:0}' +
    '.lp-card .ic{width:40px;height:40px;border-radius:11px;background:var(--l-navy);color:var(--l-gold);display:grid;place-items:center;margin-bottom:12px}.lp-card .ic svg{width:21px;height:21px}' +
    '#web-landing .lp-card h3{font-size:18px;margin-bottom:6px}.lp-card p{color:var(--l-muted);font-size:15px}' +
    '.lp-pain{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:32px}' +
    '.lp-pain>div{border-radius:16px;padding:22px;min-width:0}.lp-pain .avant{background:var(--l-surface);border:1px dashed var(--l-line)}.lp-pain .apres{background:var(--l-navy);color:#fff}' +
    '#web-landing .lp-pain h3{font-size:17px;margin-bottom:10px}.lp-pain ul{list-style:none;margin:0;padding:0;display:grid;gap:9px}.lp-pain li{display:flex;gap:10px;font-size:15px}.lp-pain li:before{content:"✕";color:#B93232;font-weight:700}.lp-pain .apres li:before{content:"✓";color:var(--l-gold)}' +
    '.lp-pain .apres li{color:#DCE9F0}.lp-pain .avant li{color:var(--l-muted)}' +
    '.lp-steps{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:32px;counter-reset:s}' +
    '.lp-step{position:relative;padding:20px 20px 20px 64px;background:var(--l-surface);border:1px solid var(--l-line);border-radius:16px;min-width:0}' +
    '.lp-step:before{counter-increment:s;content:counter(s);position:absolute;left:18px;top:18px;width:32px;height:32px;border-radius:50%;background:var(--l-gold);color:var(--l-gold-ink);display:grid;place-items:center;font:700 16px Fraunces,Georgia,serif}' +
    '#web-landing .lp-step h3{font-size:17px;margin-bottom:4px}.lp-step p{font-size:15px;color:var(--l-muted)}' +
    '.lp-final{background:linear-gradient(160deg,var(--l-navy),#03223A);color:#fff;text-align:center}.lp-final .lp-wrap{padding-block:64px}.lp-final h2{font-size:clamp(26px,4vw,38px)}.lp-final p{margin:14px auto 0;max-width:34em;color:#C9DAE4}.lp-final .lp-cta{justify-content:center}' +
    '.lp-foot{padding-block:24px;font-size:13px;color:var(--l-muted);text-align:center}.lp-foot .lp-wrap{display:grid;gap:4px}' +
    '@media (max-width:480px){.lp-brand small{display:none}.lp-btn{padding:0 16px}}' +
    '@media (max-width:860px){.lp-hero .lp-wrap{grid-template-columns:1fr;padding-block:40px 48px;gap:32px}.lp-mock{margin:0 auto;transform:none}.lp-grid,.lp-steps{grid-template-columns:1fr}.lp-pain{grid-template-columns:1fr}.lp-sec{padding-block:44px}}' +
    '@media (min-width:600px) and (max-width:860px){.lp-grid{grid-template-columns:1fr 1fr}}' +
    '@media (prefers-reduced-motion:no-preference){.lp-mock{transition:transform .3s}.lp-mock:hover{transform:rotate(0)}}';

  function ic(p) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>'; }
  var ICONS = {
    doc: ic('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>'),
    box: ic('<path d="M21 8l-9-5-9 5 9 5z"/><path d="M3 8v8l9 5 9-5V8M12 13v8"/>'),
    users: ic('<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 5.2a3 3 0 0 1 0 5.6M18 14.3c1.8.8 3 2.6 3 4.7"/>'),
    cash: ic('<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6.5 9.5v.01M17.5 14.5v.01"/>'),
    check: ic('<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.7 2.7L16 9.5"/>'),
    mail: ic('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 7l8.5 6 8.5-6"/>'),
    phone: ic('<rect x="7" y="2.5" width="10" height="19" rx="2.4"/><path d="M11 18.5h2"/>'),
    palette: ic('<path d="M12 3a9 9 0 0 0 0 18c1.2 0 1.8-.8 1.8-1.7 0-.9-.6-1.3-.6-2.2 0-.9.7-1.6 1.6-1.6H17a4 4 0 0 0 4-4C21 6.8 17 3 12 3z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10.5" cy="7.5" r="1"/><circle cx="15" cy="7.8" r="1"/>'),
    lock: ic('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>')
  };

  function html() {
    var feat = [
      ['doc', 'Devis et factures en quelques touches', 'Choisis le client, tape le nom du matériel, la ligne se remplit. HT, TTC, livraison et remise sont calculés, le PDF est prêt à envoyer.'],
      ['box', 'Un catalogue qui te ressemble', 'Ton matériel, tes tarifs, tes cautions et ton stock au même endroit. Tu retrouves un article en tapant quelques lettres.'],
      ['users', 'Tes clients et leur historique', 'Particuliers et professionnels, avec leurs coordonnées et tous leurs dossiers. Un nouveau client se crée directement dans le devis.'],
      ['check', 'Payé, récupéré : tout en un coup d’œil', 'Des pastilles de statut que tu touches pour les changer. Tu sais à tout moment ce qui est parti, ce qui est revenu et ce qui reste à encaisser.'],
      ['cash', 'Caisse pour tes évènements payants', 'Compte les entrées en espèces, carte bleue et chèque, vois l’écart avec la caisse réelle, puis envoie le récapitulatif à ton comptable.'],
      ['palette', 'À tes couleurs, avec ton logo', 'Tes devis, tes factures et l’appli prennent l’identité de ton entreprise. Tu règles tout toi-même depuis les réglages.']
    ];
    var cards = feat.map(function (f) { return '<article class="lp-card"><div class="ic">' + ICONS[f[0]] + '</div><h3>' + f[1] + '</h3><p>' + f[2] + '</p></article>'; }).join('');
    return '' +
      '<header class="lp-head"><div class="lp-wrap"><div class="lp-brand"><img src="/icon-192.png" alt="" width="34" height="34"><div>' + NOM + '<small>' + SIGNATURE + '</small></div></div>' +
      '<button class="lp-btn gold" data-lp="login" type="button">Se connecter</button></div></header>' +
      '<main>' +
      '<section class="lp-hero"><div class="lp-wrap"><div>' +
      '<span class="lp-kicker">Gestion pour loueurs de matériel</span>' +
      '<h1>Ta location de matériel, <em>enfin sous contrôle</em>.</h1>' +
      '<p class="lead">Devis, factures, stock, clients, paiements et caisse d’évènement. Tout dans une seule appli, sur ton téléphone comme sur ton ordinateur. Pensée par un loueur, pour les loueurs.</p>' +
      '<div class="lp-cta"><a class="lp-btn gold" href="mailto:' + CONTACT + '?subject=' + encodeURIComponent('Démo de ' + NOM) + '">Demander une démo</a><button class="lp-btn ghost" data-lp="login" type="button">J’ai déjà un compte</button></div>' +
      '<p class="lp-note">Pas de logiciel à installer : ça s’ouvre dans le navigateur.</p></div>' +
      '<div class="lp-mock" role="img" aria-label="Exemple de devis dans l’application"><div class="top"><span class="tag">Devis</span><span>Exemple</span></div>' +
      '<h3>Mariage de Camille et Hugo</h3><div class="sub">Samedi · 120 invités</div>' +
      '<div style="margin-top:10px"><div class="row"><span>Tente de réception 5 × 6 m</span><span>220,00 €</span></div><div class="row"><span>Tables et bancs × 15</span><span>135,00 €</span></div><div class="row"><span>Livraison et reprise</span><span>45,00 €</span></div></div>' +
      '<div class="tot"><span>Total TTC</span><b>480,00 €</b></div>' +
      '<div class="chips"><span class="chip ok">Acompte payé</span><span class="chip">À récupérer</span></div><div class="ex">Données d’illustration</div></div>' +
      '</div></section>' +

      '<section class="lp-sec"><div class="lp-wrap"><h2>Fini les papiers, les tableaux et les oublis</h2><p class="intro">Entre les devis dans un fichier, le stock dans un carnet et les paiements dans la tête, on perd du temps et de l’argent.</p>' +
      '<div class="lp-pain"><div class="avant"><h3>Avant</h3><ul><li>Des devis refaits à la main à chaque demande</li><li>Du matériel loué deux fois sans le savoir</li><li>Des paiements qu’on oublie de relancer</li><li>Les comptes d’un évènement faits le soir sur un coin de table</li></ul></div>' +
      '<div class="apres"><h3>Avec ' + NOM + '</h3><ul><li>Un devis prêt en une minute, en PDF</li><li>Le matériel et le stock toujours à jour</li><li>Le statut payé et récupéré visible partout</li><li>Une caisse qui se compte toute seule, prête pour le comptable</li></ul></div></div></div></section>' +

      '<section class="lp-sec alt"><div class="lp-wrap"><h2>Tout ce qu’il faut, rien de superflu</h2><p class="intro">Les outils du quotidien d’un loueur, simples à prendre en main dès la première utilisation.</p><div class="lp-grid">' + cards + '</div></div></section>' +

      '<section class="lp-sec"><div class="lp-wrap"><h2>Prête en trois étapes</h2><div class="lp-steps">' +
      '<div class="lp-step"><h3>On crée ton compte</h3><p>Ton espace est à toi, avec ton nom, ton logo et tes couleurs.</p></div>' +
      '<div class="lp-step"><h3>Tu importes ton matériel</h3><p>Ton catalogue et tes clients sont repris pour que tu démarres sans tout ressaisir.</p></div>' +
      '<div class="lp-step"><h3>Tu fais ton premier devis</h3><p>Quelques touches, un PDF propre, et ton client a sa proposition.</p></div></div>' +
      '<div class="lp-grid" style="margin-top:28px"><article class="lp-card"><div class="ic">' + ICONS.phone + '</div><h3>Partout avec toi</h3><p>Sur le camion, chez le client ou au bureau : tout est synchronisé entre téléphone et ordinateur. Tu peux l’ajouter à ton écran d’accueil comme une vraie appli.</p></article>' +
      '<article class="lp-card"><div class="ic">' + ICONS.users + '</div><h3>Pour toute l’équipe</h3><p>Chaque personne a son propre accès. Tu gères les comptes, tu sais qui fait quoi.</p></article>' +
      '<article class="lp-card"><div class="ic">' + ICONS.lock + '</div><h3>Tes données t’appartiennent</h3><p>Connexion sécurisée par mot de passe, données hébergées en ligne, export possible à tout moment.</p></article></div></div></section>' +

      '<section class="lp-final"><div class="lp-wrap"><h2>Prêt à gagner du temps sur chaque location ?</h2><p>Dis-nous comment tu travailles, on te montre l’appli en direct sur un cas réel.</p>' +
      '<div class="lp-cta"><a class="lp-btn gold" href="mailto:' + CONTACT + '?subject=' + encodeURIComponent('Démo de ' + NOM) + '">Demander une démo</a><button class="lp-btn ghost" data-lp="login" type="button">Se connecter</button></div>' +
      '<p style="font-size:14px;margin-top:16px">Ou écris-nous directement : <a href="mailto:' + CONTACT + '">' + CONTACT + '</a></p></div></section>' +
      '</main><footer class="lp-foot"><div class="lp-wrap"><div>' + NOM + ' ' + SIGNATURE + '</div><div>Conçu en Normandie pour les loueurs de matériel évènementiel.</div></div></footer>';
  }

  function show(onLogin) {
    if (!document.getElementById('lp-css')) {
      ['https://fonts.googleapis.com','https://fonts.gstatic.com'].forEach(function (h) { var c = document.createElement('link'); c.rel = 'preconnect'; c.href = h; if (h.indexOf('gstatic') > 0) c.crossOrigin = ''; document.head.appendChild(c); });
      var l = document.createElement('link'); l.rel = 'stylesheet';
      l.href = 'https://fonts.googleapis.com/css2?family=Fraunces:wght@600;700&family=Inter:wght@400;500;600&display=swap';
      document.head.appendChild(l);
      var s = document.createElement('style'); s.id = 'lp-css'; s.textContent = CSS; document.head.appendChild(s);
    }
    var old = document.getElementById('web-landing'); if (old) old.remove();
    var el = document.createElement('div'); el.id = 'web-landing'; el.innerHTML = html();
    el.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-lp="login"]') : null;
      if (b) { e.preventDefault(); el.remove(); onLogin(); }
    });
    document.body.appendChild(el);
    document.title = NOM + ' · Gestion de location de matériel';
  }
  window.WEB_LANDING = { show: show };
})();
