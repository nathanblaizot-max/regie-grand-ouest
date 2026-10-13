import { createRequire } from 'node:module';
import { startServer } from './dev-server.mjs';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const { server, port } = await startServer();
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 420, height: 800 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://127.0.0.1:' + port + '/');
  await page.waitForSelector('#web-form');
  await page.fill('#w-code', 'TESTCODE'); await page.fill('#w-name', 'N'); await page.fill('#w-email', 'n@t.fr'); await page.fill('#w-pass', 'motdepasse1');
  await page.click('#web-form button');
  await page.waitForSelector('nav.nav button');
  await page.click('nav.nav button:has-text("Réglages")');
  await page.click('button:has-text("Importer des données")');
  await page.setInputFiles('#i-file', process.argv[2]);
  await page.click('#web-modal button:has-text("Importer")');
  await page.waitForSelector('text=éléments importés', { timeout: 60000 });
  await page.click('#web-modal button:has-text("Fermer")');
  // rechargement à froid
  const t0 = Date.now();
  await page.reload(); await page.waitForSelector('nav.nav button', { timeout: 30000 });
  console.log('Rechargement -> appli prête (ms):', Date.now() - t0);
  const nav = await page.evaluate(() => performance.getEntriesByType('navigation')[0].toJSON());
  console.log('DOMContentLoaded', Math.round(nav.domContentLoadedEventEnd), 'load', Math.round(nav.loadEventEnd), 'transfert', nav.transferSize);
  const tabs = await page.$$eval('nav.nav button', b => b.map(x => x.textContent.trim()));
  for (const t of tabs) {
    const a = await page.evaluate(() => performance.now());
    await page.click('nav.nav button:has-text("' + t + '")');
    await page.waitForTimeout(50);
    const b = await page.evaluate(() => performance.now());
    const n = await page.evaluate(() => document.querySelectorAll('*').length);
    console.log(t.padEnd(22), 'éléments DOM', n);
  }
  // temps d'un render mesuré dans la page
  const r = await page.evaluate(async () => {
    const out = {};
    for (const t of ['Clients','Matériel','Devis et factures','Locations','Planning','Tableau de bord']) {
      const btn = [...document.querySelectorAll('nav.nav button')].find(x => x.textContent.includes(t));
      const s = performance.now(); btn.click(); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      out[t] = Math.round(performance.now() - s);
    }
    return out;
  });
  console.log('Changement d’onglet jusqu’à affichage (ms):', r);
  const sync = await page.evaluate(async () => { const s = performance.now(); const x = await fetch('/api/sync?since=0&limit=400', { credentials: 'same-origin' }); const t = await x.text(); return { ms: Math.round(performance.now() - s), ko: Math.round(t.length / 1024) }; });
  console.log('Sync complète (1re page 400 docs):', sync);
  const poll = await page.evaluate(async () => { const s = performance.now(); const x = await fetch('/api/sync?since=999999&limit=400', { credentials: 'same-origin' }); const t = await x.text(); return { ms: Math.round(performance.now() - s), octets: t.length }; });
  console.log('Sync au repos:', poll);
  console.log('Erreurs:', errs);
} finally { await browser.close(); server.close(); }
