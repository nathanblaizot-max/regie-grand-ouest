// Sauvegarde complète : ZIP avec données, photos et PDF ; espace utilisé affiché dans Réglages.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { startServer } from './dev-server.mjs';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const { server, port } = await startServer();
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:' + port + '/'); await page.waitForSelector('#web-form');
  await page.fill('#w-code', 'TESTCODE'); await page.fill('#w-name', 'N'); await page.fill('#w-email', 'n@t.fr'); await page.fill('#w-pass', 'motdepasse1');
  await page.click('#web-form button'); await page.waitForSelector('nav.nav button');
  const jpg = '/9j/' + 'A'.repeat(3000), pdf = 'JVBERi0xLjQK' + 'B'.repeat(4000);
  await page.evaluate(async ([jpg, pdf]) => {
    const db = await window.claude.use('db');
    await db.collection('materiel').doc('m1').set({ nom: 'Château gonflable', categorie: 'Gonflables', prix: 100 });
    await db.collection('clients').doc('c1').set({ nom: 'Client Test', type: 'particulier' });
    await db.collection('photos').doc('ph1').set({ dossierId: 'd1', phase: 'depart', data: 'data:image/jpeg;base64,' + jpg, ts: 1 });
    await db.collection('photos').doc('ph2').set({ dossierId: 'd1', phase: 'retour', data: 'data:image/jpeg;base64,' + jpg, ts: 2 });
    await db.collection('certifs').doc('m1').set({ nom: 'Certificat CE.pdf', taille: 3000, data: 'data:application/pdf;base64,' + pdf, ts: 1 });
  }, [jpg, pdf]);
  await page.waitForTimeout(800);
  await page.click('nav.nav button:has-text("Réglages")');
  await page.waitForSelector('#web-storage:has-text("utilisés")');
  console.log('Stockage :', (await page.textContent('#web-storage')).replace(/\s+/g, ' ').trim());
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('button[data-action="backup"]')]);
  const out = '/tmp/sauvegarde-test.zip'; await dl.saveAs(out);
  const list = execFileSync('unzip', ['-Z1', out]).toString().split('\n').filter(Boolean);
  console.log(list.join(' | '));
  assert.ok(list.includes('LISEZMOI.txt') && list.includes('donnees/materiel.json') && list.includes('donnees/camions.json') && list.includes('donnees/indemnites_km.json'));
  assert.equal(list.filter((n) => n.startsWith('photos/') && n.endsWith('.jpg')).length, 2);
  assert.ok(list.some((n) => /^pdf\/Ch-teau-gonflable-.*\.pdf$/.test(n)) || list.some((n) => n.startsWith('pdf/')));
  const p = list.find((n) => n.startsWith('pdf/')); const bytes = execFileSync('unzip', ['-p', out, p]);
  assert.equal(bytes.slice(0, 5).toString(), '%PDF-', 'le PDF restitué est valide');
  execFileSync('unzip', ['-tq', out]);
  const mat = JSON.parse(execFileSync('unzip', ['-p', out, 'donnees/materiel.json']).toString()); assert.equal(mat[0].nom, 'Château gonflable');
  fs.unlinkSync(out);
  console.log('OK sauvegarde');
} catch (e) { console.error('ÉCHEC', e); process.exitCode = 1; } finally { await browser.close(); server.close(); }
