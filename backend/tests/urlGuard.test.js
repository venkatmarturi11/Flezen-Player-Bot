import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAndValidateUrl, isBlockedIp, assertPublicDns } from '../src/services/urlGuard.js';

const HOSTS = ['flezen.com', 'www.flezen.com'];
const code = (fn) => {
  try { fn(); } catch (e) { return e.code; }
  return null;
};

test('accepts a valid Flezen share link', () => {
  const u = parseAndValidateUrl('https://flezen.com/s/dbhbi0hbjlnl41j838sg4d2mc4ez1bq', HOSTS);
  assert.equal(u.hostname, 'flezen.com');
});

test('rejects invalid / non-https / credentialed links', () => {
  assert.equal(code(() => parseAndValidateUrl('not a url', HOSTS)), 'invalid_url');
  assert.equal(code(() => parseAndValidateUrl('', HOSTS)), 'invalid_url');
  assert.equal(code(() => parseAndValidateUrl(42, HOSTS)), 'invalid_url');
  assert.equal(code(() => parseAndValidateUrl('http://flezen.com/s/abcdefgh', HOSTS)), 'invalid_url');
  assert.equal(code(() => parseAndValidateUrl('https://user:pw@flezen.com/s/abcdefgh', HOSTS)), 'invalid_url');
});

test('rejects unsafe targets: localhost, private IPs, metadata, odd ports', () => {
  for (const bad of [
    'https://localhost/s/abcdefgh',
    'https://127.0.0.1/s/abcdefgh',
    'https://10.0.0.5/s/abcdefgh',
    'https://169.254.169.254/latest/meta-data',
    'https://[::1]/s/abcdefgh',
    'https://flezen.com:8443/s/abcdefgh',
    'https://metadata.google.internal/',
  ]) {
    assert.equal(code(() => parseAndValidateUrl(bad, HOSTS)), 'unsafe_target', bad);
  }
});

test('rejects non-allowlisted and look-alike hosts', () => {
  for (const bad of ['https://example.com/s/abcdefgh', 'https://flezen.com.evil.io/s/abcdefgh', 'https://notflezen.com/s/abcdefgh']) {
    assert.equal(code(() => parseAndValidateUrl(bad, HOSTS)), 'unsupported_host', bad);
  }
});

test('isBlockedIp covers private, loopback, link-local, mapped IPv6', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fc00::1', 'fe80::1', '::ffff:10.0.0.1']) {
    assert.equal(isBlockedIp(ip), true, ip);
  }
  for (const ip of ['8.8.8.8', '104.18.0.1', '2606:4700::1']) assert.equal(isBlockedIp(ip), false, ip);
});

test('assertPublicDns blocks hosts that resolve to private addresses', async () => {
  await assert.rejects(assertPublicDns('flezen.com', async () => [{ address: '10.0.0.7' }]), { code: 'unsafe_target' });
  await assert.rejects(assertPublicDns('flezen.com', async () => [{ address: '8.8.8.8' }, { address: '127.0.0.1' }]), { code: 'unsafe_target' });
  await assert.doesNotReject(assertPublicDns('flezen.com', async () => [{ address: '104.18.0.1' }]));
});
