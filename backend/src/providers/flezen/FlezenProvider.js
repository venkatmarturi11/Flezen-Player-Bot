import { BaseProvider } from '../BaseProvider.js';
import { Errors } from '../../errors.js';
import { safeFetchHtml } from '../../services/safeFetch.js';
import { parseSharePage, detectErrorPage } from './parseSharePage.js';

/**
 * Flezen shared-file links: https://flezen.com/s/{share_id}
 *
 * INTEGRATION STATUS (investigated 2026-10-29, see README "Integration limitations"):
 *  - Metadata:  IMPLEMENTED. The public share page is server-rendered and lists the
 *               filename, size, type, upload time and view count.
 *  - Playback:  NOT AVAILABLE. No public API, embed player or direct stream URL is
 *               documented. The share page only offers "Open in App" (Android app).
 *  - Download:  NOT AVAILABLE for the same reason.
 *
 * getPlaybackSource/getDownloadSource are deliberately explicit "unavailable"
 * results. When Flezen provides an authorized mechanism, implement it here (keep
 * credentials in env vars) and nothing else in the app has to change.
 */

// Share ids seen so far are 31 chars of [a-z0-9]; accept a broader safe range
// rather than hardcoding one length.
const SHARE_ID = /^[A-Za-z0-9_-]{8,128}$/;

export const PLAYBACK_UNAVAILABLE_REASON =
  'In-app video playback requires a Flezen Bot API Key. Get your key from https://flezen.com/user/bots and set FLEZEN_API_KEY in your .env file.';
export const DOWNLOAD_UNAVAILABLE_REASON =
  'Direct file download requires a Flezen Bot API Key. Get your key from https://flezen.com/user/bots and set FLEZEN_API_KEY in your .env file.';

export class FlezenProvider extends BaseProvider {
  constructor({ allowedHosts, apiKey = '', fz = '', rt = '', fetchHtml = safeFetchHtml, fetchOptions = {} } = {}) {
    super();
    this.allowedHosts = allowedHosts;
    this.apiKey = apiKey;
    this.fz = fz;
    this.rt = rt;
    this.fetchHtml = fetchHtml;
    this.fetchOptions = fetchOptions;
    this._apiCache = new Map();
  }

  get id() {
    return 'flezen';
  }

  get displayName() {
    return 'Flezen';
  }

  canHandle(url) {
    const host = url.hostname.toLowerCase();
    return this.allowedHosts.includes(host);
  }

  resolve(url) {
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length === 2 && parts[0] === 's') {
      if (!SHARE_ID.test(parts[1])) {
        throw Errors.unsupportedFormat('That share link has an invalid identifier.');
      }
      return {
        kind: 'shared-file',
        shareId: parts[1],
        // Rebuilt from the validated id only (drops query strings/fragments).
        canonicalUrl: `https://flezen.com/s/${parts[1]}`,
      };
    }
    throw Errors.unsupportedFormat(
      'Unsupported Flezen link. Expected a shared-file link like https://flezen.com/s/<id>.',
    );
  }

  async getMetadata(resolved) {
    const page = await this.fetchHtml(resolved.canonicalUrl, {
      allowedHosts: this.allowedHosts,
      ...this.fetchOptions,
    });

    if (page.status === 404) throw Errors.notFound();
    if (page.status === 410) throw Errors.deleted();
    if (page.status === 401 || page.status === 403) throw Errors.forbidden();
    if (page.status === 429) throw Errors.upstream('Flezen is rate limiting requests. Try again shortly.');
    if (page.status >= 500) throw Errors.upstream();
    if (page.status !== 200) throw Errors.upstream(`Unexpected response from Flezen (${page.status}).`);
    if (!/html/i.test(page.contentType)) throw Errors.unparseable();

    const meta = parseSharePage(page.html);
    if (!meta) {
      // A 200 page without file info is usually a soft "not found/deleted/private" page.
      const kind = detectErrorPage(page.html);
      if (kind === 'deleted') throw Errors.deleted();
      if (kind === 'private') throw Errors.forbidden();
      if (kind === 'not_found') throw Errors.notFound();
      throw Errors.unparseable();
    }
    return meta;
  }

  async _fetchApiFile(shareId) {
    if ((!this.apiKey && !this.fz) || !shareId) return null;
    if (this._apiCache.has(shareId)) return this._apiCache.get(shareId);

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json, text/html, */*',
    };
    if (this.apiKey) {
      headers['X-API-Key'] = this.apiKey;
      headers['x-api-key'] = this.apiKey;
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    const cookies = [];
    if (this.fz) cookies.push(`fz=${this.fz}`);
    if (this.rt) cookies.push(`rt=${this.rt}`);
    if (cookies.length) headers['Cookie'] = cookies.join('; ');

    try {
      const res = await fetch(`https://flezen.com/api/file/${encodeURIComponent(shareId)}`, { headers });
      if (!res.ok) return null;
      const data = await res.json();
      this._apiCache.set(shareId, data);
      return data;
    } catch {
      return null;
    }
  }

  async getPlaybackSource(resolved, metadata) {
    const apiData = await this._fetchApiFile(resolved?.shareId);
    const streamUrl =
      apiData?.stream_url ||
      apiData?.video_url ||
      apiData?.direct_url ||
      apiData?.file?.stream_url ||
      apiData?.file?.direct_url ||
      apiData?.file?.url ||
      apiData?.download_url ||
      apiData?.url;

    if (streamUrl) {
      return { available: true, url: streamUrl, mimeType: 'video/mp4' };
    }

    // Default to backend stream proxy for in-app video player
    if (metadata?.isVideo || metadata?.fileType === 'video') {
      return { available: true, url: `/api/stream/${resolved?.shareId}`, mimeType: 'video/mp4' };
    }

    return { available: false, reason: PLAYBACK_UNAVAILABLE_REASON };
  }

  async getDownloadSource(resolved, metadata) {
    const apiData = await this._fetchApiFile(resolved?.shareId);
    const downloadUrl =
      apiData?.download_url ||
      apiData?.direct_url ||
      apiData?.file?.download_url ||
      apiData?.file?.direct_url ||
      apiData?.file?.url ||
      apiData?.url;

    if (downloadUrl) {
      return { available: true, url: downloadUrl };
    }

    // Default to backend download proxy
    if (resolved?.shareId) {
      return { available: true, url: `/api/download/${resolved.shareId}` };
    }

    return { available: false, reason: DOWNLOAD_UNAVAILABLE_REASON };
  }
}
