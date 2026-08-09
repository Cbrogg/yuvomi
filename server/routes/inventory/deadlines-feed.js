/**
 * Modul: Inventar-Garantiefristen-Feed — Verwaltung
 * Zweck: Status/Regenerieren/Deaktivieren des Feed-Tokens. Der eigentliche
 *        ICS-Inhalt wird unauthentifiziert außerhalb von /api/v1 ausgeliefert
 *        (siehe server/index.js), spiegelt server/routes/calendar/feed.js.
 */

import express from 'express';
import * as db from '../../db.js';
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
router.get('/', (req, res) => {
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
router.post('/regenerate', (req, res) => {
  try {
    const token = deadlinesIcs.regenerateFeedToken(db.get());
    res.json({ data: { token, url: feedUrl(req, token) } });
  } catch (err) {
    log.error('POST /deadlines-feed/regenerate error:', err);
    res.status(500).json({ error: 'Internal server error.', code: 500 });
  }
});

// DELETE /api/v1/inventory/deadlines-feed → Feed deaktivieren
router.delete('/', (req, res) => {
  try {
    deadlinesIcs.clearFeedToken(db.get());
    res.json({ data: { token: null } });
  } catch (err) {
    log.error('DELETE /deadlines-feed error:', err);
    res.status(500).json({ error: 'Internal server error.', code: 500 });
  }
});

export default router;
