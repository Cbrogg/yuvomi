/**
 * Test: Extension API proxy
 * Run: node --experimental-sqlite --test test/test-extensions-proxy.js
 */

import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'yuvomi-ext-proxy-'));
const MODULES_DIR = path.join(TMP_ROOT, 'modules');
fs.mkdirSync(MODULES_DIR, { recursive: true });

process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-secret';
process.env.DB_PATH = ':memory:';
process.env.MODULES_DIR = MODULES_DIR;
delete process.env.EXTENSION_PROXY_TARGETS;
delete process.env.EXTENSION_PROXY_ALLOW_PRIVATE_NETWORK;

function writeModule(folder, manifest, files = {}) {
  const dir = path.join(MODULES_DIR, folder);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'module.json'), JSON.stringify(manifest));
  for (const [name, content] of Object.entries(files)) {
    const filePath = path.join(dir, name);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content);
  }
}

writeModule('demo-ext', {
  id: 'demo-ext',
  name: 'Demo Extension',
  entry: 'index.js',
  capabilities: {
    permissions: {
      module: { label: 'Demo Extension', icon: 'box' },
      widgets: [{ id: 'summary', label: 'Summary' }],
    },
    widgets: [{
      id: 'summary',
      entry: 'widgets/summary.js',
      label: 'Summary widget',
      defaultSize: '1x2',
    }],
    api: { prefix: '/api/extensions/demo-ext' },
  },
}, {
  'index.js': 'export async function render() {}\n',
  'widgets/summary.js': 'export async function renderWidget() {}\n',
});

const { __test } = await import('../server/routes/extensions-proxy.js');
const svc = await import('../server/services/modules.js');
const { default: extensionsProxyRouter } = await import('../server/routes/extensions-proxy.js');
const { resolvePermissions } = await import('../server/permissions.js');

await svc.listModules({ admin: true });

test.after(() => {
  try { fs.rmSync(TMP_ROOT, { recursive: true, force: true }); } catch { /* noop */ }
});

test('normalizeUpstreamUrl requires https by default', () => {
  assert.equal(__test.normalizeUpstreamUrl('https://sidecar.example/api'), 'https://sidecar.example/api');
  assert.throws(() => __test.normalizeUpstreamUrl('http://sidecar.local:8080'), /https/);
});

test('normalizeUpstreamUrl allows http with private-network opt-in', () => {
  process.env[__test.ENV_ALLOW_PRIVATE_NETWORK] = 'true';
  assert.equal(__test.normalizeUpstreamUrl('http://budget-api:8080'), 'http://budget-api:8080');
  delete process.env[__test.ENV_ALLOW_PRIVATE_NETWORK];
});

test('checkSSRF blocks literal private IPs', async () => {
  await assert.rejects(
    () => __test.checkSSRF('https://192.168.0.1/health'),
    /private IP/,
  );
});

test('proxy route returns 502 when upstream is not configured', async () => {
  const app = express();
  app.use((req, _res, next) => {
    req.authUserId = 1;
    req.authRole = 'admin';
    req.sessionModuleAccess = resolvePermissions({ role: 'admin', permissions: {} }).moduleAccess;
    next();
  });
  app.use(express.json());
  app.use('/', extensionsProxyRouter);
  const server = app.listen(0);
  const baseUrl = await new Promise((r) => server.on('listening', () => r(`http://127.0.0.1:${server.address().port}`)));

  try {
    const res = await fetch(`${baseUrl}/demo-ext/accounts`);
    assert.equal(res.status, 502);
    const body = await res.json();
    assert.match(body.error, /not configured/i);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test('proxy route returns 404 for unknown extension module', async () => {
  const app = express();
  app.use((req, _res, next) => {
    req.authUserId = 1;
    req.authRole = 'admin';
    req.sessionModuleAccess = resolvePermissions({ role: 'admin', permissions: {} }).moduleAccess;
    next();
  });
  app.use(express.json());
  app.use('/', extensionsProxyRouter);
  const server = app.listen(0);
  const baseUrl = await new Promise((r) => server.on('listening', () => r(`http://127.0.0.1:${server.address().port}`)));

  try {
    const res = await fetch(`${baseUrl}/missing-mod/ping`);
    assert.equal(res.status, 404);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test('extensions-proxy binds SSRF guard and safeRequest', async () => {
  const src = fs.readFileSync(new URL('../server/routes/extensions-proxy.js', import.meta.url), 'utf8');
  assert.match(src, /from ['"]\.\.\/utils\/ssrf\.js['"]/);
  assert.match(src, /createGuardedLookup|isBlockedAddress/);
  assert.match(src, /from ['"]\.\.\/utils\/http\.js['"]/);
  assert.match(src, /safeRequest/);
});

test('encodeRestPath rejects traversal segments', () => {
  assert.equal(__test.encodeRestPath('accounts/1'), 'accounts/1');
  assert.equal(__test.encodeRestPath(''), '');
  assert.throws(() => __test.encodeRestPath('../../admin/secret'), /Invalid extension path/);
  assert.throws(() => __test.encodeRestPath('foo/../bar'), /Invalid extension path/);
  assert.throws(() => __test.encodeRestPath('foo/./bar'), /Invalid extension path/);
  assert.throws(() => __test.encodeRestPath('foo//bar'), /Invalid extension path/);
});

test('forwardHeaders allowlists and mints identity, never cookies', () => {
  const headers = __test.forwardHeaders({
    headers: {
      cookie: 'connect.sid=stolen',
      authorization: 'Bearer sk-admin',
      'content-type': 'application/json',
      accept: 'application/json',
      host: 'household.example',
      'x-forwarded-for': '1.2.3.4',
    },
    authUserId: 7,
    authRole: 'member',
    session: { displayName: 'Ada' },
    sessionModuleAccess: { 'ext:demo-ext': 'read' },
  }, 'ext:demo-ext');
  assert.equal(headers.cookie, undefined);
  assert.equal(headers.authorization, undefined);
  assert.equal(headers.host, undefined);
  assert.equal(headers['x-forwarded-for'], undefined);
  assert.equal(headers['content-type'], 'application/json');
  assert.equal(headers.accept, 'application/json');
  assert.equal(headers['x-yuvomi-user-id'], '7');
  assert.equal(headers['x-yuvomi-user-name'], 'Ada');
  assert.equal(headers['x-yuvomi-user-role'], 'member');
  assert.equal(headers['x-yuvomi-access'], 'read');
});

test('applyUpstreamHeaders drops set-cookie', () => {
  const captured = {};
  const res = {
    setHeader(key, value) { captured[String(key).toLowerCase()] = value; },
  };
  __test.applyUpstreamHeaders({
    headers: {
      get(name) {
        const map = {
          'set-cookie': 'connect.sid=evil',
          'content-type': 'application/json',
          'x-csrf-token': 'sidecar-token',
          etag: '"abc"',
        };
        return map[name] ?? null;
      },
    },
  }, res);
  assert.equal(captured['set-cookie'], undefined);
  assert.equal(captured['x-csrf-token'], undefined);
  assert.equal(captured['content-type'], 'application/json');
  assert.equal(captured.etag, '"abc"');
});

test('serializeBody rejects unsupported content types with 415', () => {
  try {
    __test.serializeBody({
      method: 'POST',
      headers: { 'content-type': 'multipart/form-data; boundary=x' },
      body: { file: true },
    });
    assert.fail('expected 415');
  } catch (err) {
    assert.equal(err.status, 415);
  }
});

test('cookie POST under /api/v1/extensions requires CSRF', async () => {
  const { csrfMiddleware } = await import('../server/middleware/csrf.js');
  const token = 'a'.repeat(64);
  const app = express();
  app.use((req, res, next) => {
    req.authMethod = 'session';
    req.session = { userId: 1, role: 'admin', csrfToken: token };
    res.cookie = () => {};
    next();
  });
  app.use('/api/v1', csrfMiddleware);
  app.use('/api/v1/extensions', (_req, res) => res.json({ leaked: true }));
  const server = app.listen(0);
  const baseUrl = await new Promise((r) => server.on('listening', () => r(`http://127.0.0.1:${server.address().port}`)));
  try {
    const forged = await fetch(`${baseUrl}/api/v1/extensions/demo-ext/accounts`, { method: 'POST' });
    assert.equal(forged.status, 403);
    const body = await forged.json();
    assert.match(body.error, /csrf/i);
    assert.equal(body.leaked, undefined);

    const ok = await fetch(`${baseUrl}/api/v1/extensions/demo-ext/accounts`, {
      method: 'POST',
      headers: { 'X-CSRF-Token': token, 'Content-Type': 'application/json' },
    });
    assert.equal(ok.status, 200);
    assert.equal((await ok.json()).leaked, true);
  } finally {
    await new Promise((r) => server.close(r));
  }
});
