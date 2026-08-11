import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as db from '../server/db.js';

test('inventory_items has a nullable photo_data column after migration', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'yuvomi-photo-migration-'));
  const dbPath = join(dir, 'test.db');
  try {
    db._setTestDatabase(dbPath);
    const database = db.get();

    const columns = database.prepare('PRAGMA table_info(inventory_items)').all();
    const photoCol = columns.find((c) => c.name === 'photo_data');
    assert.ok(photoCol, 'photo_data column is missing from inventory_items');
    assert.equal(photoCol.notnull, 0, 'photo_data must be nullable');

    // Pre-existing rows (simulated: any row inserted without photo_data) default to NULL.
    // Ensure the category exists (might already be seeded by migrations)
    const categoryExists = database.prepare(`
      SELECT 1 FROM inventory_categories WHERE key = 'other'
    `).get();
    if (!categoryExists) {
      database.prepare(`
        INSERT INTO inventory_categories (key, name, icon, sort_order) VALUES ('other', 'Other', 'package', 0)
      `).run();
    }
    const result = database.prepare(`
      INSERT INTO inventory_items (name, category) VALUES ('Test Item', 'other')
    `).run();
    const row = database.prepare('SELECT photo_data FROM inventory_items WHERE id = ?').get(result.lastInsertRowid);
    assert.equal(row.photo_data, null);
  } finally {
    db._resetTestDatabase();
    rmSync(dir, { recursive: true, force: true });
  }
});
