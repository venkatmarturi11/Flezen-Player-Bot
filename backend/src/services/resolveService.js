import { config } from '../config.js';
import { Errors } from '../errors.js';
import { parseAndValidateUrl } from './urlGuard.js';
import { createProviders, findProvider } from '../providers/index.js';

/**
 * Orchestrates a link lookup and reports THREE separate outcomes so that a
 * metadata hit is never mistaken for working playback or download:
 *   stages.metadata  -> 'ok'
 *   stages.playback  -> 'ok' | 'unavailable' | 'not_applicable'
 *   stages.download  -> 'ok' | 'unavailable'
 *
 * Upstream URLs/tokens from providers are never copied into the response:
 * playback and download are exposed only as backend-relative paths (and only
 * when a provider actually supplied a source).
 */
export function createResolveService({ cfg = config, providers = createProviders(cfg) } = {}) {
  return async function resolveLink(input) {
    const url = parseAndValidateUrl(input, cfg.allowedHosts);

    const provider = findProvider(providers, url);
    if (!provider) throw Errors.unsupportedHost(url.hostname);

    const resolved = provider.resolve(url);
    const metadata = await provider.getMetadata(resolved);

    const type = metadata.isVideo ? 'video' : 'file';

    let playback = { status: 'not_applicable', reason: 'This file is not a video.' };
    let playbackUrl = null;
    if (metadata.isVideo) {
      const src = await provider.getPlaybackSource(resolved, metadata);
      if (src.available) {
        playback = { status: 'ok' };
        playbackUrl = `/api/stream/${resolved.shareId}`;
      } else {
        playback = { status: 'unavailable', reason: src.reason };
      }
    }

    const dl = await provider.getDownloadSource(resolved, metadata);
    let downloadUrl = null;
    let download;
    if (dl.available) {
      download = { status: 'ok' };
      downloadUrl = `/api/download/${resolved.shareId}`;
    } else {
      download = { status: 'unavailable', reason: dl.reason };
    }

    return {
      success: true,
      provider: provider.id,
      kind: resolved.kind,
      shareId: resolved.shareId ?? null,
      type,
      title: metadata.filename,
      file: {
        name: metadata.filename,
        sizeBytes: metadata.sizeBytes,
        fileType: metadata.fileType,
        extension: metadata.extension,
        uploadedAt: metadata.uploadedAt,
        views: metadata.views,
      },
      thumbnail: null, // no thumbnail source is documented by Flezen
      duration: null, // not exposed on the share page
      stages: {
        metadata: { status: 'ok' },
        playback,
        download,
      },
      // Convenience flags (derived from stages, never independent).
      playbackUrl,
      downloadUrl,
      playable: playback.status === 'ok',
      downloadAvailable: download.status === 'ok',
      // Official page, so users can continue in the Flezen app.
      openUrl: resolved.canonicalUrl,
      intentUrl: `intent://flezen.com/s/${resolved.shareId}#Intent;scheme=flezen;package=com.devlooper.flezen;S.browser_fallback_url=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dcom.devlooper.flezen;end`,
      appUrl: `flezen://flezen.com/s/${resolved.shareId}`,
    };
  };
}
