import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = path.resolve('assets/scripts');
const files = [];
const errors = [];
const allowedLayers = {
  boot: new Set(['boot', 'core', 'games', 'platform', 'services', 'shared', 'ui']),
  core: new Set(['core', 'shared']),
  games: new Set(['core', 'games', 'platform', 'services', 'shared', 'ui']),
  platform: new Set(['core', 'platform', 'shared']),
  services: new Set(['core', 'platform', 'services', 'shared']),
  shared: new Set(['shared']),
  ui: new Set(['core', 'services', 'shared', 'ui']),
};

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.ts')) files.push(path.resolve(full));
  }
}

function relative(file) {
  return path.relative(root, file).replace(/\\/g, '/');
}

function resolveImport(file, specifier) {
  if (!specifier.startsWith('.')) return null;
  const target = path.resolve(path.dirname(file), specifier);
  return [`${target}.ts`, path.join(target, 'index.ts')].find((candidate) =>
    fs.existsSync(candidate)) ?? null;
}

function functionComplexity(node) {
  let score = 1;
  function visit(child) {
    if (child !== node && ts.isFunctionLike(child)) return;
    if (ts.isIfStatement(child)
      || ts.isForStatement(child)
      || ts.isForInStatement(child)
      || ts.isForOfStatement(child)
      || ts.isWhileStatement(child)
      || ts.isDoStatement(child)
      || ts.isCaseClause(child)
      || ts.isCatchClause(child)
      || ts.isConditionalExpression(child)) score += 1;
    if (ts.isBinaryExpression(child)
      && ['&&', '||', '??'].includes(child.operatorToken.getText())) score += 1;
    ts.forEachChild(child, visit);
  }
  visit(node);
  return score;
}

walk(root);
const graph = new Map(files.map((file) => [file, []]));

for (const file of files) {
  const sourceText = fs.readFileSync(file, 'utf8');
  const source = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true);
  const rel = relative(file);
  const layer = rel.split('/')[0];
  const lines = sourceText.split(/\r?\n/).length;
  if (lines > 180) errors.push(`${rel}: ${lines} lines (limit 180)`);
  if (rel.startsWith('games/') && !rel.startsWith('games/reading-jumper/')) {
    errors.push(`${rel}: unexpected game implementation`);
  }
  source.forEachChild((node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const target = resolveImport(file, node.moduleSpecifier.text);
      if (!target || !target.startsWith(root)) return;
      if (!node.importClause?.isTypeOnly) graph.get(file)?.push(target);
      const targetLayer = relative(target).split('/')[0];
      if (!allowedLayers[layer]?.has(targetLayer)) {
        errors.push(`${rel}: layer ${layer} cannot import ${relative(target)}`);
      }
    }
  });
  function inspect(node) {
    if (ts.isFunctionLike(node) && node.body) {
      const complexity = functionComplexity(node);
      if (complexity > 15) {
        const position = source.getLineAndCharacterOfPosition(node.getStart(source));
        errors.push(`${rel}:${position.line + 1} complexity ${complexity} (limit 15)`);
      }
    }
    ts.forEachChild(node, inspect);
  }
  inspect(source);
}

const visiting = new Set();
const visited = new Set();
function detectCycle(file, stack = []) {
  if (visiting.has(file)) {
    const start = stack.indexOf(file);
    errors.push(`dependency cycle: ${stack.slice(start).concat(file).map(relative).join(' -> ')}`);
    return;
  }
  if (visited.has(file)) return;
  visiting.add(file);
  for (const target of graph.get(file) ?? []) detectCycle(target, [...stack, file]);
  visiting.delete(file);
  visited.add(file);
}
files.forEach((file) => detectCycle(file));

if (errors.length) {
  console.error(Array.from(new Set(errors)).join('\n'));
  process.exit(1);
}
console.log(`architecture ok: ${files.length} files, layers and cycles verified`);
