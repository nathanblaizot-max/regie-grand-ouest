// Test dans un vrai navigateur (Chromium) : configuration, connexion, données, rechargement.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { startServer } from './dev-server.mjs';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');

const { server, port } = await startServer();
const base = 'http://127.0.0.1:' + port;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] }).catch(() => chromium.launch({ args: ['--no-sandbox'] }));
const errors = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 800 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|ERR_|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
  await page.goto(base + '/');
  await page.waitForSelector('#web-form');
  assert.ok(await page.locator('#w-code').count(), 'formulaire de première configuration');
  await page.fill('#w-code', 'TESTCODE'); await page.fill('#w-name', 'Nathan'); await page.fill('#w-email', 'nathan@test.fr'); await page.fill('#w-pass', 'motdepasse1');
  await page.click('#web-form button');
  await page.waitForSelector('#web-login', { state: 'detached' });
  await page.waitForSelector('nav.nav button', { timeout: 15000 });
  const tabs = await page.locator('nav.nav button').allInnerTexts();
  console.log('Onglets :', tabs.map((t) => t.trim()).join(' | '));
  assert.ok(!tabs.join('|').includes('Mails'), 'onglet Mails retiré');
  // données via l'API de la page
  await page.evaluate(async () => {
    const db = await window.claude.use('db');
    await db.collection('materiel').doc('p1').set({ nom: 'Chaise Napoléon', categorie: 'Chaises', prix: 2.5, prixMode: 'fixe', stock: 100, caution: 0, unite: 'pièce', horsService: 0, notes: '', url: '', stockAVerifier: false });
    await db.collection('clients').doc('c1').set({ nom: 'Dupont Marie', tel: '0600000000', email: 'm@d.fr', type: 'particulier' });
  });
  await page.click('nav.nav button:has-text("Matériel")');
  await page.waitForSelector('text=Chaise Napoléon');
  await page.click('nav.nav button:has-text("Clients")');
  await page.waitForSelector('text=Dupont Marie');
  // Réglages : bloc Compte
  await page.click('nav.nav button:has-text("Réglages")');
  await page.waitForSelector('text=Connecté en tant que');
  await page.waitForSelector('button:has-text("Gérer les comptes")');
  // la persistance côté serveur : on recharge
  await page.reload();
  await page.waitForSelector('nav.nav button', { timeout: 15000 });
  await page.click('nav.nav button:has-text("Clients")');
  await page.waitForSelector('text=Dupont Marie');
  console.log('Rechargement : session et données conservées');
  // nouvelle location + devis par l'interface
  await page.click('nav.nav button:has-text("Locations")');
  await page.click('button:has-text("Nouvelle location")');
  await page.waitForSelector('#d-client');
  await page.fill('#d-client', 'Dup');
  await page.click('#cl-res .pick-row:has-text("Dupont Marie")');
  await page.fill('#d-matsel', 'chaise');
  await page.click('#mat-res .pick-row:has-text("Chaise")');
  await page.waitForSelector('#lines .line');
  await page.click('button:has-text("Créer le devis")');
  await page.waitForTimeout(1500);
  // le devis doit exister côté serveur
  const docs = await page.evaluate(() => fetch('/api/sync?since=0&limit=500', { credentials: 'same-origin' }).then((r) => r.json()));
  const devis = docs.docs.filter((d) => d.col === 'documents');
  console.log('Documents côté serveur :', devis.length, devis[0] && devis[0].data.numero);
  assert.equal(devis.length, 1);
  await page.keyboard.press('Escape');
  // déconnexion
  await page.click('nav.nav button:has-text("Réglages")');
  await page.click('button:has-text("Se déconnecter")');
  await page.waitForSelector('#web-landing');
  await page.click('#web-landing .lp-head [data-lp=login]');
  await page.waitForSelector('#web-form');
  assert.equal(await page.locator('#w-code').count(), 0, 'plus de configuration initiale, simple connexion');
  await page.fill('#w-email', 'nathan@test.fr'); await page.fill('#w-pass', 'mauvais'); await page.click('#web-form button');
  await page.waitForSelector('#w-err:not(:empty)');
  await page.fill('#w-pass', 'motdepasse1'); await page.click('#web-form button');
  await page.waitForSelector('nav.nav button', { timeout: 15000 });
  assert.deepEqual(errors, [], 'aucune erreur JavaScript : ' + errors.join(' / '));
  console.log('Navigateur : tous les tests passent');
} catch (e) { console.error('ÉCHEC', e, errors); process.exitCode = 1; } finally { await browser.close(); server.close(); }
