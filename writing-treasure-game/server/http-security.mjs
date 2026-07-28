const windows = new Map();
function allowedOrigins() {
  return new Set(
    (process.env.CORS_ORIGINS ?? '').split(',').map((value) => value.trim()).filter(Boolean),
  );
}

export function securityHeaders(request) {
  const origin = request.headers.origin ?? '';
  const headers = {
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'permissions-policy': 'camera=(), microphone=(self), geolocation=()',
    'content-security-policy': "default-src 'self'; img-src 'self' data: https:; "
      + "script-src 'self' 'unsafe-inline' 'unsafe-eval' "
      + 'https://res.wx.qq.com https://res2.wx.qq.com; '
      + "style-src 'self' 'unsafe-inline'; "
      + "connect-src 'self' https:; worker-src 'self' blob:",
  };
  if (origin && allowedOrigins().has(origin)) {
    headers['access-control-allow-origin'] = origin;
    headers['access-control-allow-methods'] = 'GET,POST,OPTIONS';
    headers['access-control-allow-headers'] = 'content-type,x-asr-hints';
    headers['access-control-max-age'] = '86400';
    headers.vary = 'Origin';
  }
  return headers;
}

export function clientAddress(request) {
  const remote = request.socket?.remoteAddress ?? 'unknown';
  if (process.env.TRUST_PROXY !== '1') return remote;
  const forwarded = request.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  const real = request.headers?.['x-real-ip'];
  return typeof real === 'string' && real.trim() ? real.trim() : remote;
}

export function allowRequest(request, limit = 120, periodMs = 60000) {
  const now = Date.now();
  const address = clientAddress(request);
  const current = windows.get(address);
  if (!current || current.resetAt <= now) {
    windows.set(address, { count: 1, resetAt: now + periodMs });
    return true;
  }
  current.count += 1;
  return current.count <= limit;
}

export function cleanupRateLimits() {
  const now = Date.now();
  for (const [key, value] of windows) {
    if (value.resetAt <= now) windows.delete(key);
  }
}
