const FORWARDED_KEYS = Object.freeze([
  'activityId',
  'bankUrl',
  'channel',
  'difficulty',
  'grade',
  'scene',
  'skipIntro',
  'term',
  'trackEndpoint',
]);

function sessionId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function buildLaunchUrl(baseUrl, options = {}) {
  const query = {
    host: 'wechat-mp',
    sessionId: options.sessionId || sessionId(),
  };
  FORWARDED_KEYS.forEach((key) => {
    if (options[key] !== undefined && options[key] !== '') query[key] = options[key];
  });
  const suffix = Object.keys(query)
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(query[key])}`)
    .join('&');
  return `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}${suffix}`;
}

module.exports = {
  buildLaunchUrl,
};
