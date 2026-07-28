import crypto from 'node:crypto';
import process from 'node:process';

const secretId = process.env.COS_SECRET_ID?.trim();
const secretKey = process.env.COS_SECRET_KEY?.trim();
const urls = (process.env.CDN_URLS ?? '')
  .split(',')
  .map((url) => url.trim())
  .filter(Boolean);
const action = process.argv.includes('--refresh')
  ? 'PurgeUrlsCache'
  : process.argv.includes('--preheat')
    ? 'PushUrlsCache'
    : '';

if (!secretId || !secretKey || !urls.length || !action) {
  throw new Error(
    'Set COS_SECRET_ID, COS_SECRET_KEY and CDN_URLS, then use --refresh or --preheat',
  );
}
for (const url of urls) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') throw new Error(`CDN URL must use HTTPS: ${url}`);
}

const host = 'cdn.tencentcloudapi.com';
const service = 'cdn';
const version = '2018-06-06';
const timestamp = Math.floor(Date.now() / 1000);
const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
const payload = JSON.stringify({ Urls: urls });
const hashedPayload = sha256(payload);
const canonicalHeaders = [
  'content-type:application/json; charset=utf-8',
  `host:${host}`,
  `x-tc-action:${action.toLowerCase()}`,
  '',
].join('\n');
const signedHeaders = 'content-type;host;x-tc-action';
const canonicalRequest = [
  'POST',
  '/',
  '',
  canonicalHeaders,
  signedHeaders,
  hashedPayload,
].join('\n');
const credentialScope = `${date}/${service}/tc3_request`;
const stringToSign = [
  'TC3-HMAC-SHA256',
  timestamp,
  credentialScope,
  sha256(canonicalRequest),
].join('\n');
const secretDate = hmac(`TC3${secretKey}`, date);
const secretService = hmac(secretDate, service);
const secretSigning = hmac(secretService, 'tc3_request');
const signature = hmac(secretSigning, stringToSign, 'hex');
const authorization = [
  `TC3-HMAC-SHA256 Credential=${secretId}/${credentialScope}`,
  `SignedHeaders=${signedHeaders}`,
  `Signature=${signature}`,
].join(', ');

const response = await fetch(`https://${host}`, {
  method: 'POST',
  headers: {
    authorization,
    'content-type': 'application/json; charset=utf-8',
    host,
    'x-tc-action': action,
    'x-tc-timestamp': String(timestamp),
    'x-tc-version': version,
  },
  body: payload,
});
const result = await response.json();
if (!response.ok || result.Response?.Error) {
  const error = result.Response?.Error;
  throw new Error(`${action} failed: ${error?.Code ?? response.status} ${error?.Message ?? ''}`);
}

console.log(JSON.stringify({
  action,
  urls: urls.length,
  taskId: result.Response?.TaskId ?? null,
  requestId: result.Response?.RequestId ?? null,
}, null, 2));

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function hmac(key, value, encoding) {
  return crypto.createHmac('sha256', key).update(value).digest(encoding);
}
