import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.join(__dirname, 'frontend', 'dist', 'index.html');
const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';

if (!fs.existsSync(distPath)) {
  console.log('Frontend dist not found. Building frontend...');
  spawnSync(npmCmd, ['run', 'build:frontend'], { stdio: 'inherit', env: process.env });
}

console.log('Starting Flezen Web App & Backend...');

const backend = spawn(npmCmd, ['start', '--prefix', 'backend'], {
  stdio: 'inherit',
  env: process.env,
});

let bot = null;
if (process.env.BOT_TOKEN) {
  console.log('Starting Telegram Bot worker...');
  bot = spawn(npmCmd, ['start', '--prefix', 'bot'], {
    stdio: 'inherit',
    env: process.env,
  });
} else {
  console.log('BOT_TOKEN is not set; running Web App & Backend only.');
  console.log('To run the Telegram Bot, add BOT_TOKEN in your environment variables.');
}

function shutdown() {
  console.log('Shutting down services...');
  if (backend && !backend.killed) backend.kill('SIGTERM');
  if (bot && !bot.killed) bot.kill('SIGTERM');
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
