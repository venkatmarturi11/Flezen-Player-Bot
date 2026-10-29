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
 * Any other text: users must paste links inside the Mini App, not in chat,
 * so just point them back at the button.
 */
export const hintHandler = (webAppUrl) => async (ctx) => {
  await ctx.reply(HINT_TEXT, openKeyboard(webAppUrl));
};
