/**
 * Modul: Extension API proxy (optional)
 * Zweck: Leitet /api/v1/extensions/:moduleId/* an konfigurierte Sidecar-Upstreams
 *        weiter. Betreiber-Konfiguration über EXTENSION_PROXY_TARGETS JSON, z. B.
 *        {"budget-v2":"http://budget-api:8080"}. Fetch läuft über safeRequest +
 *        createGuardedLookup (server/utils/ssrf.js) - dieselbe SSRF-Härtung wie
 *        bei Nutzer-URLs, mit Opt-in EXTENSION_PROXY_ALLOW_PRIVATE_NETWORK für
 *        interne Docker-Hostnamen.
 *
 *        Outbound headers are an allowlist (never the caller's Cookie or
 *        Authorization). Identity is minted by Yuvomi. Upstream Set-Cookie is
 *        not copied onto the Yuvomi origin. rest is confined to the module
 *        namespace.
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
const ENV_IDENTITY_SECRET = 'EXTENSION_PROXY_IDENTITY_SECRET';

const FORWARD_REQ = new Set(['content-type', 'accept', 'accept-language']);
const FORWARD_RES = new Set(['content-type', 'content-disposition', 'cache-control', 'etag']);

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

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function encodeRestPath(rest) {
  const raw = Array.isArray(rest) ? rest.join('/') : String(rest || '');
  if (!raw) return '';
  const segments = raw.split('/');
  for (const segment of segments) {
    if (segment === '' || segment === '.' || segment === '..') {
      throw httpError(400, 'Invalid extension path.');
    }
  }
  return segments.map(encodeURIComponent).join('/');
}

function serializeBody(req) {
  if (req.method === 'GET' || req.method === 'HEAD') return undefined;
  const { body } = req;
  if (body === undefined || body === null) return undefined;
  if (Buffer.isBuffer(body) || typeof body === 'string') return body;
  const ct = String(req.headers['content-type'] || '').toLowerCase();
  if (ct.includes('application/json')) return JSON.stringify(body);
  throw httpError(415, 'Unsupported Media Type');
}

function grantedAccess(req, permissionKey) {
  if (!req.sessionModuleAccess) return 'write';
  return req.sessionModuleAccess[permissionKey] || 'write';
}

function forwardHeaders(req, permissionKey) {
  const headers = {};
  for (const [key, value] of Object.entries(req.headers || {})) {
    if (FORWARD_REQ.has(String(key).toLowerCase()) && value != null) {
      headers[key] = value;
    }
  }
  headers['x-yuvomi-user-id'] = String(req.authUserId ?? '');
  headers['x-yuvomi-user-name'] = String(req.session?.displayName || '');
  headers['x-yuvomi-user-role'] = String(req.authRole ?? '');
  headers['x-yuvomi-access'] = grantedAccess(req, permissionKey);
  const secret = process.env[ENV_IDENTITY_SECRET];
  if (secret) headers['x-yuvomi-proxy-secret'] = secret;
  return headers;
}

function applyUpstreamHeaders(upstreamRes, res) {
  const h = upstreamRes?.headers;
  if (!h || typeof h.get !== 'function') return;
  for (const name of FORWARD_RES) {
    const value = h.get(name);
    if (value) res.setHeader(name, value);
  }
}

const router = express.Router({ mergeParams: true });

router.all('/:moduleId/{*rest}', async (req, res) => {
  const moduleId = String(req.params.moduleId || '');
  let restPath;
  try {
    restPath = encodeRestPath(req.params.rest);
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message, code: err.status || 400 });
  }
  const permissionKey = extensionPermissionKey(moduleId);

  const catalog = getExtensionPermissionCatalog();
  const known = catalog.permissionModules.some((m) => m.extensionModuleId === moduleId);
  if (!known) {
    return res.status(404).json({ error: 'Extension module not found or not enabled.', code: 404 });
  }

  const pathKey = `extensions/${moduleId}/${restPath}`.replace(/\/+$/, '');
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

  const upstream = parseProxyTargets()[moduleId];
  if (!upstream) {
    return res.status(502).json({
      error: 'Extension proxy target not configured for this module.',
      code: 502,
    });
  }

  const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  const suffix = restPath ? `/${restPath}` : '';
  const targetUrl = `${upstream}/api/extensions/${encodeURIComponent(moduleId)}${suffix}${query}`;

  try {
    await checkSSRF(upstream);
    const body = serializeBody(req);
    const reqOpts = {
      method: req.method,
      headers: forwardHeaders(req, permissionKey),
      body,
      redirect: 'manual',
    };
    if (!isPrivateNetworkAllowed()) reqOpts.lookup = createGuardedLookup();
    const upstreamRes = await safeRequest(targetUrl, reqOpts);
    res.status(upstreamRes.status);
    applyUpstreamHeaders(upstreamRes, res);
    const chunks = [];
    for await (const chunk of upstreamRes.body) {
      chunks.push(chunk);
    }
    res.send(Buffer.concat(chunks));
  } catch (err) {
    if (err.status === 415) {
      return res.status(415).json({ error: err.message, code: 415 });
    }
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
  encodeRestPath,
  serializeBody,
  forwardHeaders,
  applyUpstreamHeaders,
  ENV_ALLOW_PRIVATE_NETWORK,
  ENV_IDENTITY_SECRET,
};
