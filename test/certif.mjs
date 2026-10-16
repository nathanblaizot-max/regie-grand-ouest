import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { startServer } from './dev-server.mjs';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const SP = '/tmp/claude-0/-home-claude/d4d04aa1-4c9c-5f91-94f1-366e34532607/scratchpad';
const { server, port } = await startServer();
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const errs = [];
try {
  const page = await (await browser.newContext({ viewport: { width: 400, height: 860 } })).newPage();
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://127.0.0.1:' + port + '/'); await page.waitForSelector('#web-form');
  await page.fill('#w-code', 'TESTCODE'); await page.fill('#w-name', 'N'); await page.fill('#w-email', 'n@t.fr'); await page.fill('#w-pass', 'motdepasse1');
  await page.click('#web-form button'); await page.waitForSelector('nav.nav button');
  await page.evaluate(async () => {
    const db = await window.claude.use('db');
    await db.collection('clients').doc('c1').set({ nom: 'Martin', type: 'particulier' });
    await db.collection('materiel').doc('m1').set({ nom: 'Chapiteau 5x8', categorie: 'Structures gonflables', prix: 300, stock: 2, unite: 'location' });
    await db.collection('materiel').doc('m2').set({ nom: 'Table', categorie: 'Mobilier', prix: 10, stock: 5, unite: 'location' });
    const lg = [{ materielId: 'm1', designation: 'Chapiteau 5x8', qte: 1, puHT: 300, tva: 20 }, { materielId: 'm2', designation: 'Table', qte: 2, puHT: 10, tva: 20 }];
    await db.collection('documents').doc('dv').set({ type: 'devis', numero: 'D-1', clientId: 'c1', clientSnap: { nom: 'Martin' }, societeSnap: { nom: 'GO' }, lignes: lg, totaux: { ht: 320, ttc: 384, detail: [{ taux: 20, montant: 64 }] }, regimeTva: 'normal', statut: 'envoye', dateEmission: '2026-10-01', dateValidite: '2026-12-01', dateDebut: '2026-11-01', dateFin: '2026-11-02', titre: 'Fête' });
  });
  await page.click('nav.nav button:has-text("Matériel")');
  await page.click('[data-action="edit-materiel"]:has-text("Chapiteau")');
  await page.getByText('Certificat de conformité de la structure').waitFor();
  await page.fill('#m-cat', 'Mobilier'); assert.equal(await page.locator('#m-cert-wrap').isHidden(), true, 'masqué hors gonflables');
  for (const c of ['Toboggans', 'Parcours enfants', 'Structures gonflables']) { await page.fill('#m-cat', c); assert.equal(await page.locator('#m-cert-wrap').isVisible(), true, c); }
  // fichier trop lourd refusé
  await page.setInputFiles('input[data-m-cert]', SP + '/gros.pdf');
  await page.getByText('PDF trop lourd').waitFor();
  assert.equal(await page.locator('#m-cert [data-action="m-cert-del"]').count(), 0);
  // ajout valide
  await page.setInputFiles('input[data-m-cert]', SP + '/cert-test.pdf');
  await page.locator('#m-cert').getByText('cert-test.pdf').waitFor();
  await page.click('[data-action="save-materiel"]');
  await page.waitForSelector('.chip:has-text("Certificat")');
  const meta = await page.evaluate(async () => { const db = await window.claude.use('db'); return await new Promise(r => { const u = db.collection('materiel').doc('m1').onSnapshot(s => { r(s.data()); }); }); });
  assert.equal(meta.certNom, 'cert-test.pdf'); assert.ok(meta.certTaille > 10); assert.equal(meta.prix, 300);
  const cd = await page.evaluate(async () => { const db = await window.claude.use('db'); return await new Promise(r => { db.collection('certifs').doc('m1').onSnapshot(s => r(s.data())); }); });
  assert.ok(cd.data.startsWith('data:application/pdf'), 'data url pdf');
  // devis : section certificats (uniquement m1)
  await page.click('nav.nav button:has-text("Devis et factures")'); await page.click('text=D-1');
  await page.getByText('Pièces à joindre au devis sur demande').waitFor();
  assert.equal(await page.locator('[data-action="cert-dl"]').count(), 1);
  const dlp = page.waitForEvent('download');
  await page.click('[data-action="cert-dl"]');
  const dl = await dlp; assert.equal(dl.suggestedFilename(), 'cert-test.pdf');
  const buf = await (await import('node:fs')).promises.readFile(await dl.path());
  assert.ok(buf.toString('latin1').startsWith('%PDF'), 'PDF intact');
  await page.locator('.modal-h [data-action="close"]').click();
  // retrait
  await page.click('nav.nav button:has-text("Matériel")');
  await page.click('[data-action="edit-materiel"]:has-text("Chapiteau")');
  await page.click('[data-action="m-cert-del"]'); await page.getByText('Ajouter le certificat').waitFor();
  await page.click('[data-action="save-materiel"]');
  await page.waitForFunction(() => !document.querySelector('.chip[title^="Certificat"]'));
  const gone = await page.evaluate(async () => { const db = await window.claude.use('db'); return await new Promise(r => { db.collection('certifs').doc('m1').onSnapshot(s => r(s.exists)); }); });
  assert.equal(gone, false);
  assert.deepEqual(errs, []);
  console.log('OK certificats');
} finally { await browser.close(); server.close(); }
