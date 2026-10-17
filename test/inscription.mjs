// Formulaire d'inscription de la page d'accueil : validation, envoi (format Netlify Forms), anti-spam, remerciement.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { startServer } from './dev-server.mjs';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const { server, port, submissions } = await startServer();
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  // copie statique pour la détection Netlify
  const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.ok(/<form name="inscription" data-netlify="true" netlify-honeypot="bot-field"/.test(html), 'formulaire statique');
  await fetch('http://127.0.0.1:' + port + '/api/setup', { method: 'POST', headers: { 'content-type': 'application/json', 'x-requested-with': 'regie' }, body: JSON.stringify({ code: 'TESTCODE', name: 'N', email: 'n@t.fr', password: 'motdepasse1' }) }); // un compte existe : la page d'accueil s'affiche aux visiteurs
  const page = await (await browser.newContext({ viewport: { width: 400, height: 800 } })).newPage();
  await page.goto('http://127.0.0.1:' + port + '/'); await page.waitForSelector('#web-landing');
  // le bouton du haut mène au formulaire
  await page.click('.lp-hero [data-lp=form]'); await page.waitForTimeout(900);
  assert.ok(await page.isVisible('#lp-form input[name=nom]'));
  // refus si incomplet
  await page.fill('#lp-form input[name=nom]', 'Marie Dupont');
  await page.click('#lp-form button[type=submit]');
  assert.match(await page.textContent('#lp-msg'), /Merci de renseigner/); assert.equal(submissions.length, 0);
  // e-mail invalide
  await page.selectOption('#lp-form select[name=secteur]', 'Jeux gonflables et animations');
  await page.fill('#lp-form input[name=email]', 'pas-un-mail'); await page.check('#lp-form input[name=consentement]');
  await page.click('#lp-form button[type=submit]'); assert.equal(submissions.length, 0);
  // envoi valide
  await page.fill('#lp-form input[name=email]', 'marie@fete-et-co.fr');
  await page.fill('#lp-form input[name=societe]', 'Fête & Co'); await page.fill('#lp-form input[name=telephone]', '06 12 34 56 78');
  await page.selectOption('#lp-form select[name=parc]', 'De 50 à 200 articles'); await page.fill('#lp-form textarea[name=message]', 'Devis et planning, avec accents é à ç.');
  await page.click('#lp-form button[type=submit]');
  await page.waitForSelector('#lp-thanks');
  assert.equal(submissions.length, 1);
  const s = submissions[0];
  assert.equal(s['form-name'], 'inscription'); assert.equal(s.nom, 'Marie Dupont'); assert.equal(s.societe, 'Fête & Co'); assert.equal(s.secteur, 'Jeux gonflables et animations');
  assert.equal(s.parc, 'De 50 à 200 articles'); assert.equal(s.email, 'marie@fete-et-co.fr'); assert.equal(s.telephone, '06 12 34 56 78'); assert.equal(s.message, 'Devis et planning, avec accents é à ç.'); assert.equal(s.consentement, 'oui'); assert.equal(s['bot-field'], '');
  // anti-spam : champ piège rempli => rien d'envoyé
  await page.reload(); await page.waitForSelector('#lp-form');
  await page.evaluate(() => { const f = document.querySelector('#lp-form'); f.nom.value = 'Bot'; f.secteur.value = 'Autre'; f.email.value = 'bot@spam.fr'; f.consentement.checked = true; f['bot-field'].value = 'x'; });
  await page.click('#lp-form button[type=submit]'); await page.waitForTimeout(300);
  assert.equal(submissions.length, 1, 'le robot n\'envoie rien');
  // le bouton de connexion marche toujours
  await page.reload(); await page.waitForSelector('#web-landing'); await page.click('#web-landing .lp-head [data-lp=login]'); await page.waitForSelector('#web-form');
  console.log('OK inscription');
} catch (e) { console.error('ÉCHEC', e); process.exitCode = 1; } finally { await browser.close(); server.close(); }
