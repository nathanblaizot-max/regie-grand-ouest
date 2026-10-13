import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { startServer } from './dev-server.mjs';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const { server, port } = await startServer();
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const errors = [];
try {
  const page = await (await browser.newContext({ viewport: { width: 420, height: 800 } })).newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://127.0.0.1:' + port + '/');
  await page.waitForSelector('#web-form');
  await page.fill('#w-code', 'TESTCODE'); await page.fill('#w-name', 'N'); await page.fill('#w-email', 'n@t.fr'); await page.fill('#w-pass', 'motdepasse1');
  await page.click('#web-form button');
  await page.waitForSelector('nav.nav button', { timeout: 15000 });
  const file = '/tmp/import-test.json';
  fs.writeFileSync(file, JSON.stringify({ collections: { clients: [{ id: 'k1', nom: 'Martin Paul' }, { id: 'k2', nom: 'Durand SARL' }], materiel: [{ id: 'p9', nom: 'Table ronde', categorie: 'Tables', prix: 10, prixMode: 'fixe', stock: 5 }] }, docs: { 'config/societe': { nom: 'Sud Manche Test', tel: '07' } } }));
  await page.click('nav.nav button:has-text("Réglages")');
  await page.click('button:has-text("Importer des données")');
  await page.setInputFiles('#i-file', file);
  await page.click('#web-modal button:has-text("Importer")');
  await page.waitForSelector('text=4 éléments importés');
  await page.click('#web-modal button:has-text("Fermer")');
  await page.click('nav.nav button:has-text("Clients")');
  await page.waitForSelector('text=Martin Paul'); await page.waitForSelector('text=Durand SARL');
  // gestion des comptes
  await page.click('nav.nav button:has-text("Réglages")');
  await page.click('button:has-text("Gérer les comptes")');
  await page.fill('#n-name', 'Guillaume'); await page.fill('#n-email', 'g@t.fr'); await page.fill('#n-pass', 'azertyuiop');
  await page.click('#web-modal button:has-text("Ajouter le compte")');
  await page.waitForSelector('text=g@t.fr');
  // aucun débordement horizontal sur téléphone
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  console.log('Débordement horizontal (px) :', over);
  await page.screenshot({ path: '/tmp/mobile-accounts.png' });
  assert.deepEqual(errors, []);
  console.log('Import et comptes : OK');
} catch (e) { console.error('ÉCHEC', e, errors); process.exitCode = 1; } finally { await browser.close(); server.close(); }
