# Temprion — one Node.js app (no Vercel needed)

Website (`/`), admin (`/admin`) and backend (`/api`) all run from one small Node server with **zero npm dependencies**.

```
server.js              the server
public/index.html      public website
public/admin/index.html admin site
api/                   login, one-time keys, content storage
data/db.json           created automatically (built-in database)
```

## Run on your Mac / PC
1. Install Node.js LTS (nodejs.org).
2. Copy `.env.example` to `.env` and set `ADMIN_PASSWORD` and `SESSION_SECRET`.
3. In the terminal inside this folder:
   ```
   npm test        # optional check
   npm run dev     # then open http://localhost:3000  and  /admin
   ```

## Put it online (pick one)
**Render (has a free plan)** — push the folder to GitHub, then Render -> New -> Web Service. Build command: *(empty)*, start command: `npm start`.
Add environment variables `ADMIN_PASSWORD`, `SESSION_SECRET`. The free plan's disk is wiped on restart, so also create a free Upstash Redis database and add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.

**Railway / Fly.io** — deploy the repo (a Dockerfile is included). Attach a volume and set `DATA_FILE=/data/db.json`, or use Upstash.

**Any VPS (DigitalOcean, Hetzner, AWS Lightsail, Oracle Cloud free tier)** — install Node, copy the folder, set the env vars, run `node server.js` under `pm2` or `systemd`, and put Caddy or nginx in front for HTTPS and your domain.

**Docker anywhere** — `docker build -t temprion . && docker run -p 3000:3000 -e ADMIN_PASSWORD=... -e SESSION_SECRET=... -v temprion-data:/app/data temprion`

Always serve it over HTTPS in production (hosts above do this for you).

## Using the admin
Open `/admin`. Owner: "Site owner? Sign in with password". Team: owner creates a one-time key in **Pass keys** and shares it privately; the person enters name + key. Publishing in the admin updates the public site within seconds.

## Security built in
One-time keys stored as hashes and consumed atomically; HMAC-signed 12-hour sessions; constant-time password check; 15 login attempts per IP per 10 min; revoking a key locks that person out.
