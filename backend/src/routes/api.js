import { Router } from 'express';
import { AppError, Errors } from '../errors.js';
import { validateInitData } from '../services/telegramAuth.js';

export function createApiRouter({ cfg, resolveLink }) {
  const router = Router();

  router.get('/health', (_req, res) => {
    res.json({ ok: true, uptime: Math.round(process.uptime()), time: new Date().toISOString() });
  });

  // Validates Telegram identity when REQUIRE_TELEGRAM_AUTH=true.
  const telegramAuth = (req, _res, next) => {
    if (!cfg.requireTelegramAuth) return next();
    const result = validateInitData(req.get('x-telegram-init-data'), cfg.botToken);
    if (!result.valid) {
      return next(
        result.reason === 'server_not_configured'
          ? new AppError('server_misconfigured', 'Server is not configured for Telegram auth.', 500)
          : Errors.unauthorized(),
      );
    }
    req.telegramUser = result.user;
    return next();
  };

  router.post('/resolve', telegramAuth, async (req, res, next) => {
    try {
      const url = req.body?.url;
      if (typeof url !== 'string') throw Errors.invalidUrl('Request body must include a "url" string.');
      res.json(await resolveLink(url));
    } catch (err) {
      next(err);
    }
  });

  router.get('/stream/:shareId', async (req, res, next) => {
    try {
      const { shareId } = req.params;
      if (!shareId || !/^[A-Za-z0-9_-]{8,128}$/.test(shareId)) {
        return res.status(400).json({ error: 'Invalid share ID' });
      }

      // Check if we have an active upstream direct stream
      const targetUrl = `https://flezen.com/s/${encodeURIComponent(shareId)}`;
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Access-Control-Allow-Origin', '*');

      // Attempt upstream fetch with configured API key
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': targetUrl,
      };
      if (cfg.flezenApiKey) headers['X-API-Key'] = cfg.flezenApiKey;

      try {
        const upstream = await fetch(targetUrl, { headers });
        if (upstream.ok && upstream.headers.get('content-type')?.includes('video')) {
          return upstream.body.pipe(res);
        }
      } catch {
        /* fallback to redirect */
      }

      // If direct binary stream is gated by Cloudflare or app scheme, redirect to canonical
      return res.redirect(targetUrl);
    } catch (err) {
      next(err);
    }
  });

  router.get('/download/:shareId', async (req, res, next) => {
    try {
      const { shareId } = req.params;
      if (!shareId || !/^[A-Za-z0-9_-]{8,128}$/.test(shareId)) {
        return res.status(400).json({ error: 'Invalid share ID' });
      }
      const targetUrl = `https://flezen.com/s/${encodeURIComponent(shareId)}`;
      res.setHeader('Content-Disposition', `attachment; filename="flezen_${shareId}.mp4"`);
      return res.redirect(targetUrl);
    } catch (err) {
      next(err);
    }
  });

  router.use((_req, _res, next) => next(new AppError('not_found_route', 'Unknown API endpoint.', 404)));
  return router;
}

// Central error handler: structured JSON, never leaks stack traces or upstream details.
// eslint-disable-next-line no-unused-vars
export function apiErrorHandler(err, _req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ success: false, error: { code: err.code, message: err.message } });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ success: false, error: { code: 'payload_too_large', message: 'Request too large.' } });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, error: { code: 'bad_json', message: 'Invalid JSON body.' } });
  }
  console.error('Unhandled error:', err);
  return res.status(500).json({ success: false, error: { code: 'internal_error', message: 'Something went wrong.' } });
}
