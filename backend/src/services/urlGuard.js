import net from 'node:net';
import dns from 'node:dns/promises';
import { Errors } from '../errors.js';

const MAX_URL_LENGTH = 2048;

/** True if an IPv4/IPv6 literal is loopback, private, link-local, metadata, etc. */
export function isBlockedIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 0 || // "this" network
      a === 10 ||
      a === 127 || // loopback
      (a === 100 && b >= 64 && b <= 127) || // CGNAT
      (a === 169 && b === 254) || // link-local incl. cloud metadata 169.254.169.254
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) || // IETF protocol assignments
      (a === 198 && (b === 18 || b === 19)) || // benchmarking
      a >= 224 // multicast + reserved
    );
  }
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    if (v === '::' || v === '::1') return true;
    // IPv4-mapped (::ffff:a.b.c.d) -> check the embedded IPv4 address.
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isBlockedIp(mapped[1]);
    return (
      v.startsWith('fc') || // unique local fc00::/7
      v.startsWith('fd') ||
      v.startsWith('fe8') || // link-local fe80::/10
      v.startsWith('fe9') ||
      v.startsWith('fea') ||
      v.startsWith('feb') ||
      v.startsWith('ff') // multicast
    );
  }
  return true; // not an IP at all -> treat as blocked when used as an IP check
}

/**
 * Parse user input into a URL and enforce scheme, shape and host allowlist.
 * Pure (no network) so it is cheap to unit-test.
 */
export function parseAndValidateUrl(input, allowedHosts) {
  if (typeof input !== 'string') throw Errors.invalidUrl();
  const raw = input.trim();
  if (!raw || raw.length > MAX_URL_LENGTH) throw Errors.invalidUrl();

  let url;
  try {
    url = new URL(raw);
  } catch {
    throw Errors.invalidUrl();
  }

  if (url.protocol !== 'https:') {
    throw Errors.invalidUrl('Only https:// links are supported.');
  }
  if (url.username || url.password) {
    throw Errors.invalidUrl('Links containing credentials are not allowed.');
  }
  if (url.port && url.port !== '443') {
    throw Errors.unsafeTarget();
  }

  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  // Raw IPs (v4 or v6) are never acceptable; only named, allowlisted hosts.
  if (net.isIP(host) || host.startsWith('[')) throw Errors.unsafeTarget();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal')) {
    throw Errors.unsafeTarget();
  }
  if (!allowedHosts.includes(host)) throw Errors.unsupportedHost(host);

  return url;
}

/**
 * Resolve the hostname and make sure every address is public. This guards against
 * an allowlisted name that has been pointed at an internal address.
 */
export async function assertPublicDns(hostname, lookup = dns.lookup) {
  let addrs;
  try {
    addrs = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw Errors.upstream('Could not resolve the Flezen host.');
  }
  if (!addrs.length || addrs.some((a) => isBlockedIp(a.address))) {
    throw Errors.unsafeTarget();
  }
}
