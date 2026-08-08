/**
 * Modul: Inventar – geteilte Routen-Helfer
 * Zweck: Slug/Key-Erzeugung fuer Kategorien (Budget-Kategorien nutzen dasselbe
 *        Muster in server/routes/budget/helpers.js - hier lokal nachgebaut statt
 *        modulfremd importiert, damit Inventar nicht von Budgets Routen-Internas
 *        abhaengt).
 */

export function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48) || 'category';
}
