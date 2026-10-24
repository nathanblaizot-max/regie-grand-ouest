// Test de bout en bout de l'API (sans navigateur).
import assert from 'node:assert/strict';
import { startServer } from './dev-server.mjs';

const { server, port } = await startServer();
const base = 'http://127.0.0.1:' + port;
let cookie = '';
async function call(method, path, body, extra = {}) {
  const r = await fetch(base + '/api/' + path, { method, headers: { 'content-type': 'application/json', 'x-requested-with': 'regie', cookie, ...extra }, body: body === undefined ? undefined : JSON.stringify(body) });
  const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
  return { status: r.status, body: await r.json() };
}
try {
  let r = await call('GET', 'me'); assert.equal(r.status, 401); assert.equal(r.body.needSetup, true);
  r = await call('POST', 'setup', { code: 'FAUX', email: 'a@b.fr', name: 'A', password: 'motdepasse1' }); assert.equal(r.status, 403);
  r = await call('POST', 'setup', { code: 'TESTCODE', email: 'nathan@test.fr', name: 'Nathan', password: 'court' }); assert.equal(r.status, 400);
  r = await call('POST', 'setup', { code: 'TESTCODE', email: 'nathan@test.fr', name: 'Nathan', password: 'motdepasse1' }); assert.equal(r.status, 200); assert.equal(r.body.user.role, 'admin');
  r = await call('GET', 'me'); assert.equal(r.status, 200); assert.equal(r.body.user.email, 'nathan@test.fr');
  r = await call('POST', 'setup', { code: 'TESTCODE', email: 'x@test.fr', name: 'X', password: 'motdepasse1' }); assert.equal(r.status, 403);
  // protections
  const savedCookie = cookie; cookie = '';
  r = await call('GET', 'sync'); assert.equal(r.status, 401);
  cookie = savedCookie;
  r = await call('POST', 'write', { ops: [{ op: 'set', col: 'clients', id: 'c1', data: { nom: 'Dupont' } }] }, { 'x-requested-with': 'autre' }); assert.equal(r.status, 403);
  // écriture / synchronisation
  r = await call('POST', 'write', { ops: [{ op: 'set', col: 'clients', id: 'c1', data: { nom: 'Dupont', tel: '06' } }, { op: 'set', col: 'materiel', id: 'p1', data: { nom: 'Chaise', stock: 10 } }] }); assert.equal(r.status, 200);
  r = await call('POST', 'write', { ops: [{ op: 'update', col: 'clients', id: 'c1', data: { tel: '07' } }, { op: 'update', col: 'config', id: 'societe', data: { nom: 'GO' } }] }); assert.equal(r.status, 200);
  r = await call('GET', 'sync?since=0'); assert.equal(r.status, 200);
  const c1 = r.body.docs.find((d) => d.id === 'c1'); assert.deepEqual(c1.data, { nom: 'Dupont', tel: '07' });
  assert.ok(r.body.docs.find((d) => d.col === 'config'));
  const mx = r.body.max;
  r = await call('POST', 'write', { ops: [{ op: 'delete', col: 'materiel', id: 'p1' }] }); assert.equal(r.status, 200);
  r = await call('GET', 'sync?since=' + mx); assert.equal(r.body.docs.length, 1); assert.equal(r.body.docs[0].deleted, true);
  for (const bad of [{ op: 'set', col: 'X;DROP', id: 'a', data: {} }, { op: 'set', col: 'a', id: 'a b', data: {} }, { op: 'set', col: 'a', id: 'a', data: [] }, { op: 'hack', col: 'a', id: 'a' }]) {
    r = await call('POST', 'write', { ops: [bad] }); assert.equal(r.status, 400, JSON.stringify(bad));
  }
  // pagination
  const many = Array.from({ length: 150 }, (_, i) => ({ op: 'set', col: 'taches', id: 't' + i, data: { n: i } }));
  r = await call('POST', 'write', { ops: many }); assert.equal(r.status, 200);
  r = await call('GET', 'sync?since=0&limit=100'); assert.equal(r.body.docs.length, 100); assert.equal(r.body.more, true);
  // comptes
  r = await call('POST', 'users', { email: 'guillaume@test.fr', name: 'Guillaume', password: 'azertyuiop', role: 'user' }); assert.equal(r.status, 200);
  const gid = r.body.user.id;
  r = await call('POST', 'users', { email: 'guillaume@test.fr', name: 'G', password: 'azertyuiop' }); assert.equal(r.status, 409);
  r = await call('GET', 'users'); assert.equal(r.body.users.length, 2);
  const admin = cookie; cookie = '';
  r = await call('POST', 'login', { email: 'guillaume@test.fr', password: 'mauvais' }); assert.equal(r.status, 401);
  r = await call('POST', 'login', { email: 'guillaume@test.fr', password: 'azertyuiop' }); assert.equal(r.status, 200);
  r = await call('GET', 'users'); assert.equal(r.status, 403);
  r = await call('POST', 'users', { email: 'z@test.fr', password: 'azertyuiop' }); assert.equal(r.status, 403);
  r = await call('GET', 'sync?since=0'); assert.equal(r.status, 200);
  r = await call('POST', 'me/password', { old: 'faux', password: 'nouveaumdp1' }); assert.equal(r.status, 403);
  r = await call('POST', 'me/password', { old: 'azertyuiop', password: 'nouveaumdp1' }); assert.equal(r.status, 200);
  cookie = admin;
  r = await call('POST', 'users/' + gid, { active: false }); assert.equal(r.status, 200);
  const g = cookie; cookie = '';
  r = await call('POST', 'login', { email: 'guillaume@test.fr', password: 'nouveaumdp1' }); assert.equal(r.status, 401);
  cookie = admin;
  r = await call('POST', 'users/1', { active: false }); assert.equal(r.status, 400);
  r = await call('DELETE', 'users/' + gid); assert.equal(r.status, 200);
  // droits par compte
  r = await call('POST', 'users', { email: 'limite@test.fr', name: 'Limité', password: 'azertyuiop', role: 'user', deny: ['prix', 'documents', 'inconnu'] }); assert.equal(r.status, 200);
  assert.deepEqual(r.body.user.deny, ['prix', 'documents']);
  const lid = r.body.user.id;
  r = await call('GET', 'users'); assert.deepEqual(r.body.users.find((u) => u.id === lid).deny, ['prix', 'documents']);
  r = await call('POST', 'users/' + lid, { deny: ['stats', 'reglages'] }); assert.equal(r.status, 200);
  r = await call('GET', 'users'); assert.deepEqual(r.body.users.find((u) => u.id === lid).deny, ['stats', 'reglages']);
  const adm = cookie; cookie = '';
  r = await call('POST', 'login', { email: 'limite@test.fr', password: 'azertyuiop' }); assert.equal(r.status, 200);
  assert.deepEqual(r.body.user.deny, ['stats', 'reglages']);
  r = await call('GET', 'me'); assert.deepEqual(r.body.user.deny, ['stats', 'reglages']);
  r = await call('POST', 'tenants', { societe: 'X', email: 'x@test.fr', password: 'azertyuiop' }); assert.equal(r.status, 403, 'un utilisateur ne crée pas d’espace');
  cookie = adm;
  r = await call('GET', 'me'); assert.deepEqual(r.body.user.deny, [], 'un administrateur a tous les droits');
  // compte temporaire
  r = await call('POST', 'users', { email: 'temp@test.fr', name: 'Extra week-end', password: 'azertyuiop', role: 'user', until: '2020-01-01' }); assert.equal(r.status, 200);
  const tid = r.body.user.id; assert.equal(r.body.user.until, '2020-01-01');
  const adm2 = cookie; cookie = '';
  r = await call('POST', 'login', { email: 'temp@test.fr', password: 'azertyuiop' }); assert.equal(r.status, 403); assert.equal(r.body.error, 'expire');
  r = await call('POST', 'login', { email: 'temp@test.fr', password: 'faux' }); assert.equal(r.status, 401, 'mauvais mot de passe : pas d’information sur l’expiration');
  cookie = adm2;
  const demain = new Date(Date.now() + 36 * 3600e3).toISOString().slice(0, 10);
  r = await call('POST', 'users/' + tid, { until: demain }); assert.equal(r.status, 200);
  cookie = '';
  r = await call('POST', 'login', { email: 'temp@test.fr', password: 'azertyuiop' }); assert.equal(r.status, 200); assert.equal(r.body.user.until, demain);
  r = await call('GET', 'sync?since=0'); assert.equal(r.status, 200);
  const tcookie = cookie; cookie = adm2;
  r = await call('POST', 'users/' + tid, { until: '2020-01-01' }); assert.equal(r.status, 200);
  cookie = tcookie;
  r = await call('GET', 'sync?since=0'); assert.equal(r.status, 401, 'la session d’un compte expiré est coupée');
  cookie = adm2;
  r = await call('POST', 'users/' + tid, { until: '' }); assert.equal(r.status, 200);
  r = await call('GET', 'users'); assert.equal(r.body.users.find((u) => u.id === tid).until, '');
  // espaces séparés pour d'autres loueurs
  r = await call('POST', 'tenants', { societe: 'Loueur Test', name: 'Marie', email: 'marie@loueur.fr', password: 'azertyuiop' }); assert.equal(r.status, 200);
  assert.equal(r.body.tenant.societe, 'Loueur Test');
  r = await call('POST', 'tenants', { societe: 'Autre', email: 'marie@loueur.fr', password: 'azertyuiop' }); assert.equal(r.status, 409);
  r = await call('POST', 'tenants', { societe: '', email: 'b@loueur.fr', password: 'azertyuiop' }); assert.equal(r.status, 400);
  r = await call('POST', 'tenants', { societe: 'Court', email: 'b@loueur.fr', password: 'court' }); assert.equal(r.status, 400);
  r = await call('GET', 'tenants'); assert.equal(r.status, 200); assert.equal(r.body.tenants.length, 1);
  cookie = '';
  r = await call('POST', 'login', { email: 'marie@loueur.fr', password: 'azertyuiop' }); assert.equal(r.status, 200);
  assert.equal(r.body.user.neutre, true); assert.equal(r.body.user.role, 'admin');
  r = await call('GET', 'sync?since=0'); assert.equal(r.status, 200);
  assert.ok(r.body.docs.find((d) => d.col === 'config' && d.id === 'societe' && d.data.nom === 'Loueur Test'), 'le nom de la société est prérempli');
  assert.equal(r.body.docs.filter((d) => d.col === 'taches').length, 0, 'aucune donnée de l’espace principal');
  r = await call('GET', 'users'); assert.equal(r.body.users.length, 1, 'comptes de son espace seulement');
  r = await call('GET', 'tenants'); assert.equal(r.status, 403, 'un autre loueur ne voit pas les espaces');
  r = await call('POST', 'tenants', { societe: 'Y', email: 'y@test.fr', password: 'azertyuiop' }); assert.equal(r.status, 403);
  r = await call('POST', 'users', { email: 'employe@loueur.fr', name: 'Employé', password: 'azertyuiop', role: 'user', deny: ['prix'] }); assert.equal(r.status, 200);
  r = await call('POST', 'users/' + lid, { active: false }); assert.equal(r.status, 404, 'pas d’accès aux comptes d’un autre espace');
  cookie = adm;
  r = await call('POST', 'logout', {}); assert.equal(r.status, 200);
  console.log('API : tous les tests passent');
} catch (e) { console.error('ÉCHEC', e); process.exitCode = 1; } finally { server.close(); }
