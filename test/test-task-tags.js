/**
 * Modul: Aufgaben-Tags (#586)
 * Zweck: Hält die zwei Dinge fest, die dieses Feature ausmachen und die je für
 *        sich still brechen können:
 *
 *          - Migration v114 baut `tasks` neu, um den Kategorie-Default zu
 *            reparieren, den v83 stehen ließ. Ein Rebuild droppt die Tabelle und
 *            nimmt Indizes und die drei Suchindex-Trigger mit. Werden die nicht
 *            vollständig neu angelegt, läuft die Suche danach still auf einem
 *            einfrierenden Index weiter - nichts wirft, nichts fehlt sichtbar.
 *          - Tags sind bewusst NICHT die Kategorie. Eine Aufgabe liegt in einer
 *            Schublade, trägt aber beliebig viele Etiketten. Die Suite hält
 *            fest, dass beide Achsen unabhängig bleiben.
 *
 *        Der CalDAV-Weg (CATEGORIES rein und raus) liegt in
 *        test-caldav-todo-outbound.js, wo schon der übrige VTODO-Verkehr steht.
 * Ausführen: npm run test:task-tags
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import http from 'node:http';
import test from 'node:test';
import Database from 'better-sqlite3-multiple-ciphers';
import express from 'express';

process.env.DB_PATH = ':memory:';
process.env.SESSION_SECRET = 'task-tags-test-secret';

const { MIGRATIONS, get, _setTestDatabase } = await import('../server/db.js');
const { default: tasksRouter } = await import('../server/routes/tasks.js');
const { normalizeTags, tagsKey, setTags, loadTags, allTags, MAX_TAGS, MAX_TAG_LEN } =
  await import('../server/utils/task-tags.js');

const moduleDatabase = get();
const suiteDatabase = buildMigratedDatabase(MIGRATIONS);
_setTestDatabase(suiteDatabase);
moduleDatabase.close();

const ALICE = seedUser('alice', 'admin');

test.after(() => suiteDatabase.close());

function applyMigration(db, migration) {
  if (typeof migration.up === 'function') migration.up(db);
  else db.exec(migration.up);
  if (typeof migration.afterUp === 'function') migration.afterUp(db);
  db.prepare('INSERT INTO schema_migrations (version, description) VALUES (?, ?)')
    .run(migration.version, migration.description);
}

function buildMigratedDatabase(migrations) {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE schema_migrations (
      version INTEGER PRIMARY KEY,
      description TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    )
  `);
  // Fremdschlüssel wie im Migrations-Runner pausieren, wo die Migration es
  // verlangt - sonst reißt der Rebuild von `tasks` die abhängigen Zeilen mit.
  for (const migration of migrations) {
    if (!migration.foreignKeysOff) { applyMigration(db, migration); continue; }
    db.pragma('foreign_keys = OFF');
    try { applyMigration(db, migration); } finally { db.pragma('foreign_keys = ON'); }
  }
  return db;
}

function seedUser(prefix, role) {
  return get().prepare(`
    INSERT INTO users (username, display_name, password_hash, role)
    VALUES (?, ?, 'hash', ?)
  `).run(`${prefix}-${randomUUID()}`, prefix, role).lastInsertRowid;
}

function seedTask({ createdBy = ALICE, category = undefined } = {}) {
  return category === undefined
    ? get().prepare('INSERT INTO tasks (title, created_by) VALUES (?, ?)')
        .run(`Task-${randomUUID()}`, createdBy).lastInsertRowid
    : get().prepare('INSERT INTO tasks (title, created_by, category) VALUES (?, ?, ?)')
        .run(`Task-${randomUUID()}`, createdBy, category).lastInsertRowid;
}

function createHarness({ userId = ALICE, role = 'admin' } = {}) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.authUserId = userId;
    req.authRole = role;
    req.session = { userId, role };
    next();
  });
  app.use('/api/v1/tasks', tasksRouter);
  const server = http.createServer(app);
  return {
    async call(method, pathname, body) {
      if (!server.listening) {
        await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
      }
      const base = `http://127.0.0.1:${server.address().port}/api/v1/tasks`;
      const res = await fetch(`${base}${pathname}`, {
        method,
        headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await res.text();
      return { status: res.status, body: text ? JSON.parse(text) : null };
    },
    close() {
      return new Promise((resolve) => (server.listening ? server.close(resolve) : resolve()));
    },
  };
}

// ── Migration v114: der reparierte Kategorie-Default ────────────────────────────

test('v114: neue Aufgaben ohne Kategorie landen auf einem gültigen Key', () => {
  const id = seedTask();
  const category = get().prepare('SELECT category FROM tasks WHERE id = ?').get(id).category;
  assert.equal(category, 'misc');
  // Der eigentliche Fehler von v83 war nicht der Name, sondern dass der Wert in
  // keiner Kategorie stand: die Aufgabe fiel aus jedem Dropdown und Filter.
  const known = get().prepare('SELECT 1 FROM task_categories WHERE key = ?').get(category);
  assert.ok(known, `Spalten-Default "${category}" muss in task_categories existieren`);
});

test('v114: der Rebuild lässt keinen Index und keinen Trigger zurück', () => {
  const objects = get().prepare(
    "SELECT type, name FROM sqlite_master WHERE tbl_name = 'tasks' AND type != 'table'"
  ).all();
  const names = objects.map((o) => o.name);

  for (const index of ['idx_tasks_status', 'idx_tasks_assigned', 'idx_tasks_parent',
                       'idx_tasks_start_date', 'idx_tasks_external']) {
    assert.ok(names.includes(index), `Index ${index} fehlt nach dem Rebuild`);
  }
  for (const trigger of ['trg_search_tasks_ai', 'trg_search_tasks_au', 'trg_search_tasks_ad']) {
    assert.ok(names.includes(trigger), `Trigger ${trigger} fehlt nach dem Rebuild`);
  }
});

test('v114: die Suchindex-Trigger feuern noch (vorhanden heißt nicht wirksam)', () => {
  const id = seedTask();
  const indexed = () => get().prepare(
    "SELECT title FROM search_index WHERE entity = 'task' AND entity_id = ?"
  ).get(id);

  assert.ok(indexed(), 'INSERT muss den Suchindex füllen');

  get().prepare('UPDATE tasks SET title = ? WHERE id = ?').run('Umbenannt', id);
  assert.equal(indexed().title, 'Umbenannt', 'UPDATE muss den Suchindex nachziehen');

  get().prepare('DELETE FROM tasks WHERE id = ?').run(id);
  assert.equal(indexed(), undefined, 'DELETE muss den Suchindex aufräumen');
});

// ── Normalisierung ─────────────────────────────────────────────────────────────

test('normalizeTags trimmt, entfernt Leeres und eint Groß-/Kleinschreibung', () => {
  assert.deepEqual(normalizeTags(['  Garten ', '', '   ', 'garten', 'Haus']), ['Garten', 'Haus']);
});

test('normalizeTags nimmt auch einen kommaseparierten String', () => {
  assert.deepEqual(normalizeTags('Garten, Haus ,, Hof'), ['Garten', 'Haus', 'Hof']);
});

test('normalizeTags deckelt Anzahl und Länge, statt abzulehnen', () => {
  const many = normalizeTags(Array.from({ length: MAX_TAGS + 10 }, (_, i) => `tag-${i}`));
  assert.equal(many.length, MAX_TAGS);
  const long = normalizeTags(['x'.repeat(MAX_TAG_LEN + 50)]);
  assert.equal(long[0].length, MAX_TAG_LEN);
});

test('tagsKey ignoriert Reihenfolge und Schreibweise', () => {
  // Sonst löste eine bloße Umsortierung einen Push zum CalDAV-Server aus.
  assert.equal(tagsKey(['Garten', 'Haus']), tagsKey(['haus', 'GARTEN']));
  assert.notEqual(tagsKey(['Garten']), tagsKey(['Garten', 'Haus']));
});

// ── Speicherschicht ────────────────────────────────────────────────────────────

test('setTags ersetzt die Liste vollständig', () => {
  const id = seedTask();
  setTags(get(), id, ['Garten', 'Haus']);
  assert.deepEqual(loadTags(get(), id), ['Garten', 'Haus']);

  setTags(get(), id, ['Hof']);
  assert.deepEqual(loadTags(get(), id), ['Hof']);

  setTags(get(), id, []);
  assert.deepEqual(loadTags(get(), id), []);
});

test('Tags verschwinden mit ihrer Aufgabe (CASCADE)', () => {
  const id = seedTask();
  setTags(get(), id, ['Garten']);
  get().prepare('DELETE FROM tasks WHERE id = ?').run(id);
  assert.equal(get().prepare('SELECT COUNT(*) AS n FROM task_tags WHERE task_id = ?').get(id).n, 0);
});

test('allTags zählt über Aufgaben hinweg', () => {
  const a = seedTask();
  const b = seedTask();
  setTags(get(), a, ['Zähltest']);
  setTags(get(), b, ['Zähltest']);
  const entry = allTags(get()).find((e) => e.tag === 'Zähltest');
  assert.equal(entry.count, 2);
  get().prepare('DELETE FROM tasks WHERE id IN (?, ?)').run(a, b);
});

// ── API ────────────────────────────────────────────────────────────────────────

test('POST legt Tags an, GET liefert sie zurück', async () => {
  const h = createHarness();
  try {
    const post = await h.call('POST', '/', { title: 'Rasen mähen', tags: ['Garten', 'Sommer'] });
    assert.equal(post.status, 201);
    assert.deepEqual(post.body.data.tags, ['Garten', 'Sommer']);

    const detail = await h.call('GET', `/${post.body.data.id}`);
    assert.deepEqual(detail.body.data.tags, ['Garten', 'Sommer']);
  } finally {
    await h.close();
  }
});

test('PUT ohne tags-Feld lässt die Tags unangetastet', async () => {
  const h = createHarness();
  try {
    const post = await h.call('POST', '/', { title: 'Unberührt', tags: ['Garten'] });
    const id = post.body.data.id;

    const put = await h.call('PUT', `/${id}`, { title: 'Umbenannt' });
    assert.equal(put.status, 200);
    assert.deepEqual(put.body.data.tags, ['Garten'],
      'Ein Client, der nur den Titel schickt, darf keine Tags verlieren');
  } finally {
    await h.close();
  }
});

test('PUT mit leerem Array entfernt alle Tags', async () => {
  const h = createHarness();
  try {
    const post = await h.call('POST', '/', { title: 'Leeren', tags: ['Garten'] });
    const put = await h.call('PUT', `/${post.body.data.id}`, { tags: [] });
    assert.deepEqual(put.body.data.tags, []);
  } finally {
    await h.close();
  }
});

test('POST weist eine Tag-Liste ab, die keine ist', async () => {
  const h = createHarness();
  try {
    const res = await h.call('POST', '/', { title: 'Kaputt', tags: { garten: true } });
    assert.equal(res.status, 400, 'Ein Objekt darf nicht als leere Liste durchgehen');
  } finally {
    await h.close();
  }
});

test('GET ?tag= filtert ohne Rücksicht auf Groß-/Kleinschreibung', async () => {
  const h = createHarness();
  try {
    const marker = `Filtertest-${randomUUID().slice(0, 8)}`;
    const withTag = await h.call('POST', '/', { title: 'Mit Tag', tags: [marker] });
    await h.call('POST', '/', { title: 'Ohne Tag' });

    const hit = await h.call('GET', `/?tag=${encodeURIComponent(marker.toLowerCase())}`);
    assert.equal(hit.status, 200);
    assert.deepEqual(hit.body.data.map((t) => t.id), [withTag.body.data.id]);
  } finally {
    await h.close();
  }
});

test('Tags und Kategorie bleiben getrennte Achsen', async () => {
  const h = createHarness();
  try {
    // Der ganze Grund für die eigene Tabelle: ein Tag darf die Schublade nicht
    // umstellen, und alle Werte müssen überleben - nicht nur der erste.
    const post = await h.call('POST', '/', {
      title: 'Zwei Achsen', category: 'household', tags: ['Garten', 'Sommer', 'Balkon'],
    });
    assert.equal(post.body.data.category, 'household');
    assert.equal(post.body.data.tags.length, 3);
  } finally {
    await h.close();
  }
});

test('GET /tags listet die vergebenen Tags mit Häufigkeit', async () => {
  const h = createHarness();
  try {
    const marker = `Liste-${randomUUID().slice(0, 8)}`;
    await h.call('POST', '/', { title: 'A', tags: [marker] });
    await h.call('POST', '/', { title: 'B', tags: [marker] });

    const res = await h.call('GET', '/tags');
    assert.equal(res.status, 200);
    const entry = res.body.data.find((e) => e.tag === marker);
    assert.equal(entry?.count, 2);
  } finally {
    await h.close();
  }
});

test('meta/options liefert die Tags für die Filterleiste mit', async () => {
  const h = createHarness();
  try {
    const marker = `Meta-${randomUUID().slice(0, 8)}`;
    await h.call('POST', '/', { title: 'Meta', tags: [marker] });
    const res = await h.call('GET', '/meta/options');
    assert.ok(res.body.tags.some((e) => e.tag === marker));
  } finally {
    await h.close();
  }
});
