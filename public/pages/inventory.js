/**
 * Modul: Inventar (Inventory)
 * Zweck: Besitz erfassen - Ort, Kategorie, Kaufpreis, Zeitwert, Fristen (Stufe 1:
 *        kein Verknuepfen mit Buchungen/Dokumenten/Abos, das kommt in spaeteren
 *        Stufen). Orte (zwei Ebenen) und Kategorien werden ueber dieselbe
 *        yuvomi-category-manager-Komponente verwaltet, die Budget fuer seine
 *        Kategorien/Unterkategorien nutzt.
 */

import { api } from '/api.js';
import { t, formatDate } from '/i18n.js';
import { esc } from '/utils/html.js';
import {
  openModal as openSharedModal,
  closeModal as closeSharedModal,
  advancedSection,
  wireBlurValidation,
  reportFieldError,
  confirmModal,
} from '/components/modal.js';
import { renderSkeletonList } from '/utils/skeleton.js';
import { emptyStateEl } from '/utils/empty-state.js';
import { renderPageSearch, wirePageSearch } from '/utils/page-search.js';
import { formatMoney } from '/utils/money.js';

let _container = null;
let _search = null;

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
// Gegenstands-Liste
// --------------------------------------------------------

function categoryLabel(key) {
  return state.categories.find((c) => c.key === key)?.name ?? key;
}

function statusLabel(status) {
  return t(`inventory.status${status.charAt(0).toUpperCase()}${status.slice(1)}`);
}

function matchesQuery(item) {
  if (!state.query) return true;
  const q = state.query.toLowerCase();
  return [item.name, item.brand, item.model, item.serial_number]
    .some((v) => v && String(v).toLowerCase().includes(q));
}

function renderItemRow(item) {
  return `
    <div class="inventory-item-row" data-id="${item.id}" role="button" tabindex="0">
      <div class="inventory-item-row__name">${esc(item.name)}</div>
      <div class="inventory-item-row__category">${esc(item.category_name)}</div>
      <div class="inventory-item-row__location">${item.location_path ? esc(item.location_path) : ''}</div>
      <span class="inventory-status-badge inventory-status-badge--${esc(item.status)}">${esc(statusLabel(item.status))}</span>
      <span class="inventory-item-row__value">${esc(formatMoney(item.current_value, item.currency))}</span>
    </div>`;
}

function renderList() {
  const list = _container?.querySelector('#inventory-list');
  if (!list) return;

  if (!state.items.length) {
    list.replaceChildren(emptyStateEl({
      title: t('inventory.emptyTitle'),
      description: t('inventory.emptyDescription'),
      action: { label: t('inventory.addItem'), icon: 'plus', onClick: () => openItemModal('create') },
    }));
    return;
  }

  const filtered = state.items.filter(matchesQuery);
  if (!filtered.length) {
    list.replaceChildren(emptyStateEl({
      variant: 'no-results',
      title: t('inventory.noResultsTitle'),
      description: t('inventory.noResultsDescription'),
      action: { label: t('inventory.resetSearch'), onClick: () => { state.query = ''; _search?.clear(); renderList(); } },
    }));
    return;
  }

  list.replaceChildren();
  list.insertAdjacentHTML('beforeend', filtered.map(renderItemRow).join(''));

  list.querySelectorAll('.inventory-item-row').forEach((row) => {
    const open = () => {
      const item = state.items.find((i) => i.id === Number(row.dataset.id));
      if (item) openItemModal('edit', item);
    };
    row.addEventListener('click', open);
    row.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
  });

  if (window.lucide) window.lucide.createIcons({ el: list });
}

async function loadItems() {
  const res = await api.get('/inventory/items');
  state.items = res.data;
}

// --------------------------------------------------------
// Gegenstands-Formular (Anlegen/Bearbeiten - dient in Stufe 1 auch als
// De-facto-Detailansicht, es gibt keine separate Nur-Lese-Ansicht)
// --------------------------------------------------------

const CONDITIONS = ['new', 'good', 'fair', 'poor'];
const STATUSES = ['active', 'sold', 'disposed', 'lost'];

function openItemModal(mode, item = null) {
  const isEdit = mode === 'edit';

  const categoryOptions = state.categories
    .map((c) => `<option value="${esc(c.key)}">${esc(c.name)}</option>`).join('');
  const locationOptions = [`<option value="">${esc(t('inventory.unlocated'))}</option>`];
  for (const root of state.locations) {
    locationOptions.push(`<option value="${root.id}">${esc(root.name)}</option>`);
    for (const child of root.subcategories || []) {
      locationOptions.push(`<option value="${child.id}">${esc(root.name)} · ${esc(child.name)}</option>`);
    }
  }
  const conditionOptions = CONDITIONS.map((c) => `<option value="${c}">${esc(t(`inventory.condition${c.charAt(0).toUpperCase()}${c.slice(1)}`))}</option>`).join('');
  const statusOptions = STATUSES.map((s) => `<option value="${s}">${esc(t(`inventory.status${s.charAt(0).toUpperCase()}${s.slice(1)}`))}</option>`).join('');

  openSharedModal({
    title: isEdit ? t('common.editItem') : t('inventory.addItem'),
    size: 'md',
    content: `
      <div class="form-group">
        <label class="form-label" for="inv-name">${esc(t('common.nameLabel'))}</label>
        <input id="inv-name" class="form-input" type="text" required placeholder="${esc(t('inventory.namePlaceholder'))}">
      </div>
      <div class="pantry-form-row">
        <div class="form-group">
          <label class="form-label" for="inv-category">${esc(t('inventory.categoryLabel'))}</label>
          <select id="inv-category" class="form-input">${categoryOptions}</select>
        </div>
        <div class="form-group">
          <label class="form-label" for="inv-location">${esc(t('inventory.locationLabel'))}</label>
          <select id="inv-location" class="form-input">${locationOptions.join('')}</select>
        </div>
      </div>
      <div class="pantry-form-row">
        <div class="form-group">
          <label class="form-label" for="inv-purchase-date">${esc(t('inventory.purchaseDateLabel'))}</label>
          <yuvomi-datepicker id="inv-purchase-date" type="date"
                             value="${esc(isEdit && item.purchase_date ? item.purchase_date : '')}"></yuvomi-datepicker>
        </div>
        <div class="form-group">
          <label class="form-label" for="inv-purchase-price">${esc(t('inventory.purchasePriceLabel'))}</label>
          <input id="inv-purchase-price" class="form-input" type="number" min="0" step="0.01" inputmode="decimal">
        </div>
      </div>
      <div class="pantry-form-row">
        <div class="form-group">
          <label class="form-label" for="inv-current-value">${esc(t('inventory.currentValueLabel'))}</label>
          <input id="inv-current-value" class="form-input" type="number" min="0" step="0.01" inputmode="decimal">
          <p class="form-hint">${esc(t('inventory.currentValueHint'))}</p>
        </div>
        <div class="form-group">
          <label class="form-label" for="inv-status">${esc(t('inventory.statusLabel'))}</label>
          <select id="inv-status" class="form-input">${statusOptions}</select>
        </div>
      </div>
      ${advancedSection(`
        <div class="pantry-form-row">
          <div class="form-group">
            <label class="form-label" for="inv-brand">${esc(t('inventory.brandLabel'))}</label>
            <input id="inv-brand" class="form-input" type="text">
          </div>
          <div class="form-group">
            <label class="form-label" for="inv-model">${esc(t('inventory.modelLabel'))}</label>
            <input id="inv-model" class="form-input" type="text">
          </div>
        </div>
        <div class="pantry-form-row">
          <div class="form-group">
            <label class="form-label" for="inv-serial">${esc(t('inventory.serialNumberLabel'))}</label>
            <input id="inv-serial" class="form-input" type="text">
          </div>
          <div class="form-group">
            <label class="form-label" for="inv-vendor">${esc(t('inventory.vendorLabel'))}</label>
            <input id="inv-vendor" class="form-input" type="text">
          </div>
        </div>
        <div class="pantry-form-row">
          <div class="form-group">
            <label class="form-label" for="inv-warranty">${esc(t('inventory.warrantyMonthsLabel'))}</label>
            <input id="inv-warranty" class="form-input" type="number" min="0" max="600" step="1" inputmode="numeric">
          </div>
          <div class="form-group">
            <label class="form-label" for="inv-condition">${esc(t('inventory.conditionLabel'))}</label>
            <select id="inv-condition" class="form-input">${conditionOptions}</select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label" for="inv-notes">${esc(t('inventory.notesLabel'))}</label>
          <textarea id="inv-notes" class="form-input" rows="3" placeholder="${esc(t('inventory.notesPlaceholder'))}"></textarea>
        </div>`,
      { open: isEdit && (!!item.brand || !!item.model || !!item.serial_number || !!item.notes) })}
      <div class="modal-panel__footer modal-panel__footer--plain">
        ${isEdit ? `<button type="button" class="btn btn--danger-ghost" id="inv-delete">${esc(t('common.delete'))}</button>` : ''}
        <button type="button" class="btn btn--secondary" data-action="close-modal">${esc(t('common.cancel'))}</button>
        <button type="button" class="btn btn--primary" id="inv-save">${esc(isEdit ? t('common.save') : t('common.add'))}</button>
      </div>`,
    onSave(panel) {
      panel.querySelector('#inv-name').value = isEdit ? item.name : '';
      panel.querySelector('#inv-category').value = isEdit ? item.category : 'other';
      panel.querySelector('#inv-location').value = isEdit && item.location_id ? String(item.location_id) : '';
      panel.querySelector('#inv-purchase-price').value = isEdit && item.purchase_price != null ? String(item.purchase_price) : '';
      panel.querySelector('#inv-current-value').value = isEdit && item.current_value != null ? String(item.current_value) : '';
      panel.querySelector('#inv-status').value = isEdit ? item.status : 'active';
      panel.querySelector('#inv-brand').value = isEdit && item.brand ? item.brand : '';
      panel.querySelector('#inv-model').value = isEdit && item.model ? item.model : '';
      panel.querySelector('#inv-serial').value = isEdit && item.serial_number ? item.serial_number : '';
      panel.querySelector('#inv-vendor').value = isEdit && item.vendor ? item.vendor : '';
      panel.querySelector('#inv-warranty').value = isEdit && item.warranty_months != null ? String(item.warranty_months) : '';
      panel.querySelector('#inv-condition').value = isEdit ? item.condition : 'good';
      panel.querySelector('#inv-notes').value = isEdit && item.notes ? item.notes : '';

      panel.querySelector('#inv-save').addEventListener('click', () => saveItem(panel, mode, item));
      panel.querySelector('#inv-delete')?.addEventListener('click', async () => {
        closeSharedModal({ force: true });
        await removeItem(item);
      });

      wireBlurValidation(panel);
      if (window.lucide) window.lucide.createIcons({ el: panel });
    },
  });
}

async function saveItem(panel, mode, item) {
  const saveBtn = panel.querySelector('#inv-save');
  const nameInput = panel.querySelector('#inv-name');
  const name = nameInput.value.trim();
  if (!name) { reportFieldError(nameInput, t('common.nameRequired')); return; }

  const priceRaw = panel.querySelector('#inv-purchase-price').value.trim();
  const valueRaw = panel.querySelector('#inv-current-value').value.trim();
  const warrantyRaw = panel.querySelector('#inv-warranty').value.trim();

  const payload = {
    name,
    category: panel.querySelector('#inv-category').value,
    location_id: panel.querySelector('#inv-location').value || null,
    purchase_date: panel.querySelector('#inv-purchase-date').value || null,
    purchase_price: priceRaw === '' ? null : Number(priceRaw),
    current_value: valueRaw === '' ? null : Number(valueRaw),
    status: panel.querySelector('#inv-status').value,
    brand: panel.querySelector('#inv-brand').value.trim() || null,
    model: panel.querySelector('#inv-model').value.trim() || null,
    serial_number: panel.querySelector('#inv-serial').value.trim() || null,
    vendor: panel.querySelector('#inv-vendor').value.trim() || null,
    warranty_months: warrantyRaw === '' ? null : Number(warrantyRaw),
    condition: panel.querySelector('#inv-condition').value,
    notes: panel.querySelector('#inv-notes').value.trim() || null,
  };

  saveBtn.disabled = true;
  try {
    if (mode === 'create') await api.post('/inventory/items', payload);
    else await api.put(`/inventory/items/${item.id}`, payload);
    await loadItems();
    closeSharedModal({ force: true });
    renderList();
    window.yuvomi?.showToast(mode === 'create' ? t('inventory.created') : t('inventory.updated'), 'success');
  } catch (err) {
    saveBtn.disabled = false;
    window.yuvomi?.showToast(err.data?.error ?? t('common.errorGeneric'), 'danger');
  }
}

async function removeItem(item) {
  const ok = await confirmModal(t('inventory.deleteConfirm', { name: item.name }), {
    danger: true,
    detail: t('inventory.deleteConfirmDetail'),
  });
  if (!ok) return;
  try {
    await api.delete(`/inventory/items/${item.id}`);
    await loadItems();
    renderList();
    window.yuvomi?.showToast(t('inventory.deleted'), 'success');
  } catch (err) {
    window.yuvomi?.showToast(err.data?.error ?? t('common.errorGeneric'), 'danger');
  }
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
  toolbar.insertAdjacentHTML('afterbegin', `
    <div class="page-toolbar__center">
      ${renderPageSearch({
        id: 'inventory-search',
        label: t('inventory.searchPlaceholder'),
        placeholder: t('inventory.searchPlaceholder'),
        value: state.query,
        clearLabel: t('common.searchClear'),
        className: 'inventory-search',
      })}
    </div>`);

  const list = document.createElement('div');
  list.className = 'inventory-list';
  list.id = 'inventory-list';
  list.insertAdjacentHTML('beforeend', renderSkeletonList({ rows: 4, lines: 2 }));

  const fab = document.createElement('button');
  fab.className = 'page-fab';
  fab.type = 'button';
  fab.setAttribute('aria-label', t('inventory.addItem'));
  fab.insertAdjacentHTML('beforeend', '<i data-lucide="plus" aria-hidden="true"></i>');

  page.append(title, toolbar, list, fab);
  container.replaceChildren(page);

  if (window.lucide) window.lucide.createIcons({ el: container });

  toolbar.querySelector('[data-action="manage-locations"]').addEventListener('click', openLocationManager);
  toolbar.querySelector('[data-action="manage-categories"]').addEventListener('click', openCategoryManager);

  _search = wirePageSearch(toolbar, {
    id: 'inventory-search',
    onQuery: (value) => { state.query = value.trim(); renderList(); },
  });
  fab.addEventListener('click', () => openItemModal('create'));

  try {
    await Promise.all([loadLocations(), loadCategories(), loadItems()]);
    renderList();
  } catch (err) {
    window.yuvomi?.showToast(err.data?.error ?? t('common.errorGeneric'), 'danger');
    list.replaceChildren();
  }
}
