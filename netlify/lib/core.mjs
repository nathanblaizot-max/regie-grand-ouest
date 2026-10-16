// Cœur de l'API : comptes, session, synchronisation des documents.
// Aucune dépendance externe : seul l'accès à la base (db.sql) est injecté, ce qui permet de tester en local.
import crypto from 'node:crypto';

const COOKIE = 'regie_session';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 jours
const COLS = /^[a-z_]{1,40}$/;
const IDS = /^[A-Za-z0-9_\-]{1,100}$/;
const MAX_OPS = 200;
const MAX_DOC_BYTES = 1500000;
const fails = new Map();
let secretCache = null;

const J = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });

const b64u = (buf) => Buffer.from(buf).toString('base64url');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function scrypt(password, salt) {
  return new Promise((resolve, reject) =>
    crypto.scrypt(password, salt, 64, (e, k) => (e ? reject(e) : resolve(k)))
  );
}
export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt);
  return 'scrypt$' + salt.toString('base64url') + '$' + key.toString('base64url');
}
export async function checkPassword(password, stored) {
  const p = String(stored || '').split('$');
  if (p[0] !== 'scrypt' || p.length !== 3) return false;
  const key = await scrypt(password, Buffer.from(p[1], 'base64url'));
  const ref = Buffer.from(p[2], 'base64url');
  return ref.length === key.length && crypto.timingSafeEqual(ref, key);
}

async function getSecret(db) {
  if (secretCache) return secretCache;
  const fresh = crypto.randomBytes(32).toString('base64url');
  await db.sql`INSERT INTO meta (k, v) VALUES ('secret', ${fresh}) ON CONFLICT (k) DO NOTHING`;
  const rows = await db.sql`SELECT v FROM meta WHERE k = 'secret'`;
  secretCache = rows[0].v;
  return secretCache;
}
async function sign(db, payload) {
  const body = b64u(JSON.stringify(payload));
  const mac = crypto.createHmac('sha256', await getSecret(db)).update(body).digest('base64url');
  return body + '.' + mac;
}
async function verify(db, token) {
  const [body, mac] = String(token || '').split('.');
  if (!body || !mac) return null;
  const good = crypto.createHmac('sha256', await getSecret(db)).update(body).digest('base64url');
  const a = Buffer.from(mac), b = Buffer.from(good);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    return p && p.e > Date.now() / 1000 ? p : null;
  } catch { return null; }
}
function cookieHeader(value, maxAge) {
  return `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}
function readCookie(req) {
  const m = (req.headers.get('cookie') || '').match(new RegExp('(?:^|;\\s*)' + COOKIE + '=([^;]+)'));
  return m ? m[1] : '';
}
async function startSession(db, user) {
  const token = await sign(db, { u: user.id, e: Math.floor(Date.now() / 1000) + MAX_AGE });
  return cookieHeader(token, MAX_AGE);
}
async function currentUser(db, req) {
  const p = await verify(db, readCookie(req));
  if (!p) return null;
  const rows = await db.sql`SELECT id, tenant, email, name, role, active FROM users WHERE id = ${p.u}`;
  const u = rows[0];
  return u && u.active ? u : null;
}
const pub = (u) => ({ id: u.id, email: u.email, name: u.name, role: u.role });
const validEmail = (e) => /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(e);

async function body(req) {
  const txt = await req.text();
  if (txt.length > 4500000) throw Object.assign(new Error('too large'), { status: 413 });
  try { return txt ? JSON.parse(txt) : {}; } catch { throw Object.assign(new Error('bad json'), { status: 400 }); }
}
function tooMany(ip) {
  const now = Date.now(), arr = (fails.get(ip) || []).filter((t) => now - t < 600000);
  fails.set(ip, arr);
  return arr.length >= 10;
}


const pubHits = new Map();
function tooManyPub(ip) { const now = Date.now(), a = (pubHits.get(ip) || []).filter((t) => now - t < 600000); pubHits.set(ip, a); return a.length >= 20; }
function pubFails(ip) { (pubHits.get(ip) || []).push(Date.now()); }
const todayParis = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });
async function findByToken(db, t) {
  const token = String(t || '');
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const rows = await db.sql`SELECT tenant, id, data FROM docs WHERE col = 'documents' AND deleted = false AND data->>'signToken' = ${token}`;
  return rows[0] || null;
}
function publicDevis(d) {
  const so = d.societeSnap || {};
  return {
    type: d.type, numero: d.numero, titre: d.titre || '', statut: d.statut, lieu: d.lieu || '',
    dateDebut: d.dateDebut || '', dateFin: d.dateFin || '', dateValidite: d.dateValidite || '',
    expire: !!(d.dateValidite && d.dateValidite < todayParis()),
    client: (d.clientSnap && d.clientSnap.nom) || '',
    societe: { nom: so.nom || '', adresse: so.adresse || '', tel: so.tel || '', email: so.email || '', siret: so.siret || '', conditions: so.conditions || '', cgv: so.cgv || '' },
    lignes: (d.lignes || []).map((l) => ({ designation: l.designation, qte: l.qte, puHT: l.puHT, tva: l.tva, unite: l.unite || '' })),
    totaux: d.totaux || {}, regimeTva: d.regimeTva || '', acomptePct: d.acomptePct || 0,
    signe: !!d.signature, dateSignature: d.dateSignature || '', signataire: d.signataire || '',
  };
}

export async function handle(req, db, opts = {}) {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api\/?/, '').replace(/\/$/, '');
  const method = req.method.toUpperCase();
  const ip = req.headers.get('x-nf-client-connection-ip') || req.headers.get('x-forwarded-for') || 'local';
  try {
    if (method !== 'GET') {
      if (req.headers.get('x-requested-with') !== 'regie') return J({ error: 'forbidden' }, 403);
      const o = req.headers.get('origin');
      if (o && new URL(o).host !== url.host) return J({ error: 'forbidden' }, 403);
    }

    // ---- Sans session : état, première configuration, connexion
    if (path === 'me' && method === 'GET') {
      const u = await currentUser(db, req);
      if (u) return J({ user: pub(u) });
      const n = await db.sql`SELECT count(*)::int AS n FROM users`;
      return J({ user: null, needSetup: n[0].n === 0 }, 401);
    }
    if (path === 'setup' && method === 'POST') {
      const n = await db.sql`SELECT count(*)::int AS n FROM users`;
      if (n[0].n > 0) return J({ error: 'deja-configure' }, 403);
      const b = await body(req);
      if (!opts.setupCode || String(b.code || '').trim() !== opts.setupCode) { await wait(400); return J({ error: 'code' }, 403); }
      const email = String(b.email || '').trim().toLowerCase();
      if (!validEmail(email)) return J({ error: 'email' }, 400);
      if (String(b.password || '').length < 8) return J({ error: 'mot-de-passe-court' }, 400);
      const hash = await hashPassword(String(b.password));
      const rows = await db.sql`INSERT INTO users (email, name, pass_hash, role) VALUES (${email}, ${String(b.name || '').trim()}, ${hash}, 'admin') RETURNING id, tenant, email, name, role, active`;
      return J({ user: pub(rows[0]) }, 200, { 'set-cookie': await startSession(db, rows[0]) });
    }
    if (path === 'login' && method === 'POST') {
      if (tooMany(ip)) return J({ error: 'trop-de-tentatives' }, 429);
      const b = await body(req);
      const email = String(b.email || '').trim().toLowerCase();
      const rows = await db.sql`SELECT id, tenant, email, name, role, active, pass_hash FROM users WHERE email = ${email}`;
      const u = rows[0];
      const ok = u && u.active && (await checkPassword(String(b.password || ''), u.pass_hash));
      if (!ok) { fails.get(ip).push(Date.now()); await wait(400); return J({ error: 'identifiants' }, 401); }
      return J({ user: pub(u) }, 200, { 'set-cookie': await startSession(db, u) });
    }
    if (path === 'logout' && method === 'POST') return J({ ok: true }, 200, { 'set-cookie': cookieHeader('', 0) });

    // ---- Signature en ligne d'un devis par le client (lien secret, sans compte)
    if (path === 'public/devis' && method === 'GET') {
      if (tooManyPub(ip)) return J({ error: 'trop-de-tentatives' }, 429);
      const found = await findByToken(db, url.searchParams.get('t'));
      if (!found) { pubFails(ip); await wait(300); return J({ error: 'introuvable' }, 404); }
      return J({ devis: publicDevis(found.data) });
    }
    if (path === 'public/sign' && method === 'POST') {
      if (tooManyPub(ip)) return J({ error: 'trop-de-tentatives' }, 429);
      const b = await body(req);
      const found = await findByToken(db, b.t);
      if (!found) { pubFails(ip); await wait(300); return J({ error: 'introuvable' }, 404); }
      const d = found.data;
      if (d.type !== 'devis' || ['refuse', 'annule'].includes(d.statut)) return J({ error: 'indisponible' }, 409);
      if (d.signature) return J({ error: 'deja-signe' }, 409);
      if (d.dateValidite && d.dateValidite < todayParis()) return J({ error: 'expire' }, 409);
      const nom = String(b.nom || '').trim().slice(0, 80);
      const img = String(b.img || '');
      if (nom.length < 2) return J({ error: 'nom' }, 400);
      if (!/^data:image\/png;base64,[A-Za-z0-9+\/=]+$/.test(img) || img.length > 250000) return J({ error: 'signature' }, 400);
      const patch = JSON.stringify({ statut: 'accepte', signature: img, signataire: nom, dateSignature: todayParis(), signeEnLigne: true, signeLe: new Date().toISOString(), signeIp: ip });
      await db.sql`UPDATE docs SET data = data || ${patch}::jsonb, seq = nextval('docs_seq') WHERE tenant = ${found.tenant} AND col = 'documents' AND id = ${found.id}`;
      return J({ ok: true });
    }

    // ---- Avec session
    const me = await currentUser(db, req);
    if (!me) return J({ error: 'non-connecte' }, 401);
    const isAdmin = me.role === 'admin';

    if (path === 'sync' && method === 'GET') {
      const since = Math.max(0, parseInt(url.searchParams.get('since') || '0', 10) || 0);
      const limit = Math.min(500, Math.max(1, parseInt(url.searchParams.get('limit') || '400', 10) || 400));
      const rows = await db.sql`SELECT col, id, data, deleted, seq::text AS seq FROM docs WHERE tenant = ${me.tenant} AND seq > ${since} AND col NOT IN ('photos', 'certifs') ORDER BY seq ASC LIMIT ${limit + 1}`;
      const more = rows.length > limit;
      const docs = rows.slice(0, limit);
      const mx = docs.length ? Number(docs[docs.length - 1].seq) : since;
      return J({ docs: docs.map((r) => ({ col: r.col, id: r.id, data: r.data, deleted: r.deleted, seq: Number(r.seq) })), max: mx, more });
    }

    // Collections lourdes (photos, certificats PDF) : exclues de la synchro, lues à la demande.
    if (path === 'heavy' && method === 'GET') {
      const col = String(url.searchParams.get('col') || '');
      if (col !== 'photos' && col !== 'certifs') return J({ error: 'collection' }, 400);
      const id = url.searchParams.get('id'), dos = url.searchParams.get('dossierId');
      let rows = [];
      if (id && IDS.test(id)) rows = await db.sql`SELECT id, data FROM docs WHERE tenant = ${me.tenant} AND col = ${col} AND id = ${id} AND deleted = false`;
      else if (col === 'photos' && dos && IDS.test(dos)) rows = await db.sql`SELECT id, data FROM docs WHERE tenant = ${me.tenant} AND col = ${col} AND deleted = false AND data->>'dossierId' = ${dos} LIMIT 60`;
      else return J({ error: 'requete' }, 400);
      return J({ docs: rows.map((r) => ({ col, id: r.id, data: r.data })) });
    }

    if (path === 'write' && method === 'POST') {
      const b = await body(req);
      const ops = Array.isArray(b.ops) ? b.ops : [];
      if (!ops.length || ops.length > MAX_OPS) return J({ error: 'ops' }, 400);
      for (const o of ops) {
        if (!COLS.test(String(o.col)) || !IDS.test(String(o.id)) || !['set', 'update', 'delete'].includes(o.op)) return J({ error: 'op-invalide' }, 400);
        if (o.op !== 'delete' && (typeof o.data !== 'object' || o.data === null || Array.isArray(o.data) || JSON.stringify(o.data).length > MAX_DOC_BYTES)) return J({ error: 'donnees-invalides' }, 400);
      }
      for (const o of ops) {
        const t = me.tenant;
        if (o.op === 'delete') {
          await db.sql`INSERT INTO docs (tenant, col, id, data, deleted) VALUES (${t}, ${o.col}, ${o.id}, '{}'::jsonb, true)
            ON CONFLICT (tenant, col, id) DO UPDATE SET data = '{}'::jsonb, deleted = true, seq = nextval('docs_seq')`;
        } else if (o.op === 'set') {
          const json = JSON.stringify(o.data);
          await db.sql`INSERT INTO docs (tenant, col, id, data, deleted) VALUES (${t}, ${o.col}, ${o.id}, ${json}::jsonb, false)
            ON CONFLICT (tenant, col, id) DO UPDATE SET data = ${json}::jsonb, deleted = false, seq = nextval('docs_seq')`;
        } else {
          const json = JSON.stringify(o.data);
          await db.sql`INSERT INTO docs (tenant, col, id, data, deleted) VALUES (${t}, ${o.col}, ${o.id}, ${json}::jsonb, false)
            ON CONFLICT (tenant, col, id) DO UPDATE SET data = CASE WHEN docs.deleted THEN ${json}::jsonb ELSE docs.data || ${json}::jsonb END, deleted = false, seq = nextval('docs_seq')`;
        }
      }
      const m = await db.sql`SELECT coalesce(max(seq), 0)::text AS m FROM docs WHERE tenant = ${me.tenant}`;
      return J({ ok: true, seq: Number(m[0].m) });
    }

    if (path === 'me/password' && method === 'POST') {
      const b = await body(req);
      const rows = await db.sql`SELECT pass_hash FROM users WHERE id = ${me.id}`;
      if (!(await checkPassword(String(b.old || ''), rows[0].pass_hash))) { await wait(400); return J({ error: 'ancien-mot-de-passe' }, 403); }
      if (String(b.password || '').length < 8) return J({ error: 'mot-de-passe-court' }, 400);
      const hash = await hashPassword(String(b.password));
      await db.sql`UPDATE users SET pass_hash = ${hash} WHERE id = ${me.id}`;
      return J({ ok: true });
    }

    if (path === 'users' && method === 'GET') {
      if (!isAdmin) return J({ error: 'interdit' }, 403);
      const rows = await db.sql`SELECT id, email, name, role, active FROM users WHERE tenant = ${me.tenant} ORDER BY id`;
      return J({ users: rows });
    }
    if (path === 'users' && method === 'POST') {
      if (!isAdmin) return J({ error: 'interdit' }, 403);
      const b = await body(req);
      const email = String(b.email || '').trim().toLowerCase();
      if (!validEmail(email)) return J({ error: 'email' }, 400);
      if (String(b.password || '').length < 8) return J({ error: 'mot-de-passe-court' }, 400);
      const role = b.role === 'admin' ? 'admin' : 'user';
      const hash = await hashPassword(String(b.password));
      const ex = await db.sql`SELECT id FROM users WHERE email = ${email}`;
      if (ex.length) return J({ error: 'existe' }, 409);
      const rows = await db.sql`INSERT INTO users (tenant, email, name, pass_hash, role) VALUES (${me.tenant}, ${email}, ${String(b.name || '').trim()}, ${hash}, ${role}) RETURNING id, email, name, role, active`;
      return J({ user: rows[0] });
    }
    const um = path.match(/^users\/(\d+)$/);
    if (um) {
      if (!isAdmin) return J({ error: 'interdit' }, 403);
      const id = parseInt(um[1], 10);
      const rows = await db.sql`SELECT id FROM users WHERE id = ${id} AND tenant = ${me.tenant}`;
      if (!rows.length) return J({ error: 'introuvable' }, 404);
      if (method === 'DELETE') {
        if (id === me.id) return J({ error: 'soi-meme' }, 400);
        await db.sql`DELETE FROM users WHERE id = ${id}`;
        return J({ ok: true });
      }
      if (method === 'POST') {
        const b = await body(req);
        if (b.password !== undefined) {
          if (String(b.password).length < 8) return J({ error: 'mot-de-passe-court' }, 400);
          const hash = await hashPassword(String(b.password));
          await db.sql`UPDATE users SET pass_hash = ${hash} WHERE id = ${id}`;
        }
        if (b.active !== undefined) {
          if (id === me.id && !b.active) return J({ error: 'soi-meme' }, 400);
          await db.sql`UPDATE users SET active = ${!!b.active} WHERE id = ${id}`;
        }
        if (b.role !== undefined) {
          if (id === me.id && b.role !== 'admin') return J({ error: 'soi-meme' }, 400);
          await db.sql`UPDATE users SET role = ${b.role === 'admin' ? 'admin' : 'user'} WHERE id = ${id}`;
        }
        return J({ ok: true });
      }
    }
    return J({ error: 'introuvable' }, 404);
  } catch (e) {
    if (e && e.status) return J({ error: e.message }, e.status);
    console.error('api error', e);
    return J({ error: 'serveur' }, 500);
  }
}
