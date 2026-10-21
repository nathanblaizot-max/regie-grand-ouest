// Accès lecture seule de BBB aux factures : clé obligatoire, CORS, contenu.
import assert from 'node:assert/strict';
import { startServer } from './dev-server.mjs';

const { server, port } = await startServer();
const base = 'http://127.0.0.1:' + port + '/api/bbb/factures';
const KEY = 'TOKEN_DE_TEST_0123456789abcdef';
let cookie = '';
async function call(method, path, body) {
  const r = await fetch('http://127.0.0.1:' + port + '/api/' + path, { method, headers: { 'content-type': 'application/json', 'x-requested-with': 'regie', cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
  return { status: r.status, body: await r.json() };
}
try {
  let r = await call('POST', 'setup', { code: 'TESTCODE', email: 'n@test.fr', name: 'N', password: 'motdepasse1' }); assert.equal(r.status, 200);
  r = await call('POST', 'write', { ops: [
    { op: 'set', col: 'documents', id: 'f1', data: { type: 'facture', numero: 'F-1', titre: 'Mariage', clientSnap: { nom: 'Dupont' }, statut: 'emise', dateEmission: '2020-01-01', dateEcheance: '2020-01-31', totaux: { ht: 100, ttc: 120 }, acomptes: [{ montant: 30 }] } },
    { op: 'set', col: 'documents', id: 'f2', data: { type: 'facture', numero: 'F-2', statut: 'payee', datePaiement: '2020-02-02', totaux: { ht: 50, ttc: 60 } } },
    { op: 'set', col: 'documents', id: 'd1', data: { type: 'devis', numero: 'D-1', totaux: { ht: 10, ttc: 12 } } },
    { op: 'set', col: 'clients', id: 'c1', data: { nom: 'Secret' } },
  ] });
  assert.equal(r.status, 200);
  // sans clé, mauvaise clé : refusé (même avec une session ouverte, la clé seule compte)
  let x = await fetch(base); assert.equal(x.status, 401);
  x = await fetch(base, { headers: { authorization: 'Bearer mauvaise' } }); assert.equal(x.status, 401);
  // préparation CORS
  x = await fetch(base, { method: 'OPTIONS', headers: { origin: 'https://exemple.test', 'access-control-request-headers': 'authorization' } });
  assert.equal(x.status, 204); assert.equal(x.headers.get('access-control-allow-origin'), '*');
  // écriture interdite
  x = await fetch(base, { method: 'POST', headers: { authorization: 'Bearer ' + KEY } }); assert.equal(x.status, 405);
  // lecture
  x = await fetch(base, { headers: { authorization: 'Bearer ' + KEY, origin: 'https://exemple.test' } });
  assert.equal(x.status, 200); assert.equal(x.headers.get('access-control-allow-origin'), '*');
  const j = await x.json();
  assert.equal(j.factures.length, 2, 'seulement les factures');
  const f1 = j.factures.find((f) => f.numero === 'F-1');
  assert.deepEqual([f1.client, f1.ttc, f1.acomptes, f1.reste, f1.enRetard], ['Dupont', 120, 30, 90, true]);
  const f2 = j.factures.find((f) => f.numero === 'F-2');
  assert.deepEqual([f2.statut, f2.reste, f2.enRetard], ['payee', 0, false]);
  assert.ok(!JSON.stringify(j).includes('Secret'), 'aucune autre donnée');
  console.log('OK accès BBB');
} finally { server.close(); }
