import crypto from 'node:crypto';

/**
 * Validate Telegram Mini App initData per
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 *   secret_key = HMAC_SHA256(key="WebAppData", message=bot_token)
 *   hash       = HMAC_SHA256(key=secret_key, message=data_check_string)
 *
 * Returns { valid:true, user, authDate } or { valid:false, reason }.
 */
export function validateInitData(initData, botToken, { maxAgeSeconds = 86400, now = Date.now() } = {}) {
  if (!botToken) return { valid: false, reason: 'server_not_configured' };
  if (typeof initData !== 'string' || !initData) return { valid: false, reason: 'missing' };

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return { valid: false, reason: 'missing_hash' };
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('\n');

  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');

  const a = Buffer.from(expected, 'hex');
  let b;
  try {
    b = Buffer.from(hash, 'hex');
  } catch {
    return { valid: false, reason: 'bad_hash' };
  }
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { valid: false, reason: 'bad_hash' };
  }

  const authDate = Number(params.get('auth_date'));
  if (!authDate) return { valid: false, reason: 'missing_auth_date' };
  if (now / 1000 - authDate > maxAgeSeconds) return { valid: false, reason: 'expired' };

  let user = null;
  try {
    user = params.get('user') ? JSON.parse(params.get('user')) : null;
  } catch {
    return { valid: false, reason: 'bad_user' };
  }
  return { valid: true, user, authDate };
}
