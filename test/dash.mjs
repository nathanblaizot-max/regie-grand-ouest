import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { startServer } from './dev-server.mjs';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const { server, port } = await startServer();
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const errs = [];
try {
  const page = await (await browser.newContext({ viewport: { width: 1200, height: 900 } })).newPage();
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://127.0.0.1:' + port + '/'); await page.waitForSelector('#web-form');
  await page.fill('#w-code', 'TESTCODE'); await page.fill('#w-name', 'N'); await page.fill('#w-email', 'n@t.fr'); await page.fill('#w-pass', 'motdepasse1');
  await page.click('#web-form button'); await page.waitForSelector('nav.nav button');
  for (const [w, shot] of [[1200, 'desk'], [400, 'mob']]) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.click('nav.nav button:has-text("Tableau de bord")');
    await page.waitForSelector('text=Tâches à faire');
    const titres = await page.$$eval('.sec-title', e => e.map(x => x.textContent.trim().split('(')[0].trim()));
    console.log(w, titres);
    assert.ok(titres[0].startsWith('À livrer') && titres[1].startsWith('Tâches à faire') && titres[2].startsWith('À surveiller'));
    await page.screenshot({ path: process.argv[2] + '/dash-' + shot + '.png', fullPage: true });
  }
  assert.deepEqual(errs, []); console.log('Ordre des cartes : OK');
} catch (e) { console.error('ÉCHEC', e.message.split('\n')[0], errs); process.exitCode = 1; } finally { await browser.close(); server.close(); }
