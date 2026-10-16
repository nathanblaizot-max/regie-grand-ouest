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
  // ajout de camions (barème : 5 CV, > 20 000 km => 0,427 €/km)
  await page.click('[data-action="veh-open"]');
  await page.fill('#veh-nom', 'Ford Transit'); await page.fill('#veh-immat', 'AB-123-CD'); await page.fill('#veh-cond', 'Nathan Blaizot');
  await page.fill('#veh-dep', '1 impasse des Pommiers 50500 Auvers');
  await page.click('[data-action="veh-save"]');
  await page.locator('.modal-b .card:has-text("Ford Transit")').waitFor();
  assert.ok(await page.locator('.modal-b .card:has-text("0,427 €/km")').count(), 'coefficient 5 CV > 20000');
  await page.fill('#veh-nom', 'Fourgon'); await page.selectOption('#veh-cv', '3'); await page.selectOption('#veh-elec', 'oui'); await page.selectOption('#veh-est', '1');
  await page.click('[data-action="veh-save"]');
  await page.locator('.modal-b .card:has-text("Fourgon")').waitFor();
  assert.ok(await page.locator('.modal-b .card:has-text("Fourgon"):has-text("0,379 €/km")').count(), 'électrique 3 CV 5001-20000 = 0,379');
  await page.click('.modal-f [data-action="close"]');
  // tournée avec camion et compteurs
  await page.locator('.page-head [data-action="tour-new"]').click(); await page.waitForSelector('#t-nom');
  await page.fill('#t-nom', 'Matin'); await page.check('[data-tsel="liv:dA"]');
  await page.selectOption('#t-veh', { label: 'Ford Transit – AB-123-CD' });
  await page.fill('#t-kmdep', '12000'); await page.locator('#t-kmdep').blur();
  await page.fill('#t-kmret', '12084.5'); await page.locator('#t-kmret').blur();
  assert.equal(await page.inputValue('#t-km'), '84.5', 'km = retour - départ');
  await page.getByText('= 36,08').waitFor();
  await page.click('[data-action="tour-save"]');
  await page.locator('.card:has-text("Matin"):has-text("84,5 km")').waitFor();
  assert.ok(await page.locator('.card:has-text("Matin"):has-text("indemnité 36,08")').count());
  // onglet Indemnités km : jour prérempli depuis la tournée
  await page.click('nav.nav button:has-text("Indemnités km")');
  await page.getByText('Feuille de frais kilométriques –').waitFor();
  const today = await page.evaluate(() => window.__f(0));
  assert.equal(await page.inputValue('#ik-k-' + today), '84.5', 'km prérempli');
  assert.ok((await page.inputValue('#ik-d-' + today)).startsWith('Domicile / Coutances'), 'destination = Domicile / ville');
  assert.equal(await page.inputValue('#ik-o-' + today), 'PRESTATION');
  assert.ok(await page.locator('tr:has(#ik-k-' + today + ') .chip:has-text("auto")').count());
  const tot = await page.locator("tbody tr:has(b:text-is(\"TOTAUX\"))").innerText();
  assert.ok(/84,5 km/.test(tot) && /36,08/.test(tot), tot);
  // saisie manuelle sur un autre jour (même mois)
  const d2 = await page.evaluate(() => { const d = new Date(); const t = new Date(d.getFullYear(), d.getMonth(), d.getDate() === 1 ? 2 : 1, 12); return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'); });
  await page.fill('#ik-k-' + d2, '100'); await page.locator('#ik-k-' + d2).blur();
  await page.waitForFunction((id) => document.getElementById(id) && document.getElementById(id).value === 'PRESTATION', 'ik-o-' + d2);
  // modifier un jour auto : devient manuel et ↺ rétablit
  await page.fill('#ik-d-' + today, 'Domicile / Test / Domicile'); await page.locator('#ik-d-' + today).blur();
  await page.locator('[data-action="ik-reset"][data-date="' + today + '"]').waitFor();
  await page.click('[data-action="ik-reset"][data-date="' + today + '"]');
  await page.waitForFunction((id) => document.getElementById(id).value.startsWith('Domicile / Coutances'), 'ik-d-' + today);
  // régularisation : 184,5 km => moins de 5001 km pour un 5 CV : 0,636
  const rg = await page.locator('.card:has-text("Régularisation de fin d")').innerText();
  assert.ok(/moins de 5001 km/.test(rg) && /0,636/.test(rg), rg);
  // fichier Excel
  const dlp = page.waitForEvent('download'); await page.click('[data-action="ik-xlsx"]');
  const dl = await dlp; assert.ok(/^Indemnites-km-Ford-Transit-\d{4}\.xlsx$/.test(dl.suggestedFilename()), dl.suggestedFilename());
  fs.copyFileSync(await dl.path(), process.env.IK_OUT || '/tmp/ik-test.xlsx');
  // suppression d'un camion (2 clics)
  await page.click('[data-action="veh-open"]');
  await page.locator('.card:has-text("Fourgon") [data-action="veh-del"]').click();
  await page.locator('.card:has-text("Fourgon") [data-action="veh-del"]:has-text("Confirmer")').click();
  await page.waitForFunction(() => !document.querySelector('.modal-b').innerText.includes('Fourgon'));
  assert.deepEqual(errs, []);
  console.log('OK camions');
} finally { await browser.close(); server.close(); }
