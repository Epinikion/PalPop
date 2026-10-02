import fs from 'node:fs/promises';
import path from 'node:path';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
const root = path.resolve(import.meta.dirname, '..');
const browserGlobals = new Set(
  'AbortController window document navigator location localStorage matchMedia Audio Worker Blob URL Uint8Array Float32Array DataView setInterval clearInterval setTimeout clearTimeout requestAnimationFrame cancelAnimationFrame ResizeObserver performance console Math Number String Boolean Object Array Map Set JSON Promise Infinity undefined globalThis'.split(
    ' ',
  ),
);
async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((e) =>
        e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)],
      ),
    )
  ).flat();
}
const files = (await walk(path.join(root, 'src'))).filter((f) => f.endsWith('.js'));
const fileSet = new Set(files.map((f) => path.resolve(f)));
const errors = [];
const modules = new Map();
for (const file of files) {
  const ast = parse(await fs.readFile(file, 'utf8'), { sourceType: 'module' });
  const exports = new Set();
  const imports = [];
  for (const node of ast.program.body) {
    if (node.type === 'ExportNamedDeclaration') {
      if (node.declaration?.id) exports.add(node.declaration.id.name);
      for (const declaration of node.declaration?.declarations || [])
        exports.add(declaration.id.name);
      for (const specifier of node.specifiers) exports.add(specifier.exported.name);
    }
    if (node.type === 'ImportDeclaration')
      imports.push({
        target: path.resolve(path.dirname(file), node.source.value),
        names: node.specifiers
          .filter((s) => s.type === 'ImportSpecifier')
          .map((s) => s.imported.name),
      });
  }
  modules.set(file, { exports, imports });
  traverse(ast, {
    ReferencedIdentifier(p) {
      if (!p.scope.hasBinding(p.node.name) && !browserGlobals.has(p.node.name))
        errors.push(
          `${path.relative(root, file)}:${p.node.loc.start.line}: unknown binding ${p.node.name}`,
        );
    },
    ImportDeclaration(p) {
      if (!fileSet.has(path.resolve(path.dirname(file), p.node.source.value)))
        errors.push(`${file}: missing ${p.node.source.value}`);
    },
  });
}
for (const [file, module] of modules) {
  for (const dependency of module.imports) {
    const target = modules.get(dependency.target);
    if (!target) continue;
    for (const name of dependency.names)
      if (!target.exports.has(name))
        errors.push(`${file}: ${name} is not exported by ${dependency.target}`);
  }
}
const visited = new Set();
function visit(file, stack = []) {
  if (stack.includes(file)) {
    errors.push(
      'Circular import: ' + [...stack, file].map((f) => path.relative(root, f)).join(' → '),
    );
    return;
  }
  if (visited.has(file)) return;
  for (const dependency of modules.get(file)?.imports || [])
    visit(dependency.target, [...stack, file]);
  visited.add(file);
}
for (const file of files) visit(file);
if (errors.length) throw new Error(errors.join('\n'));
console.log(
  `Checked ${files.length} modules: bindings and named imports are valid; no circular imports.`,
);
