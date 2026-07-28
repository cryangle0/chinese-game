const GAME_PAGE = '/pages/game/index';

function decode(value) {
  if (typeof value !== 'string' || !value) return '';
  try {
    return decodeURIComponent(value);
  } catch (error) {
    return value;
  }
}

function pickTitle(candidate, fallback) {
  const title = decode(candidate).trim();
  return title ? title.slice(0, 60) : fallback;
}

/**
 * Share card for the native share page. The H5 passes the score title through the
 * navigateTo query because web-view postMessage is only flushed on share/back.
 */
function buildShareCard(options, previous, fallbackTitle) {
  const source = previous || {};
  const title = pickTitle(options && options.title, pickTitle(source.title, fallbackTitle));
  const base = typeof source.path === 'string' && source.path.indexOf('/') === 0
    ? source.path.split('?')[0]
    : GAME_PAGE;
  const query = typeof source.query === 'string' ? source.query : '';
  return {
    title,
    query,
    path: query ? `${base}?${query}` : base,
  };
}

module.exports = {
  buildShareCard,
};
