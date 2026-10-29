import { getInitData } from './telegram.js';

// Same-origin by default (backend serves the app, or the Vite dev proxy).
// Set VITE_BACKEND_URL at build time if the API lives on another origin.
const BASE = (import.meta.env?.VITE_BACKEND_URL || '').replace(/\/$/, '');
const TIMEOUT_MS = 15000;

export class ApiError extends Error {
  constructor(code, message, status = 0) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

/** Ask the backend to resolve a Flezen link. Always throws ApiError with a user-friendly message. */
export async function resolveLink(url, { fetchImpl = fetch } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res;
  try {
    res = await fetchImpl(`${BASE}/api/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': getInitData() },
      body: JSON.stringify({ url }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new ApiError('timeout', 'The request took too long. Check your connection and try again.');
    }
    throw new ApiError('network', 'Could not reach the server. Check your connection and try again.');
  } finally {
    clearTimeout(timer);
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON response */
  }

  if (!res.ok || !data?.success) {
    if (res.status === 429) throw new ApiError('rate_limited', 'Too many requests. Please wait a moment.', 429);
    throw new ApiError(
      data?.error?.code || 'server_error',
      data?.error?.message || 'The server returned an unexpected response.',
      res.status,
    );
  }
  return data;
}
