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
    const J = function () { return new Proxy({}, { get: (t, k) => k === 'text' ? (s) => window.__txt.push(String(s)) : k === 'splitTextToSize' ? (s) => [String(s)] : k === 'output' ? () => new Blob(['x']) : k === 'internal' ? { pageSize: { getWidth: () => 210, getHeight: () => 297 } } : (() => ({ finalY: 100 })), set: () => true }); }; J.API = { autoTable() {} };
    window.jspdf = { jsPDF: J };
  });
  await page.goto('http://127.0.0.1:' + port + '/'); await page.waitForSelector('#web-form');
  await page.fill('#w-code', 'TESTCODE'); await page.fill('#w-name', 'N'); await page.fill('#w-email', 'n@t.fr'); await page.fill('#w-pass', 'motdepasse1');
  await page.click('#web-form button'); await page.waitForSelector('nav.nav button');
  await page.click('nav.nav button:has-text("Réglages")');
  await page.fill('#s-mediateur', 'CM2C\n14 rue Saint Jean, 75017 Paris\ncm2c.net');
  await page.click('[data-action="save-settings"]');
  await page.waitForSelector('text=enregistr');
  await page.evaluate(async () => { const db = await window.claude.use('db'); await db.collection('documents').doc('q1').set({ type: 'devis', numero: 'D-2026-0001', statut: 'envoye', titre: 'T', dossierId: 'd1', clientSnap: { nom: 'M' }, societeSnap: { nom: 'GO' }, lignes: [{ designation: 'Tente', qte: 1, puHT: 100, tva: 20 }], totaux: { ht: 100, ttc: 120, detail: [{ taux: 20, montant: 20 }] }, regimeTva: 'normal', dateEmission: '2026-10-13', dateValidite: '2026-11-13', dateDebut: '2026-10-20', dateFin: '2026-10-21' }); });
  await page.click('nav.nav button:has-text("Devis et factures")'); await page.click('text=D-2026-0001');
  assert.ok(await page.locator('.doc-view, .modal-b').locator('text=Médiateur de la consommation : CM2C').count(), 'affiché à l\'écran');
  await page.click('[data-action="pdf"]'); await page.waitForTimeout(500);
  assert.ok(await page.evaluate(() => window.__txt.some(t => t.includes('Médiateur de la consommation : CM2C – 14 rue Saint Jean, 75017 Paris – cm2c.net'))), 'dans le PDF');
  console.log('Médiateur : OK');
} catch (e) { console.error('ÉCHEC', e.message.split('\n')[0], errs); process.exitCode = 1; } finally { await browser.close(); server.close(); }
