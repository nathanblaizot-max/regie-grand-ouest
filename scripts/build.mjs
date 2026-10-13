// Fabrique public/index.html à partir de app.src.html (la source de l'appli) pour la version en ligne.
import fs from 'node:fs';

let s = fs.readFileSync(new URL('../app.src.html', import.meta.url), 'utf8');
function patch(a, b) {
  if (!s.includes(a)) throw new Error('Modification introuvable dans app.src.html : ' + a.slice(0, 70));
  s = s.replace(a, () => b);
}

// Pas de Gmail hors de Claude : on retire l'onglet Mails.
patch("['mails','Mails','mail'],", '');
// Bloc « Compte » dans les Réglages.
patch(
  `+'<div class="toolbar" style="margin:0"><button class="btn" data-action="export">'`,
  `+(window.WEB?window.WEB.card():'')+'<div class="toolbar" style="margin:0"><button class="btn" data-action="export">'`
);
// Actions du bloc Compte.
patch(
  "  'add-line':function(){",
  `  'web-logout':function(){window.WEB.logout();},
  'web-accounts':function(){window.WEB.accounts();},
  'web-password':function(){window.WEB.password();},
  'web-import':function(){window.WEB.importData();},
  'add-line':function(){`
);

const head = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#023047">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Régie">
<meta name="description" content="Régie : devis, factures, stock, clients et caisse d’évènement pour les loueurs de matériel. Sur téléphone et ordinateur.">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="icon" href="/icon-192.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<style>:root{color-scheme:light;padding-block:env(safe-area-inset-top,0px) env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>
</head>
<body>
<script src="/landing.js"></script>
<script src="/web.js"></script>
`;
fs.mkdirSync(new URL('../public', import.meta.url), { recursive: true });
fs.writeFileSync(new URL('../public/index.html', import.meta.url), head + s + '\n</body>\n</html>\n');
console.log('public/index.html généré (' + Math.round((head.length + s.length) / 1024) + ' Ko)');
