import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const scope = 'http://localhost:4174/refactored/';
function worker() {
  const handlers = new Map(),
    deleted = [],
    cached = [];
  const context = vm.createContext({
    URL,
    Set,
    Promise,
    Response,
    self: {
      location: new URL(scope + 'sw.js'),
      registration: { scope },
      clients: { claim: async () => {} },
      skipWaiting: async () => {},
      addEventListener: (name, handler) => handlers.set(name, handler),
    },
    caches: {
      open: async () => ({ addAll: async (assets) => cached.push(...assets) }),
      keys: async () => ['palpop-v8', 'another-app', 'palpop-refactored-old'],
      delete: async (key) => deleted.push(key),
      match: async () => new Response('cached asset'),
    },
    fetch: async () => {
      throw new Error('offline');
    },
  });
  context.importScripts = () =>
    vm.runInContext(fs.readFileSync(new URL('../precache.js', import.meta.url), 'utf8'), context);
  vm.runInContext(fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8'), context);
  return { handlers, deleted, cached };
}
test('offline install caches every module, and activation preserves other apps', async () => {
  const { handlers, deleted, cached } = worker();
  let pending;
  handlers.get('install')({ waitUntil: (promise) => (pending = promise) });
  await pending;
  assert(cached.includes('src/main.js'));
  assert(cached.includes('assets/fonts/press-start-2p.ttf'));
  assert(cached.includes('tools/pal-designer.html'));
  handlers.get('activate')({ waitUntil: (promise) => (pending = promise) });
  await pending;
  assert.deepEqual(deleted, ['palpop-refactored-old']);
});
test('offline fallback serves owned assets and ignores unrelated requests', async () => {
  const { handlers } = worker();
  let response;
  const request = (url) => ({
    request: { url, method: 'GET' },
    respondWith: (promise) => (response = promise),
  });
  handlers.get('fetch')(request(scope + 'src/main.js'));
  assert.equal(await (await response).text(), 'cached asset');
  response = undefined;
  handlers.get('fetch')(request('http://localhost:4174/other-app/index.html'));
  assert.equal(response, undefined);
  handlers.get('fetch')(request('https://example.com/asset.js'));
  assert.equal(response, undefined);
});
