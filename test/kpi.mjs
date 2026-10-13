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
  await page.evaluate(async (t) => { const db = await window.claude.use('db'); await db.collection('dossiers').doc('d1').set({ titre: 'Dehors aujourd hui', statut: 'confirmee', dateDebut: t, dateFin: t, clientId: '', lignes: [] }); await db.collection('dossiers').doc('d2').set({ titre: 'Plus tard', statut: 'confirmee', dateDebut: '2099-01-01', dateFin: '2099-01-02', clientId: '', lignes: [] }); }, t);
  await page.click('nav.nav button:has-text("Tableau de bord")');
  await page.waitForSelector('[data-action="kpi-dehors"]');
  await page.click('[data-action="kpi-dehors"]');
  await page.waitForSelector('text=Dehors aujourd hui');
  assert.equal(await page.locator('text=Plus tard').count(), 0, 'filtre dehors');
  await page.click('[data-action="kpi-dehors-off"]');
  await page.waitForSelector('text=Plus tard');
  await page.click('nav.nav button:has-text("Tableau de bord")');
  await page.click('[data-action="kpi-doc"][data-t="facture"]');
  await page.waitForSelector('nav.nav button[aria-current="page"]:has-text("Devis et factures")');
  assert.deepEqual(errs, []);
  console.log('Cases cliquables : OK');
} catch (e) { console.error('ÉCHEC', e, errs); process.exitCode = 1; } finally { await browser.close(); server.close(); }
