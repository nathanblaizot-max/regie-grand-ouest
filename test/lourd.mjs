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
    const f = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
    const ps = [];
    for (let i = 0; i < 130; i++) ps.push(() => db.collection('clients').doc('c' + String(i).padStart(3, '0')).set({ nom: 'Client ' + String(i).padStart(3, '0'), type: 'particulier' }));
    ps.push(() => db.collection('materiel').doc('m1').set({ nom: 'Château', categorie: 'Structures gonflables', prix: 100, stock: 3, unite: 'location', certNom: 'cert.pdf', certTaille: 1000 }));
    ps.push(() => db.collection('certifs').doc('m1').set({ nom: 'cert.pdf', taille: 1000, data: 'data:application/pdf;base64,JVBERi0xLjQKJSVFT0YK', ts: 1 }));
    ps.push(() => db.collection('dossiers').doc('dA').set({ titre: 'Fête A', statut: 'confirmee', clientId: 'c001', dateDebut: f(1), dateFin: f(2), lignes: [{ materielId: 'm1', designation: 'Château', qte: 1, puHT: 100, tva: 20 }] }));
    ps.push(() => db.collection('photos').doc('p1').set({ dossierId: 'dA', phase: 'depart', data: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/yQALCAABAAEBAREA/8wABgAQEAX/2gAIAQEAAD8A0v/Z', ts: 1 }));
    ps.push(() => db.collection('photos').doc('p2').set({ dossierId: 'autre', phase: 'depart', data: 'data:image/jpeg;base64,/9j/', ts: 2 }));
    ps.push(() => db.collection('documents').doc('dv').set({ type: 'devis', numero: 'D-1', clientId: 'c001', clientSnap: { nom: 'C' }, societeSnap: { nom: 'GO' }, lignes: [{ materielId: 'm1', designation: 'Château', qte: 1, puHT: 100, tva: 20 }], totaux: { ht: 100, ttc: 120, detail: [{ taux: 20, montant: 20 }] }, regimeTva: 'normal', statut: 'envoye', dateEmission: f(0), dateValidite: f(30), dateDebut: f(1), dateFin: f(2) }));
    for (const g of ps) await g();
  });
  // rechargement à froid : photos et certificats ne sont PAS dans la synchro
  await page.reload(); await page.waitForSelector('nav.nav button');
  const sync = await page.evaluate(async () => { const r = await (await fetch('/api/sync?since=0&limit=500')).json(); return [...new Set(r.docs.map(d => d.col))]; });
  assert.ok(!sync.includes('photos') && !sync.includes('certifs'), JSON.stringify(sync));
  // liste clients : 60 puis +60, filtre remet à 60
  await page.click('nav.nav button:has-text("Clients")');
  await page.locator('tr[data-action="edit-client"]').first().waitFor();
  assert.equal(await page.locator('tr[data-action="edit-client"]').count(), 60);
  await page.click('[data-action="more"]');
  assert.equal(await page.locator('tr[data-action="edit-client"]').count(), 120);
  await page.click('[data-action="more"]');
  assert.equal(await page.locator('tr[data-action="edit-client"]').count(), 130);
  assert.equal(await page.locator('[data-action="more"]').count(), 0);
  await page.fill('#f-q', 'Client 12'); await page.waitForTimeout(300);
  assert.equal(await page.locator('tr[data-action="edit-client"]').count(), 10, 'filtre sur tout le jeu de données');
  // photos de l'état des lieux : chargées à l'ouverture, seulement celles du dossier
  await page.click('nav.nav button:has-text("Locations")'); await page.click('text=Fête A');
  await page.click('[data-action="open-edl-save"]');
  await page.waitForSelector('#edl-ph-depart img');
  assert.equal(await page.locator('#edl-ph-depart img').count(), 1);
  await page.locator('.modal-h [data-action="close"]').click();
  // certificat : lu à la demande après rechargement
  await page.click('nav.nav button:has-text("Devis et factures")'); await page.click('text=D-1');
  const dlp = page.waitForEvent('download'); await page.click('[data-action="cert-dl"]');
  const dl = await dlp; assert.equal(dl.suggestedFilename(), 'cert.pdf');
  assert.deepEqual(errs, [], JSON.stringify(errs));
  console.log('OK allègement');
} finally { await browser.close(); server.close(); }
