import { Markup } from 'telegraf';
import { WELCOME_TEXT, OPEN_BUTTON_TEXT, HINT_TEXT } from '../messages.js';

/** Inline keyboard with a single Web App button that opens the Mini App inside Telegram. */
export function openKeyboard(webAppUrl) {
  return Markup.inlineKeyboard([[Markup.button.webApp(OPEN_BUTTON_TEXT, webAppUrl)]]);
}

/** /start: welcome message + "Open Flezen" Web App button. */
export const startHandler = (webAppUrl) => async (ctx) => {
  await ctx.reply(WELCOME_TEXT, openKeyboard(webAppUrl));
};

/**
 * Any other text: if a Flezen link is detected, provide an instant play button
 * pointing directly to that video inside the Mini App, plus a direct link.
 */
export const hintHandler = (webAppUrl) => async (ctx) => {
  const text = (ctx.message?.text || '').trim();
  const flezenMatch = text.match(/https?:\/\/(?:www\.)?flezen\.com\/s\/([A-Za-z0-9_-]+)/i);

  if (flezenMatch) {
    const playUrl = `${webAppUrl}?url=${encodeURIComponent(flezenMatch[0])}`;
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.webApp('▶ Play Video in App', playUrl)],
      [Markup.button.url('🌐 Open Flezen Link', flezenMatch[0])],
    ]);
    return ctx.reply(HINT_TEXT, keyboard);
  }

  await ctx.reply(HINT_TEXT, openKeyboard(webAppUrl));
};
