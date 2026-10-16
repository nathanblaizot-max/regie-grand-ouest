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
  await page.evaluate(async () => {
    const db = await window.claude.use('db');
    const f = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
    await db.collection('clients').doc('c1').set({ nom: 'Martin', type: 'particulier' });
    await db.collection('clients').doc('c2').set({ nom: 'Société X', type: 'pro' });
    await db.collection('materiel').doc('m1').set({ nom: 'Tente', prix: 100, stock: 3, caution: 50, unite: 'location' });
    const lg = [{ materielId: 'm1', designation: 'Tente', qte: 1, puHT: 100, tva: 20 }], tot = { ht: 100, ttc: 120, detail: [{ taux: 20, montant: 20 }] };
    const dv = (id, o) => db.collection('documents').doc(id).set(Object.assign({ type: 'devis', numero: 'D-' + id, clientId: 'c1', clientSnap: { nom: 'M' }, societeSnap: { nom: 'GO' }, lignes: lg, totaux: tot, regimeTva: 'normal', dateEmission: f(-12), dateEnvoi: f(-12), dateValidite: f(18), dossierId: 'd' + id }, o));
    await dv('a', { statut: 'accepte', dateSignature: f(-8), relanceNiv: 1 });          // accepté après 4 jours, 1 relance
    await dv('b', { statut: 'accepte', clientId: 'c2', dateSignature: f(-10) });      // pro, 2 jours
    await dv('c', { statut: 'refuse' });
    await dv('d', { statut: 'envoye', dateValidite: f(-1), relanceNiv: 3 });           // expiré
    await dv('e', { statut: 'envoye' });                                               // en attente
    await dv('z', { statut: 'brouillon' });                                            // ignoré
    await db.collection('dossiers').doc('dX').set({ titre: 'Fête X', statut: 'confirmee', clientId: 'c1', dateDebut: f(1), dateFin: f(2), lignes: lg });
  });
  // transformation des devis
  await page.click('nav.nav button:has-text("Statistiques")');
  await page.getByText('Transformation des devis en').waitFor();
  const t = (await page.locator('main, #app').first().innerText()).replace(/ /g, ' ');
  assert.ok(/Taux de transformation\s*\n?\s*40 %/.test(t), 'taux 2/5 = 40 %');
  assert.ok(/Sur les devis tranchés\s*\n?\s*50 %/.test(t), '2 sur 4 tranchés');
  assert.ok(/Délai de décision\s*\n?\s*3 j/.test(t), 'délai moyen 3 j');
  assert.ok(t.includes('Sans réponse, expirés') && t.includes('Effet des relances') && t.includes('Professionnels'));
  // alerte caution présente par défaut, puis désactivée en option
  await page.click('nav.nav button:has-text("Tableau de bord")');
  await page.getByText('Caution à encaisser avant la livraison').first().waitFor();
  await page.click('nav.nav button:has-text("Locations")'); await page.click('text=Fête X');
  assert.ok(await page.locator('[data-action="open-edl-save"]:has-text("Caution et état des lieux")').count());
  await page.locator('.modal-h [data-action="close"]').click();
  await page.click('nav.nav button:has-text("Réglages")');
  await page.selectOption('#s-modCaution', 'non'); await page.selectOption('#s-modEdl', 'non');
  await page.click('[data-action="save-settings"]'); await page.waitForTimeout(600);
  await page.click('nav.nav button:has-text("Tableau de bord")'); await page.waitForTimeout(300);
  assert.equal(await page.getByText('Caution à encaisser').count(), 0, 'alerte masquée');
  await page.click('nav.nav button:has-text("Locations")'); await page.click('text=Fête X');
  assert.equal(await page.locator('[data-action="open-edl-save"]').count(), 0, 'bouton masqué');
  await page.locator('.modal-h [data-action="close"]').click();
  // seulement la caution
  await page.click('nav.nav button:has-text("Réglages")');
  await page.selectOption('#s-modCaution', 'oui');
  await page.click('[data-action="save-settings"]'); await page.waitForTimeout(600);
  await page.click('nav.nav button:has-text("Locations")'); await page.click('text=Fête X');
  assert.equal((await page.locator('[data-action="open-edl-save"]').innerText()).trim(), 'Caution');
  await page.click('[data-action="open-edl-save"]'); await page.waitForSelector('#c-mont');
  assert.equal(await page.locator('#ed-date').count(), 0, 'pas d\'état des lieux');
  console.log('Commercial et options : OK');
} catch (e) { console.error('ÉCHEC', e.message.split('\n')[0], e.stack.split('\n').filter(l => l.includes('test/commercial')).slice(0, 1), errs); process.exitCode = 1; } finally { await browser.close(); server.close(); }
