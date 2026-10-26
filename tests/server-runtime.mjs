import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

// Vite resolves extensionless imports; deployed Node ESM does not. Compile the
// API's actual runtime dependency graph, then load it with Node's own resolver.
const root = process.cwd();
const parent = path.join(root, 'artifacts/qa');
await fs.mkdir(parent, { recursive: true });
const output = await fs.mkdtemp(path.join(parent, 'server-runtime-'));
await fs.writeFile(path.join(output, 'package.json'), '{"type":"module"}');
const compiled = new Set();
async function compile(relative) {
  if (compiled.has(relative)) return;
  compiled.add(relative);
  const source = await fs.readFile(path.join(root, relative), 'utf8');
  const javascript = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const destination = path.join(output, relative.replace(/\.ts$/, '.js'));
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, javascript);
  for (const dependency of ts.preProcessFile(javascript, true, true).importedFiles) {
    if (!dependency.fileName.startsWith('.')) continue;
    const resolved = path.join(path.dirname(relative), dependency.fileName);
    await compile(resolved.endsWith('.js') ? resolved.slice(0, -3) + '.ts' : resolved + '.ts');
  }
}
await compile('api/netone.ts');
const { default: handler } = await import(pathToFileURL(path.join(output, 'api/netone.js')));
let status, data;
const headers = new Map();
await handler({ method: 'GET', query: { action: 'session' }, headers: { host: 'localhost' } }, {
  setHeader: (key, value) => headers.set(key, value),
  status(value) { status = value; return this; },
  json(value) { data = value; }
});
assert.equal(status, 200);
assert.equal(data.user, null);
assert.equal(headers.get('Cache-Control'), 'no-store');
console.log('Compiled API loads under native Node ESM and returns a JSON session response.');
