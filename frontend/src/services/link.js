// Client-side pre-check only, to enable/disable the button. The backend is the authority.
const HOSTS = ['flezen.com', 'www.flezen.com'];
const SHARE_ID = /^[A-Za-z0-9_-]{8,128}$/;

/** True for https://flezen.com/s/{id}; other Flezen URL shapes are left for the backend to explain. */
export function isValidFlezenShareLink(input) {
  if (typeof input !== 'string') return false;
  let url;
  try {
    url = new URL(input.trim());
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || !HOSTS.includes(url.hostname.toLowerCase())) return false;
  const parts = url.pathname.split('/').filter(Boolean);
  return parts.length === 2 && parts[0] === 's' && SHARE_ID.test(parts[1]);
}

export function formatBytes(bytes) {
  if (bytes == null || Number.isNaN(Number(bytes))) return 'Unknown';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let n = Number(bytes);
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n >= 10 || i === 0 ? Math.round(n) : n.toFixed(1)} ${units[i]}`;
}
