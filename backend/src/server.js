import { config } from './config.js';
import { createApp } from './app.js';

const app = createApp();

app.listen(config.port, () => {
  console.log(`Flezen backend listening on port ${config.port}`);
  if (config.requireTelegramAuth && !config.botToken) {
    console.warn('REQUIRE_TELEGRAM_AUTH is true but BOT_TOKEN is empty: /api/resolve will fail.');
  }
});
