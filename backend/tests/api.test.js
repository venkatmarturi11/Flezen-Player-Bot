import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createApp } from '../src/app.js';
import { createResolveService } from '../src/services/resolveService.js';
import { FlezenProvider } from '../src/providers/flezen/FlezenProvider.js';
import { validateInitData } from '../src/services/telegramAuth.js';
import { sharePageHtml, EXAMPLE_URL } from './fixtures/sharePage.js';

const HOSTS = ['flezen.com', 'www.flezen.com'];
const baseCfg = (over = {}) => ({
  allowedHosts: HOSTS, botToken: 'TEST:TOKEN', requireTelegramAuth: false, serveFrontend: false,
  frontendDist: '/nonexistent', rateLimit: { windowMs: 60000, max: 1000 }, ...over,
});
const fakeFetch = async () => ({ status: 200, finalUrl: new URL(EXAMPLE_URL), contentType: 'text/html', html: sharePageHtml() });

async function withServer(cfg, fn) {
  const resolveLink = createResolveService({ cfg, providers: [new FlezenProvider({ allowedHosts: HOSTS, fetchHtml: fakeFetch })] });
  const server = createApp({ cfg, resolveLink }).listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  try { await fn(base); } finally { server.close(); }
}
const post = (base, body, headers = {}) =>
  fetch(`${base}/api/resolve`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });

test('GET /api/health', async () => withServer(baseCfg(), async (b) => {
  const r = await fetch(`${b}/api/health`);
  assert.equal(r.status, 200);
  assert.equal((await r.json()).ok, true);
}));

test('POST /api/resolve: example link returns structured metadata', async () => withServer(baseCfg(), async (b) => {
  const r = await post(b, { url: EXAMPLE_URL });
  const j = await r.json();
  assert.equal(r.status, 200);
  assert.equal(j.type, 'video');
  assert.equal(j.stages.playback.status, 'ok');
  assert.equal(j.playable, true);
  assert.equal(j.downloadAvailable, true);
}));

test('POST /api/resolve: validation and status codes', async () => withServer(baseCfg(), async (b) => {
  let r = await post(b, { url: 'nope' });
  assert.equal(r.status, 400);
  assert.equal((await r.json()).error.code, 'invalid_url');
  r = await post(b, {});
  assert.equal(r.status, 400);
  r = await post(b, { url: 'https://example.com/s/abcdefgh' });
  assert.equal(r.status, 422);
  r = await post(b, { url: 'https://169.254.169.254/' });
  assert.equal(r.status, 400);
  r = await post(b, '{bad json');
  assert.equal(r.status, 400);
  r = await post(b, { url: 'https://flezen.com/s/' + 'a'.repeat(6000) });
  assert.equal(r.status, 413);
  r = await fetch(`${b}/api/nope`);
  assert.equal(r.status, 404);
}));

test('rate limiting returns 429', async () => withServer(baseCfg({ rateLimit: { windowMs: 60000, max: 2 } }), async (b) => {
  const codes = [];
  for (let i = 0; i < 4; i += 1) codes.push((await fetch(`${b}/api/health`)).status);
  assert.deepEqual(codes.slice(0, 2), [200, 200]);
  assert.equal(codes[3], 429);
}));

// ---- Telegram initData ----
const sign = (fields, token) => {
  const dcs = Object.entries(fields).map(([k, v]) => `${k}=${v}`).sort().join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
  const hash = crypto.createHmac('sha256', secret).update(dcs).digest('hex');
  return new URLSearchParams({ ...fields, hash }).toString();
};
const fresh = () => ({ auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify({ id: 7, first_name: 'T' }), query_id: 'AAA' });

test('validateInitData accepts valid, rejects tampered/expired/missing', () => {
  const good = sign(fresh(), 'TEST:TOKEN');
  assert.equal(validateInitData(good, 'TEST:TOKEN').valid, true);
  assert.equal(validateInitData(good, 'OTHER:TOKEN').reason, 'bad_hash');
  assert.equal(validateInitData(good.replace('T%22', 'X%22'), 'TEST:TOKEN').valid, false);
  const old = sign({ ...fresh(), auth_date: '1000' }, 'TEST:TOKEN');
  assert.equal(validateInitData(old, 'TEST:TOKEN').reason, 'expired');
  assert.equal(validateInitData('', 'TEST:TOKEN').reason, 'missing');
  assert.equal(validateInitData('a=b', 'TEST:TOKEN').reason, 'missing_hash');
  assert.equal(validateInitData(good, '').reason, 'server_not_configured');
});

test('REQUIRE_TELEGRAM_AUTH enforces initData on /api/resolve', async () => withServer(baseCfg({ requireTelegramAuth: true }), async (b) => {
  let r = await post(b, { url: EXAMPLE_URL });
  assert.equal(r.status, 401);
  r = await post(b, { url: EXAMPLE_URL }, { 'x-telegram-init-data': 'hash=zz' });
  assert.equal(r.status, 401);
  r = await post(b, { url: EXAMPLE_URL }, { 'x-telegram-init-data': sign(fresh(), 'TEST:TOKEN') });
  assert.equal(r.status, 200);
}));
