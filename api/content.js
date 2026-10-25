const L = require('./_lib');

module.exports = async (req, res) => {
  if (L.cors(req, res)) return;
  try {
    // Public: the website reads its content from here
    if (req.method === 'GET') {
      res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=60');
      if (!L.configured()) return res.json({});
      const v = await L.r('GET', 'content');
      return res.json(v ? JSON.parse(v) : {});
    }
    // Admins: publish new content (owner, or an editor whose key was not revoked)
    if (req.method === 'POST') {
      res.setHeader('Cache-Control', 'no-store');
      if (!L.configured()) return res.status(500).json({ error: 'Server is not configured yet.' });
      const s = L.auth(req);
      if (!s) return res.status(401).json({ error: 'Session expired. Please log in again.' });
      if (s.role === 'editor' && !(await L.r('HGET', 'keyidx', s.kid))) return res.status(401).json({ error: 'Your access was revoked.' });
      const d = (req.body || {}).data;
      if (!d || !Array.isArray(d.team) || !Array.isArray(d.ach) || !Array.isArray(d.ms)) return res.status(400).json({ error: 'Invalid content.' });
      const str = JSON.stringify(d);
      if (str.length > 900000) return res.status(413).json({ error: 'Content too large (try smaller photos).' });
      await L.r('SET', 'content', str);
      return res.json({ ok: true });
    }
    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
};
