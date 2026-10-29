import { config } from '../config.js';
import { Errors } from '../errors.js';
import { parseAndValidateUrl, assertPublicDns } from './urlGuard.js';

/**
 * Fetch an HTML page from an allowlisted host with SSRF protections:
 *  - every hop (including redirects) is re-validated against the allowlist
 *  - redirects are followed manually and capped
 *  - DNS must resolve to public addresses only
 *  - total time and body size are limited; body is read as a stream, never executed
 *
 * `deps` allows tests to inject fetch/dns without touching the network.
 */
export async function safeFetchHtml(startUrl, opts = {}) {
  const {
    allowedHosts = config.allowedHosts,
    timeoutMs = config.upstream.timeoutMs,
    maxBytes = config.upstream.maxBytes,
    maxRedirects = config.upstream.maxRedirects,
    userAgent = config.upstream.userAgent,
    fetchImpl = globalThis.fetch,
    lookup,
  } = opts;

  const signal = AbortSignal.timeout(timeoutMs);
  let url = parseAndValidateUrl(startUrl.toString(), allowedHosts);

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    await assertPublicDns(url.hostname, lookup);

    let res;
    try {
      res = await fetchImpl(url, {
        method: 'GET',
        redirect: 'manual',
        signal,
        headers: {
          'user-agent': userAgent,
          accept: 'text/html,application/xhtml+xml',
        },
      });
    } catch (err) {
      if (err?.name === 'TimeoutError' || err?.name === 'AbortError') throw Errors.timeout();
      throw Errors.upstream();
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) throw Errors.upstream();
      // Re-validate the redirect target: same rules as the original URL.
      url = parseAndValidateUrl(new URL(location, url).toString(), allowedHosts);
      continue;
    }

    return {
      status: res.status,
      finalUrl: url,
      contentType: res.headers.get('content-type') || '',
      html: res.status === 204 ? '' : await readLimitedText(res, maxBytes),
    };
  }
  throw Errors.upstream('Too many redirects from Flezen.');
}

async function readLimitedText(res, maxBytes) {
  const declared = Number(res.headers.get('content-length'));
  if (declared && declared > maxBytes) throw Errors.upstream('Flezen response was too large.');
  if (!res.body) return '';

  const reader = res.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw Errors.upstream('Flezen response was too large.');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}
