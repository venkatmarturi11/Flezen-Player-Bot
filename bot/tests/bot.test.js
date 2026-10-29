import test from 'node:test';
import assert from 'node:assert/strict';
import { Telegram } from 'telegraf';
import { createBot, assertValidWebAppUrl } from '../createBot.js';
import { WELCOME_TEXT } from '../messages.js';

const URL_OK = 'https://flezen-app.example.com/';
// Telegraf validates the token shape only when calling Telegram, so any string works offline.
const make = () => createBot({ token: '123456:TEST', webAppUrl: URL_OK }).bot;

// Telegraf creates a new Telegram client per update, so patch the prototype (restored after each use).
async function withApi(impl, fn) {
  const orig = Telegram.prototype.callApi;
  Telegram.prototype.callApi = impl;
  try { return await fn(); } finally { Telegram.prototype.callApi = orig; }
}

/** Feed a synthetic update through the real Telegraf pipeline, capturing outgoing API calls. */
async function send(bot, text, entities) {
  const calls = [];
  bot.botInfo = { id: 1, is_bot: true, username: 'flezen_test_bot', first_name: 'F' };
  await withApi(async (method, payload) => { calls.push({ method, payload }); return { message_id: 1 }; }, () =>
    bot.handleUpdate({
      update_id: 1,
      message: {
        message_id: 1, date: 1, text,
        chat: { id: 5, type: 'private', first_name: 'U' },
        from: { id: 5, is_bot: false, first_name: 'U' },
        ...(entities ? { entities } : {}),
      },
    }));
  return calls;
}

test('/start replies with the exact welcome text and an Open Flezen Web App button', async () => {
  const calls = await send(make(), '/start', [{ type: 'bot_command', offset: 0, length: 6 }]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'sendMessage');
  assert.equal(calls[0].payload.text, WELCOME_TEXT);
  assert.ok(WELCOME_TEXT.startsWith('🎥 Welcome to Flezen - Free HD Video Downloader! 🎬'));
  const btn = calls[0].payload.reply_markup.inline_keyboard[0][0];
  assert.equal(btn.text, '🚀 Open Flezen');
  assert.deepEqual(btn.web_app, { url: URL_OK }); // opens inside Telegram, not a plain URL button
  assert.equal(btn.url, undefined);
});

test('plain text (e.g. a pasted link) is redirected to the Mini App button', async () => {
  const calls = await send(make(), 'https://flezen.com/s/dbhbi0hbjlnl41j838sg4d2mc4ez1bq');
  assert.equal(calls.length, 1);
  assert.match(calls[0].payload.text, /paste your link inside the app/);
  assert.ok(calls[0].payload.reply_markup.inline_keyboard[0][0].web_app);
});

test('handler errors are caught and reported politely', async () => {
  const bot = make();
  const calls = [];
  let first = true;
  bot.botInfo = { id: 1, is_bot: true, username: 'x', first_name: 'F' };
  const origError = console.error;
  console.error = () => {};
  try {
    await withApi(async (method, payload) => {
      calls.push({ method, payload });
      if (first) { first = false; throw new Error('boom'); }
      return { message_id: 2 };
    }, () => bot.handleUpdate({
      update_id: 2,
      message: { message_id: 1, date: 1, text: '/start', entities: [{ type: 'bot_command', offset: 0, length: 6 }], chat: { id: 5, type: 'private' }, from: { id: 5, is_bot: false, first_name: 'U' } },
    }));
  } finally { console.error = origError; }
  assert.match(calls.at(-1).payload.text, /Something went wrong/);
});

test('configuration validation: token and https URL are required', () => {
  assert.throws(() => createBot({ token: '', webAppUrl: URL_OK }), /BOT_TOKEN/);
  assert.throws(() => createBot({ token: 't', webAppUrl: '' }), /WEB_APP_URL/);
  assert.throws(() => assertValidWebAppUrl('http://example.com'), /https/);
  assert.equal(assertValidWebAppUrl('https://example.com'), 'https://example.com/');
});
