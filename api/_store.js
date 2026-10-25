// Tiny built-in database (a JSON file). Used automatically when Upstash Redis is NOT configured.
// It understands just the Redis commands this project uses.
const fs = require('fs'), path = require('path');
const FILE = process.env.DATA_FILE || path.join(__dirname, '..', 'data', 'db.json');
let db = null;
const load = () => { if (db) return; try { db = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) { db = { kv: {}, h: {}, exp: {} }; } };
const save = () => { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE + '.tmp', JSON.stringify(db)); fs.renameSync(FILE + '.tmp', FILE); };
const sweep = () => { const n = Date.now(); for (const k in db.exp) if (db.exp[k] <= n) { delete db.kv[k]; delete db.h[k]; delete db.exp[k]; } };

module.exports = async (...c) => {
  load(); sweep();
  const [op, k, a, b, d] = c; let r = null, w = true;
  switch (op) {
    case 'SET': db.kv[k] = a; if (String(b).toUpperCase() === 'EX') db.exp[k] = Date.now() + d * 1000; else delete db.exp[k]; r = 'OK'; break;
    case 'GET': r = db.kv[k] ?? null; w = false; break;
    case 'GETDEL': r = db.kv[k] ?? null; delete db.kv[k]; delete db.exp[k]; break;
    case 'DEL': delete db.kv[k]; delete db.h[k]; delete db.exp[k]; r = 1; break;
    case 'INCR': db.kv[k] = String((+db.kv[k] || 0) + 1); r = +db.kv[k]; break;
    case 'EXPIRE': db.exp[k] = Date.now() + a * 1000; r = 1; break;
    case 'HSET': (db.h[k] = db.h[k] || {})[a] = b; r = 1; break;
    case 'HGET': r = (db.h[k] || {})[a] ?? null; w = false; break;
    case 'HDEL': if (db.h[k]) delete db.h[k][a]; r = 1; break;
    case 'HGETALL': r = Object.entries(db.h[k] || {}).flat(); w = false; break;
    default: throw new Error('Unsupported command ' + op);
  }
  if (w) save();
  return r;
};
