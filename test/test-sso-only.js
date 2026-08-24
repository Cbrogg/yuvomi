/**
 * Modul: SSO als einziger Weg hinein (#847)
 * Zweck: Der Schalter `AUTH_ALLOW_PASSWORD_LOGIN`, Konten ohne Passwort und die
 *        Loecher, die beide im Passwort-Reset aufreissen wuerden.
 * Ausfuehren: node --experimental-sqlite test/test-sso-only.js
 *
 * Warum eine eigene Suite und nicht ein Kapitel in test-oidc.js: die Regeln
 * hier gelten fuer die EINGEBAUTE Anmeldung. Dass OIDC ueber ihr Wirksamwerden
 * entscheidet, macht sie nicht zu OIDC-Regeln - test-oidc.js prueft, was der
 * Anbieter darf, diese Datei prueft, was das Formular noch darf.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { DatabaseSync } from 'node:sqlite';
import { createPasswordResetService } from '../server/services/password-reset.js';
import {
  isPasswordLoginEnabled,
  passwordLoginWarning,
  isSsoOnlyAccount,
  OIDC_PASSWORD_SENTINEL,
} from '../server/services/oidc.js';

process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-secret';

const OIDC_ENV = {
  OIDC_ISSUER: 'https://idp.example/',
  OIDC_CLIENT_ID: 'yuvomi',
  OIDC_CLIENT_SECRET: 'shh',
  OIDC_REDIRECT_URI: 'https://home.example/api/v1/auth/oidc/callback',
};

/**
 * Fuehrt `fn` mit einer gesetzten Umgebung aus und stellt sie danach exakt
 * wieder her - auch die Faelle "war vorher nicht gesetzt". Ein Test, der eine
 * Variable stehen laesst, verschiebt das Ergebnis des naechsten.
 *
 * Gibt `fn` ein Promise zurueck, wird bis dahin gewartet. Ein `finally` allein
 * raeumte sonst auf, sobald das Promise ERZEUGT ist - der eigentliche Aufruf
 * liefe dann schon wieder mit der alten Umgebung und der Test waere gruen,
 * ohne je den Zustand geprueft zu haben, um den es ihm ging.
 */
function withEnv(vars, fn) {
  const before = {};
  for (const [k, v] of Object.entries(vars)) {
    before[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  const restore = () => {
    for (const [k, v] of Object.entries(before)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  };
  let result;
  try {
    result = fn();
  } catch (err) {
    restore();
    throw err;
  }
  if (result && typeof result.then === 'function') {
    return result.then(
      (value) => { restore(); return value; },
      (err) => { restore(); throw err; },
    );
  }
  restore();
  return result;
}

const withOidc = (extra, fn) => withEnv({ ...OIDC_ENV, ...extra }, fn);
const withoutOidc = (extra, fn) => withEnv({
  OIDC_ISSUER: undefined, OIDC_CLIENT_ID: undefined,
  OIDC_CLIENT_SECRET: undefined, OIDC_REDIRECT_URI: undefined, ...extra,
}, fn);

// ─── Der Schalter selbst ─────────────────────────────────────────────────────

test('ohne den Schalter bleibt die Passwort-Anmeldung an', () => {
  withOidc({ AUTH_ALLOW_PASSWORD_LOGIN: undefined }, () => {
    assert.equal(isPasswordLoginEnabled(), true);
  });
});

test('AUTH_ALLOW_PASSWORD_LOGIN=false schaltet sie ab, wenn OIDC konfiguriert ist', () => {
  withOidc({ AUTH_ALLOW_PASSWORD_LOGIN: 'false' }, () => {
    assert.equal(isPasswordLoginEnabled(), false);
  });
});

test('nur der ausdrueckliche Wert "false" schaltet ab', () => {
  // Ein Sicherheitsschalter, der auf jeden gesetzten Wert reagiert, macht aus
  // einem Tippfehler eine Aussperrung - dieselbe Regel wie OIDC_ALLOW_SIGNUP.
  for (const value of ['true', '1', 'no', 'FALSE', '']) {
    withOidc({ AUTH_ALLOW_PASSWORD_LOGIN: value }, () => {
      assert.equal(isPasswordLoginEnabled(), true, `"${value}" darf nicht abschalten`);
    });
  }
});

test('ohne OIDC wird der Schalter ignoriert, statt alle auszusperren', () => {
  // Das ist die wichtigste Zusicherung der ganzen Datei: griffe er hier, waere
  // eine einzelne Zeile in der .env ein Haushalt ohne Weg in seine eigene App.
  withoutOidc({ AUTH_ALLOW_PASSWORD_LOGIN: 'false' }, () => {
    assert.equal(isPasswordLoginEnabled(), true);
  });
});

test('ein unvollstaendig konfiguriertes OIDC zaehlt nicht als konfiguriert', () => {
  // Drei von vier Werten sind kein Anbieter, sondern ein halb fertiger Versuch.
  withOidc({ OIDC_CLIENT_SECRET: undefined, AUTH_ALLOW_PASSWORD_LOGIN: 'false' }, () => {
    assert.equal(isPasswordLoginEnabled(), true);
  });
});

test('der ignorierte Schalter meldet sich, statt still zu versagen', () => {
  withoutOidc({ AUTH_ALLOW_PASSWORD_LOGIN: 'false' }, () => {
    const warning = passwordLoginWarning();
    assert.ok(warning, 'ohne Warnung glaubt der Betreiber, das Formular sei zu');
    assert.match(warning, /AUTH_ALLOW_PASSWORD_LOGIN/);
    assert.match(warning, /OIDC_ISSUER/, 'die Meldung muss sagen, was fehlt');
  });
});

test('wo der Schalter greift oder gar nicht gesetzt ist, warnt nichts', () => {
  withOidc({ AUTH_ALLOW_PASSWORD_LOGIN: 'false' }, () => {
    assert.equal(passwordLoginWarning(), null);
  });
  withoutOidc({ AUTH_ALLOW_PASSWORD_LOGIN: undefined }, () => {
    assert.equal(passwordLoginWarning(), null);
  });
});

// ─── Der Platzhalter ─────────────────────────────────────────────────────────

test('der Platzhalter erkennt genau sich selbst', () => {
  assert.equal(isSsoOnlyAccount(OIDC_PASSWORD_SENTINEL), true);
  assert.equal(isSsoOnlyAccount('$2b$12$echterhash'), false);
  assert.equal(isSsoOnlyAccount(null), false);
  assert.equal(isSsoOnlyAccount(undefined), false);
  assert.equal(isSsoOnlyAccount(''), false);
});

test('der Platzhalter steht an genau einer Stelle', () => {
  // Eine zweite Schreibweise waere ein Konto mit einem Passwort, das niemand
  // gesetzt hat: `verifyPassword` schlaegt gegen den einen fehl und koennte
  // gegen den anderen zufaellig gelingen.
  assert.equal(OIDC_PASSWORD_SENTINEL, '$oidc$');
});

// ─── Passwort-Reset ──────────────────────────────────────────────────────────

function makeDb() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL DEFAULT 'x');
    CREATE TABLE password_resets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL, expires_at INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
    );
    CREATE UNIQUE INDEX idx_password_resets_hash ON password_resets(token_hash);
    CREATE TABLE contacts (id INTEGER PRIMARY KEY AUTOINCREMENT,
      family_user_id INTEGER, email TEXT);
  `);
  // alice hat ein echtes Passwort, sso hat nur den Platzhalter - beide mit
  // hinterlegter Adresse, damit der Reset an ihnen nicht schon daran scheitert.
  db.prepare("INSERT INTO users (id, username, password_hash) VALUES (1,'alice','$2b$12$fakehash')").run();
  db.prepare('INSERT INTO users (id, username, password_hash) VALUES (2,?,?)')
    .run('sso', OIDC_PASSWORD_SENTINEL);
  db.prepare("INSERT INTO contacts (family_user_id, email) VALUES (1, 'alice@test')").run();
  db.prepare("INSERT INTO contacts (family_user_id, email) VALUES (2, 'sso@test')").run();
  return db;
}

async function makeAuthApp(db) {
  const { buildResetRoutes } = await import('../server/auth.js');
  const sent = [];
  const app = express();
  app.use(express.json());
  const router = express.Router();
  buildResetRoutes(router, {
    database: db,
    emailService: { isConfigured: () => true, sendMail: async (m) => { sent.push(m); } },
    resetService: createPasswordResetService({ db }),
    baseUrl: 'https://oikos.test',
    limiter: (_req, _res, next) => next(),
  });
  app.use('/auth', router);
  return { app, sent };
}

async function callJson(app, method, path, body) {
  const { createServer } = await import('node:http');
  const server = createServer(app);
  await new Promise((r) => server.listen(0, r));
  const { port } = server.address();
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    method, headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  server.close();
  return { status: res.status, json };
}

test('ein Konto ohne Passwort bekommt keinen Reset-Link', async () => {
  // Das Loch, das es vor #847 gab: der Reset kannte den Platzhalter nicht und
  // haette dem SSO-Konto ein echtes, funktionierendes Passwort gegeben - genau
  // die zweite Tuer, die der Platzhalter zuhalten soll. Ausloesen konnte das
  // jeder, der die E-Mail-Adresse kennt.
  const db = makeDb();
  const { app, sent } = await makeAuthApp(db);
  const { status, json } = await callJson(app, 'POST', '/auth/forgot-password', { identifier: 'sso' });
  assert.equal(status, 200, 'die Antwort bleibt generisch');
  assert.equal(json.data.ok, true);
  assert.equal(sent.length, 0, 'es darf keine Mail rausgehen');
  assert.equal(db.prepare('SELECT COUNT(*) c FROM password_resets').get().c, 0,
    'und erst recht kein Token entstehen');
});

test('das Konto mit Passwort bekommt seinen Reset-Link weiterhin', async () => {
  // Gegenprobe: ohne sie belegt der Test darueber nur, dass irgendetwas kaputt
  // ist.
  const db = makeDb();
  const { app, sent } = await makeAuthApp(db);
  await callJson(app, 'POST', '/auth/forgot-password', { identifier: 'alice' });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, 'alice@test');
});

test('auch ueber die E-Mail-Adresse fuehrt kein Weg zum Reset eines SSO-Kontos', async () => {
  // `resolveUser` findet ein Konto auf zwei Wegen; ein Riegel, der nur an einem
  // haengt, ist kein Riegel.
  const db = makeDb();
  const { app, sent } = await makeAuthApp(db);
  await callJson(app, 'POST', '/auth/forgot-password', { identifier: 'sso@test' });
  assert.equal(sent.length, 0);
});

test('mit abgeschalteter Passwort-Anmeldung geht ueberhaupt keine Reset-Mail raus', async () => {
  const db = makeDb();
  const { app, sent } = await makeAuthApp(db);
  await withOidc({ AUTH_ALLOW_PASSWORD_LOGIN: 'false' }, async () => {
    const { status, json } = await callJson(app, 'POST', '/auth/forgot-password', { identifier: 'alice' });
    assert.equal(status, 200, 'die Antwort bleibt generisch - der Zustand ist nicht abfragbar');
    assert.equal(json.data.ok, true);
    assert.equal(sent.length, 0);
  });
});

test('ein bereits ausgestellter Token laeuft ins Leere, wenn das Konto auf SSO wechselt', async () => {
  // Der Token entsteht, WAEHREND das Konto noch ein Passwort hat. Zwischen
  // Ausstellen und Einloesen liegt bis zu einer Stunde - genug Zeit fuer einen
  // Admin, das Konto umzustellen. Diese Entscheidung darf ein alter Token nicht
  // ueberholen.
  const db = makeDb();
  const { app, sent } = await makeAuthApp(db);
  await callJson(app, 'POST', '/auth/forgot-password', { identifier: 'alice' });
  const token = sent[0].html.match(/token=([a-f0-9]+)/)[1];

  db.prepare('UPDATE users SET password_hash = ? WHERE id = 1').run(OIDC_PASSWORD_SENTINEL);

  const { status } = await callJson(app, 'POST', '/auth/reset-password', { token, password: 'brandnewpw' });
  assert.equal(status, 400, 'derselbe Grund wie ein ungueltiger Token, damit der Unterschied nichts verraet');
  assert.equal(db.prepare('SELECT password_hash FROM users WHERE id = 1').get().password_hash,
    OIDC_PASSWORD_SENTINEL, 'der Platzhalter muss stehen bleiben');
  assert.equal(db.prepare('SELECT COUNT(*) c FROM password_resets').get().c, 0,
    'der Token wird verbraucht, nicht liegengelassen');
});

test('ein ausgestellter Token laeuft ins Leere, wenn die Passwort-Anmeldung abgeschaltet wird', async () => {
  const db = makeDb();
  const { app, sent } = await makeAuthApp(db);
  await callJson(app, 'POST', '/auth/forgot-password', { identifier: 'alice' });
  const token = sent[0].html.match(/token=([a-f0-9]+)/)[1];
  const before = db.prepare('SELECT password_hash FROM users WHERE id = 1').get().password_hash;

  await withOidc({ AUTH_ALLOW_PASSWORD_LOGIN: 'false' }, async () => {
    const { status } = await callJson(app, 'POST', '/auth/reset-password', { token, password: 'brandnewpw' });
    assert.equal(status, 400);
  });
  assert.equal(db.prepare('SELECT password_hash FROM users WHERE id = 1').get().password_hash, before,
    'das bestehende Passwort bleibt unangetastet');
});

// ─── Die Regeln an ihren Quellen ─────────────────────────────────────────────
//
// Diese drei pruefen den Code selbst. Die Routen dahinter haengen an Session
// und CSRF und waeren hier nur mit halbem Server zu erreichen - aber genau die
// Stellen sind es, an denen die Regel wieder verschwinden koennte.

import { readFileSync } from 'node:fs';

const authSrc = readFileSync(new URL('../server/auth.js', import.meta.url), 'utf8');

test('die Anmelderoute selbst haelt den Riegel, nicht nur die Anmeldeseite', () => {
  // Eine Regel, die nur die Oberflaeche kennt, ist keine Regel, sondern eine
  // Bitte: `curl` auf /login umgeht sie vollstaendig.
  const login = authSrc.slice(authSrc.indexOf("router.post('/login'"));
  const body = login.slice(0, login.indexOf("router.post('/logout'"));
  assert.match(body, /isPasswordLoginEnabled\(\)/,
    'POST /login prueft den Schalter nicht');
  assert.match(body, /status\(403\)/, 'und weist nicht ab');
});

test('ein Konto ohne Passwort verlangt ausdrueckliche Zustimmung, kein fehlendes Feld', () => {
  // Waere "kein Passwort mitgeschickt" das Signal, ergaebe ein vergessenes Feld
  // still ein Konto ohne Passwort.
  assert.match(authSrc, /function assertSsoOnlyAllowed/);
  assert.match(authSrc, /An account without a password requires OIDC to be configured/,
    'ohne SSO waere so ein Konto tot');
  assert.match(authSrc, /cannot be given a password at the same time/,
    'Passwort und sso_only zugleich muss der Server abweisen statt zu raten');
});

test('der Rueckweg aus SSO-only verlangt ein Passwort', () => {
  // Sonst bliebe der Platzhalter stehen: das Konto haette weder SSO-Pflicht
  // noch einen Zugang, den jemand kennt.
  assert.match(authSrc, /Turning off SSO-only requires setting a password/);
});

test('die Anmeldeseite fragt beide Wege in EINEM Aufruf ab', () => {
  // Ein zweiter blockierender Aufruf vor dem ersten Paint waere ein zweiter
  // Grund, warum die Anmeldeseite haengt.
  const login = readFileSync(new URL('../public/pages/login.js', import.meta.url), 'utf8');
  assert.match(login, /password_login_enabled/,
    'die Seite liest die Angabe nicht');
  assert.match(login, /!\(ssoEnabled && oidc\?\.password_login_enabled === false\)/,
    'ohne die Kopplung an ssoEnabled kann die Seite ganz ohne Weg hinein enden');
  assert.equal((login.match(/fetch\('\/api\/v1\/auth\/oidc\/config'/g) || []).length, 1);
});
