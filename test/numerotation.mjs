// À la première facture, l'appli demande par quel numéro commencer (reprise d'un ancien outil).
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { startServer } from './dev-server.mjs';
let chromium;
try { ({ chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright')); } catch { ({ chromium } = await import('playwright')); }

const { server, port } = await startServer();
const base = 'http://127.0.0.1:' + port;
let cookie = '';
async function api(method, path, body) {
  const r = await fetch(base + '/api/' + path, { method, headers: { 'content-type': 'application/json', 'x-requested-with': 'regie', cookie }, body: body ? JSON.stringify(body) : undefined });
  const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
  return { status: r.status, body: await r.json() };
}
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] }).catch(() => chromium.launch({ args: ['--no-sandbox'] }));
const errors = [];
async function login(email) {
  const page = await (await browser.newContext({ viewport: { width: 1200, height: 900 } })).newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.goto(base + '/');
  await page.waitForSelector('#web-landing .lp-head [data-lp=login]');
  await page.click('#web-landing .lp-head [data-lp=login]');
  await page.fill('#w-email', email); await page.fill('#w-pass', 'motdepasse1'); await page.click('#web-form button');
  await page.waitForFunction(() => window.WEB && window.WEB.user, null, { timeout: 15000 });
  await page.waitForSelector('nav.nav button'); await page.waitForTimeout(600);
  return page;
}
async function nouvelleFacture(page) {
  await page.click('nav.nav button:has-text("Locations")');
  await page.click('button:has-text("Nouvelle location")');
  await page.waitForSelector('#d-client');
  await page.fill('#d-client', 'Dup');
  await page.click('#cl-res .pick-row:has-text("Dupont")');
  await page.fill('#d-matsel', 'chaise');
  await page.click('#mat-res .pick-row:has-text("Chaise")');
  await page.waitForSelector('#lines .line');
  await page.click('button:has-text("Créer une facture")');
}
const numeros = async (page) => (await page.evaluate(() => fetch('/api/sync?since=0&limit=500', { credentials: 'same-origin' }).then((r) => r.json()))).docs.filter((d) => d.col === 'documents' && d.data.type === 'facture').map((d) => d.data.numero).sort();
try {
  let r = await api('POST', 'setup', { code: 'TESTCODE', email: 'nathan@test.fr', name: 'Nathan', password: 'motdepasse1' }); assert.equal(r.status, 200);
  r = await api('POST', 'tenants', { societe: 'Fêtes de l’Ouest', name: 'Marie', email: 'marie@fetes.fr', password: 'motdepasse1' }); assert.equal(r.status, 200);
  const page = await login('marie@fetes.fr');
  await page.evaluate(async () => {
    const db = await window.claude.use('db');
    await db.collection('materiel').doc('p1').set({ nom: 'Chaise Napoléon', categorie: 'Chaises', prix: 2.5, prixMode: 'fixe', stock: 100, caution: 0, unite: 'pièce', horsService: 0, notes: '', url: '', stockAVerifier: false });
    await db.collection('clients').doc('c1').set({ nom: 'Dupont Marie', tel: '0600000000', email: 'm@d.fr', type: 'particulier' });
  });
  await page.click('nav.nav button:has-text("Matériel")'); await page.waitForSelector('text=Chaise Napoléon');

  // 1. première facture : la question est posée, avec aperçu du prochain numéro
  await nouvelleFacture(page);
  await page.waitForSelector('#fs-in');
  assert.ok(await page.locator('#fs-one').isVisible(), 'choix « Commencer à 1 » proposé');
  await page.fill('#fs-in', '28-64');
  assert.match(await page.locator('#fs-prev').innerText(), /28-65/);
  await page.fill('#fs-in', 'abc');
  await page.click('#fs-ok');
  assert.ok(await page.locator('#fs-in').isVisible(), 'refus d’un numéro sans chiffres à la fin');
  await page.fill('#fs-in', '28-64'); await page.click('#fs-ok');
  await page.waitForSelector('#fs-root', { state: 'detached' });
  await page.waitForFunction(() => document.body.innerText.includes('28-65'), null, { timeout: 8000 });
  assert.deepEqual(await numeros(page), ['28-65']);

  // 2. la suivante continue, sans reposer la question
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  await nouvelleFacture(page);
  await page.waitForTimeout(1500);
  assert.equal(await page.locator('#fs-in').count(), 0, 'la question n’est posée qu’une fois');
  assert.deepEqual(await numeros(page), ['28-65', '28-66']);

  // 3. Réglages : le point de départ est visible et modifiable
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  await page.click('nav.nav button:has-text("Réglages")');
  await page.waitForSelector('text=reprise après le numéro');
  assert.ok((await page.locator('main.main').innerText()).includes('28-64'));
  await page.click('[data-action=edit-factstart][data-t=facture]');
  await page.waitForSelector('#fs-in');
  assert.equal(await page.locator('#fs-one').count(), 0);
  await page.click('#fs-cancel');

  // 3 bis. même question pour le premier devis
  await page.click('nav.nav button:has-text("Locations")');
  await page.click('button:has-text("Nouvelle location")');
  await page.waitForSelector('#d-client');
  await page.fill('#d-client', 'Dup'); await page.click('#cl-res .pick-row:has-text("Dupont")');
  await page.fill('#d-matsel', 'chaise'); await page.click('#mat-res .pick-row:has-text("Chaise")');
  await page.waitForSelector('#lines .line');
  await page.click('button:has-text("Créer le devis")');
  await page.waitForSelector('#fs-in');
  assert.match(await page.locator('#fs-root').innerText(), /devis/);
  await page.fill('#fs-in', 'D-310');
  assert.match(await page.locator('#fs-prev').innerText(), /D-311/);
  await page.click('#fs-ok');
  await page.waitForSelector('#fs-root', { state: 'detached' });
  await page.waitForTimeout(1500);
  const nd = async (pg) => (await pg.evaluate(() => fetch('/api/sync?since=0&limit=500', { credentials: 'same-origin' }).then((r) => r.json()))).docs.filter((d) => d.col === 'documents' && d.data.type === 'devis').map((d) => d.data.numero).sort();
  assert.deepEqual(await nd(page), ['D-311']);
  assert.deepEqual(await numeros(page), ['28-65', '28-66'], 'les factures ne bougent pas');

  // 4. « Commencer à 1 » dans un autre espace
  await page.evaluate(() => window.WEB.logout && window.WEB.logout());
  cookie = '';
  await api('POST', 'login', { email: 'nathan@test.fr', password: 'motdepasse1' });
  r = await api('POST', 'tenants', { societe: 'Neuf SARL', name: 'Paul', email: 'paul@neuf.fr', password: 'motdepasse1' }); assert.equal(r.status, 200);
  const p2 = await login('paul@neuf.fr');
  await p2.evaluate(async () => {
    const db = await window.claude.use('db');
    await db.collection('materiel').doc('p1').set({ nom: 'Chaise Napoléon', categorie: 'Chaises', prix: 2.5, prixMode: 'fixe', stock: 100, caution: 0, unite: 'pièce', horsService: 0, notes: '', url: '', stockAVerifier: false });
    await db.collection('clients').doc('c1').set({ nom: 'Dupont Marie', tel: '0600000000', email: 'm@d.fr', type: 'particulier' });
  });
  await p2.click('nav.nav button:has-text("Matériel")'); await p2.waitForSelector('text=Chaise Napoléon');
  await nouvelleFacture(p2);
  await p2.waitForSelector('#fs-one'); await p2.click('#fs-one');
  await p2.waitForFunction(() => /F-\d{4}-0001/.test(document.body.innerText), null, { timeout: 8000 });
  assert.deepEqual(errors, [], 'aucune erreur JavaScript : ' + errors.join(' / '));
  console.log('Numérotation des factures : reprise (28-64 → 28-65, 28-66) et départ à 1 : OK');
} catch (e) { console.error('ÉCHEC', e, errors); process.exitCode = 1; } finally { await browser.close(); server.close(); }
