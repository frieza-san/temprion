const crypto = require('crypto');
const U = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const T = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const S = () => process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD || '';
const configured = () => !!process.env.ADMIN_PASSWORD;
const local = require('./_store');

// Uses Upstash Redis (REST) if configured, otherwise a local JSON file (data/db.json)
async function r(...cmd) {
  if (!(U && T)) return local(...cmd); // no Upstash configured -> use the built-in file database
  const x = await fetch(U, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + T, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  const j = await x.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}
const sha = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');
const norm = (k) => String(k).toUpperCase().replace(/[^A-Z0-9]/g, '');
const same = (a, b) => crypto.timingSafeEqual(Buffer.from(sha(a)), Buffer.from(sha(b)));
const mac = (d) => crypto.createHmac('sha256', S()).update(d).digest('base64url');
const sign = (p) => { const d = Buffer.from(JSON.stringify(p)).toString('base64url'); return d + '.' + mac(d); };
function auth(req) {
  try {
    const [d, m] = String((req.headers.authorization || '').replace(/^Bearer /, '')).split('.');
    const e = mac(d);
    if (!m || m.length !== e.length || !crypto.timingSafeEqual(Buffer.from(m), Buffer.from(e))) return null;
    const p = JSON.parse(Buffer.from(d, 'base64url').toString());
    return p.exp > Date.now() ? p : null;
  } catch (e) { return null; }
}
// Basic brute-force protection: 15 login attempts per IP per 10 minutes
async function limit(req) {
  const ip = String(req.headers['x-forwarded-for'] || 'x').split(',')[0].trim();
  const n = await r('INCR', 'rl:' + ip);
  if (n === 1) await r('EXPIRE', 'rl:' + ip, 600);
  return n <= 15;
}
// CORS: only needed if the website/admin are hosted on a different domain than this backend.
// Set ALLOWED_ORIGINS to a comma-separated list, e.g. https://temprion.com,https://admin.temprion.com
function cors(req, res) {
  const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map((x) => x.trim()).filter(Boolean);
  const o = req.headers.origin;
  if (o && (allowed.includes('*') || allowed.includes(o))) {
    res.setHeader('Access-Control-Allow-Origin', o);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  }
  if (req.method === 'OPTIONS') { res.status(204).end(); return true; }
  return false;
}
module.exports = { r, sha, norm, same, sign, auth, limit, configured, cors };
