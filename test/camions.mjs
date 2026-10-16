import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { startServer } from './dev-server.mjs';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const { server, port } = await startServer();
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const errs = [];
try {
  const page = await (await browser.newContext({ viewport: { width: 400, height: 860 } })).newPage();
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://127.0.0.1:' + port + '/'); await page.waitForSelector('#web-form');
  await page.fill('#w-code', 'TESTCODE'); await page.fill('#w-name', 'N'); await page.fill('#w-email', 'n@t.fr'); await page.fill('#w-pass', 'motdepasse1');
  await page.click('#web-form button'); await page.waitForSelector('nav.nav button');
  await page.evaluate(async () => {
    const db = await window.claude.use('db');
    const f = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
    window.__f = f;
    await db.collection('clients').doc('c1').set({ nom: 'Martin Paul', type: 'particulier' });
    await db.collection('materiel').doc('m1').set({ nom: 'Château', prix: 100, stock: 3, unite: 'location' });
    const lg = [{ materielId: 'm1', designation: 'Château', qte: 1, puHT: 100, tva: 20 }];
    await db.collection('dossiers').doc('dA').set({ titre: 'Fête A', statut: 'confirmee', clientId: 'c1', dateDebut: f(0), dateFin: f(1), lieu: '5 rue des Lilas, Coutances', lignes: lg });
  });
  await page.click('nav.nav button:has-text("Tournées")');
  await page.getByText('Fête A').first().waitFor();
  // ajout de camions
  await page.click('[data-action="veh-open"]');
  await page.fill('#veh-nom', 'Camion 20 m³'); await page.fill('#veh-immat', 'AB-123-CD'); await page.fill('#veh-taux', '0.5');
  await page.click('[data-action="veh-save"]');
  await page.locator('.modal-b .card:has-text("Camion 20 m³")').waitFor();
  assert.ok(await page.locator('.modal-b .card:has-text("0,5 €/km")').count());
  await page.fill('#veh-nom', 'Fourgon'); await page.click('[data-action="veh-save"]');
  await page.locator('.modal-b .card:has-text("Fourgon")').waitFor();
  await page.click('.modal-f [data-action="close"]');
  // tournée avec camion et compteurs
  await page.locator('.page-head [data-action="tour-new"]').click(); await page.waitForSelector('#t-nom');
  await page.fill('#t-nom', 'Matin'); await page.check('[data-tsel="liv:dA"]');
  await page.selectOption('#t-veh', { label: 'Camion 20 m³ – AB-123-CD' });
  await page.fill('#t-kmdep', '12000'); await page.locator('#t-kmdep').blur();
  await page.fill('#t-kmret', '12084.5'); await page.locator('#t-kmret').blur();
  assert.equal(await page.inputValue('#t-km'), '84.5', 'km = retour - départ');
  await page.getByText('= 42,25').waitFor();
  await page.click('[data-action="tour-save"]');
  await page.locator('.card:has-text("Matin"):has-text("84,5 km")').waitFor();
  assert.ok(await page.locator('.card:has-text("Matin"):has-text("indemnité")').count());
  // récapitulatif du mois
  const card = page.locator('.card:has-text("Kilomètres et indemnités")');
  await card.locator('tr:has-text("Camion 20 m³")').waitFor();
  assert.ok((await card.innerText()).includes('84,5 km'));
  // export CSV
  const dlp = page.waitForEvent('download'); await page.click('[data-action="export-km"]');
  const dl = await dlp; assert.ok(/^Kilometres-tournees-\d{4}-\d{2}\.csv$/.test(dl.suggestedFilename()));
  const csv = fs.readFileSync(await dl.path(), 'utf8');
  assert.ok(csv.includes('Camion 20 m³;AB-123-CD;12000;12084,5;84,5;0,5;42,25'), csv);
  assert.ok(csv.includes('Total général;;;;;;84,5;;42,25'), csv);
  // modification : le kilométrage se conserve
  await page.click('[data-action="tour-edit"]'); await page.waitForSelector('#t-nom');
  assert.equal(await page.inputValue('#t-km'), '84.5'); assert.equal(await page.inputValue('#t-veh') !== '', true);
  await page.click('.modal-f [data-action="close"]');
  // suppression d'un camion (2 clics)
  await page.click('[data-action="veh-open"]');
  await page.locator('.card:has-text("Fourgon") [data-action="veh-del"]').click();
  await page.locator('.card:has-text("Fourgon") [data-action="veh-del"]:has-text("Confirmer")').click();
  await page.waitForFunction(() => !document.body.innerText.includes('Fourgon'));
  assert.deepEqual(errs, []);
  console.log('OK camions');
} finally { await browser.close(); server.close(); }
