import process from 'node:process';

const endpoint = process.env.CDN_PREHEAT_ENDPOINT ?? '';
const token = process.env.CDN_PREHEAT_TOKEN ?? '';
const urls = (process.env.CDN_PREHEAT_URLS ?? '').split(',').map((url) => url.trim())
  .filter(Boolean);
if (!endpoint || !urls.length) {
  throw new Error('Set CDN_PREHEAT_ENDPOINT and CDN_PREHEAT_URLS before preheating');
}
const response = await fetch(endpoint, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  },
  body: JSON.stringify({ urls }),
});
if (!response.ok) throw new Error(`CDN preheat failed: HTTP ${response.status}`);
console.log(`CDN preheat accepted for ${urls.length} URL(s)`);
