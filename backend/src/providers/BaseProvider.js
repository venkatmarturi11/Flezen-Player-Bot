/**
 * Provider interface. Each external service lives in its own module that extends
 * this class. Methods that a service cannot support through an authorized,
 * documented mechanism must return an explicit "unavailable" result instead of
 * guessing.
 *
 * Source results use this shape:
 *   { available: true,  url, headers?, filename?, mimeType? }   // a usable source
 *   { available: false, reason: '...' }                         // honest "no"
 */
export class BaseProvider {
  /** Stable identifier, e.g. "flezen". */
  get id() {
    throw new Error('Provider must define id');
  }

  /** Human-readable name shown in the UI. */
  get displayName() {
    return this.id;
  }

  /** Synchronous, no I/O: does this provider recognise the (already parsed) URL? */
  canHandle(_url) {
    return false;
  }

  /**
   * Synchronous, no I/O: identify the URL format.
   * Returns { kind, shareId?, canonicalUrl } or throws an AppError for
   * links this provider recognises as the wrong shape.
   */
  resolve(_url) {
    throw new Error('resolve() not implemented');
  }

  /** Retrieve metadata. Must throw AppError for inaccessible/deleted/private links. */
  async getMetadata(_resolved) {
    throw new Error('getMetadata() not implemented');
  }

  /** Return a playable source or { available:false, reason }. */
  async getPlaybackSource(_resolved, _metadata) {
    return { available: false, reason: 'Playback is not supported for this provider.' };
  }

  /** Return a downloadable source or { available:false, reason }. */
  async getDownloadSource(_resolved, _metadata) {
    return { available: false, reason: 'Download is not supported for this provider.' };
  }
}
