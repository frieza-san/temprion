// Zero-dependency Node server: serves the website + admin and runs the API.
// Works on any host that can run Node 20+ (Render, Railway, Fly.io, a VPS, your own PC...).
const http = require('http'), fs = require('fs'), path = require('path');
const auth = require('./api/auth'), content = require('./api/content');
const PORT = process.env.PORT || 3000, PUB = path.join(__dirname, 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webp': 'image/webp' };

const wrap = (res) => {
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (j) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(j)); return res; };
  return res;
};
const readBody = (req) => new Promise((ok) => {
  let b = '';
  req.on('data', (d) => { b += d; if (b.length > 2e6) req.destroy(); });
  req.on('end', () => { try { ok(b ? JSON.parse(b) : {}); } catch (e) { ok({}); } });
});

http.createServer(async (req, res) => {
  wrap(res);
  try {
    const u = new URL(req.url, 'http://localhost');
    if (u.pathname === '/api/auth' || u.pathname === '/api/content') {
      req.body = req.method === 'POST' ? await readBody(req) : {};
      return await (u.pathname === '/api/auth' ? auth : content)(req, res);
    }
    let f = path.join(PUB, decodeURIComponent(u.pathname));
    if (!f.startsWith(PUB)) return res.status(403).end('Forbidden');
    if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
    if (!fs.existsSync(f)) return res.status(404).end('Not found');
    res.setHeader('Content-Type', TYPES[path.extname(f)] || 'application/octet-stream');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    fs.createReadStream(f).pipe(res);
  } catch (e) { res.status(500).end('Server error'); }
}).listen(PORT, () => console.log('Temprion running on http://localhost:' + PORT));
