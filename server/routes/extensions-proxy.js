/**
 * Modul: Extension API proxy (optional)
 * Zweck: Leitet /api/v1/extensions/:moduleId/* an konfigurierte Sidecar-Upstreams
 *        weiter. Betreiber-Konfiguration über EXTENSION_PROXY_TARGETS JSON, z. B.
 *        {"budget-v2":"http://budget-api:8080"}. Fetch läuft über safeRequest +
 *        createGuardedLookup (server/utils/ssrf.js) - dieselbe SSRF-Härtung wie
 *        bei Nutzer-URLs, mit Opt-in EXTENSION_PROXY_ALLOW_PRIVATE_NETWORK für
 *        interne Docker-Hostnamen.
 */

import dns from 'node:dns/promises';
import { isIP } from 'node:net';
import express from 'express';
import { createLogger } from '../logger.js';
import { getExtensionPermissionCatalog } from '../services/modules.js';
import { extensionPermissionKey } from '../services/module-capabilities.js';
import { moduleAccessVerdict, MODULE_ACCESS_DENIED, MODULE_ACCESS_READ_ONLY } from '../permissions.js';
import { moduleForPath, requiredAccess, tokenAllows } from '../scopes.js';
import { createGuardedLookup, isBlockedAddress, readPrivateNetworkOptIn } from '../utils/ssrf.js';
import { safeRequest } from '../utils/http.js';

const log = createLogger('ExtensionsProxy');

const ENV_ALLOW_PRIVATE_NETWORK = 'EXTENSION_PROXY_ALLOW_PRIVATE_NETWORK';

function isPrivateNetworkAllowed() {
  return readPrivateNetworkOptIn(ENV_ALLOW_PRIVATE_NETWORK);
}

function normalizeUpstreamUrl(raw) {
  const allowPrivate = isPrivateNetworkAllowed();
  const url = new URL(String(raw).trim());
  const allowed = allowPrivate ? ['https:', 'http:'] : ['https:'];
  if (!allowed.includes(url.protocol)) {
    throw new Error(allowPrivate
      ? 'Extension proxy target must use http:// or https://.'
      : 'Extension proxy target must use https://.');
  }
  return url.href.replace(/\/+$/, '');
}

async function checkSSRF(urlStr) {
  if (isPrivateNetworkAllowed()) return;
  const hostname = new URL(urlStr).hostname.replace(/^\[|\]$/g, '');
  if (isIP(hostname)) {
    if (isBlockedAddress(hostname)) throw new Error(`URL resolves to a private IP address: ${hostname}`);
    return;
  }
  const v4 = await dns.resolve4(hostname).catch(() => []);
  const v6 = await dns.resolve6(hostname).catch(() => []);
  for (const addr of [...v4, ...v6]) {
    if (isBlockedAddress(addr)) {
      throw new Error(`URL resolves to a private IP address: ${addr}`);
    }
  }
}

function parseProxyTargets() {
  try {
    const raw = process.env.EXTENSION_PROXY_TARGETS || '{}';
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const out = {};
    for (const [moduleId, upstream] of Object.entries(parsed)) {
      if (typeof upstream !== 'string' || !upstream.trim()) continue;
      try {
        out[moduleId] = normalizeUpstreamUrl(upstream);
      } catch (err) {
        log.warn(`Invalid proxy target for "${moduleId}":`, err.message);
      }
    }
    return out;
  } catch (err) {
    log.warn('Invalid EXTENSION_PROXY_TARGETS:', err.message);
    return {};
  }
}

function serializeBody(req) {
  if (req.method === 'GET' || req.method === 'HEAD') return undefined;
  const { body } = req;
  if (body === undefined || body === null) return undefined;
  if (Buffer.isBuffer(body)) return body;
  if (typeof body === 'string') return body;
  const ct = String(req.headers['content-type'] || '').toLowerCase();
  if (ct.includes('application/json')) return JSON.stringify(body);
  return undefined;
}

function forwardHeaders(req) {
  const headers = { ...req.headers };
  delete headers.host;
  delete headers.connection;
  delete headers['content-length'];
  return headers;
}

const PROXY_TARGETS = parseProxyTargets();

const router = express.Router({ mergeParams: true });

router.all('/:moduleId/{*rest}', async (req, res) => {
  const moduleId = String(req.params.moduleId || '');
  const rest = Array.isArray(req.params.rest)
    ? req.params.rest.join('/')
    : String(req.params.rest || '');
  const permissionKey = extensionPermissionKey(moduleId);

  const catalog = getExtensionPermissionCatalog();
  const known = catalog.permissionModules.some((m) => m.extensionModuleId === moduleId);
  if (!known) {
    return res.status(404).json({ error: 'Extension module not found or not enabled.', code: 404 });
  }

  const pathKey = `extensions/${moduleId}/${rest}`.replace(/\/+$/, '');
  const moduleKey = moduleForPath(pathKey) || permissionKey;

  if (req.authMethod === 'api_token' && req.authScopes != null) {
    if (!tokenAllows(req.authScopes, moduleKey, requiredAccess(req.method))) {
      return res.status(403).json({ error: 'Token scope does not permit this operation.', code: 403 });
    }
  } else {
    const verdict = moduleAccessVerdict(
      req.sessionModuleAccess,
      permissionKey,
      requiredAccess(req.method),
    );
    if (verdict === MODULE_ACCESS_DENIED) {
      return res.status(403).json({ error: 'You do not have access to this module.', code: 403 });
    }
    if (verdict === MODULE_ACCESS_READ_ONLY) {
      return res.status(403).json({ error: 'You have read-only access to this module.', code: 403 });
    }
  }

  const upstream = PROXY_TARGETS[moduleId];
  if (!upstream) {
    return res.status(502).json({
      error: 'Extension proxy target not configured for this module.',
      code: 502,
    });
  }

  const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  const targetUrl = `${upstream}/api/extensions/${encodeURIComponent(moduleId)}/${rest}${query}`;

  try {
    await checkSSRF(upstream);
    const reqOpts = {
      method: req.method,
      headers: forwardHeaders(req),
      body: serializeBody(req),
      redirect: 'manual',
    };
    if (!isPrivateNetworkAllowed()) reqOpts.lookup = createGuardedLookup();
    const upstreamRes = await safeRequest(targetUrl, reqOpts);
    res.status(upstreamRes.status);
    upstreamRes.headers.forEach((value, key) => {
      if (key.toLowerCase() === 'transfer-encoding') return;
      res.setHeader(key, value);
    });
    const chunks = [];
    for await (const chunk of upstreamRes.body) {
      chunks.push(chunk);
    }
    res.send(Buffer.concat(chunks));
  } catch (err) {
    if (String(err.message || '').includes('private IP')) {
      log.warn(`Proxy SSRF block for ${moduleId}:`, err.message);
      return res.status(502).json({ error: 'Extension upstream URL is not allowed.', code: 502 });
    }
    log.error(`Proxy error for ${moduleId}:`, err.message);
    res.status(502).json({ error: 'Extension upstream unavailable.', code: 502 });
  }
});

export default router;

export const __test = {
  normalizeUpstreamUrl,
  checkSSRF,
  isPrivateNetworkAllowed,
  ENV_ALLOW_PRIVATE_NETWORK,
};
