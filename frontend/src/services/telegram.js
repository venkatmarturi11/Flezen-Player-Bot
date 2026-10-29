/**
 * Thin wrapper over the Telegram Mini Apps SDK (window.Telegram.WebApp).
 * Every function is safe to call in a normal browser: when Telegram is not
 * present (local development) they quietly do nothing or return fallbacks.
 */
const tg = () => (typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined);

/** True only when really running inside Telegram (initData is signed by Telegram). */
export const isTelegram = () => Boolean(tg()?.initData);

export function initTelegram() {
  const app = tg();
  if (!app) return { inTelegram: false };
  try {
    app.ready(); // tell Telegram the UI is ready (hides its loading placeholder)
    app.expand(); // use the full height
    app.disableVerticalSwipes?.(); // avoid accidental swipe-to-close while scrolling
    applyTheme(app);
    app.onEvent?.('themeChanged', () => applyTheme(app));
    app.onEvent?.('viewportChanged', () => applyViewport(app));
    applyViewport(app);
  } catch (err) {
    console.warn('Telegram init failed (continuing without it):', err);
  }
  return { inTelegram: isTelegram() };
}

function applyTheme(app) {
  const root = document.documentElement;
  const p = app.themeParams || {};
  // Map Telegram theme colours onto our CSS variables; keep our dark defaults otherwise.
  if (p.bg_color) root.style.setProperty('--bg', p.bg_color);
  if (p.secondary_bg_color) root.style.setProperty('--surface', p.secondary_bg_color);
  if (p.text_color) root.style.setProperty('--text', p.text_color);
  if (p.hint_color) root.style.setProperty('--muted', p.hint_color);
  try {
    app.setHeaderColor?.('bg_color');
    app.setBackgroundColor?.('bg_color');
  } catch { /* older clients */ }
}

function applyViewport(app) {
  const h = app.viewportStableHeight || app.viewportHeight;
  if (h) document.documentElement.style.setProperty('--tg-viewport-height', `${h}px`);
}

export const getInitData = () => tg()?.initData || '';

/** Show Telegram's native Back button; returns an unsubscribe function. */
export function showBackButton(onClick) {
  const bb = tg()?.BackButton;
  if (!bb) return () => {};
  bb.onClick(onClick);
  bb.show();
  return () => {
    bb.offClick(onClick);
    bb.hide();
  };
}

/** Open an external page: Telegram's handler inside Telegram, a new tab otherwise. */
export function openExternal(url) {
  const app = tg();
  if (app?.openLink) app.openLink(url);
  else window.open(url, '_blank', 'noopener,noreferrer');
}

export function haptic(kind = 'light') {
  try {
    tg()?.HapticFeedback?.impactOccurred(kind);
  } catch { /* ignore */ }
}

export const closeApp = () => tg()?.close?.();
