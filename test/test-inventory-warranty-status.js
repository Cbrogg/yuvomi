/**
 * Test: Inventar-Garantiestatus (Stufe 4)
 * Zweck: Die reine Ableitung, an der Listen-Icon und Formular-Statuszeile hängen -
 *        analog test/test-pantry-status.js. Fester Bezugstag, damit die
 *        Zusicherungen nicht mit dem Kalender kippen.
 * Ausführen: node --loader ./test/test-browser-loader.mjs --test test/test-inventory-warranty-status.js
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const {
  WARRANTY_ALERT_DAYS, warrantyEndDateKey, warrantyStatus, hasWarrantyAlert,
} = await import('../public/utils/inventory-warranty.js');

const TODAY = '2026-07-29';
const item = (over = {}) => ({ purchase_date: null, warranty_months: null, ...over });

test('ohne Kaufdatum oder Garantiemonate gibt es kein Enddatum', () => {
  assert.equal(warrantyEndDateKey(item()), null);
  assert.equal(warrantyEndDateKey(item({ purchase_date: '2026-01-01' })), null);
  assert.equal(warrantyEndDateKey(item({ warranty_months: 12 })), null);
});

test('warrantyEndDateKey addiert Monate mit Tages-Klemmung', () => {
  assert.equal(warrantyEndDateKey(item({ purchase_date: '2026-01-15', warranty_months: 24 })), '2028-01-15');
  assert.equal(warrantyEndDateKey(item({ purchase_date: '2026-01-31', warranty_months: 1 })), '2026-02-28');
});

test('warrantyStatus ohne Garantiedaten ist null', () => {
  assert.equal(warrantyStatus(item(), TODAY), null);
});

test('WARRANTY_ALERT_DAYS ist 30', () => {
  assert.equal(WARRANTY_ALERT_DAYS, 30);
});

test('warrantyStatus: valid weit in der Zukunft, expiring innerhalb 30 Tagen, expired in der Vergangenheit', () => {
  assert.equal(warrantyStatus(item({ purchase_date: '2026-01-01', warranty_months: 24 }), TODAY).state, 'valid');
  assert.equal(warrantyStatus(item({ purchase_date: '2026-07-01', warranty_months: 1 }), TODAY).state, 'expiring');
  assert.equal(warrantyStatus(item({ purchase_date: '2020-01-01', warranty_months: 12 }), TODAY).state, 'expired');
});

test('die expiring-Schwelle ist inklusiv und endet exakt nach WARRANTY_ALERT_DAYS', () => {
  // TODAY + 30 Tage = 2026-08-28 -> noch "expiring" (inklusive Grenze).
  const atThreshold = warrantyStatus(item({ purchase_date: '2026-02-28', warranty_months: 6 }), TODAY);
  assert.equal(atThreshold.endDateKey, '2026-08-28');
  assert.equal(atThreshold.days, 30);
  assert.equal(atThreshold.state, 'expiring');

  // TODAY + 31 Tage = 2026-08-29 -> schon "valid" (einen Tag jenseits der Grenze).
  const pastThreshold = warrantyStatus(item({ purchase_date: '2026-01-29', warranty_months: 7 }), TODAY);
  assert.equal(pastThreshold.endDateKey, '2026-08-29');
  assert.equal(pastThreshold.days, 31);
  assert.equal(pastThreshold.state, 'valid');
});

test('hasWarrantyAlert ist false für valid, true für expiring/expired', () => {
  assert.equal(hasWarrantyAlert(item({ purchase_date: '2026-01-01', warranty_months: 24 }), TODAY), false);
  assert.equal(hasWarrantyAlert(item({ purchase_date: '2026-07-01', warranty_months: 1 }), TODAY), true);
  assert.equal(hasWarrantyAlert(item({ purchase_date: '2020-01-01', warranty_months: 12 }), TODAY), true);
  assert.equal(hasWarrantyAlert(item(), TODAY), false);
});
