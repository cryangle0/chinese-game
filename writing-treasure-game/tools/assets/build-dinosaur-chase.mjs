import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const projectRoot = path.resolve(import.meta.dirname, '../..');
const materialRoot = process.env.WRITING_MATERIAL_ROOT
  ?? path.resolve(projectRoot, '..', '客户提供素材', '动效音乐素材', '写作宝藏-动效文件',
    '写作宝藏-恐龙世界-动效');
const dinosaurRoot = process.env.DINOSAUR_FRAME_ROOT
  ?? path.resolve(projectRoot, '..', '恐龙动画');
const outputRoot = path.join(projectRoot, 'customer-media', 'dinosaur');
const python = process.env.PYTHON_PATH ?? 'python';
const builder = path.join(import.meta.dirname, 'build_dinosaur_chase.py');

for (const required of [builder, materialRoot, dinosaurRoot]) {
  if (!fs.existsSync(required)) throw new Error(`Missing dinosaur chase input: ${required}`);
}

const result = spawnSync(python, [
  builder,
  '--material-root', materialRoot,
  '--dinosaur-root', dinosaurRoot,
  '--output-root', outputRoot,
], { stdio: 'inherit', windowsHide: true });
if (result.status !== 0) throw new Error('Failed to build dinosaur chase animations');
