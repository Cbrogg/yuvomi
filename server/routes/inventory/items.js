/**
 * Modul: Inventar – Gegenstaende
 * Zweck: CRUD + Liste. Stufe 1 - keine Buchungs-/Dokument-/Abo-Verknuepfung,
 *        die kommen in spaeteren Stufen als eigene Routen dazu.
 *
 * Kein Eigentuemer-Gate: Inventar ist Haushaltseigentum wie der Vorrat.
 * created_by bleibt als Herkunftsnachweis (nullable, ON DELETE SET NULL).
 */

import express from 'express';
import * as db from '../../db.js';
import { createLogger } from '../../logger.js';
import {
  str, oneOf, num, date, id as idParam, collectErrors, MAX_TITLE, MAX_TEXT, MAX_SHORT,
} from '../../middleware/validate.js';
import { documentLinksFor, loadDocumentLinks, replaceDocumentLinks } from '../../services/document-links.js';

const log = createLogger('Inventory');
const router = express.Router();

const CONDITIONS = ['new', 'good', 'fair', 'poor'];
const STATUSES = ['active', 'sold', 'disposed', 'lost'];
const CURRENCY_RE = /^[A-Z]{3}$/;
const DOCS = { table: 'inventory_item_documents', ownerColumn: 'item_id' };

/** Gleiches Muster wie server/routes/subscriptions.js#budgetCurrency(). */
function householdCurrency() {
  return db.get().prepare("SELECT value FROM sync_config WHERE key = 'currency'").get()?.value || 'EUR';
}

function validCategoryKeys() {
  return db.get().prepare('SELECT key FROM inventory_categories').all().map((r) => r.key);
}

/**
 * Ortspfad fuer die Anzeige, z. B. "Keller · Regal 2" fuer einen Unterort,
 * "Garage" fuer einen Top-Ebene-Ort. NULL fuer ortlose Gegenstaende.
 */
function locationPath(locationId) {
  if (locationId == null) return null;
  const loc = db.get().prepare('SELECT * FROM inventory_locations WHERE id = ?').get(locationId);
  if (!loc) return null;
  if (loc.parent_id == null) return loc.name;
  const parent = db.get().prepare('SELECT name FROM inventory_locations WHERE id = ?').get(loc.parent_id);
  return parent ? `${parent.name} · ${loc.name}` : loc.name;
}

function loadItem(id, userId) {
  const item = db.get().prepare('SELECT * FROM inventory_items WHERE id = ?').get(id);
  if (!item) return null;
  const category = db.get().prepare('SELECT name, icon FROM inventory_categories WHERE key = ?').get(item.category);
  return {
    ...item,
    category_name: category?.name ?? item.category,
    category_icon: category?.icon ?? 'package',
    location_path: locationPath(item.location_id),
    attachments: documentLinksFor(db.get(), { ...DOCS, ownerId: item.id, userId }),
  };
}

function loadItems({ category, locationId, status, q } = {}, userId) {
  const clauses = [];
  const params = [];
  if (category !== undefined) { clauses.push('ii.category = ?'); params.push(category); }
  if (locationId !== undefined) { clauses.push('ii.location_id = ?'); params.push(locationId); }
  if (status !== undefined) { clauses.push('ii.status = ?'); params.push(status); }
  if (q) {
    clauses.push('(ii.name LIKE ? OR ii.brand LIKE ? OR ii.model LIKE ? OR ii.serial_number LIKE ?)');
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db.get().prepare(`
    SELECT ii.*, ic.name AS category_name, ic.icon AS category_icon
    FROM inventory_items ii
    LEFT JOIN inventory_categories ic ON ic.key = ii.category
    ${where}
    ORDER BY ii.name COLLATE NOCASE ASC
  `).all(...params);
  const byItem = loadDocumentLinks(db.get(), { ...DOCS, ownerIds: rows.map((r) => r.id), userId });
  return rows.map((row) => ({
    ...row,
    location_path: locationPath(row.location_id),
    attachments: byItem.get(row.id) || [],
  }));
}

/**
 * Validiert die Felder eines Gegenstands fuer ein volles Replace (POST wie PUT
 * identisch). Ein weggelassenes Feld wird NULL/Default - kein Feld behaelt den
 * Altwert (siehe die erste, einfachere Inventar-Version dieses Projekts, wo genau
 * diese Inkonsistenz per Review-Fund korrigiert werden musste).
 */
function validateItemFields(body) {
  const values = {};
  const results = [];

  const vName = str(body.name, 'Name', { max: MAX_TITLE });
  results.push(vName);
  values.name = vName.value;

  const vBrand = str(body.brand, 'Marke', { max: MAX_SHORT, required: false });
  results.push(vBrand);
  values.brand = vBrand.value;

  const vModel = str(body.model, 'Modell', { max: MAX_SHORT, required: false });
  results.push(vModel);
  values.model = vModel.value;

  const vSerial = str(body.serial_number, 'Seriennummer', { max: MAX_SHORT, required: false });
  results.push(vSerial);
  values.serial_number = vSerial.value;

  const categoryKeys = validCategoryKeys();
  const vCategory = oneOf(body.category || 'other', categoryKeys, 'Kategorie');
  results.push(vCategory);
  values.category = vCategory.value ?? 'other';

  if (body.location_id === null || body.location_id === '' || body.location_id === undefined) {
    values.location_id = null;
  } else {
    const vLoc = idParam(body.location_id, 'Ort');
    results.push(vLoc);
    if (vLoc.value !== null) {
      const exists = db.get().prepare('SELECT id FROM inventory_locations WHERE id = ?').get(vLoc.value);
      if (!exists) results.push({ error: 'Location not found.' });
    }
    values.location_id = vLoc.value;
  }

  const vPurchaseDate = date(body.purchase_date, 'Kaufdatum');
  results.push(vPurchaseDate);
  values.purchase_date = vPurchaseDate.value;

  if (body.purchase_price === null || body.purchase_price === '' || body.purchase_price === undefined) {
    values.purchase_price = null;
  } else {
    const vPrice = num(body.purchase_price, 'Kaufpreis');
    results.push(vPrice);
    if (vPrice.value !== null && vPrice.value < 0) results.push({ error: 'Kaufpreis darf nicht negativ sein.' });
    values.purchase_price = vPrice.value;
  }

  if (body.current_value === null || body.current_value === '' || body.current_value === undefined) {
    values.current_value = null;
  } else {
    const vValue = num(body.current_value, 'Zeitwert');
    results.push(vValue);
    if (vValue.value !== null && vValue.value < 0) results.push({ error: 'Zeitwert darf nicht negativ sein.' });
    values.current_value = vValue.value;
  }

  if (body.currency === null || body.currency === '' || body.currency === undefined) {
    values.currency = householdCurrency();
  } else {
    const currency = String(body.currency).toUpperCase();
    if (!CURRENCY_RE.test(currency)) results.push({ error: 'Currency must be a three-letter ISO code.' });
    values.currency = currency;
  }

  const vVendor = str(body.vendor, 'Haendler', { max: MAX_SHORT, required: false });
  results.push(vVendor);
  values.vendor = vVendor.value;

  if (body.warranty_months === null || body.warranty_months === '' || body.warranty_months === undefined) {
    values.warranty_months = null;
  } else {
    const vWarranty = num(body.warranty_months, 'Garantiemonate');
    results.push(vWarranty);
    if (vWarranty.value !== null && (!Number.isInteger(vWarranty.value) || vWarranty.value < 0 || vWarranty.value > 600)) {
      results.push({ error: 'Garantiemonate muss eine ganze Zahl zwischen 0 und 600 sein.' });
    }
    values.warranty_months = vWarranty.value;
  }

  const vCondition = oneOf(body.condition || 'good', CONDITIONS, 'Zustand');
  results.push(vCondition);
  values.condition = vCondition.value ?? 'good';

  const vStatus = oneOf(body.status || 'active', STATUSES, 'Status');
  results.push(vStatus);
  values.status = vStatus.value ?? 'active';

  const vNotes = str(body.notes, 'Notiz', { max: MAX_TEXT, required: false });
  results.push(vNotes);
  values.notes = vNotes.value;

  return { values, errors: collectErrors(results) };
}

// --------------------------------------------------------
// GET /api/v1/inventory/items   Query: ?category=&location_id=&status=&q=
// --------------------------------------------------------
router.get('/', (req, res) => {
  try {
    const category = typeof req.query.category === 'string' && req.query.category ? req.query.category : undefined;
    let locationId;
    if (req.query.location_id !== undefined) {
      const n = parseInt(req.query.location_id, 10);
      if (!n || n < 1) return res.status(400).json({ error: 'location_id must be a positive number.', code: 400 });
      locationId = n;
    }
    const status = typeof req.query.status === 'string' && STATUSES.includes(req.query.status) ? req.query.status : undefined;
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : undefined;
    const userId = req.authUserId || req.session.userId;

    res.json({ data: loadItems({ category, locationId, status, q }, userId) });
  } catch (err) {
    log.error('GET / error:', err);
    res.status(500).json({ error: 'Internal server error.', code: 500 });
  }
});

// --------------------------------------------------------
// GET /api/v1/inventory/items/:id
// --------------------------------------------------------
router.get('/:id', (req, res) => {
  try {
    const vId = idParam(req.params.id, 'Gegenstand-ID');
    if (vId.error) return res.status(400).json({ error: vId.error, code: 400 });
    const userId = req.authUserId || req.session.userId;
    const item = loadItem(vId.value, userId);
    if (!item) return res.status(404).json({ error: 'Item not found.', code: 404 });
    res.json({ data: item });
  } catch (err) {
    log.error('GET /:id error:', err);
    res.status(500).json({ error: 'Internal server error.', code: 500 });
  }
});

// --------------------------------------------------------
// POST /api/v1/inventory/items
// --------------------------------------------------------
router.post('/', (req, res) => {
  try {
    const { values, errors } = validateItemFields(req.body);
    if (errors.length) return res.status(400).json({ error: errors.join(' '), code: 400 });

    const userId = req.authUserId || req.session.userId;
    const result = db.get().prepare(`
      INSERT INTO inventory_items
        (name, brand, model, serial_number, category, location_id, purchase_date,
         purchase_price, current_value, currency, vendor, warranty_months, condition,
         status, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      values.name, values.brand, values.model, values.serial_number, values.category,
      values.location_id, values.purchase_date, values.purchase_price, values.current_value,
      values.currency, values.vendor, values.warranty_months, values.condition, values.status,
      values.notes, userId,
    );

    // Belege sind optional, deshalb erst nach dem Insert - der Gegenstand
    // steht auch ohne sie, ein unbekanntes Dokument darf ihn nicht scheitern lassen.
    replaceDocumentLinks(db.get(), {
      ...DOCS, ownerId: result.lastInsertRowid, documentIds: req.body.attachment_document_ids, userId,
    });

    res.status(201).json({ data: loadItem(result.lastInsertRowid, userId) });
  } catch (err) {
    log.error('POST / error:', err);
    res.status(500).json({ error: 'Internal server error.', code: 500 });
  }
});

// --------------------------------------------------------
// PUT /api/v1/inventory/items/:id   Volles Replace, siehe Kommentar oben.
// --------------------------------------------------------
router.put('/:id', (req, res) => {
  try {
    const vId = idParam(req.params.id, 'Gegenstand-ID');
    if (vId.error) return res.status(400).json({ error: vId.error, code: 400 });
    const item = db.get().prepare('SELECT id FROM inventory_items WHERE id = ?').get(vId.value);
    if (!item) return res.status(404).json({ error: 'Item not found.', code: 404 });

    const { values, errors } = validateItemFields(req.body);
    if (errors.length) return res.status(400).json({ error: errors.join(' '), code: 400 });

    db.get().prepare(`
      UPDATE inventory_items
      SET name = ?, brand = ?, model = ?, serial_number = ?, category = ?, location_id = ?,
          purchase_date = ?, purchase_price = ?, current_value = ?, currency = ?, vendor = ?,
          warranty_months = ?, condition = ?, status = ?, notes = ?
      WHERE id = ?
    `).run(
      values.name, values.brand, values.model, values.serial_number, values.category,
      values.location_id, values.purchase_date, values.purchase_price, values.current_value,
      values.currency, values.vendor, values.warranty_months, values.condition, values.status,
      values.notes, item.id,
    );

    const userId = req.authUserId || req.session.userId;
    // Belege nur anfassen, wenn das Feld mitkommt - ein PUT, das nur einen
    // Wert korrigiert, darf angehaengte Belege nicht stillschweigend abraeumen
    // (gleiches Muster wie server/routes/budget/entries.js#PUT /:id).
    if (req.body.attachment_document_ids !== undefined) {
      replaceDocumentLinks(db.get(), {
        ...DOCS, ownerId: item.id, documentIds: req.body.attachment_document_ids, userId,
      });
    }

    res.json({ data: loadItem(item.id, userId) });
  } catch (err) {
    log.error('PUT /:id error:', err);
    res.status(500).json({ error: 'Internal server error.', code: 500 });
  }
});

// --------------------------------------------------------
// DELETE /api/v1/inventory/items/:id
// --------------------------------------------------------
router.delete('/:id', (req, res) => {
  try {
    const vId = idParam(req.params.id, 'Gegenstand-ID');
    if (vId.error) return res.status(400).json({ error: vId.error, code: 400 });
    const result = db.get().prepare('DELETE FROM inventory_items WHERE id = ?').run(vId.value);
    if (result.changes === 0) return res.status(404).json({ error: 'Item not found.', code: 404 });
    res.status(204).end();
  } catch (err) {
    log.error('DELETE /:id error:', err);
    res.status(500).json({ error: 'Internal server error.', code: 500 });
  }
});

export default router;
