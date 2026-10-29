import * as cheerio from 'cheerio';

const TITLE_SUFFIX = /\s*\|\s*Secure File Access\s*\|\s*Flezen\s*$/i;
const VIDEO_EXTENSIONS = new Set(['mp4', 'mkv', 'webm', 'mov', 'avi', 'm4v', 'ts', 'flv', '3gp']);

/** Accepts "13636124", "13.6 MB", "1,234 KB" ... and returns bytes, or null. */
export function parseSizeToBytes(value) {
  if (value == null) return null;
  const m = String(value)
    .trim()
    .replace(/,/g, '')
    .match(/^(\d+(?:\.\d+)?)\s*(b|bytes|kb|mb|gb|tb|kib|mib|gib|tib)?$/i);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = (m[2] || 'b').toLowerCase();
  const mult = {
    b: 1, bytes: 1,
    kb: 1e3, mb: 1e6, gb: 1e9, tb: 1e12,
    kib: 1024, mib: 1024 ** 2, gib: 1024 ** 3, tib: 1024 ** 4,
  }[unit];
  return Math.round(n * mult);
}

function extensionOf(filename) {
  const m = /\.([A-Za-z0-9]{1,6})$/.exec(filename || '');
  return m ? m[1].toLowerCase() : null;
}

/**
 * Extract file metadata from a Flezen share page.
 *
 * Observed page content (flezen.com/s/{id}): a heading with the filename, then a
 * "File Information" block with labelled values Name / Size / Type / Uploaded /
 * Views. The parser works on the page's visible text so it tolerates markup
 * changes, and returns only fields it actually found (null otherwise).
 *
 * Returns null when the page has no recognisable file information at all.
 */
/**
 * Visible page text with a space at every element boundary, so adjacent cells like
 * <span>Size</span><span>123</span> become "Size 123" instead of "Size123".
 */
function visibleText(html) {
  const $ = cheerio.load(html);
  $('script, style, noscript, template').remove();
  const body = $('body').length ? $('body') : $.root();
  const spaced = (body.html() || '').replace(/<[^>]*>/g, ' ');
  return cheerio.load(`<p>${spaced}</p>`).text().replace(/\s+/g, ' ').trim();
}

export function parseSharePage(html) {
  const $ = cheerio.load(html);
  $('script, style, noscript').remove();

  const text = visibleText(html);

  const grab = (label, valuePattern) => {
    const m = new RegExp(`\\b${label}\\s+(${valuePattern})`, 'i').exec(text);
    return m ? m[1].trim() : null;
  };

  const sizeRaw = grab('Size', '[\\d.,]+(?:\\s*(?:[KMGT]i?B|bytes|B))?');
  const typeRaw = grab('Type', '[A-Za-z0-9/+._-]+');
  const viewsRaw = grab('Views', '\\d[\\d,]*');
  const uploadedRaw = (/\bUploaded\s+(.+?)(?:\s+Views\b|\s+Security\b|$)/i.exec(text) || [])[1] || null;

  // Filename: prefer the page heading, then og:title / <title> minus the site suffix.
  const heading = $('h1').first().text().trim();
  const ogTitle = $('meta[property="og:title"]').attr('content') || '';
  const docTitle = $('title').first().text() || '';
  const filename =
    [heading, ogTitle.replace(TITLE_SUFFIX, ''), docTitle.replace(TITLE_SUFFIX, '')]
      .map((s) => s.trim())
      .find(Boolean) || null;

  // Without a filename AND at least one info field, we do not trust the page.
  const hasInfo = sizeRaw || typeRaw || viewsRaw || uploadedRaw;
  if (!filename || !hasInfo) return null;

  const fileType = typeRaw ? typeRaw.toLowerCase() : null;
  const ext = extensionOf(filename);
  const isVideo = fileType === 'video' || (!fileType && ext !== null && VIDEO_EXTENSIONS.has(ext));

  return {
    filename,
    sizeBytes: parseSizeToBytes(sizeRaw),
    fileType,
    extension: ext,
    isVideo,
    uploadedAt: uploadedRaw ? uploadedRaw.trim() : null,
    views: viewsRaw ? Number(viewsRaw.replace(/,/g, '')) : null,
  };
}

/** Heuristic for 200-status error pages ("file not found", "deleted", ...). */
export function detectErrorPage(html) {
  const text = visibleText(html).toLowerCase();
  if (/\b(has been deleted|was deleted|file deleted|removed by)\b/.test(text)) return 'deleted';
  if (/\b(link (has )?expired|expired link)\b/.test(text)) return 'deleted';
  if (/\b(file not found|link not found|page not found|does not exist)\b/.test(text)) return 'not_found';
  if (/\b(private file|access denied|not authorized|login required)\b/.test(text)) return 'private';
  return null;
}
