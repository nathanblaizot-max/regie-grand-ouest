// Fichiers externalisés : photos et PDF sortent de la base, reviennent intacts, sont supprimés avec leur ligne.
import assert from 'node:assert/strict';
import { startServer } from './dev-server.mjs';
const { server, db, files, port } = await startServer();
const base = 'http://127.0.0.1:' + port + '/api/';
let cookie = '';
const call = async (m, p, b) => { const r = await fetch(base + p, { method: m, headers: { 'content-type': 'application/json', 'x-requested-with': 'regie', cookie }, body: b ? JSON.stringify(b) : undefined }); const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0]; return { status: r.status, json: await r.json() }; };
try {
  assert.equal((await call('POST', 'setup', { code: 'TESTCODE', name: 'N', email: 'n@t.fr', password: 'motdepasse1' })).status, 200);
  const big = 'data:image/jpeg;base64,' + 'A'.repeat(50000);
  const pdf = 'data:application/pdf;base64,' + 'B'.repeat(80000);
  await call('POST', 'write', { ops: [
    { op: 'set', col: 'photos', id: 'p1', data: { dossierId: 'd1', phase: 'depart', data: big, ts: 1 } },
    { op: 'set', col: 'certifs', id: 'm1', data: { nom: 'c.pdf', taille: 80000, data: pdf, ts: 1 } },
    { op: 'set', col: 'clients', id: 'c1', data: { nom: 'Petit', note: 'data:court' } },
  ] });
  // 1. la base ne contient plus les gros champs, les fichiers sont dans le stockage
  const row = [...db._docs.values()].find((d) => d.col === 'photos');
  assert.ok(!('data' in row.data) && row.data.dossierId === 'd1' && row.data._blob[0] === 'data', 'photo allégée dans la base');
  assert.equal(JSON.stringify([...db._docs.values()]).includes('AAAAAAAAAA'), false);
  assert.equal(files.size, 2);
  // 2. lecture à la demande : identique à l'original, sans champ interne
  const g1 = (await call('GET', 'heavy?col=photos&dossierId=d1')).json.docs;
  assert.equal(g1.length, 1); assert.equal(g1[0].data.data, big); assert.ok(!('_blob' in g1[0].data));
  const g2 = (await call('GET', 'heavy?col=certifs&id=m1')).json.docs[0].data;
  assert.equal(g2.data, pdf); assert.equal(g2.nom, 'c.pdf');
  // 3. un document ordinaire reste dans la base
  assert.equal(files.size, 2); assert.equal([...db._docs.values()].find((d) => d.col === 'clients').data.note, 'data:court');
  // 4. remplacement puis suppression
  const pdf2 = 'data:application/pdf;base64,' + 'C'.repeat(60000);
  await call('POST', 'write', { ops: [{ op: 'set', col: 'certifs', id: 'm1', data: { nom: 'd.pdf', taille: 60000, data: pdf2, ts: 2 } }] });
  assert.equal((await call('GET', 'heavy?col=certifs&id=m1')).json.docs[0].data.data, pdf2); assert.equal(files.size, 2);
  await call('POST', 'write', { ops: [{ op: 'delete', col: 'photos', id: 'p1' }, { op: 'delete', col: 'certifs', id: 'm1' }] });
  assert.equal(files.size, 0, 'fichiers supprimés avec les lignes');
  // 5. ancienne ligne (gros champ encore dans la base) : migrée à la première lecture
  db._docs.set('main|photos|old', { tenant: 'main', col: 'photos', id: 'old', data: { dossierId: 'd2', phase: 'retour', data: big, ts: 3 }, deleted: false, seq: 99 });
  const g3 = (await call('GET', 'heavy?col=photos&dossierId=d2')).json.docs[0].data;
  assert.equal(g3.data, big); assert.equal(files.size, 1);
  assert.ok(!('data' in db._docs.get('main|photos|old').data), 'ligne ancienne allégée');
  assert.equal((await call('GET', 'heavy?col=photos&dossierId=d2')).json.docs[0].data.data, big);
  // 6. la synchro ne contient toujours ni photos ni certificats
  const sync = (await call('GET', 'sync?since=0')).json.docs;
  assert.ok(sync.every((d) => d.col !== 'photos' && d.col !== 'certifs'));
  console.log('OK fichiers externalisés');
} catch (e) { console.error('ÉCHEC', e); process.exitCode = 1; } finally { server.close(); }
