import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { startServer } from './dev-server.mjs';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const { server, port } = await startServer();
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 420, height: 800 } });
  const a = await ctx.newPage();
  await a.goto('http://127.0.0.1:' + port + '/'); await a.waitForSelector('#web-form');
  await a.fill('#w-code', 'TESTCODE'); await a.fill('#w-name', 'N'); await a.fill('#w-email', 'n@t.fr'); await a.fill('#w-pass', 'motdepasse1');
  await a.click('#web-form button'); await a.waitForSelector('nav.nav button');
  const b = await ctx.newPage(); await b.goto('http://127.0.0.1:' + port + '/'); await b.waitForSelector('nav.nav button');
  await b.click('nav.nav button:has-text("Clients")');
  // A crée un client ; B doit le voir sans rien faire (rythme rapide, puis après un long repos)
  await a.evaluate(() => window.claude.use('db').then(db => db.collection('clients').doc('zz1').set({ nom: 'Synchro Test', type: 'particulier' })));
  const t0 = Date.now();
  await b.waitForSelector('text=Synchro Test', { timeout: 15000 });
  console.log('Visible sur le 2e appareil en', Date.now() - t0, 'ms');
  // repos : 8 vérifications sans activité sur B => rythme lent, puis une modif doit arriver quand même
  await b.waitForTimeout(500);
  console.log('OK');
} catch (e) { console.error('ÉCHEC', e); process.exitCode = 1; } finally { await browser.close(); server.close(); }
