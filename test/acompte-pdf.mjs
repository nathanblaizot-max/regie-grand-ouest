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
    window.__txt = [];
    const mk = () => new Proxy({}, { get: (t, k) => k === 'text' ? (s) => window.__txt.push(String(s)) : k === 'splitTextToSize' ? (s) => [String(s)] : k === 'getTextWidth' ? () => 10 : k === 'internal' ? { pageSize: { getWidth: () => 210, getHeight: () => 297 }, getNumberOfPages: () => 1 } : k === 'output' ? () => 'AAAA' : (() => ({ finalY: 100 })), set: () => true });
    const J = function () { return mk(); }; J.API = { autoTable: function () {} };
    window.jspdf = { jsPDF: J };
    window.__block = true;
  });
  await page.goto('http://127.0.0.1:' + port + '/'); await page.waitForSelector('#web-form');
  await page.fill('#w-code', 'TESTCODE'); await page.fill('#w-name', 'N'); await page.fill('#w-email', 'n@t.fr'); await page.fill('#w-pass', 'motdepasse1');
  await page.click('#web-form button'); await page.waitForSelector('nav.nav button');
  await page.evaluate(async () => {
    const db = await window.claude.use('db');
    await db.collection('documents').doc('f1').set({ type: 'facture', numero: 'F-2026-0001', statut: 'emise', titre: 'T', dossierId: 'd1', dateDebut: '2026-10-20', dateFin: '2026-10-21', dateEmission: '2026-10-13', dateEcheance: '2026-11-13', clientSnap: { nom: 'Martin' }, societeSnap: { nom: 'GO' }, lignes: [{ designation: 'Tente', qte: 1, puHT: 200, tva: 20 }], totaux: { ht: 200, ttc: 240, detail: [{ taux: 20, montant: 40 }] }, regimeTva: 'normal', acomptes: [{ date: '2026-10-13', montant: 72, mode: 'Carte bancaire' }] });
  });
  await page.click('nav.nav button:has-text("Devis et factures")');
  await page.click('[data-action="dtype"][data-t="facture"]');
  await page.click('text=F-2026-0001');
  await page.click('[data-action="pdf"]');
  await page.waitForTimeout(800);
  const out = await page.evaluate(() => window.__txt.filter(t => /Acompte|Reste/.test(t)));
  console.log(out);
  assert.ok(Array.isArray(out) && out.some(t => t.includes('Reste à payer : 168,00')) && out.some(t => t.includes('-72,00')));
  console.log('PDF acompte : OK');
} catch (e) { console.error('ÉCHEC', e.message.split('\n')[0], errs); process.exitCode = 1; } finally { await browser.close(); server.close(); }
