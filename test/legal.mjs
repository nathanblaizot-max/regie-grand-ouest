// Pages légales : générées depuis scripts/legal-config.json ; champ vide => « [à compléter] », champ rempli => affiché.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'legal-'));
const cfg = path.join(dir, 'cfg.json');
const run = (c) => { fs.writeFileSync(cfg, JSON.stringify(c)); return execFileSync('node', ['scripts/legal.mjs'], { env: { ...process.env, LEGAL_CONFIG: cfg, LEGAL_OUT: dir } }).toString(); };
const read = (n) => fs.readFileSync(path.join(dir, n + '.html'), 'utf8');
// vide
let out = run({}); assert.match(out, /champs à compléter/);
for (const n of ['mentions-legales', 'conditions', 'confidentialite']) assert.ok(read(n).includes('[à compléter]'), n + ' signale les champs vides');
// rempli
out = run({ nom: 'ACME <SAS>', forme: 'SAS', capital: '1 000 €', adresse: '1 rue Test, 50000 Saint-Lô', rcsVille: 'Coutances', siren: '123 456 789', siret: '123 456 789 00011', tva: 'FR00 123 456 789', naf: '93.29Z', email: 'contact@acme.fr', tel: '02 33 00 00 00', directeur: 'Jeanne Test' });
assert.equal(out.trim(), '', 'aucun avertissement quand tout est rempli');
const mentions = read('mentions-legales'), cgv = read('conditions'), conf = read('confidentialite');
for (const t of ['ACME &lt;SAS&gt;', '123 456 789', 'Saint-Lô', 'contact@acme.fr', 'tel:0233000000', 'Jeanne Test']) assert.ok(mentions.includes(t), 'mentions : ' + t);
assert.ok(cgv.includes('tribunal de commerce de Coutances') && cgv.includes('mailto:contact@acme.fr'));
assert.ok(conf.includes('mailto:contact@acme.fr'));
for (const h of [mentions, cgv, conf]) assert.ok(!h.includes('[à compléter]') && !/undefined|\$\{/.test(h));
fs.rmSync(dir, { recursive: true });
console.log('OK pages légales');
