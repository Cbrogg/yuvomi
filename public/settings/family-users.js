/**
 * Modul: Familienmitglieder fuer Settings-Blaetter
 * Zweck: Die Mitgliederliste einmal je Seitenaufruf laden, fuer die
 *        Zuweisungs-Auswahlfelder der Sync-Blaetter.
 *
 * Liegt hier statt in einem der Blaetter, seit die Kalender-Abos aus
 * `sync-calendar` ausgezogen sind und beide Seiten dieselbe Liste brauchen.
 * Zwei Kopien haetten zwei Zwischenspeicher bedeutet - und damit zwei
 * Abfragen fuer dieselbe Antwort, sobald jemand zwischen den Blaettern wechselt.
 *
 * Nur Erfolge werden behalten: ein voruebergehender Fehler darf nicht die ganze
 * Sitzung mit leeren Auswahlfeldern zementieren.
 */

import { api } from '/api.js';

let cached = null;

export async function loadFamilyUsers() {
  if (cached) return cached;
  try {
    cached = (await api.get('/auth/users')).data ?? [];
    return cached;
  } catch {
    return [];
  }
}
