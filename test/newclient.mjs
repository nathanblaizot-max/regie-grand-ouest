import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
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
  await page.click('[data-action="new-dossier"]');
  await page.fill('#d-client', 'Dupont');
  await page.click('[data-action="pick-client"][data-id="__new"]');
  await page.fill('#nc-tel', '0600000000');
  await page.selectOption('#nc-type', 'pro'); await page.fill('#nc-siret', '12345678900011'); await page.fill('#nc-adresse', '3 rue des Lilas\n50000 Saint-Lô');
  await page.click('[data-action="add-nc"]');
  await page.waitForSelector('text=Client ajouté');
  assert.equal(await page.inputValue('#d-client'), 'Dupont');
  assert.equal(await page.locator('#nc-nom').count(), 0, 'formulaire refermé');
  const cl = await page.evaluate(async () => (await (await fetch('/api/sync?since=0&limit=100')).json()).docs.filter(d => d.col === 'clients').map(d => [d.data.nom, d.data.tel, d.data.type, d.data.siret, d.data.adresse].join('|')));
  assert.deepEqual(cl, ['Dupont|0600000000|pro|12345678900011|3 rue des Lilas\n50000 Saint-Lô']);
  console.log('Ajout client depuis une location : OK');
} catch (e) { console.error('ÉCHEC', e.message.split('\n')[0], errs); process.exitCode = 1; } finally { await browser.close(); server.close(); }
