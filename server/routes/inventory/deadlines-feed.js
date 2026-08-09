/**
 * Modul: Inventar-Garantiefristen-Feed — Verwaltung
 * Zweck: Status/Regenerieren/Deaktivieren des Feed-Tokens. Der eigentliche
 *        ICS-Inhalt wird unauthentifiziert außerhalb von /api/v1 ausgeliefert
 *        (siehe server/index.js), spiegelt server/routes/calendar/feed.js.
 *
 * Alle drei Routen sind admin-only, wie jede andere haushaltweite
 * Integrations-Route (server/routes/calendar/caldav.js, google.js, apple.js):
 * das Token in sync_config ist ein einzelnes Haushalts-Artefakt, und seine
 * Oberflaeche (public/settings/pages/sync-calendar.js) ist ohnehin admin-only
 * registriert. Ohne die Gate koennte jedes Mitglied mit Inventar-Schreibrecht
 * die Feed-URL ueber die rohe API erzeugen, rotieren oder abschalten.
 */

import express from 'express';
import * as db from '../../db.js';
// Aus middleware/ statt aus auth.js (das dieselbe Funktion weiterexportiert):
// dieses Modul ist seiteneffektfrei, auth.js wirft beim Laden ohne
// SESSION_SECRET. Gleiche Wahl wie server/routes/health/caregivers.js.
import { requireAdmin } from '../../middleware/require-admin.js';
import { createLogger } from '../../logger.js';
import * as deadlinesIcs from '../../services/inventory-deadlines-ics.js';

const log = createLogger('Inventory');
const router = express.Router();

function feedUrl(req, token) {
  const base = process.env.BASE_URL?.replace(/\/+$/, '')
    || `${req.protocol}://${req.get('host')}`;
  return `${base}/feed/inventory-deadlines/${token}.ics`;
}

// GET /api/v1/inventory/deadlines-feed → aktueller Feed-Status
router.get('/', requireAdmin, (req, res) => {
  try {
    const token = deadlinesIcs.getFeedToken(db.get());
    if (!token) return res.json({ data: null });
    res.json({ data: { token, url: feedUrl(req, token) } });
  } catch (err) {
    log.error('GET /deadlines-feed error:', err);
    res.status(500).json({ error: 'Internal server error.', code: 500 });
  }
});

// POST /api/v1/inventory/deadlines-feed/regenerate → neuen Token erzeugen
router.post('/regenerate', requireAdmin, (req, res) => {
  try {
    const token = deadlinesIcs.regenerateFeedToken(db.get());
    res.json({ data: { token, url: feedUrl(req, token) } });
  } catch (err) {
    log.error('POST /deadlines-feed/regenerate error:', err);
    res.status(500).json({ error: 'Internal server error.', code: 500 });
  }
});

// DELETE /api/v1/inventory/deadlines-feed → Feed deaktivieren
router.delete('/', requireAdmin, (req, res) => {
  try {
    deadlinesIcs.clearFeedToken(db.get());
    res.json({ data: { token: null } });
  } catch (err) {
    log.error('DELETE /deadlines-feed error:', err);
    res.status(500).json({ error: 'Internal server error.', code: 500 });
  }
});

export default router;
