// Droits par compte (prix masqués, sections retirées), comptes temporaires, création d'un espace d'un autre loueur.
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
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.goto(base + '/');
  await page.waitForSelector('#web-landing .lp-head [data-lp=login]');
  await page.click('#web-landing .lp-head [data-lp=login]');
  await page.fill('#w-email', email); await page.fill('#w-pass', 'motdepasse1'); await page.click('#web-form button');
  await page.waitForFunction(() => window.WEB && window.WEB.user, null, { timeout: 15000 });
  await page.waitForSelector('nav.nav button', { timeout: 15000 });
  await page.waitForTimeout(500);
  return page;
}
const iso = (d) => d.toISOString().slice(0, 10);
const demain = iso(new Date(Date.now() + 86400e3)), apres = iso(new Date(Date.now() + 2 * 86400e3));
try {
  let r = await api('POST', 'setup', { code: 'TESTCODE', email: 'nathan@test.fr', name: 'Nathan', password: 'motdepasse1' }); assert.equal(r.status, 200);
  // données de l'espace principal
  r = await api('POST', 'write', { ops: [
    { op: 'set', col: 'materiel', id: 'm1', data: { nom: 'Château gonflable', categorie: 'Structures', prix: 250, prixMode: 'fixe', stock: 3, caution: 100, unite: 'location', horsService: 0, notes: '' } },
    { op: 'set', col: 'clients', id: 'c1', data: { nom: 'Client Dupont', type: 'particulier' } },
    { op: 'set', col: 'dossiers', id: 'd1', data: { titre: 'Anniversaire Léo', clientId: 'c1', dateDebut: demain, dateFin: apres, statut: 'confirmee', lieu: 'Nantes', km: 0, rem: 0, notes: '',
      lignes: [{ materielId: 'm1', designation: 'Château gonflable', qte: 1, puHT: 833.33, tva: 20, unite: 'location' }] } },
  ] }); assert.equal(r.status, 200);

  // 1. Un administrateur ajoute un compte limité depuis l'écran « Comptes », puis crée l'espace d'un autre loueur
  let page = await login('nathan@test.fr');
  const tabsAdmin = (await page.locator('nav.nav button').allInnerTexts()).join('|');
  assert.ok(tabsAdmin.includes('Devis et factures') && tabsAdmin.includes('Statistiques'), 'l’administrateur voit tout');
  await page.evaluate(() => window.WEB.accounts());
  await page.waitForSelector("#n-name");
  await page.fill('#n-name', 'Léa'); await page.fill('#n-email', 'lea@test.fr'); await page.fill('#n-pass', 'motdepasse1');
  await page.uncheck('#n-rights input[data-k=prix]');
  await page.uncheck('#n-rights input[data-k=reglages]');
  await page.fill('#n-until', demain);
  await page.click('[data-w=add]');
  await page.waitForSelector('text=accès limité');
  r = await api('GET', 'users');
  const lea = r.body.users.find((u) => u.email === 'lea@test.fr');
  assert.deepEqual(lea.deny.sort(), ['prix', 'reglages']); assert.equal(lea.until, demain);
  await page.fill('#t-soc', 'Fêtes de l’Ouest'); await page.fill('#t-name', 'Marie'); await page.fill('#t-email', 'marie@fetes.fr'); await page.fill('#t-pass', 'motdepasse1');
  await page.click('[data-w=tenant]');
  await page.waitForSelector('text=marie@fetes.fr');
  r = await api('GET', 'tenants'); assert.equal(r.body.tenants.length, 1);
  await page.close();

  // 2. Léa (prix masqués, sans Réglages)
  page = await login('lea@test.fr');
  const tabs = (await page.locator('nav.nav button').allInnerTexts()).map((t) => t.trim());
  console.log('Onglets de Léa :', tabs.join(' | '));
  for (const interdit of ['Devis et factures', 'Caisse évènement', 'Statistiques', 'Réglages']) assert.ok(!tabs.includes(interdit), interdit + ' masqué');
  for (const ok of ['Tableau de bord', 'Planning', 'Locations', 'Clients', 'Matériel']) assert.ok(tabs.includes(ok), ok + ' visible');
  const noEuro = async (nom) => { const t = await page.locator('main.main').innerText(); assert.ok(!/\d\s?€/.test(t), 'aucun prix affiché : ' + nom + ' → ' + t.match(/.{0,30}\d\s?€.{0,10}/)); };
  await noEuro('tableau de bord');
  await page.click('nav.nav button:has-text("Planning")'); await noEuro('planning');
  await page.click('nav.nav button:has-text("Locations")'); await page.waitForSelector('text=Anniversaire Léo'); await noEuro('locations');
  await page.click('text=Anniversaire Léo');
  await page.waitForSelector('.modal');
  await page.waitForTimeout(400);
  const modalTxt = await page.locator('.modal').innerText();
  assert.ok(!/\d\s?€/.test(modalTxt), 'aucun prix dans la fiche de location : ' + (modalTxt.match(/.{0,30}\d\s?€.{0,10}/) || ''));
  for (const sel of ['#totals', '#ft-total', '#pu-0', '#d-km', '#d-rem', '[data-action=make-doc][data-t=devis]', '[data-action=make-doc][data-t=facture]']) {
    assert.ok(!(await page.locator(sel).first().isVisible()), sel + ' masqué');
  }
  assert.ok(await page.locator('[data-action=save-dossier]').isVisible(), 'enregistrer reste possible');
  await page.keyboard.press('Escape');
  await page.click('[data-action=close]').catch(() => {});
  await page.click('nav.nav button:has-text("Matériel")'); await page.waitForSelector('text=Château gonflable'); await noEuro('matériel');
  assert.deepEqual(errors, [], 'aucune erreur JavaScript : ' + errors.join(' / '));
  await page.close();

  // 3. Compte temporaire expiré : connexion refusée
  cookie = '';
  r = await api('POST', 'login', { email: 'nathan@test.fr', password: 'motdepasse1' }); assert.equal(r.status, 200);
  r = await api('POST', 'users/' + lea.id, { until: '2020-01-01' }); assert.equal(r.status, 200);
  const ctx = await browser.newContext(); const p2 = await ctx.newPage();
  await p2.goto(base + '/'); await p2.waitForSelector('#web-landing .lp-head [data-lp=login]'); await p2.click('#web-landing .lp-head [data-lp=login]');
  await p2.fill('#w-email', 'lea@test.fr'); await p2.fill('#w-pass', 'motdepasse1'); await p2.click('#web-form button');
  await p2.waitForSelector('text=compte était temporaire');
  console.log('Droits par compte, comptes temporaires, création d’espace : OK');
} catch (e) { console.error('ÉCHEC', e, errors); process.exitCode = 1; } finally { await browser.close(); server.close(); }
