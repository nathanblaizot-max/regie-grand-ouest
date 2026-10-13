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
  await page.addInitScript(() => {
    window.__calls = [];
    let real; Object.defineProperty(window, 'claude', { configurable: true, get: () => real, set: v => { real = { ...v, use: async (n) => n === 'mcp' ? { callTool: async (s, t, a) => { window.__calls.push([t, a]); return { payload: t === 'create_draft' ? { id: 'DR1', viewUrl: 'https://mail.google.com/x' } : { id: 'M1' } }; } } : v.use(n) }; } });
    const J = function () { return new Proxy({}, { get: (t, k) => k === 'output' ? () => new Blob(['x']) : k === 'splitTextToSize' ? (s) => [String(s)] : k === 'internal' ? { pageSize: { getWidth: () => 210, getHeight: () => 297 } } : (() => ({ finalY: 100 })), set: () => true }); }; J.API = { autoTable() {} };
    window.jspdf = { jsPDF: J };
  });
  await page.goto('http://127.0.0.1:' + port + '/'); await page.waitForSelector('#web-form');
  await page.fill('#w-code', 'TESTCODE'); await page.fill('#w-name', 'N'); await page.fill('#w-email', 'n@t.fr'); await page.fill('#w-pass', 'motdepasse1');
  await page.click('#web-form button'); await page.waitForSelector('nav.nav button');
  await page.evaluate(async () => {
    const db = await window.claude.use('db');
    await db.collection('documents').doc('q1').set({ type: 'devis', numero: 'D-2026-0001', statut: 'brouillon', titre: 'T', dossierId: 'd1', clientSnap: { nom: 'Martin', email: 'm@ex.fr' }, societeSnap: { nom: 'GO' }, lignes: [{ designation: 'Tente', qte: 1, puHT: 100, tva: 20 }], totaux: { ht: 100, ttc: 120, detail: [{ taux: 20, montant: 20 }] }, regimeTva: 'normal', dateEmission: '2026-10-13', dateValidite: '2026-11-13', dateDebut: '2026-10-20', dateFin: '2026-10-21' });
  });
  await page.click('nav.nav button:has-text("Devis et factures")');
  await page.click('text=D-2026-0001');
  await page.click('[data-action="mail"]');
  await page.waitForSelector('[data-action="mail-send"]');
  assert.deepEqual(await page.evaluate(() => window.__calls.map(c => c[0])), ['create_draft']);
  await page.click('[data-action="mail-send"]');
  assert.equal(await page.evaluate(() => window.__calls.length), 1, 'pas d\'envoi au premier clic');
  assert.ok((await page.locator('[data-action="mail-send"]').innerText()).includes('Confirmer'));
  await page.click('[data-action="mail-send"]');
  await page.waitForSelector('text=Mail envoyé');
  const calls = await page.evaluate(() => window.__calls);
  assert.deepEqual(calls[1], ['send_message', { draftId: 'DR1' }]);
  console.log('Envoi du mail : OK');
} catch (e) { console.error('ÉCHEC', e.message.split('\n')[0], errs); process.exitCode = 1; } finally { await browser.close(); server.close(); }
