import { createRequire } from 'node:module';
import { startServer } from './dev-server.mjs';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const { server, port } = await startServer();
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const page = await (await browser.newContext({ viewport: { width: 420, height: 800 } })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  let bytes = 0, calls = 0; const big = [];
  page.on('response', async r => { if (r.url().includes('/api/')) { try { const b = await r.body(); if (/sync/.test(r.url())) { bytes += b.length; calls++; } } catch {} } });
  await page.goto('http://127.0.0.1:' + port + '/'); await page.waitForSelector('#web-form');
  await page.fill('#w-code', 'TESTCODE'); await page.fill('#w-name', 'N'); await page.fill('#w-email', 'n@t.fr'); await page.fill('#w-pass', 'motdepasse1');
  await page.click('#web-form button'); await page.waitForSelector('nav.nav button');
  const N = { mat: 300, cl: 800, dos: 1500, doc: 2000, ph: +process.env.PH || 0, ce: +process.env.CE || 0 };
  await page.evaluate(async (N) => {
    const db = await window.claude.use('db');
    const f = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
    const ps = []; const run = async (arr) => { for (let i = 0; i < arr.length; i += 20) { await Promise.all(arr.slice(i, i + 20).map(g => g())); } };
    for (let i = 0; i < N.mat; i++) ps.push(() => db.collection('materiel').doc('m' + i).set({ nom: 'Article ' + i, categorie: 'Cat ' + (i % 12), prix: 50 + i, stock: 5, unite: 'location' }));
    for (let i = 0; i < N.cl; i++) ps.push(() => db.collection('clients').doc('c' + i).set({ nom: 'Client ' + i, type: i % 3 ? 'particulier' : 'pro', email: 'c' + i + '@ex.fr' }));
    for (let i = 0; i < N.dos; i++) { const lg = [{ materielId: 'm' + (i % N.mat), designation: 'Article', qte: 1 + i % 3, puHT: 100, tva: 20 }, { materielId: 'm' + ((i * 7) % N.mat), designation: 'Article', qte: 1, puHT: 50, tva: 20 }];
      ps.push(() => db.collection('dossiers').doc('d' + i).set({ titre: 'Fête ' + i, statut: i % 5 ? 'confirmee' : 'devis', clientId: 'c' + (i % N.cl), dateDebut: f((i % 400) - 200), dateFin: f((i % 400) - 199), lieu: i + ' rue des Lilas, Coutances', lignes: lg })); }
    for (let i = 0; i < N.doc; i++) ps.push(() => db.collection('documents').doc('x' + i).set({ type: i % 2 ? 'devis' : 'facture', numero: (i % 2 ? 'D-' : 'F-') + i, dossierId: 'd' + (i % N.dos), clientId: 'c' + (i % N.cl), clientSnap: { nom: 'Client' }, societeSnap: { nom: 'GO' }, lignes: [{ designation: 'x', qte: 1, puHT: 100, tva: 20 }], totaux: { ht: 100, ttc: 120, detail: [{ taux: 20, montant: 20 }] }, regimeTva: 'normal', statut: i % 2 ? 'envoye' : 'emise', dateEmission: f((i % 300) - 250), dateValidite: f(30), dateEcheance: f(30) }));
    const blob = (kb) => 'data:image/jpeg;base64,' + 'A'.repeat(kb * 1024);
    for (let i = 0; i < N.ph; i++) ps.push(() => db.collection('photos').doc('p' + i).set({ dossierId: 'd' + (i % 40), phase: 'depart', data: blob(60), ts: i }));
    for (let i = 0; i < N.ce; i++) ps.push(() => db.collection('materiel').doc('m' + i).update({ certNom: 'c.pdf', certTaille: 300000 }).then(() => db.collection('certifs').doc('m' + i).set({ nom: 'c.pdf', taille: 300000, data: 'data:application/pdf;base64,' + 'A'.repeat(400000), ts: 1 })));
    try { await run(ps); } catch (e) { throw new Error(JSON.stringify(e && (e.message || e.code || e))); }
  }, N).catch(e => { throw e; });
  await page.waitForTimeout(1500);
  bytes = 0; calls = 0;
  const t0 = Date.now(); await page.reload(); await page.waitForSelector('nav.nav button', { timeout: 60000 });
  console.log('Rechargement -> appli prête (ms):', Date.now() - t0, '| synchro:', calls, 'appels,', Math.round(bytes / 1024), 'Ko');
  await page.waitForTimeout(800);
  const m = await page.evaluate(async () => { let since = 0, tot = 0, per = {}, more = true, calls = 0; while (more && calls < 200) { const r = await fetch('/api/sync?since=' + since + '&limit=400'); const t = await r.text(); tot += t.length; calls++; const j = JSON.parse(t); (j.docs || []).forEach(d => { per[d.col] = per[d.col] || [0, 0]; per[d.col][0]++; per[d.col][1] += JSON.stringify(d).length; }); more = !!j.more; since = j.max != null ? j.max : since; if (!j.docs || !j.docs.length) break; } return { calls, Ko: Math.round(tot / 1024), per: Object.fromEntries(Object.entries(per).map(([k, v]) => [k, v[0] + ' docs / ' + Math.round(v[1] / 1024) + ' Ko'])) }; });
  console.log('Synchro complète:', JSON.stringify(m));
  const tabs = await page.$$eval('nav.nav button', b => b.map(x => x.textContent.trim()));
  for (const t of tabs) {
    const ms = await page.evaluate(async (t) => { const b = [...document.querySelectorAll('nav.nav button')].find(x => x.textContent.trim() === t); const a = performance.now(); b.click(); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); return Math.round(performance.now() - a); }, t);
    const n = await page.evaluate(() => document.querySelectorAll('*').length);
    console.log(t.padEnd(18), String(ms).padStart(5), 'ms', String(n).padStart(6), 'éléments');
  }
  console.log(errs.length ? 'ERREURS ' + errs[0] : 'sans erreur');
} finally { await browser.close(); server.close(); }
