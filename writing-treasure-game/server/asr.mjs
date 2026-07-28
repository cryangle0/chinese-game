import { execFile } from 'node:child_process';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import * as tencentcloud from 'tencentcloud-sdk-nodejs-asr';

const execFileAsync = promisify(execFile);
const Client = tencentcloud.asr.v20190614.Client;
const allowedAudioTypes = new Set([
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/x-m4a',
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
]);
let cachedClient = null;
let cachedClientKey = '';
const allowedEngineTypes = new Set(['16k_zh-PY', '16k_zh', '16k_en']);

export function asrConfigured() {
  return Boolean(process.env.TENCENTCLOUD_SECRET_ID && process.env.TENCENTCLOUD_SECRET_KEY);
}

export function normalizeAudioContentType(value) {
  const type = String(value ?? '').split(';', 1)[0].trim().toLowerCase();
  return allowedAudioTypes.has(type) ? type : null;
}

export function resolveEngineType(value) {
  const engine = String(value ?? '').trim();
  return allowedEngineTypes.has(engine) ? engine : '16k_zh';
}

export function resolveLetterEngineType(value) {
  const engine = String(value ?? '').trim();
  return allowedEngineTypes.has(engine) ? engine : '16k_en';
}

export function shouldRetryLetterRecognition(transcript, hints) {
  if (!hints.some((hint) => /^[A-D]$/i.test(String(hint).trim()))) return false;
  const cleaned = String(transcript ?? '').replace(/[\s.,!?，。！？]/g, '').trim();
  if (!cleaned) return true;
  if (/^[A-D]$/i.test(cleaned)) return false;
  if (hints.some((hint) => String(hint).trim().toLowerCase() === cleaned.toLowerCase())) {
    return false;
  }
  return Array.from(cleaned).length === 1;
}

export function parseAsrHints(value) {
  const header = Array.isArray(value) ? value[0] : value;
  if (typeof header !== 'string' || !header || header.length > 4096) return [];
  try {
    const parsed = JSON.parse(decodeURIComponent(header));
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, 16).filter((hint) =>
      typeof hint === 'string' && hint.trim() && Array.from(hint).length <= 80);
  } catch {
    return [];
  }
}

export function buildHotwordList(hints) {
  const hotwords = [];
  for (const hint of hints) {
    const cleaned = String(hint).replace(/[|,\r\n]/g, ' ').replace(/\s+/g, '').trim();
    const characters = Array.from(cleaned);
    const limit = /[\u3400-\u9fff]/u.test(cleaned) ? 10 : 30;
    if (characters.length < 1 || characters.length > limit || hotwords.includes(cleaned)) continue;
    // Allow single Latin A–D for spoken letter answers; keep CJK min length 2.
    if (characters.length === 1 && !/^[A-Da-d]$/.test(cleaned)) continue;
    hotwords.push(cleaned);
  }
  return hotwords.slice(0, 16).map((word) => `${word}|8`).join(',');
}

function asrClient() {
  const region = process.env.TENCENTCLOUD_REGION ?? 'ap-beijing';
  const key = `${process.env.TENCENTCLOUD_SECRET_ID}:${region}`;
  if (cachedClient && cachedClientKey === key) return cachedClient;
  cachedClientKey = key;
  cachedClient = new Client({
    credential: {
      secretId: process.env.TENCENTCLOUD_SECRET_ID,
      secretKey: process.env.TENCENTCLOUD_SECRET_KEY,
    },
    region,
    profile: { httpProfile: { reqTimeout: 12 } },
  });
  return cachedClient;
}

export async function recognizeAudio(input, { hints = [] } = {}) {
  if (!asrConfigured()) throw new Error('Tencent ASR is not configured');
  if (!Buffer.isBuffer(input) || input.length < 128 || input.length > 4 * 1024 * 1024) {
    throw new Error('invalid audio payload');
  }
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'writing-asr-'));
  const source = path.join(dir, 'input.audio');
  const output = path.join(dir, 'output.wav');
  try {
    await fsp.writeFile(source, input);
    await execFileAsync(process.env.FFMPEG_PATH ?? 'ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-i', source,
      '-vn', '-map_metadata', '-1', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', output,
    ], { timeout: 8000, windowsHide: true, maxBuffer: 512 * 1024 });
    const wav = await fsp.readFile(output);
    if (wav.length > 3 * 1024 * 1024) throw new Error('converted audio payload is too large');
    const request = {
      ProjectId: Number(process.env.TENCENTCLOUD_PROJECT_ID ?? 0),
      SourceType: 1,
      VoiceFormat: 'wav',
      Data: wav.toString('base64'),
      DataLen: wav.length,
      FilterPunc: 2,
      FilterModal: 2,
      ConvertNumMode: 1,
    };
    const hotwordList = buildHotwordList(hints);
    if (hotwordList) request.HotwordList = hotwordList;
    const result = await asrClient().SentenceRecognition({
      ...request,
      EngSerViceType: resolveEngineType(process.env.TENCENTCLOUD_ASR_ENGINE),
    });
    const transcript = result.Result ?? '';
    const alternatives = [];
    if (shouldRetryLetterRecognition(transcript, hints)) {
      try {
        const fallback = await asrClient().SentenceRecognition({
          ...request,
          EngSerViceType: resolveLetterEngineType(
            process.env.TENCENTCLOUD_ASR_LETTER_ENGINE,
          ),
          HotwordList: 'A|11,B|11,C|11,D|11',
        });
        if (fallback.Result && fallback.Result !== transcript) alternatives.push(fallback.Result);
      } catch (error) {
        console.warn('[asr] letter fallback failed', error?.code ?? error?.name ?? 'unknown');
      }
    }
    return {
      transcript,
      alternatives,
      requestId: result.RequestId ?? '',
    };
  } finally {
    await fsp.rm(dir, { recursive: true, force: true });
  }
}

export const recognizeWebm = recognizeAudio;
