/**
 * Modul: Erinnerungen (Reminders)
 * Zweck: REST-API für Erinnerungen an Aufgaben und Kalender-Events
 * Abhängigkeiten: express, server/db.js
 */

import { createLogger } from '../logger.js';
import express from 'express';
import * as db from '../db.js';
import * as v from '../middleware/validate.js';
import { syncAllBirthdayReminders } from '../services/birthdays.js';

const log    = createLogger('Reminders');
const router = express.Router();

const VALID_ENTITY_TYPES = ['task', 'event', 'subscription', 'inventory_item', 'inventory_tracked_date', 'pantry_item'];

/**
 * ABGELEITETE HERKÜNFTE: ihre Erinnerung ist keine Eingabe, sondern eine Folge
 * von Moduldaten - Abo-Termin, Garantieende, Inventar-Frist, Mindesthaltbarkeit.
 * Das Modul stellt sie bei jedem Schreibvorgang neu her (löschen, dann anlegen),
 * und der Vorrat zusätzlich in jedem Benachrichtigungslauf.
 *
 * Eine von Hand gesetzte Erinnerung überlebt das nicht. Sie anzunehmen wäre eine
 * Zusage, die beim nächsten Speichern gebrochen wird - und beim Vorrat binnen
 * einer Minute, ohne dass irgendwo steht, warum sie verschwunden ist. Ein
 * ehrliches 400 sagt es sofort.
 *
 * Die LESEWEGE (GET, DELETE) kennen alle Typen weiter: der Erinnerungs-Toast
 * muss eine abgeleitete Meldung anzeigen und wegwischen können.
 */
const DERIVED_ENTITY_TYPES = ['subscription', 'inventory_item', 'inventory_tracked_date', 'pantry_item'];

/** Herkünfte, die ein Schreibweg annehmen darf: alle ausser den abgeleiteten. */
const SETTABLE_ENTITY_TYPES = VALID_ENTITY_TYPES.filter((t) => !DERIVED_ENTITY_TYPES.includes(t));

/** Fehlertext, wenn ein Schreibweg eine abgeleitete Herkunft von Hand setzen will. */
function derivedTypeError(entityType) {
  return `Reminders for ${entityType} are derived from the item itself and cannot be set here.`;
}

// Obergrenze für mehrere Erinnerungen je Entität (z. B. Kalender-Termin, #436).
const MAX_REMINDERS_PER_ENTITY = 5;

// --------------------------------------------------------
// GET /api/v1/reminders/pending
// Gibt alle fälligen, nicht-verworfenen Erinnerungen des aktuellen Nutzers zurück.
// "Fällig" = remind_at <= jetzt
// Response: { data: Reminder[] }
// --------------------------------------------------------
router.get('/pending', (req, res) => {
  try {
    const userId = req.authUserId || req.session.userId;
    const now    = new Date().toISOString();
    syncAllBirthdayReminders(db.get(), userId, new Date());

    const rows = db.get().prepare(`
      SELECT
        r.*,
        CASE r.entity_type
          WHEN 'task'  THEN (SELECT title FROM tasks           WHERE id = r.entity_id)
          WHEN 'event' THEN (SELECT title FROM calendar_events WHERE id = r.entity_id)
          WHEN 'subscription' THEN (SELECT name FROM budget_subscriptions WHERE id = r.entity_id)
          WHEN 'inventory_item' THEN (SELECT name FROM inventory_items WHERE id = r.entity_id)
          WHEN 'inventory_tracked_date' THEN (
            SELECT ii.name || ' · ' || d.label
            FROM inventory_item_dates d JOIN inventory_items ii ON ii.id = d.item_id
            WHERE d.id = r.entity_id
          )
          WHEN 'pantry_item' THEN (SELECT name FROM pantry_items WHERE id = r.entity_id)
        END AS entity_title
      FROM reminders r
      WHERE r.created_by  = ?
        AND r.dismissed   = 0
        AND r.remind_at  <= ?
      ORDER BY r.remind_at ASC
    `).all(userId, now);

    res.json({ data: rows });
  } catch (err) {
    log.error('Error loading due reminders:', err.message);
    res.status(500).json({ error: 'Internal error.', code: 500 });
  }
});

// --------------------------------------------------------
// GET /api/v1/reminders/all?entity_type=event&entity_id=5
// Gibt ALLE nicht-verworfenen Erinnerungen einer Entität zurück (#436).
// Kalender-Termine unterstützen mehrere Erinnerungen; Tasks/Subscriptions
// nutzen weiterhin den Single-Endpoint (GET /).
// Response: { data: Reminder[] }
// --------------------------------------------------------
router.get('/all', (req, res) => {
  try {
    const userId     = req.authUserId || req.session.userId;
    const entityType = req.query.entity_type;
    const entityId   = parseInt(req.query.entity_id, 10);

    if (!VALID_ENTITY_TYPES.includes(entityType) || !entityId) {
      return res.status(400).json({ error: 'entity_type und entity_id sind erforderlich.', code: 400 });
    }

    const rows = db.get().prepare(`
      SELECT * FROM reminders
      WHERE entity_type = ? AND entity_id = ? AND created_by = ? AND dismissed = 0
      ORDER BY remind_at ASC
    `).all(entityType, entityId, userId);

    res.json({ data: rows });
  } catch (err) {
    log.error('Error loading reminders:', err.message);
    res.status(500).json({ error: 'Internal error.', code: 500 });
  }
});

// --------------------------------------------------------
// GET /api/v1/reminders?entity_type=task&entity_id=5
// Gibt die Erinnerung für eine spezifische Entität zurück (oder null).
// Response: { data: Reminder | null }
// --------------------------------------------------------
router.get('/', (req, res) => {
  try {
    const userId      = req.authUserId || req.session.userId;
    const entityType  = req.query.entity_type;
    const entityId    = parseInt(req.query.entity_id, 10);

    if (!VALID_ENTITY_TYPES.includes(entityType) || !entityId) {
      return res.status(400).json({ error: 'entity_type und entity_id sind erforderlich.', code: 400 });
    }

    const row = db.get().prepare(`
      SELECT * FROM reminders
      WHERE entity_type = ? AND entity_id = ? AND created_by = ? AND dismissed = 0
      ORDER BY created_at DESC LIMIT 1
    `).get(entityType, entityId, userId);

    res.json({ data: row || null });
  } catch (err) {
    log.error('Error loading reminder:', err.message);
    res.status(500).json({ error: 'Internal error.', code: 500 });
  }
});

// --------------------------------------------------------
// POST /api/v1/reminders
// Erstellt oder ersetzt die Erinnerung für eine Entität.
// Body: { entity_type, entity_id, remind_at }
// Response: { data: Reminder }
// --------------------------------------------------------
router.post('/', (req, res) => {
  try {
    const userId = req.authUserId || req.session.userId;
    const { entity_type, entity_id, remind_at } = req.body;

    const errors = v.collectErrors([
      v.id(entity_id,          'entity_id'),
      v.datetime(remind_at,    'remind_at', true),
    ]);

    // Der `v.oneOf` gegen VALID_ENTITY_TYPES stand hier zusätzlich und sagte
    // dasselbe ein zweites Mal - seit die abgeleiteten Herkünfte abgewiesen
    // werden, sagte er sogar etwas anderes: eine Liste, aus der vier Einträge
    // im nächsten Zweig doch scheitern. Ein Check, eine Antwort.
    if (!entity_type || !SETTABLE_ENTITY_TYPES.includes(entity_type)) {
      errors.push(DERIVED_ENTITY_TYPES.includes(entity_type)
        ? derivedTypeError(entity_type)
        : `entity_type must be one of: ${SETTABLE_ENTITY_TYPES.join(', ')}.`);
    }

    if (errors.length) {
      return res.status(400).json({ error: errors.join(' '), code: 400 });
    }

    const entityId = parseInt(entity_id, 10);

    // Bestehende nicht-verworfene Erinnerungen für diese Entität löschen
    db.get().prepare(`
      DELETE FROM reminders
      WHERE entity_type = ? AND entity_id = ? AND created_by = ?
    `).run(entity_type, entityId, userId);

    const result = db.get().prepare(`
      INSERT INTO reminders (entity_type, entity_id, remind_at, created_by)
      VALUES (?, ?, ?, ?)
    `).run(entity_type, entityId, remind_at, userId);

    const row = db.get().prepare('SELECT * FROM reminders WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ data: row });
  } catch (err) {
    log.error('Error creating reminder:', err.message);
    res.status(500).json({ error: 'Internal error.', code: 500 });
  }
});

// --------------------------------------------------------
// PUT /api/v1/reminders?entity_type=event&entity_id=5
// Ersetzt die komplette Erinnerungs-Menge einer Entität (#436).
// Body: { remind_ats: string[] } (dedupliziert, max. MAX_REMINDERS_PER_ENTITY)
// Response: { data: Reminder[] }
// --------------------------------------------------------
router.put('/', (req, res) => {
  try {
    const userId     = req.authUserId || req.session.userId;
    const entityType = req.query.entity_type;
    const entityId   = parseInt(req.query.entity_id, 10);
    const remindAts  = req.body?.remind_ats;

    if (!VALID_ENTITY_TYPES.includes(entityType) || !entityId) {
      return res.status(400).json({ error: 'entity_type und entity_id sind erforderlich.', code: 400 });
    }
    // DERSELBE RIEGEL WIE IN POST. Er fehlte hier zunächst, und das war der
    // teurere Weg: PUT ersetzt die ganze Menge und darf bis zu fünf Termine
    // schreiben. Für eine abgeleitete Herkunft zieht der Modul-Sync sie
    // anschliessend alle auf denselben Zeitpunkt - fünf identische Meldungen
    // für einen Artikel, statt einer.
    if (DERIVED_ENTITY_TYPES.includes(entityType)) {
      return res.status(400).json({ error: derivedTypeError(entityType), code: 400 });
    }
    if (!Array.isArray(remindAts)) {
      return res.status(400).json({ error: 'remind_ats muss ein Array sein.', code: 400 });
    }

    // Duplikate entfernen, jeden Eintrag als Datetime validieren, Cap anwenden.
    const unique = [...new Set(remindAts)];
    const errors = v.collectErrors(unique.map((value, i) => v.datetime(value, `remind_ats[${i}]`, true)));
    if (errors.length) {
      return res.status(400).json({ error: errors.join(' '), code: 400 });
    }
    if (unique.length > MAX_REMINDERS_PER_ENTITY) {
      return res.status(400).json({ error: `Maximal ${MAX_REMINDERS_PER_ENTITY} Erinnerungen je Eintrag.`, code: 400 });
    }

    const replace = db.get().transaction((values) => {
      db.get().prepare(`
        DELETE FROM reminders
        WHERE entity_type = ? AND entity_id = ? AND created_by = ?
      `).run(entityType, entityId, userId);

      const insert = db.get().prepare(`
        INSERT INTO reminders (entity_type, entity_id, remind_at, created_by)
        VALUES (?, ?, ?, ?)
      `);
      for (const remindAt of values) {
        insert.run(entityType, entityId, remindAt, userId);
      }
    });
    replace(unique);

    const rows = db.get().prepare(`
      SELECT * FROM reminders
      WHERE entity_type = ? AND entity_id = ? AND created_by = ? AND dismissed = 0
      ORDER BY remind_at ASC
    `).all(entityType, entityId, userId);

    res.json({ data: rows });
  } catch (err) {
    log.error('Error setting reminders:', err.message);
    res.status(500).json({ error: 'Internal error.', code: 500 });
  }
});

// --------------------------------------------------------
// PATCH /api/v1/reminders/:id/dismiss
// Markiert eine Erinnerung als verworfen.
// Response: { data: { id } }
// --------------------------------------------------------
router.patch('/:id/dismiss', (req, res) => {
  try {
    const userId     = req.authUserId || req.session.userId;
    const reminderId = parseInt(req.params.id, 10);

    if (!reminderId) {
      return res.status(400).json({ error: 'Ungültige Erinnerungs-ID.', code: 400 });
    }

    const reminder = db.get().prepare(
      'SELECT * FROM reminders WHERE id = ? AND created_by = ?'
    ).get(reminderId, userId);

    if (!reminder) {
      return res.status(404).json({ error: 'Erinnerung nicht gefunden.', code: 404 });
    }

    db.get().prepare('UPDATE reminders SET dismissed = 1 WHERE id = ?').run(reminderId);
    res.json({ data: { id: reminderId } });
  } catch (err) {
    log.error('Error dismissing reminder:', err.message);
    res.status(500).json({ error: 'Internal error.', code: 500 });
  }
});

// --------------------------------------------------------
// DELETE /api/v1/reminders/:id
// Löscht eine Erinnerung dauerhaft.
// Response: 204 No Content
// --------------------------------------------------------
router.delete('/:id', (req, res) => {
  try {
    const userId     = req.authUserId || req.session.userId;
    const reminderId = parseInt(req.params.id, 10);

    if (!reminderId) {
      return res.status(400).json({ error: 'Ungültige Erinnerungs-ID.', code: 400 });
    }

    const reminder = db.get().prepare(
      'SELECT id FROM reminders WHERE id = ? AND created_by = ?'
    ).get(reminderId, userId);

    if (!reminder) {
      return res.status(404).json({ error: 'Erinnerung nicht gefunden.', code: 404 });
    }

    db.get().prepare('DELETE FROM reminders WHERE id = ?').run(reminderId);
    res.status(204).end();
  } catch (err) {
    log.error('Error deleting reminder:', err.message);
    res.status(500).json({ error: 'Internal error.', code: 500 });
  }
});

// --------------------------------------------------------
// DELETE /api/v1/reminders?entity_type=task&entity_id=5
// Löscht alle Erinnerungen für eine Entität (z.B. bei Task-Löschung).
// Response: 204 No Content
// --------------------------------------------------------
router.delete('/', (req, res) => {
  try {
    const userId     = req.authUserId || req.session.userId;
    const entityType = req.query.entity_type;
    const entityId   = parseInt(req.query.entity_id, 10);

    if (!VALID_ENTITY_TYPES.includes(entityType) || !entityId) {
      return res.status(400).json({ error: 'entity_type und entity_id sind erforderlich.', code: 400 });
    }

    db.get().prepare(`
      DELETE FROM reminders
      WHERE entity_type = ? AND entity_id = ? AND created_by = ?
    `).run(entityType, entityId, userId);

    res.status(204).end();
  } catch (err) {
    log.error('Error deleting reminders:', err.message);
    res.status(500).json({ error: 'Internal error.', code: 500 });
  }
});

export default router;
