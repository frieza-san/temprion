// End-to-end test of the API using the built-in file database. Usage: npm test
const assert = require('assert'), os = require('os'), path = require('path');
process.env.DATA_FILE = path.join(os.tmpdir(), 'temprion-test-' + Date.now() + '.json');
process.env.ADMIN_PASSWORD = 'pw';
delete process.env.UPSTASH_REDIS_REST_URL; delete process.env.UPSTASH_REDIS_REST_TOKEN;
const A = require('../api/auth.js'), C = require('../api/content.js');
const call = async (f, method, body, tok) => {
  let out; const res = { setHeader() {}, end() {}, status(c) { this.c = c; return this; }, json(j) { out = { c: this.c || 200, j }; return this; } };
  await f({ method, body, headers: tok ? { authorization: 'Bearer ' + tok } : {} }, res); return out;
};
(async () => {
  const d = { tag: 'x', team: [], ach: [], ms: [] };
  assert.equal((await call(A, 'POST', { action: 'owner', password: 'bad' })).c, 401);
  const T = (await call(A, 'POST', { action: 'owner', password: 'pw' })).j.token; assert(T);
  const key = (await call(A, 'POST', { action: 'keygen', label: 'Ann', mins: 60 }, T)).j.key;
  const e = await call(A, 'POST', { action: 'key', name: 'Ann', key: key.toLowerCase() }); assert.equal(e.c, 200);
  assert.equal((await call(A, 'POST', { action: 'key', name: 'Bob', key })).c, 401, 'key must work once');
  assert.equal((await call(C, 'POST', { data: d }, e.j.token)).c, 200);
  assert.equal((await call(C, 'POST', { data: d })).c, 401);
  assert.equal((await call(C, 'GET')).j.tag, 'x');
  assert.equal((await call(A, 'POST', { action: 'keygen' }, e.j.token)).c, 401, 'editors cannot make keys');
  const l = (await call(A, 'POST', { action: 'list' }, T)).j.keys[0]; assert(l.used && l.by === 'Ann');
  await call(A, 'POST', { action: 'revoke', id: l.id }, T);
  assert.equal((await call(C, 'POST', { data: d }, e.j.token)).c, 401, 'revoked editor locked out');
  console.log('All backend tests passed');
})().catch((x) => { console.error(x); process.exit(1); });
