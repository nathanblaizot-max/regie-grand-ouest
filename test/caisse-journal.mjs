// Caisse évènement : chaque + / − s'inscrit dans un journal avec date et heure, conservé et exporté.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { startServer } from './dev-server.mjs';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const { server, port } = await startServer();
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const page = await (await browser.newContext({ viewport: { width: 420, height: 900 }, acceptDownloads: true })).newPage();
  await page.goto('http://127.0.0.1:' + port + '/'); await page.waitForSelector('#web-form');
  await page.fill('#w-code', 'TESTCODE'); await page.fill('#w-name', 'N'); await page.fill('#w-email', 'n@t.fr'); await page.fill('#w-pass', 'motdepasse1');
  await page.click('#web-form button'); await page.waitForSelector('nav.nav button');
  await page.evaluate(async () => { const db = await window.claude.use('db'); await db.collection('caisses').doc('ev1').set({ nom: 'Vide-grenier', date: '2026-10-17', lieu: 'Avranches', tva: 20, tarifs: [{ id: 't1', nom: 'Adulte', prix: 5 }, { id: 't2', nom: 'Enfant', prix: 2.5 }], cnt: {} }); });
  await page.click('nav.nav button:has-text("Caisse")'); await page.click('[data-action=caisse-open]');
  await page.waitForSelector('#cx-journal');
  assert.match(await page.textContent('#cx-journal'), /s’inscrit ici|s'inscrit ici/);
  const t1 = [page.locator('.cx-t').nth(0), page.locator('.cx-t').nth(1)];
  await t1[0].locator('button:has-text("+ 1")').first().click();               // Adulte, espèces
  await page.waitForTimeout(1100);
  await t1[0].locator('button:has-text("+ 2")').nth(1).click();                // Adulte, carte bleue : +2
  await t1[1].locator('button:has-text("+ 1")').first().click();               // Enfant, espèces
  await t1[0].locator('button[aria-label="Retirer une entrée"]').first().click(); // Adulte, espèces : −1
  const lines = await page.$$eval('#cx-journal .list-row', (r) => r.map((x) => x.innerText.replace(/\s+/g, ' ').trim()));
  console.log(lines.join('\n'));
  assert.equal(lines.length, 4);
  assert.match(lines[0], /^\d\d:\d\d:\d\d \d\d\/\d\d\/\d{4} Adulte Espèces · ligne 4 −1/);   // le plus récent en haut
  assert.match(lines[1], /Enfant Espèces · ligne 3 \+1 2,50/);
  assert.match(lines[2], /Adulte Carte bleue · ligne 2 \+2 10,00/);
  assert.match(lines[3], /Adulte Espèces · ligne 1 \+1 5,00/);
  // cohérence avec les compteurs : entrées = 1 + 2 + 1 − 1 = 3
  assert.equal((await page.textContent('#cx-n')).trim(), '3');
  // enregistré côté serveur et conservé au rechargement
  await page.waitForTimeout(900);
  await page.reload(); await page.waitForSelector('nav.nav button'); await page.click('nav.nav button:has-text("Caisse")'); await page.click('[data-action=caisse-open]'); await page.waitForSelector('#cx-journal .list-row');
  assert.equal((await page.$$('#cx-journal .list-row')).length, 4);
  // export Excel : le journal est dans le CSV
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-action=caisse-csv]')]);
  const csv = (await (await import('node:fs/promises')).readFile(await dl.path(), 'utf8'));
  assert.match(csv, /Journal des entrées/); assert.match(csv, /"1";"\d\d\/\d\d\/\d{4}";"\d\d:\d\d:\d\d";"Adulte";"Espèces";"1";"5"/);
  assert.match(csv, /"4";.*"Adulte";"Espèces";"-1";"-5"/);
  console.log('OK journal caisse');
} catch (e) { console.error('ÉCHEC', e); process.exitCode = 1; } finally { await browser.close(); server.close(); }
