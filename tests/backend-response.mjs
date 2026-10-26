import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const javascript = ts.transpileModule(fs.readFileSync('src/lib/backend.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 }
}).outputText;
const { backend } = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`);
const originalFetch = globalThis.fetch;
try {
  const cases = [
    [500, 'A server error has occurred', /server request failed \(HTTP 500\)/],
    [502, '<html>Bad gateway</html>', /server request failed \(HTTP 502\)/],
    [200, '<html>Sign in</html>', /server returned an invalid response/],
    [200, '', /server returned an invalid response/],
    [200, 'null', /server returned an invalid response/],
    [200, '[]', /server returned an invalid response/],
    [401, '{"error":"Authentication required."}', /Authentication required\./],
    [503, '{"error":{"private":"internal details"}}', /server request failed \(HTTP 503\)/]
  ];
  for (const [status, body, error] of cases) {
    globalThis.fetch = async () => new Response(body, { status });
    await assert.rejects(() => backend('session'), error);
  }
  let sent;
  globalThis.fetch = async (url, options) => {
    sent = { url, ...options };
    return new Response('{"user":null}', { status: 200 });
  };
  assert.deepEqual(await backend('login', { username: 'finance' }, 'site/1'), { user: null });
  assert.equal(sent.method, 'POST');
  assert.equal(sent.credentials, 'same-origin');
  assert.equal(sent.body, '{"username":"finance"}');
  assert.match(sent.url, /id=site%2F1/);
  console.log('API responses preserve JSON errors and handle plain text, HTML, empty and malformed payloads.');
} finally { globalThis.fetch = originalFetch; }
