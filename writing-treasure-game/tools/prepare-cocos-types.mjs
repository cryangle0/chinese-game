import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, parse, resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const driveRoot = parse(projectRoot).root;
const declarationSuffix = join(
  'resources',
  'resources',
  '3d',
  'engine',
  'bin',
  '.declarations',
  'cc.d.ts',
);
const candidates = [
  process.env.COCOS_ENGINE_PATH
    ? join(process.env.COCOS_ENGINE_PATH, 'bin', '.declarations', 'cc.d.ts')
    : '',
  join('C:\\ProgramData\\cocos\\editors\\Creator\\3.8.8', declarationSuffix),
  join(
    driveRoot,
    'angsa',
    'angsa_data',
    'c-drive-backups',
    '20260619-cocos',
    'ProgramData_cocos_editors',
    'Creator',
    '3.8.8',
    declarationSuffix,
  ),
].filter(Boolean);

const declaration = candidates.find(existsSync);
if (!declaration) {
  throw new Error(
    'Cocos Creator 3.8.8 type declarations were not found. Set COCOS_ENGINE_PATH to the engine directory.',
  );
}

const tempRoot = join(projectRoot, 'temp');
const declarationsRoot = join(tempRoot, 'declarations');
mkdirSync(declarationsRoot, { recursive: true });

const normalizedDeclaration = declaration.replaceAll('\\', '/');
const wrapper = `/// <reference path="${normalizedDeclaration}"/>\n`;
writeFileSync(join(declarationsRoot, 'cc.d.ts'), wrapper, 'utf8');

const config = {
  compilerOptions: {
    target: 'ES2015',
    module: 'ES2015',
    strict: true,
    types: ['./temp/declarations/cc'],
    experimentalDecorators: true,
    isolatedModules: true,
    moduleResolution: 'node',
    noEmit: true,
    skipLibCheck: true,
    forceConsistentCasingInFileNames: true,
  },
};
writeFileSync(
  join(tempRoot, 'tsconfig.cocos.json'),
  `${JSON.stringify(config, null, 2)}\n`,
  'utf8',
);

console.log(`Cocos declarations: ${declaration}`);
