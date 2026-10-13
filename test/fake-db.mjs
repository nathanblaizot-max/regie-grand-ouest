// Base de données simulée en mémoire, juste assez pour exécuter netlify/lib/core.mjs en local.
export function makeFakeDb() {
  const meta = new Map(), users = [], docs = new Map();
  let seq = 0, uid = 0;
  const norm = (s) => s.replace(/\s+/g, ' ').trim();
  const row = (u) => ({ id: u.id, tenant: u.tenant, email: u.email, name: u.name, role: u.role, active: u.active });
  async function run(text, v) {
    const t = norm(text);
    if (t.startsWith("INSERT INTO meta")) { if (!meta.has('secret')) meta.set('secret', v[0]); return []; }
    if (t.startsWith("SELECT v FROM meta")) return [{ v: meta.get('secret') }];
    if (t.startsWith("SELECT count(*)::int AS n FROM users")) return [{ n: users.length }];
    if (t.startsWith("INSERT INTO users (email, name, pass_hash, role)")) { const u = { id: ++uid, tenant: 'main', email: v[0], name: v[1], pass_hash: v[2], role: 'admin', active: true }; users.push(u); return [row(u)]; }
    if (t.startsWith("INSERT INTO users (tenant, email, name, pass_hash, role)")) { const u = { id: ++uid, tenant: v[0], email: v[1], name: v[2], pass_hash: v[3], role: v[4], active: true }; users.push(u); return [row(u)]; }
    if (t.startsWith("SELECT id, tenant, email, name, role, active, pass_hash FROM users WHERE email")) return users.filter((u) => u.email === v[0]);
    if (t.startsWith("SELECT id, tenant, email, name, role, active FROM users WHERE id")) return users.filter((u) => u.id === v[0]).map(row);
    if (t.startsWith("SELECT pass_hash FROM users WHERE id")) return users.filter((u) => u.id === v[0]);
    if (t.startsWith("SELECT id FROM users WHERE email")) return users.filter((u) => u.email === v[0]).map((u) => ({ id: u.id }));
    if (t.startsWith("SELECT id FROM users WHERE id = ? AND tenant")) return users.filter((u) => u.id === v[0] && u.tenant === v[1]).map((u) => ({ id: u.id }));
    if (t.startsWith("SELECT id, email, name, role, active FROM users WHERE tenant")) return users.filter((u) => u.tenant === v[0]).map((u) => ({ id: u.id, email: u.email, name: u.name, role: u.role, active: u.active }));
    if (t.startsWith("UPDATE users SET pass_hash")) { users.find((u) => u.id === v[1]).pass_hash = v[0]; return []; }
    if (t.startsWith("UPDATE users SET active")) { users.find((u) => u.id === v[1]).active = v[0]; return []; }
    if (t.startsWith("UPDATE users SET role")) { users.find((u) => u.id === v[1]).role = v[0]; return []; }
    if (t.startsWith("DELETE FROM users")) { users.splice(users.findIndex((u) => u.id === v[0]), 1); return []; }
    if (t.startsWith("SELECT col, id, data, deleted, seq::text AS seq FROM docs")) {
      const [tenant, since, limit] = v;
      return [...docs.values()].filter((d) => d.tenant === tenant && d.seq > since).sort((a, b) => a.seq - b.seq).slice(0, limit).map((d) => ({ ...d, seq: String(d.seq) }));
    }
    if (t.startsWith("SELECT coalesce(max(seq), 0)::text AS m FROM docs")) return [{ m: String(Math.max(0, ...[...docs.values()].filter((d) => d.tenant === v[0]).map((d) => d.seq))) }];
    if (t.startsWith("INSERT INTO docs")) {
      const [tenant, col, id] = v, key = tenant + '|' + col + '|' + id, ex = docs.get(key);
      let op = 'delete'; if (t.includes("docs.deleted THEN")) op = 'update'; else if (t.includes("deleted = false, seq")) op = 'set';
      if (op === 'delete') docs.set(key, { tenant, col, id, data: {}, deleted: true, seq: ++seq });
      else if (op === 'set') docs.set(key, { tenant, col, id, data: JSON.parse(v[3]), deleted: false, seq: ++seq });
      else { const patch = JSON.parse(v[3]); docs.set(key, { tenant, col, id, data: ex && !ex.deleted ? { ...ex.data, ...patch } : patch, deleted: false, seq: ++seq }); }
      return [];
    }
    throw new Error('Requête non prévue dans la base simulée : ' + t.slice(0, 90));
  }
  const sql = (strings, ...vals) => { let text = strings[0]; for (let i = 0; i < vals.length; i++) text += '?' + strings[i + 1]; return run(text, vals); };
  return { sql, _docs: docs, _users: users };
}
