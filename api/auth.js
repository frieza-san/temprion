const L = require('./_lib');
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const crypto = require('crypto');

module.exports = async (req, res) => {
  if (L.cors(req, res)) return;
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!L.configured()) return res.status(500).json({ error: 'Server is not configured yet. See README.md.' });
  const b = req.body || {}, a = b.action;
  try {
    if (a === 'owner' || a === 'key') {
      if (!(await L.limit(req))) return res.status(429).json({ error: 'Too many attempts. Try again in a few minutes.' });
    }
    // Owner signs in with the ADMIN_PASSWORD environment variable
    if (a === 'owner') {
      if (!L.same(b.password || '', process.env.ADMIN_PASSWORD)) return res.status(401).json({ error: 'Wrong password.' });
      return res.json({ token: L.sign({ role: 'owner', name: 'Owner', exp: Date.now() + 12 * 36e5 }) });
    }
    // Anyone else: name + one-time pass key. GETDEL makes a key usable exactly once.
    if (a === 'key') {
      const name = String(b.name || '').trim().slice(0, 60), k = L.norm(b.key || '');
      if (name.length < 2) return res.status(400).json({ error: 'Please enter your name.' });
      if (k.length < 8) return res.status(400).json({ error: 'Enter your full pass key.' });
      const h = L.sha(k), raw = await L.r('GETDEL', 'key:' + h);
      if (!raw) return res.status(401).json({ error: 'Invalid, used or expired pass key.' });
      await L.r('HSET', 'keyidx', h, JSON.stringify({ ...JSON.parse(raw), used: true, by: name, at: Date.now() }));
      return res.json({ token: L.sign({ role: 'editor', name, kid: h, exp: Date.now() + 12 * 36e5 }) });
    }
    // Everything below is owner-only
    const s = L.auth(req);
    if (!s || s.role !== 'owner') return res.status(401).json({ error: 'Owner only.' });
    if (a === 'keygen') {
      const mins = [10, 60, 1440].includes(+b.mins) ? +b.mins : 60;
      const c = [...crypto.randomBytes(12)].map((x) => ALPHA[x % ALPHA.length]).join('');
      const key = 'TMP-' + c.slice(0, 4) + '-' + c.slice(4, 8) + '-' + c.slice(8), h = L.sha(L.norm(key));
      const m = { label: String(b.label || 'Unnamed').slice(0, 60), created: Date.now(), exp: Date.now() + mins * 60000 };
      await L.r('SET', 'key:' + h, JSON.stringify(m), 'EX', mins * 60);
      await L.r('HSET', 'keyidx', h, JSON.stringify(m));
      return res.json({ key });
    }
    if (a === 'list') {
      const f = (await L.r('HGETALL', 'keyidx')) || [], out = [];
      for (let i = 0; i < f.length; i += 2) out.push({ id: f[i], ...JSON.parse(f[i + 1]) });
      return res.json({ keys: out.sort((x, y) => y.created - x.created) });
    }
    if (a === 'revoke') {
      await L.r('DEL', 'key:' + b.id);
      await L.r('HDEL', 'keyidx', b.id);
      return res.json({ ok: true });
    }
    res.status(400).json({ error: 'Unknown action' });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
};
