import { Telegraf } from 'telegraf';
import { startHandler, hintHandler } from './handlers/start.js';
import { ERROR_TEXT } from './messages.js';

/** Telegram only opens Web Apps from public https:// URLs. */
export function assertValidWebAppUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('WEB_APP_URL is missing or not a valid URL (example: https://your-app.example.com).');
  }
  if (url.protocol !== 'https:') {
    throw new Error('WEB_APP_URL must start with https:// (Telegram requires HTTPS for Mini Apps).');
  }
  return url.toString();
}

export function createBot({ token, webAppUrl }) {
  if (!token) throw new Error('BOT_TOKEN is missing. Get one from @BotFather and put it in .env.');
  const url = assertValidWebAppUrl(webAppUrl);

  const bot = new Telegraf(token);

  bot.start(startHandler(url));
  bot.on('text', hintHandler(url));

  // Never crash on a handler error; tell the user politely.
  bot.catch(async (err, ctx) => {
    console.error(`Bot error for update ${ctx?.update?.update_id}:`, err);
    try {
      await ctx.reply(ERROR_TEXT);
    } catch {
      /* ignore secondary failure (e.g. user blocked the bot) */
    }
  });

  return { bot, webAppUrl: url };
}
