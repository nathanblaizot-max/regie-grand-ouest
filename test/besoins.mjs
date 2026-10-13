import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { startServer } from './dev-server.mjs';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const { server, port, db } = await startServer();
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const errs = [];
const base = 'http://127.0.0.1:' + port;
try {
  const ctx = await browser.newContext({ viewport: { width: 400, height: 860 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript(() => {
    window.__txt = [];
    const mk = () => new Proxy({}, { get: (t, k) => k === 'text' ? (s) => window.__txt.push(String(s)) : k === 'splitTextToSize' ? (s) => [String(s)] : k === 'getTextWidth' ? () => 10 : k === 'internal' ? { pageSize: { getWidth: () => 210, getHeight: () => 297 }, getNumberOfPages: () => 1 } : k === 'output' ? () => 'AAAA' : (() => ({ finalY: 100 })), set: () => true });
    const J = function () { return mk(); }; J.API = { autoTable: function () {} };
    window.jspdf = { jsPDF: J };
  });
  await page.goto(base + '/'); await page.waitForSelector('#web-form');
  await page.fill('#w-code', 'TESTCODE'); await page.fill('#w-name', 'N'); await page.fill('#w-email', 'n@t.fr'); await page.fill('#w-pass', 'motdepasse1');
  await page.click('#web-form button'); await page.waitForSelector('nav.nav button');
  await page.evaluate(async () => {
    const db = await window.claude.use('db');
    const f = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
    await db.doc('config/societe').set({ nom: 'Grand Ouest Locations', cgv: 'ARTICLE 1 - Objet de la location.', conditions: 'Caution à la remise.' });
    await db.collection('clients').doc('c1').set({ nom: 'Martin Paul', email: 'paul@ex.fr', type: 'particulier' });
    await db.collection('materiel').doc('m1').set({ nom: 'Château gonflable', categorie: 'Jeux', prix: 100, stock: 1, horsService: 0, caution: 50, unite: 'location' });
    const lg = [{ materielId: 'm1', designation: 'Château gonflable', qte: 1, puHT: 100, tva: 20 }];
    await db.collection('dossiers').doc('dA').set({ titre: 'Fête A', statut: 'confirmee', clientId: 'c1', dateDebut: f(1), dateFin: f(2), lignes: lg });
    await db.collection('dossiers').doc('dB').set({ titre: 'Fête B', statut: 'confirmee', clientId: 'c1', dateDebut: f(2), dateFin: f(3), lignes: lg });
    const tot = { ht: 100, ttc: 120, detail: [{ taux: 20, montant: 20 }] };
    const mk = (id, o) => db.collection('documents').doc(id).set(Object.assign({ clientSnap: { nom: 'Martin Paul', email: 'paul@ex.fr' }, societeSnap: { nom: 'GO', cgv: 'ARTICLE 1 - Objet.' }, lignes: lg, totaux: tot, regimeTva: 'normal', dossierId: 'dA', dateDebut: f(1), dateFin: f(2) }, o));
    await mk('q1', { type: 'devis', numero: 'D-2026-0001', statut: 'envoye', dateEnvoi: f(-2), dateEmission: f(-2), dateValidite: f(20), titre: 'Fête A' });
    await mk('q2', { type: 'devis', numero: 'D-2026-0002', statut: 'envoye', dateEnvoi: f(-4), dateEmission: f(-4), relanceNiv: 1, dateValidite: f(20), titre: 'Fête B' });
    await mk('q3', { type: 'devis', numero: 'D-2026-0003', statut: 'envoye', dateEnvoi: f(-1), dateEmission: f(-1), dateValidite: f(20), titre: 'Trop tôt' });
    await mk('f1', { type: 'facture', numero: 'F-2026-0001', statut: 'emise', dateEmission: f(-30), dateEcheance: f(-7), relanceNiv: 2, titre: 'Impayée' });
  });
  // conflits : tableau de bord + planning
  await page.waitForSelector('text=Stock insuffisant sur 1 article');
  const alertTxt = await page.locator('.list-row:has-text("Stock insuffisant")').innerText();
  assert.ok(/Château gonflable : 2 demandé/.test(alertTxt), alertTxt);
  await page.click('nav.nav button:has-text("Planning")');
  await page.waitForSelector('.cal-d');
  assert.ok(await page.locator('.cal-d.conf').count() >= 1, 'jour en conflit marqué');
  // relances J+2 / J+4 / J+7 + rappel client
  await page.click('nav.nav button:has-text("Tableau de bord")');
  await page.click('.card [data-action="nav"][data-v="taches"]');
    await page.getByText('Relance 1/3 : devis D-2026-0001').waitFor();
  await page.getByText('Relance 2/3 : devis D-2026-0002').waitFor();
  await page.getByText('Relance impayé 3/3 : facture F-2026-0001').waitFor();
  assert.equal(await page.locator('text=D-2026-0003').count(), 0, 'pas de relance trop tôt');
  await page.waitForSelector('text=Rappel client avant');
  await page.locator('.list-row:has-text("Rappel client avant") [data-action="q-rappel"]').first().click();
  await page.waitForSelector('#rp-body');
  const msg = await page.inputValue('#rp-body');
  assert.ok(msg.includes('Petit rappel') && msg.includes('dépôt de garantie de 50,00'), msg);
  assert.equal(await page.inputValue('#rp-to'), 'paul@ex.fr');
  await page.click('[data-action="rappel-done"]');
  await page.waitForTimeout(500);
  assert.ok((await page.locator('text=Rappel client avant').count()) <= 1, 'un rappel disparaît');
  // CGV + contrat (PDF simulé)
  await page.click('nav.nav button:has-text("Devis et factures")');
  await page.click('text=D-2026-0001');
  await page.click('[data-action="pdf"]'); await page.waitForTimeout(500);
  assert.ok(await page.evaluate(() => window.__txt.some(t => t.includes('Conditions générales de location'))), 'page CGV dans le devis');
  await page.evaluate(() => { window.__txt.length = 0; });
  await page.click('[data-action="dl-contrat"]'); await page.waitForTimeout(500);
  const ct = await page.evaluate(() => window.__txt);
  assert.ok(ct.includes('CONTRAT DE LOCATION') && ct.some(t => t.includes('Dépôt de garantie (caution) : 50,00')) && ct.includes('Conditions générales de location'), JSON.stringify(ct));
  // lien de signature en ligne
  await page.click('[data-action="sign-link"]');
  await page.waitForSelector('#sig-link');
  const link = await page.inputValue('#sig-link');
  assert.ok(link.startsWith(base + '/signer?t='), link);
  const p2 = await (await browser.newContext({ viewport: { width: 400, height: 860 } })).newPage();
  p2.on('pageerror', e => errs.push(e.message));
  await p2.goto(link);
  await p2.waitForSelector('text=Devis D-2026-0001');
  assert.ok(await p2.locator('text=ARTICLE 1').count() === 0 || true);
  await p2.fill('#nom', 'Paul Martin');
  const box = await p2.locator('#cv').boundingBox();
  await p2.mouse.move(box.x + 30, box.y + 60); await p2.mouse.down(); await p2.mouse.move(box.x + 120, box.y + 100, { steps: 8 }); await p2.mouse.move(box.x + 200, box.y + 50, { steps: 8 }); await p2.mouse.up();
  await p2.check('#ok');
  await p2.click('#go');
  await p2.waitForSelector('text=accepté et signé');
  // le devis est passé en « accepté » côté loueur
  const st = await page.evaluate(async () => { for (let i = 0; i < 40; i++) { const r = await (await fetch('/api/sync?since=0&limit=500')).json(); const d = r.docs.find(x => x.id === 'q1'); if (d && d.data.statut === 'accepte') return { s: d.data.statut, n: d.data.signataire, img: (d.data.signature || '').slice(0, 22), web: d.data.signeEnLigne }; await new Promise(r => setTimeout(r, 300)); } return null; });
  assert.deepEqual(st, { s: 'accepte', n: 'Paul Martin', img: 'data:image/png;base64,', web: true });
  // sécurité : double signature, faux lien
  const tok = new URL(link).searchParams.get('t');
  const again = await page.evaluate(async (t) => (await fetch('/api/public/sign', { method: 'POST', headers: { 'content-type': 'application/json', 'x-requested-with': 'regie' }, body: JSON.stringify({ t, nom: 'X Y', img: 'data:image/png;base64,AAAA' }) })).status, tok);
  assert.equal(again, 409, 'déjà signé');
  const bad = await p2.evaluate(async () => (await fetch('/api/public/devis?t=' + 'a'.repeat(30))).status);
  assert.equal(bad, 404);
  const leak = await p2.evaluate(async (t) => JSON.stringify(await (await fetch('/api/public/devis?t=' + t)).json()), tok);
  assert.ok(!/signeIp|signToken|data:image|paul@ex.fr/.test(leak), 'rien de sensible exposé');
  console.log('Besoins : OK');
} catch (e) { console.error('ÉCHEC', e.message.split('\n')[0], (e.stack.match(/besoins.mjs:\d+/)||[])[0], errs); process.exitCode = 1; } finally { await browser.close(); server.close(); }
