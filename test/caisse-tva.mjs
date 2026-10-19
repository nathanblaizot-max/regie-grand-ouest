// Caisse évènement : le taux de TVA modifié dans « Modifier l'évènement » est bien enregistré.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { startServer } from './dev-server.mjs';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const { server, port } = await startServer();
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const page = await (await browser.newContext({ viewport: { width: 420, height: 900 } })).newPage();
  await page.goto('http://127.0.0.1:' + port + '/'); await page.waitForSelector('#web-form');
  await page.fill('#w-code', 'TESTCODE'); await page.fill('#w-name', 'N'); await page.fill('#w-email', 'n@t.fr'); await page.fill('#w-pass', 'motdepasse1');
  await page.click('#web-form button'); await page.waitForSelector('nav.nav button');
  await page.evaluate(async () => { const db = await window.claude.use('db'); await db.collection('caisses').doc('ev1').set({ nom: 'Loto', date: '2026-10-17', lieu: '', tva: 20, tarifs: [{ id: 't1', nom: 'Adulte', prix: 10 }], cnt: { 't1|e': 2 } }); });
  await page.click('nav.nav button:has-text("Caisse")'); await page.click('[data-action=caisse-open]'); await page.waitForSelector('#cx-tva');
  await page.click('[data-action=caisse-edit]');
  await page.waitForSelector('#cx-taux');
  assert.equal(await page.inputValue('#cx-taux'), '20');
  await page.selectOption('#cx-taux', '5.5');
  await page.click('[data-action=cx-save]');
  await page.waitForTimeout(600);
  const tva = await page.evaluate(async () => { const db = await window.claude.use('db'); const r = await db.collection('caisses').get(); const d = (r.docs || r).find((x) => (x.id || x.data?.().id) === 'ev1'); return (d.data ? d.data() : d).tva; });
  assert.equal(tva, 5.5);
  assert.match(await page.textContent('.cx-stat:has(#cx-tva) span'), /TVA 5,5 %/);
  // 20 € TTC à 5,5 % : TVA = 20 − 20/1,055 = 1,04 €
  assert.match((await page.textContent('#cx-tva')).replace(/\s/g, ' '), /1,04/);
  console.log('OK TVA caisse');
} catch (e) { console.error('ÉCHEC', e); process.exitCode = 1; } finally { await browser.close(); server.close(); }
