// Un autre loueur (hors espace « main ») ne doit pas hériter du nom ni du logo Grand Ouest Locations.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { startServer } from './dev-server.mjs';
let chromium;
try { ({ chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright')); } catch { ({ chromium } = await import('playwright')); }

const { server, port, db } = await startServer();
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
  const page = await (await browser.newContext({ viewport: { width: 1100, height: 800 } })).newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.goto(base + '/');
  await page.waitForSelector('#web-landing .lp-head [data-lp=login]');
  await page.click('#web-landing .lp-head [data-lp=login]');
  await page.fill('#w-email', email); await page.fill('#w-pass', 'motdepasse1'); await page.click('#web-form button');
  await page.waitForSelector('nav.nav button', { timeout: 15000 });
  return page;
}
try {
  let r = await api('POST', 'setup', { code: 'TESTCODE', email: 'nathan@test.fr', name: 'Nathan', password: 'motdepasse1' }); assert.equal(r.status, 200);
  assert.equal(r.body.user.neutre, false, 'l’espace principal n’est pas neutre');
  r = await api('POST', 'users', { email: 'autre@test.fr', name: 'Autre Loueur', password: 'motdepasse1', role: 'admin' }); assert.equal(r.status, 200);
  db._users.find((u) => u.email === 'autre@test.fr').tenant = 'autre-loueur';

  // 1. Espace principal : rien ne change (nom et logo d'origine)
  let page = await login('nathan@test.fr');
  await page.click('nav.nav button:has-text("Réglages")');
  assert.equal(await page.inputValue('#s-nom'), 'Grand Ouest Locations');
  assert.ok((await page.getAttribute('.brand-logo', 'src')).startsWith('data:image/png'), 'logo d’origine conservé');
  await page.close();

  // 2. Autre loueur : nom vide, logo neutre, alerte pour renseigner le nom
  page = await login('autre@test.fr');
  await page.waitForFunction(() => /icon-192\.png$/.test(document.querySelector('.brand-logo').getAttribute('src')), null, { timeout: 10000 });
  assert.equal(await page.getAttribute('.brand-logo', 'src'), '/icon-192.png', 'logo neutre');
  await page.click('nav.nav button:has-text("Réglages")');
  assert.equal(await page.inputValue('#s-nom'), '', 'nom de société vide par défaut');
  await page.click('nav.nav button:has-text("Tableau de bord")');
  await page.waitForSelector('text=Nom de la société à renseigner');
  assert.deepEqual(errors, [], 'aucune erreur JavaScript : ' + errors.join(' / '));
  console.log('Autres loueurs : nom et logo neutres ; espace principal inchangé');
} catch (e) { console.error('ÉCHEC', e, errors); process.exitCode = 1; } finally { await browser.close(); server.close(); }
