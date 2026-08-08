/**
 * Modul: Inventar (Inventory)
 * Zweck: Besitz erfassen - Ort, Kategorie, Kaufpreis, Zeitwert, Fristen (Stufe 1:
 *        kein Verknuepfen mit Buchungen/Dokumenten/Abos, das kommt in spaeteren
 *        Stufen). Orte (zwei Ebenen) und Kategorien werden ueber dieselbe
 *        yuvomi-category-manager-Komponente verwaltet, die Budget fuer seine
 *        Kategorien/Unterkategorien nutzt.
 */

import { api } from '/api.js';
import { t } from '/i18n.js';
import { esc } from '/utils/html.js';
import { openModal as openSharedModal } from '/components/modal.js';
import { renderSkeletonList } from '/utils/skeleton.js';
import { emptyStateEl } from '/utils/empty-state.js';

let _container = null;

const state = {
  items: [],
  locations: [],
  categories: [],
  query: '',
};

async function loadLocations() {
  const res = await api.get('/inventory/locations');
  state.locations = res.data;
}

async function loadCategories() {
  const res = await api.get('/inventory/categories');
  state.categories = res.data;
}

// --------------------------------------------------------
// Ort-Verwaltung (zwei Ebenen ueber dieselbe Komponente wie Budget-Kategorien)
// --------------------------------------------------------
async function openLocationManager() {
  await import('/components/category-manager.js');

  let changed = false;
  const onChanged = async () => { changed = true; try { await loadLocations(); } catch { /* Fehler meldet der Manager selbst */ } };

  let manager = null;
  openSharedModal({
    title: t('inventory.manageLocations'),
    size: 'lg',
    content: '<yuvomi-category-manager></yuvomi-category-manager>',
    onSave: (panel) => {
      manager = panel.querySelector('yuvomi-category-manager');
      manager.addEventListener('category-manager-changed', onChanged);
      manager.configure({
        basePath: '/inventory/locations',
        groups: [{ key: '', labelKey: '', addLabelKey: 'inventory.addLocation', subcategories: true }],
        supportsSubcategories: true,
        titleKey: 'inventory.manageLocations',
        hintKey: 'inventory.manageLocationsHint',
        addPlaceholderKey: 'inventory.addLocation',
        deleteDetailKey: 'inventory.locationDeleteConfirmDetail',
        subDeleteDetailKey: 'inventory.locationDeleteConfirmDetail',
      });
    },
    onClose: () => {
      manager?.removeEventListener('category-manager-changed', onChanged);
      manager = null;
      if (changed && typeof renderList === 'function') renderList();
    },
  });
}

// --------------------------------------------------------
// Kategorie-Verwaltung (flach, keine Unterebene)
// --------------------------------------------------------
async function openCategoryManager() {
  await import('/components/category-manager.js');

  let changed = false;
  const onChanged = async () => { changed = true; try { await loadCategories(); } catch { /* Fehler meldet der Manager selbst */ } };

  let manager = null;
  openSharedModal({
    title: t('inventory.manageCategories'),
    content: '<yuvomi-category-manager></yuvomi-category-manager>',
    onSave: (panel) => {
      manager = panel.querySelector('yuvomi-category-manager');
      manager.addEventListener('category-manager-changed', onChanged);
      manager.configure({
        basePath: '/inventory/categories',
        groups: [{ key: '', labelKey: '', addLabelKey: 'inventory.addCategory' }],
        titleKey: 'inventory.manageCategories',
        hintKey: 'inventory.manageCategoriesHint',
        addPlaceholderKey: 'inventory.addCategory',
        deleteDetailKey: 'inventory.categoryDeleteConfirmDetail',
      });
    },
    onClose: () => {
      manager?.removeEventListener('category-manager-changed', onChanged);
      manager = null;
      if (changed && typeof renderList === 'function') renderList();
    },
  });
}

// --------------------------------------------------------
// Seiten-Grundgeruest (Task 11 ergaenzt renderList()/das Formular)
// --------------------------------------------------------

function renderList() {
  const list = _container?.querySelector('#inventory-list');
  if (!list) return;
  // Platzhalter bis Task 11: zeigt vorlaeufig nur die Anzahl geladener
  // Gegenstaende, damit dieser Task fuer sich testbar ist, ohne das Listen-UI
  // vorwegzunehmen.
  list.replaceChildren(emptyStateEl({
    title: t('inventory.emptyTitle'),
    description: `${state.items.length} item(s) loaded`,
  }));
}

export async function render(container) {
  _container = container;

  const page = document.createElement('div');
  page.className = 'inventory-page';

  const title = document.createElement('h1');
  title.className = 'sr-only';
  title.textContent = t('nav.inventory');

  const toolbar = document.createElement('div');
  toolbar.className = 'page-toolbar page-toolbar--narrow';
  toolbar.insertAdjacentHTML('beforeend', `
    <div class="page-toolbar__actions">
      <button class="btn btn--ghost btn--icon" data-action="manage-locations"
              aria-label="${esc(t('inventory.manageLocations'))}" title="${esc(t('inventory.manageLocations'))}">
        <i data-lucide="map-pin" class="icon-md" aria-hidden="true"></i>
      </button>
      <button class="btn btn--ghost btn--icon" data-action="manage-categories"
              aria-label="${esc(t('inventory.manageCategories'))}" title="${esc(t('inventory.manageCategories'))}">
        <i data-lucide="tags" class="icon-md" aria-hidden="true"></i>
      </button>
    </div>`);

  const list = document.createElement('div');
  list.className = 'inventory-list';
  list.id = 'inventory-list';
  list.insertAdjacentHTML('beforeend', renderSkeletonList({ rows: 4, lines: 2 }));

  page.append(title, toolbar, list);
  container.replaceChildren(page);

  if (window.lucide) window.lucide.createIcons({ el: container });

  toolbar.querySelector('[data-action="manage-locations"]').addEventListener('click', openLocationManager);
  toolbar.querySelector('[data-action="manage-categories"]').addEventListener('click', openCategoryManager);

  try {
    await Promise.all([loadLocations(), loadCategories()]);
    renderList();
  } catch (err) {
    window.yuvomi?.showToast(err.data?.error ?? t('common.errorGeneric'), 'danger');
    list.replaceChildren();
  }
}
