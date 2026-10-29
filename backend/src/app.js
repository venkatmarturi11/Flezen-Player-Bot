import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { createResolveService } from './services/resolveService.js';
import { createApiRouter, apiErrorHandler } from './routes/api.js';

export function createApp({ cfg = config, resolveLink = createResolveService({ cfg }) } = {}) {
  const app = express();
  app.disable('x-powered-by');
  // Behind a hosting proxy (Render, Railway, Fly...) so rate limiting sees real IPs.
  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          // Telegram embeds Mini Apps in a WebView, so framing must be allowed.
          'frame-ancestors': ['*'],
          'script-src': ["'self'", 'https://telegram.org'],
          'img-src': ["'self'", 'data:'],
          'connect-src': ["'self'", 'https:'],
          'media-src': ["'self'", 'blob:', 'https:', 'data:'],
        },
      },
      frameguard: false,
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(cors({ origin: true, methods: ['GET', 'POST'], allowedHeaders: ['Content-Type', 'X-Telegram-Init-Data'] }));
  app.use(express.json({ limit: '4kb' })); // a link is tiny; keep bodies tiny

  const limiter = rateLimit({
    windowMs: cfg.rateLimit.windowMs,
    limit: cfg.rateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: { code: 'rate_limited', message: 'Too many requests. Please slow down.' } },
  });
  app.use('/api', limiter);
  app.use('/api', createApiRouter({ cfg, resolveLink }));
  app.use('/api', apiErrorHandler);

  if (cfg.serveFrontend && fs.existsSync(cfg.frontendDist)) {
    app.use(express.static(cfg.frontendDist, { index: false, maxAge: '1h' }));
    app.get('*', (_req, res) => res.sendFile(path.join(cfg.frontendDist, 'index.html')));
  }
  app.use(apiErrorHandler);
  return app;
}
