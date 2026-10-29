import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createBot } from './createBot.js';
import { OPEN_BUTTON_TEXT } from './messages.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

let created;
try {
  created = createBot({ token: process.env.BOT_TOKEN, webAppUrl: process.env.WEB_APP_URL || process.env.RENDER_EXTERNAL_URL });
} catch (err) {
  console.error(`Cannot start bot: ${err.message}`);
  process.exit(1);
}
const { bot, webAppUrl } = created;

async function main() {
  const me = await bot.telegram.getMe();
  // Also show the Mini App from the chat menu button next to the message box (best effort).
  try {
    await bot.telegram.setChatMenuButton({
      menuButton: { type: 'web_app', text: OPEN_BUTTON_TEXT.replace(/^\S+\s/, ''), web_app: { url: webAppUrl } },
    });
  } catch (err) {
    console.warn('Could not set the menu button (non-fatal):', err.message);
  }
  console.log(`Bot @${me.username} is running. Mini App: ${webAppUrl}`);
  await bot.launch();
}

main().catch((err) => {
  console.error('Bot failed to start:', err.message);
  process.exit(1);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
