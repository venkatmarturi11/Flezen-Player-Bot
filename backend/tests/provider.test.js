import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSharePage, parseSizeToBytes } from '../src/providers/flezen/parseSharePage.js';
import { FlezenProvider } from '../src/providers/flezen/FlezenProvider.js';
import { createResolveService } from '../src/services/resolveService.js';
import { safeFetchHtml } from '../src/services/safeFetch.js';
import { sharePageHtml, EXAMPLE_URL, EXAMPLE_ID, EXAMPLE_NAME } from './fixtures/sharePage.js';

const HOSTS = ['flezen.com', 'www.flezen.com'];
const cfg = { allowedHosts: HOSTS };
const okPage = (html, status = 200) => async () => ({ status, finalUrl: new URL(EXAMPLE_URL), contentType: 'text/html; charset=utf-8', html });
const svc = (fetchHtml) => createResolveService({ cfg, providers: [new FlezenProvider({ allowedHosts: HOSTS, fetchHtml })] });

test('parser extracts metadata from the example share page', () => {
  const m = parseSharePage(sharePageHtml());
  assert.equal(m.filename, EXAMPLE_NAME);
  assert.equal(m.sizeBytes, 13636124);
  assert.equal(m.fileType, 'video');
  assert.equal(m.isVideo, true);
  assert.equal(m.views, 1);
  assert.match(m.uploadedAt, /^2026-10-29 08:39:54/);
});

test('parser: non-video file, size units, and unrecognised page', () => {
  const doc = parseSharePage(sharePageHtml({ name: 'notes.pdf', type: 'document', size: '2.5 MB' }));
  assert.equal(doc.isVideo, false);
  assert.equal(doc.sizeBytes, 2500000);
  assert.equal(parseSharePage('<html><body><h1>Hello</h1></body></html>'), null);
  assert.equal(parseSizeToBytes('13636124'), 13636124);
  assert.equal(parseSizeToBytes('abc'), null);
});

test('resolve(): extracts any share id, rejects other shapes', () => {
  const p = new FlezenProvider({ allowedHosts: HOSTS });
  const r = p.resolve(new URL(`${EXAMPLE_URL}?utm=1#x`));
  assert.equal(r.shareId, EXAMPLE_ID);
  assert.equal(r.canonicalUrl, EXAMPLE_URL); // query/fragment dropped
  assert.equal(p.resolve(new URL('https://www.flezen.com/s/Zz9aBcDeFgHiJk')).shareId, 'Zz9aBcDeFgHiJk');
  for (const bad of ['https://flezen.com/', 'https://flezen.com/features', 'https://flezen.com/s/', 'https://flezen.com/s/a/b', 'https://flezen.com/s/short']) {
    assert.throws(() => p.resolve(new URL(bad)), { code: 'unsupported_format' }, bad);
  }
});

test('example link: metadata ok, playback and download available for video', async () => {
  const out = await svc(okPage(sharePageHtml()))(EXAMPLE_URL);
  assert.equal(out.success, true);
  assert.equal(out.type, 'video');
  assert.equal(out.file.sizeBytes, 13636124);
  assert.equal(out.stages.metadata.status, 'ok');
  assert.equal(out.stages.playback.status, 'ok');
  assert.equal(out.stages.download.status, 'ok');
  assert.equal(out.playable, true);
  assert.equal(out.downloadAvailable, true);
  assert.equal(out.playbackUrl, '/api/stream/dbhbi0hbjlnl41j838sg4d2mc4ez1bq');
  assert.equal(out.openUrl, EXAMPLE_URL);
});

test('non-video file: playback is not_applicable', async () => {
  const out = await svc(okPage(sharePageHtml({ name: 'a.pdf', type: 'document' })))(EXAMPLE_URL);
  assert.equal(out.type, 'file');
  assert.equal(out.stages.playback.status, 'not_applicable');
});

test('a provider that supplies sources flips playable/download flags (stages stay separate)', async () => {
  class CustomProvider extends FlezenProvider {
    async getPlaybackSource() { return { available: true, url: 'https://secret.upstream/x.mp4' }; }
    async getDownloadSource() { return { available: false, reason: 'restricted' }; }
  }
  const s = createResolveService({ cfg, providers: [new CustomProvider({ allowedHosts: HOSTS, fetchHtml: okPage(sharePageHtml()) })] });
  const out = await s(EXAMPLE_URL);
  assert.equal(out.playable, true);
  assert.equal(out.downloadAvailable, false);
  assert.equal(JSON.stringify(out).includes('secret.upstream'), false); // upstream URL never leaks
});

test('inaccessible link statuses map to clear errors', async () => {
  const cases = [[404, 'not_found'], [410, 'deleted'], [403, 'private'], [401, 'private'], [500, 'upstream_error'], [429, 'upstream_error']];
  for (const [status, code] of cases) {
    await assert.rejects(svc(okPage('', status))(EXAMPLE_URL), { code }, String(status));
  }
});

test('200-status soft error pages and unknown pages', async () => {
  await assert.rejects(svc(okPage('<body><h1>Oops</h1><p>This file has been deleted</p></body>'))(EXAMPLE_URL), { code: 'deleted' });
  await assert.rejects(svc(okPage('<body><h1>Oops</h1><p>File not found</p></body>'))(EXAMPLE_URL), { code: 'not_found' });
  await assert.rejects(svc(okPage('<body><p>whatever</p></body>'))(EXAMPLE_URL), { code: 'unparseable' });
});

test('unsupported hosts / formats are rejected before any fetch', async () => {
  let called = false;
  const s = svc(async () => { called = true; });
  await assert.rejects(s('https://youtube.com/watch?v=1'), { code: 'unsupported_host' });
  await assert.rejects(s('https://flezen.com/features'), { code: 'unsupported_format' });
  await assert.rejects(s('http://127.0.0.1/s/abcdefgh'), { code: 'invalid_url' });
  assert.equal(called, false);
});

// ---- safeFetch: redirect + size + dns protections (no real network) ----
const publicDns = async () => [{ address: '104.18.0.1' }];
const resp = (status, headers = {}, body = '') => new Response(body, { status, headers });

test('safeFetch refuses redirects to non-allowlisted or internal targets', async () => {
  for (const loc of ['https://evil.example/x', 'https://169.254.169.254/', 'http://flezen.com/s/abcdefgh']) {
    const fetchImpl = async () => resp(302, { location: loc });
    await assert.rejects(safeFetchHtml(EXAMPLE_URL, { fetchImpl, lookup: publicDns, allowedHosts: HOSTS }), (e) => ['unsupported_host', 'unsafe_target', 'invalid_url'].includes(e.code), loc);
  }
});

test('safeFetch follows allowlisted redirects but caps the count', async () => {
  let n = 0;
  const hop = async () => { n += 1; return resp(302, { location: 'https://www.flezen.com/s/abcdefgh' }); };
  await assert.rejects(safeFetchHtml(EXAMPLE_URL, { fetchImpl: hop, lookup: publicDns, allowedHosts: HOSTS, maxRedirects: 2 }), { code: 'upstream_error' });
  assert.equal(n, 3);
});

test('safeFetch enforces body size limit and DNS check', async () => {
  const big = async () => resp(200, { 'content-type': 'text/html' }, 'x'.repeat(5000));
  await assert.rejects(safeFetchHtml(EXAMPLE_URL, { fetchImpl: big, lookup: publicDns, allowedHosts: HOSTS, maxBytes: 1000 }), { code: 'upstream_error' });
  await assert.rejects(safeFetchHtml(EXAMPLE_URL, { fetchImpl: big, lookup: async () => [{ address: '10.0.0.1' }], allowedHosts: HOSTS }), { code: 'unsafe_target' });
  const ok = await safeFetchHtml(EXAMPLE_URL, { fetchImpl: async () => resp(200, { 'content-type': 'text/html' }, 'hi'), lookup: publicDns, allowedHosts: HOSTS });
  assert.equal(ok.html, 'hi');
});

test('safeFetch maps network failure and timeout to clean errors', async () => {
  await assert.rejects(safeFetchHtml(EXAMPLE_URL, { fetchImpl: async () => { throw new TypeError('fetch failed'); }, lookup: publicDns, allowedHosts: HOSTS }), { code: 'upstream_error' });
  await assert.rejects(safeFetchHtml(EXAMPLE_URL, { fetchImpl: async () => { const e = new Error('t'); e.name = 'TimeoutError'; throw e; }, lookup: publicDns, allowedHosts: HOSTS }), { code: 'upstream_timeout' });
});
