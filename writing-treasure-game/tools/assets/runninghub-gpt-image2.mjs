import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const BASE_URL = 'https://www.runninghub.cn/openapi/v2';
const DEFAULT_ENDPOINT =
  'rhart-image-g-2-official/image-to-image';

const options = parseArgs(process.argv.slice(2));
if (options.promptFile) {
  options.prompt = await fs.readFile(
    path.resolve(options.promptFile),
    'utf8',
  );
}
const apiKey = process.env.RUNNINGHUB_API_KEY?.trim();
if (!apiKey) {
  throw new Error('RUNNINGHUB_API_KEY is required');
}
if (!options.prompt) {
  throw new Error('Use --prompt or --prompt-file');
}
if (options.images.length === 0) {
  throw new Error('At least one --image is required');
}

const headers = {
  Authorization: `Bearer ${apiKey}`,
};
const imageUrls = [];
for (const imagePath of options.images) {
  imageUrls.push(await uploadImage(imagePath));
}

const response = await postJson(
  `${BASE_URL}/${DEFAULT_ENDPOINT}`,
  {
    prompt: options.prompt,
    imageUrls,
    aspectRatio: options.aspectRatio,
    resolution: options.resolution,
    quality: options.quality,
  },
);
if (!response.taskId) {
  throw new Error(`RunningHub submit failed: ${JSON.stringify(response)}`);
}
console.log(`RunningHub task submitted: ${response.taskId}`);

const result = await waitForTask(response.taskId);
if (result.status !== 'SUCCESS') {
  throw new Error(
    `RunningHub task failed: ${result.errorCode ?? ''} `
      + `${result.errorMessage ?? result.failedReason ?? ''}`,
  );
}
const output = result.results?.find((item) => typeof item?.url === 'string');
if (!output?.url) {
  throw new Error(`RunningHub returned no image: ${JSON.stringify(result)}`);
}

const outputPath = path.resolve(options.output);
await fs.mkdir(path.dirname(outputPath), { recursive: true });
const imageResponse = await fetch(output.url);
if (!imageResponse.ok) {
  throw new Error(
    `Failed to download generated image: ${imageResponse.status}`,
  );
}
await fs.writeFile(
  outputPath,
  Buffer.from(await imageResponse.arrayBuffer()),
);
await fs.writeFile(
  `${outputPath}.json`,
  `${JSON.stringify({
    taskId: response.taskId,
    output: path.basename(outputPath),
    aspectRatio: options.aspectRatio,
    resolution: options.resolution,
    quality: options.quality,
    sourceFiles: options.images.map((value) => path.basename(value)),
    prompt: options.prompt,
  }, null, 2)}\n`,
);
console.log(`RunningHub image saved: ${outputPath}`);

async function uploadImage(source) {
  const sourcePath = path.resolve(source);
  const bytes = await fs.readFile(sourcePath);
  if (bytes.length > 10 * 1024 * 1024) {
    throw new Error(`RunningHub image exceeds 10 MB: ${sourcePath}`);
  }
  const form = new FormData();
  form.append(
    'file',
    new Blob([bytes], { type: mimeType(sourcePath) }),
    path.basename(sourcePath),
  );
  const response = await fetch(
    `${BASE_URL}/media/upload/binary`,
    {
      method: 'POST',
      headers,
      body: form,
    },
  );
  const data = await readJson(response);
  const url = data?.data?.download_url;
  if (!response.ok || data.code !== 0 || typeof url !== 'string') {
    throw new Error(
      `RunningHub upload failed for ${sourcePath}: ${JSON.stringify(data)}`,
    );
  }
  console.log(`Uploaded reference: ${path.basename(sourcePath)}`);
  return url;
}

async function waitForTask(taskId) {
  const deadline = Date.now() + options.timeoutMs;
  let lastStatus = '';
  while (Date.now() < deadline) {
    const result = await postJson(
      `${BASE_URL}/query`,
      { taskId },
    );
    if (result.status !== lastStatus) {
      lastStatus = result.status;
      console.log(`RunningHub task status: ${lastStatus}`);
    }
    if (result.status === 'SUCCESS' || result.status === 'FAILED') {
      return result;
    }
    await delay(options.pollMs);
  }
  throw new Error(`RunningHub task timed out: ${taskId}`);
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await readJson(response);
  if (!response.ok) {
    throw new Error(
      `RunningHub request failed (${response.status}): `
        + JSON.stringify(data),
    );
  }
  return data;
}

async function readJson(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      `RunningHub returned non-JSON (${response.status}): ${text}`,
    );
  }
}

function parseArgs(args) {
  const parsed = {
    prompt: '',
    promptFile: '',
    images: [],
    output: '',
    aspectRatio: '1:1',
    resolution: '4k',
    quality: 'high',
    pollMs: 5000,
    timeoutMs: 15 * 60 * 1000,
  };
  for (let index = 0; index < args.length; index += 1) {
    const name = args[index];
    const value = args[index + 1];
    if (name === '--image') {
      parsed.images.push(requiredValue(name, value));
      index += 1;
    } else if (name === '--prompt') {
      parsed.prompt = requiredValue(name, value);
      index += 1;
    } else if (name === '--prompt-file') {
      parsed.promptFile = requiredValue(name, value);
      index += 1;
    } else if (name === '--out') {
      parsed.output = requiredValue(name, value);
      index += 1;
    } else if (name === '--aspect') {
      parsed.aspectRatio = requiredValue(name, value);
      index += 1;
    } else if (name === '--resolution') {
      parsed.resolution = requiredValue(name, value);
      index += 1;
    } else if (name === '--quality') {
      parsed.quality = requiredValue(name, value);
      index += 1;
    } else if (name === '--poll-ms') {
      parsed.pollMs = Number(requiredValue(name, value));
      index += 1;
    } else if (name === '--timeout-ms') {
      parsed.timeoutMs = Number(requiredValue(name, value));
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${name}`);
    }
  }
  if (!parsed.output) {
    throw new Error('--out is required');
  }
  return parsed;
}

function requiredValue(name, value) {
  if (!value || value.startsWith('--')) {
    throw new Error(`${name} requires a value`);
  }
  return value;
}

function mimeType(sourcePath) {
  const extension = path.extname(sourcePath).toLowerCase();
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  if (extension === '.webp') return 'image/webp';
  return 'image/png';
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
