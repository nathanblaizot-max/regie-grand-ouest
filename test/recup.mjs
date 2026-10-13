import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { startServer } from './dev-server.mjs';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const { server, port } = await startServer();
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const errs = [];
try {
  const page = await (await browser.newContext({ viewport: { width: 420, height: 800 } })).newPage();
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://127.0.0.1:' + port + '/'); await page.waitForSelector('#web-form');
  await page.fill('#w-code', 'TESTCODE'); await page.fill('#w-name', 'N'); await page.fill('#w-email', 'n@t.fr'); await page.fill('#w-pass', 'motdepasse1');
  await page.click('#web-form button'); await page.waitForSelector('nav.nav button');
  const t = new Date().toISOString().slice(0, 10);
  await page.evaluate(async (t) => { const db = await window.claude.use('db'); await db.collection('dossiers').doc('d1').set({ titre: 'Mariage Test', statut: 'confirmee', dateDebut: t, dateFin: t, clientId: '', lieu: 'Avranches', lignes: [{ designation: 'Tente 5x6', qte: 1, puHT: 200, tva: 20 }, { designation: 'Tables rondes', qte: 15, puHT: 9, tva: 20 }, { designation: 'Livraison', qte: 1, puHT: 45, tva: 20 }] }); }, t);
  await page.click('nav.nav button:has-text("Tableau de bord")');
  await page.waitForSelector('[data-action="voir-recup"]');
  await page.click('[data-action="voir-recup"]');
  await page.waitForSelector('text=Matériel à récupérer');
  await page.waitForSelector('#modal-root >> text=Tables rondes');
  assert.equal(await page.locator('#modal-root >> text=Livraison').count(), 0, 'livraison exclue');
  await page.screenshot({ path: process.argv[2] || '/tmp/recup.png' });
  await page.click('#modal-root [data-action="open-dossier"]');
  await page.waitForSelector('text=Mariage Test');
  assert.deepEqual(errs, []);
  console.log('Voir plus : OK');
} catch (e) { console.error('ÉCHEC', e, errs); process.exitCode = 1; } finally { await browser.close(); server.close(); }
