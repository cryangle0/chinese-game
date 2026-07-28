import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../assets');

function writeMeta(file, value) {
  fs.writeFileSync(`${file}.meta`, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function directoryMeta() {
  return {
    ver: '1.2.0',
    importer: 'directory',
    imported: true,
    uuid: crypto.randomUUID(),
    files: [],
    subMetas: {},
    userData: {},
  };
}

function typescriptMeta() {
  return {
    ver: '4.0.24',
    importer: 'typescript',
    imported: true,
    uuid: crypto.randomUUID(),
    files: [],
    subMetas: {},
    userData: {},
  };
}

function imageMeta(file) {
  const uuid = crypto.randomUUID();
  const extension = path.extname(file);
  const displayName = path.basename(file, extension);
  return {
    ver: '1.0.27',
    importer: 'image',
    imported: true,
    uuid,
    files: ['.json', extension],
    subMetas: {
      '6c48a': {
        importer: 'texture',
        uuid: `${uuid}@6c48a`,
        displayName,
        id: '6c48a',
        name: 'texture',
        userData: {
          wrapModeS: 'clamp-to-edge',
          wrapModeT: 'clamp-to-edge',
          minfilter: 'linear',
          magfilter: 'linear',
          mipfilter: 'none',
          anisotropy: 0,
          isUuid: true,
          imageUuidOrDatabaseUri: uuid,
          visible: false,
        },
        ver: '1.0.22',
        imported: true,
        files: ['.json'],
        subMetas: {},
      },
    },
    userData: {
      type: 'texture',
      fixAlphaTransparencyArtifacts: false,
      hasAlpha: extension.toLowerCase() === '.png',
      redirect: `${uuid}@6c48a`,
    },
  };
}

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name.endsWith('.meta')) continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!fs.existsSync(`${file}.meta`)) writeMeta(file, directoryMeta());
      walk(file);
    } else if (!fs.existsSync(`${file}.meta`)) {
      if (entry.name.endsWith('.ts')) writeMeta(file, typescriptMeta());
      else if (/\.(png|jpg|jpeg)$/i.test(entry.name)) writeMeta(file, imageMeta(file));
    }
  }
}

walk(root);
console.log('Cocos meta files are complete.');
