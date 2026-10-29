/**
 * Application errors carry a machine-readable `code` and an HTTP status so the
 * route layer can answer consistently and the frontend can show a useful message.
 */
export class AppError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
  }
}

export const Errors = {
  invalidUrl: (msg = 'That does not look like a valid link.') =>
    new AppError('invalid_url', msg, 400),
  unsupportedHost: (host) =>
    new AppError(
      'unsupported_host',
      `Links from "${host}" are not supported. Only Flezen share links are supported.`,
      422,
    ),
  unsupportedFormat: (msg = 'This Flezen link format is not supported.') =>
    new AppError('unsupported_format', msg, 422),
  unsafeTarget: () =>
    new AppError('unsafe_target', 'This link points to a blocked or unsafe address.', 400),
  notFound: () =>
    new AppError('not_found', 'This shared file was not found. The link may be wrong.', 404),
  deleted: () =>
    new AppError('deleted', 'This shared file has been deleted or has expired.', 410),
  forbidden: () =>
    new AppError('private', 'This shared file is private or requires access you do not have.', 403),
  upstream: (msg = 'Flezen could not be reached right now. Please try again later.') =>
    new AppError('upstream_error', msg, 502),
  timeout: () =>
    new AppError('upstream_timeout', 'Flezen took too long to respond. Please try again.', 504),
  unparseable: () =>
    new AppError(
      'unparseable',
      'Flezen responded, but the page did not contain recognizable file information.',
      422,
    ),
  unauthorized: (msg = 'Open this app from inside Telegram.') =>
    new AppError('unauthorized', msg, 401),
};
