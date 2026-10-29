import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load the repo-root .env (two levels above backend/src), then fall back to cwd.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const list = (value, fallback) =>
  (value ?? fallback)
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

export function loadConfig(env = process.env) {
  return {
    port: Number(env.PORT) || 3000,
    botToken: env.BOT_TOKEN || '',
    flezenApiKey: env.FLEZEN_API_KEY || '',
    flezenFz: env.FLEZEN_FZ || '',
    flezenRt: env.FLEZEN_RT || '',
    allowedHosts: list(env.ALLOWED_HOSTS, 'flezen.com,www.flezen.com'),
    requireTelegramAuth: env.REQUIRE_TELEGRAM_AUTH === 'true',
    serveFrontend: env.SERVE_FRONTEND !== 'false',
    frontendDist: path.resolve(__dirname, '../../frontend/dist'),
    upstream: {
      timeoutMs: 8000,
      maxBytes: 1024 * 1024, // 1 MB is plenty for an HTML metadata page
      maxRedirects: 3,
      userAgent: 'FlezenMiniApp/1.0 (+metadata lookup)',
    },
    rateLimit: { windowMs: 60_000, max: 30 },
  };
}

export const config = loadConfig();
