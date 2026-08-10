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
import { formatDate, getLocale } from '/i18n.js';
import { renderDocumentAttachField, bindDocumentAttachField } from '/components/document-attach.js';
import { warrantyStatus, hasUpcomingDeadline, dateStatus } from '/utils/inventory-warranty.js';

let _container = null;
let _search = null;
let _householdCurrency = 'EUR';

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
    onClose: async () => {
      manager?.removeEventListener('category-manager-changed', onChanged);
      manager = null;
      if (changed) {
        // Loeschen einer Location NULLt location_id betroffener Items
        // server-seitig - die Liste muss neu geladen werden, sonst zeigt sie
        // veraltete location_path-Werte bis zum naechsten vollen Reload.
        await loadItems();
        renderList();
      }
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
    onClose: async () => {
      manager?.removeEventListener('category-manager-changed', onChanged);
      manager = null;
      if (changed) {
        // Loeschen einer Kategorie weist betroffene Items server-seitig
        // 'other' zu - die Liste muss neu geladen werden, sonst zeigt sie
        // veraltete category_name-Werte bis zum naechsten vollen Reload.
        await loadItems();
        renderList();
      }
    },
  });
}

// --------------------------------------------------------
// Gegenstands-Liste
// --------------------------------------------------------

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
  const hasAttachments = (item.attachments?.length ?? 0) > 0;
  const hasBookings = (item.linked_entries?.length ?? 0) > 0;
  const deadlineAlert = hasUpcomingDeadline(item);
  return `
    <div class="inventory-item-row" data-id="${item.id}" role="button" tabindex="0">
      <div class="inventory-item-row__name">
        <span class="inventory-item-row__name-text">${esc(item.name)}</span>
        ${hasAttachments ? `<i data-lucide="paperclip" class="icon-sm" aria-hidden="true"></i><span class="sr-only">${esc(t('inventory.hasAttachmentsLabel'))}</span>` : ''}
        ${hasBookings ? `<i data-lucide="receipt" class="icon-sm" aria-hidden="true"></i><span class="sr-only">${esc(t('inventory.hasBookingsLabel'))}</span>` : ''}
        ${deadlineAlert ? `<i data-lucide="shield-alert" class="icon-sm" aria-hidden="true"></i><span class="sr-only">${esc(t('inventory.warrantyAlertLabel'))}</span>` : ''}
      </div>
      <div class="inventory-item-row__category">${esc(item.category_name)}</div>
      <div class="inventory-item-row__location">${item.location_path ? esc(item.location_path) : ''}</div>
      <span class="inventory-status-badge inventory-status-badge--${esc(item.status)}">${esc(statusLabel(item.status))}</span>
      <span class="inventory-item-row__value">${item.current_value != null ? esc(formatMoney(item.current_value, item.currency)) : ''}</span>
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

// Muss mit server/routes/inventory/entry-links.js#ROLES uebereinstimmen.
const ROLES = ['purchase', 'refund', 'instalment', 'maintenance', 'accessory'];

// Muss mit server/routes/inventory/item-dates.js#MAX_TRACKED_DATES_PER_ITEM uebereinstimmen.
const MAX_TRACKED_DATES_PER_ITEM = 10;

function roleLabel(role) {
  return t(`inventory.role${role.charAt(0).toUpperCase()}${role.slice(1)}`);
}

// Lokale Kopien der gleichnamigen (nicht exportierten) Helfer aus
// public/pages/budget.js - keine gemeinsame Datei, da nur diese beiden
// Module Monatsnavigation brauchen und ein Export-Refactor von budget.js
// ausserhalb dieses Plans liegt.
function getMonthName(monthIndex) {
  const monthDate = new Date(2000, monthIndex, 1);
  return new Intl.DateTimeFormat(getLocale(), { month: 'long' }).format(monthDate);
}

function formatMonthLabel(ym) {
  const [y, m] = ym.split('-');
  return `${getMonthName(parseInt(m, 10) - 1)} ${y}`;
}

function addMonths(ym, n) {
  const [y, m] = ym.split('-').map(Number);
  const shifted = new Date(y, m - 1 + n, 1);
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, '0')}`;
}

function currentMonthStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// Gleiche Liste wie public/pages/documents.js#CATEGORIES - dort hardcodiert
// statt aus GET /documents/meta/options geladen, hier aus Konsistenz genauso.
const DOCUMENT_CATEGORIES = ['medical', 'school', 'identity', 'insurance', 'finance', 'home', 'vehicle', 'legal', 'travel', 'pets', 'warranty', 'taxes', 'work', 'other'];

// --------------------------------------------------------
// Buchungs-Auswahl (Overlay im Modal-Panel, wie openDocumentPicker in
// document-attach.js - ein zweites Modal wuerde das Formular darunter
// schliessen). Monatsweise geblaettert wie die Budget-Seite selbst statt
// Volltextsuche - es gibt keine bestehende Suche ueber Buchungen im Projekt.
//
// `includeRole: true` fragt nach der Auswahl noch die Rolle ab (fuer
// "Buchung hinzufuegen" am bestehenden Gegenstand); `false` loest sofort
// mit role:'purchase' auf (Anlegen-Fluss, Kaufpreis-Vorbelegung).
//
// @returns {Promise<{entry: object, role: string}|null>}
// --------------------------------------------------------
function openBookingPicker(panel, { initialMonth, includeRole = false } = {}) {
  return new Promise((resolve) => {
    let month = initialMonth || currentMonthStr();
    let entries = [];
    let picked = null;

    const overlay = document.createElement('div');
    overlay.className = 'inventory-booking-picker';
    overlay.insertAdjacentHTML('afterbegin', `
      <div class="inventory-booking-picker__panel" role="dialog" aria-modal="true"
           aria-label="${esc(t('inventory.bookingPickerTitle'))}">
        <div class="inventory-booking-picker__header">
          <strong>${esc(t('inventory.bookingPickerTitle'))}</strong>
          <button class="btn btn--icon" type="button" data-picker-close
                  aria-label="${esc(t('common.cancel'))}">
            <i data-lucide="x" aria-hidden="true"></i>
          </button>
        </div>
        <div class="inventory-booking-picker__nav">
          <button class="btn btn--icon" type="button" data-picker-prev
                  aria-label="${esc(t('inventory.bookingPickerPrevMonth'))}">
            <i data-lucide="chevron-left" aria-hidden="true"></i>
          </button>
          <strong data-picker-month></strong>
          <button class="btn btn--icon" type="button" data-picker-next
                  aria-label="${esc(t('inventory.bookingPickerNextMonth'))}">
            <i data-lucide="chevron-right" aria-hidden="true"></i>
          </button>
        </div>
        <div class="inventory-booking-picker__list" data-picker-list>
          <p class="inventory-booking-picker__status">${esc(t('common.loading'))}</p>
        </div>
        <div class="inventory-booking-picker__role" data-picker-role hidden>
          <div class="form-group">
            <label class="form-label" for="inv-picker-role-select">${esc(t('inventory.roleLabel'))}</label>
            <select id="inv-picker-role-select" class="form-input">
              ${ROLES.map((r) => `<option value="${r}">${esc(roleLabel(r))}</option>`).join('')}
            </select>
          </div>
          <div class="inventory-booking-picker__role-footer">
            <button class="btn btn--secondary" type="button" data-picker-role-back>${esc(t('common.back'))}</button>
            <button class="btn btn--primary" type="button" data-picker-role-confirm>${esc(t('inventory.addBooking'))}</button>
          </div>
        </div>
      </div>`);
    panel.append(overlay);
    if (window.lucide) window.lucide.createIcons({ el: overlay });
    const opener = document.activeElement;
    overlay.querySelector('[data-picker-close]').focus();

    const listEl = overlay.querySelector('[data-picker-list]');
    const monthEl = overlay.querySelector('[data-picker-month]');
    const roleEl = overlay.querySelector('[data-picker-role]');
    const navEl = overlay.querySelector('.inventory-booking-picker__nav');

    const close = (result) => {
      overlay.remove();
      if (opener?.isConnected) opener.focus();
      resolve(result);
    };

    const renderList = () => {
      monthEl.textContent = formatMonthLabel(month);
      listEl.replaceChildren();
      if (!entries.length) {
        listEl.insertAdjacentHTML('afterbegin',
          `<p class="inventory-booking-picker__status">${esc(t('inventory.noBookingsThisMonth'))}</p>`);
        return;
      }
      for (const entry of entries) {
        listEl.insertAdjacentHTML('beforeend', `
          <button class="inventory-booking-picker__item" type="button" data-picker-item="${entry.id}">
            <span class="inventory-booking-picker__item-title">${esc(entry.title)}</span>
            <span class="inventory-booking-picker__item-meta">${esc(formatDate(entry.date))}</span>
            <span class="inventory-booking-picker__item-amount">${esc(formatMoney(entry.amount, _householdCurrency))}</span>
          </button>`);
      }
    };

    const loadMonth = () => {
      listEl.replaceChildren();
      listEl.insertAdjacentHTML('afterbegin', `<p class="inventory-booking-picker__status">${esc(t('common.loading'))}</p>`);
      api.get(`/budget?month=${month}`).then((res) => {
        entries = (res.data || []).filter((e) => !e.recurrence_parent_id && !e.is_pending);
        renderList();
      }).catch(() => {
        listEl.replaceChildren();
        listEl.insertAdjacentHTML('afterbegin',
          `<p class="inventory-booking-picker__status">${esc(t('common.errorGeneric'))}</p>`);
      });
    };

    listEl.addEventListener('click', (event) => {
      const button = event.target.closest('[data-picker-item]');
      if (!button) return;
      picked = entries.find((e) => e.id === Number(button.dataset.pickerItem));
      if (!picked) return;
      if (!includeRole) { close({ entry: picked, role: 'purchase' }); return; }
      roleEl.hidden = false;
      listEl.hidden = true;
      navEl.hidden = true;
    });

    overlay.querySelector('[data-picker-prev]').addEventListener('click', () => { month = addMonths(month, -1); loadMonth(); });
    overlay.querySelector('[data-picker-next]').addEventListener('click', () => { month = addMonths(month, 1); loadMonth(); });
    overlay.querySelectorAll('[data-picker-close]').forEach((button) => button.addEventListener('click', () => close(null)));
    overlay.querySelector('[data-picker-role-back]').addEventListener('click', () => {
      picked = null;
      roleEl.hidden = true;
      listEl.hidden = false;
      navEl.hidden = false;
    });
    overlay.querySelector('[data-picker-role-confirm]').addEventListener('click', () => {
      const role = overlay.querySelector('#inv-picker-role-select').value;
      close({ entry: picked, role });
    });
    overlay.addEventListener('mousedown', (event) => { if (event.target === overlay) close(null); });
    overlay.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') { event.stopPropagation(); close(null); return; }
      if (event.key !== 'Tab') return;
      const focusable = [...overlay.querySelectorAll('button, select')].filter((el) => !el.disabled && !el.closest('[hidden]'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });

    loadMonth();
  });
}

/** (Re-)rendert die "Verknuepfte Buchungen"-Sektion im Bearbeiten-Formular. */
function renderLinkedEntries(panel, item) {
  const container = panel.querySelector('[data-linked-entries]');
  if (!container) return;
  const links = item.linked_entries || [];

  if (!links.length) {
    container.replaceChildren();
    container.insertAdjacentHTML('beforeend', `<p class="form-hint">${esc(t('inventory.noLinkedBookings'))}</p>`);
    return;
  }

  container.replaceChildren();
  container.insertAdjacentHTML('beforeend', links.map((link) => `
    <div class="inventory-linked-entry-row" data-entry-id="${link.entry_id}">
      <span class="inventory-linked-entry-row__title">${esc(link.title)}</span>
      <span class="inventory-linked-entry-row__role">${esc(roleLabel(link.role))}</span>
      <span class="inventory-linked-entry-row__date">${esc(formatDate(link.date))}</span>
      <span class="inventory-linked-entry-row__amount">${esc(formatMoney(link.amount, _householdCurrency))}</span>
      <button class="btn btn--icon btn--sm" type="button" data-remove-entry="${link.entry_id}"
              aria-label="${esc(t('inventory.removeBookingAction', { title: link.title }))}">
        <i data-lucide="x" aria-hidden="true"></i>
      </button>
    </div>`).join(''));
  container.insertAdjacentHTML('beforeend', `
    <div class="inventory-linked-entry-total">
      <span>${esc(t('inventory.totalLinkedLabel'))}</span>
      <span>${esc(formatMoney(item.linked_entries_total, _householdCurrency))}</span>
    </div>`);

  if (window.lucide) window.lucide.createIcons({ el: container });
}

function updateWarrantyStatus(panel) {
  const statusEl = panel.querySelector('#inv-warranty-status');
  const purchaseDate = panel.querySelector('#inv-purchase-date').value;
  const warrantyRaw = panel.querySelector('#inv-warranty').value.trim();
  const status = warrantyStatus({
    purchase_date: purchaseDate || null,
    warranty_months: warrantyRaw === '' ? null : Number(warrantyRaw),
  });

  if (!status) {
    statusEl.hidden = true;
    statusEl.className = 'inventory-warranty-status';
    return;
  }

  statusEl.hidden = false;
  statusEl.className = `inventory-warranty-status inventory-warranty-status--${status.state}`;
  const formattedDate = formatDate(new Date(`${status.endDateKey}T00:00:00`));
  if (status.state === 'expired') {
    statusEl.textContent = t('inventory.warrantyStatusExpired', { date: formattedDate });
  } else if (status.state === 'expiring') {
    // Parameter heisst `count`, nicht `days`: nur ein numerischer `count` waehlt
    // in public/i18n.js die Pluralvariante (_one/_other). Mit `days` stand hier
    // "in 1 Tagen" (#534, gleiche Fehlerklasse).
    statusEl.textContent = t('inventory.warrantyStatusExpiringSoon', { count: status.days });
  } else {
    statusEl.textContent = t('inventory.warrantyStatusValid', { date: formattedDate });
  }
}

function trackedDateRowHtml({ label = '', date = '', reminder_offset_days = 30 } = {}) {
  return `
    <div class="inventory-tracked-date-row" data-tracked-date-row>
      <input class="form-input js-tracked-date-label" type="text" maxlength="100"
             placeholder="${esc(t('inventory.trackedDateLabelPlaceholder'))}" value="${esc(label)}">
      <yuvomi-datepicker class="js-tracked-date-date" type="date" value="${esc(date)}"></yuvomi-datepicker>
      <input class="form-input js-tracked-date-offset" type="number" min="0" max="365" step="1"
             value="${reminder_offset_days}" aria-label="${esc(t('inventory.trackedDateRemindBeforeLabel'))}">
      <span class="inventory-tracked-date-row__countdown" data-countdown></span>
      <button type="button" class="btn btn--ghost btn--icon js-tracked-date-remove"
              aria-label="${esc(t('inventory.removeTrackedDateAction'))}">
        <i data-lucide="x" class="icon-md" aria-hidden="true"></i>
      </button>
    </div>`;
}

function updateTrackedDateRowCountdown(row) {
  const countdownEl = row.querySelector('[data-countdown]');
  const dateVal = row.querySelector('.js-tracked-date-date').value;
  const status = dateStatus(dateVal || null);
  if (!status) { countdownEl.textContent = ''; return; }
  if (status.days < 0) countdownEl.textContent = t('inventory.trackedDateOverdueDays', { count: Math.abs(status.days) });
  else if (status.days === 0) countdownEl.textContent = t('inventory.trackedDateDueToday');
  else countdownEl.textContent = t('inventory.trackedDateInDays', { count: status.days });
}

/** Verdrahtet Hinzufuegen/Entfernen der Fristen-Zeilen, gleiches Muster wie
 *  public/pages/calendar.js#wireReminderRows (Mehrfach-Erinnerungen). */
function wireTrackedDateRows(panel) {
  const rowsEl = panel.querySelector('#inv-tracked-dates-rows');
  const addBtn = panel.querySelector('#inv-tracked-dates-add');
  if (!rowsEl) return;

  const rowCount = () => rowsEl.querySelectorAll('[data-tracked-date-row]').length;
  const syncAddState = () => { if (addBtn) addBtn.disabled = rowCount() >= MAX_TRACKED_DATES_PER_ITEM; };

  const wireRow = (row) => {
    updateTrackedDateRowCountdown(row);
    row.querySelector('.js-tracked-date-date').addEventListener('input', () => updateTrackedDateRowCountdown(row));
  };

  rowsEl.querySelectorAll('[data-tracked-date-row]').forEach(wireRow);

  const appendRow = () => {
    rowsEl.insertAdjacentHTML('beforeend', trackedDateRowHtml());
    const newRow = rowsEl.lastElementChild;
    if (window.lucide && newRow) lucide.createIcons({ el: newRow });
    wireRow(newRow);
    syncAddState();
  };

  rowsEl.addEventListener('click', (e) => {
    const rm = e.target.closest('.js-tracked-date-remove');
    if (!rm) return;
    rm.closest('[data-tracked-date-row]')?.remove();
    syncAddState();
  });

  addBtn?.addEventListener('click', () => {
    if (rowCount() >= MAX_TRACKED_DATES_PER_ITEM) return;
    appendRow();
  });

  syncAddState();
}

function collectTrackedDates(panel) {
  return [...panel.querySelectorAll('[data-tracked-date-row]')].map((row) => {
    // Kein `|| 30`: eine explizite 0 ("am Tag selbst erinnern") ist falsy und
    // wuerde sonst still zu 30 umgeschrieben. 0 ist ueberall sonst gueltig
    // (input min="0", Server-Validator >= 0, DB-CHECK BETWEEN 0 AND 365).
    const rawOffset = row.querySelector('.js-tracked-date-offset').value.trim();
    const offset = Number(rawOffset);
    return {
      label: row.querySelector('.js-tracked-date-label').value.trim(),
      date: row.querySelector('.js-tracked-date-date').value || null,
      reminder_offset_days: rawOffset === '' || !Number.isFinite(offset) ? 30 : offset,
    };
  }).filter((d) => d.label && d.date);
}

/**
 * Baut Titel, Markup und Verdrahtung des Gegenstands-Formulars in einem
 * Stueck. Eigene Funktion, weil dasselbe Formular an zwei Stellen entsteht:
 * im regulaeren Modal (Neuanlage/Bearbeiten ueber den Listen-Klick) und
 * nachtraeglich gemountet im Formular-Pane der Detailansicht (Task 5).
 * Gleiches Muster wie public/pages/contacts.js#buildContactForm.
 *
 * @returns {{title: string, content: string, wire: (panel: HTMLElement) => void}}
 */
function buildItemForm({ mode, item = null }) {
  const isEdit = mode === 'edit';
  let pickedBooking = null; // nur im Anlegen-Fluss: {entry, role:'purchase'} vor dem Speichern

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
  const documentCategoryOptions = DOCUMENT_CATEGORIES
    .map((c) => `<option value="${c}" ${c === 'warranty' ? 'selected' : ''}>${esc(t(`documents.category.${c}`))}</option>`).join('');

  const content = `
      <div class="form-group">
        <label class="form-label" for="inv-name">${esc(t('common.nameLabel'))}</label>
        <input id="inv-name" class="form-input" type="text" required placeholder="${esc(t('inventory.namePlaceholder'))}">
      </div>
      <div class="inventory-form-row">
        <div class="form-group">
          <label class="form-label" for="inv-category">${esc(t('inventory.categoryLabel'))}</label>
          <select id="inv-category" class="form-input">${categoryOptions}</select>
        </div>
        <div class="form-group">
          <label class="form-label" for="inv-location">${esc(t('inventory.locationLabel'))}</label>
          <select id="inv-location" class="form-input">${locationOptions.join('')}</select>
        </div>
      </div>
      <div class="inventory-form-row">
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
      ${!isEdit ? `
      <div class="form-group">
        <button class="btn btn--secondary btn--sm" type="button" data-action="link-booking">
          <i data-lucide="link" aria-hidden="true"></i> ${esc(t('inventory.linkBooking'))}
        </button>
        <div data-picked-booking-chip hidden></div>
      </div>` : ''}
      <div class="inventory-form-row">
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
      ${isEdit ? `
      <div class="form-group">
        <span class="form-label">${esc(t('inventory.linkedBookingsLabel'))}</span>
        <div class="inventory-linked-entries" data-linked-entries></div>
        <button class="btn btn--secondary btn--sm" type="button" data-action="add-booking">
          <i data-lucide="plus" aria-hidden="true"></i> ${esc(t('inventory.addBooking'))}
        </button>
      </div>` : ''}
      ${advancedSection(`
        <div class="inventory-form-row">
          <div class="form-group">
            <label class="form-label" for="inv-brand">${esc(t('inventory.brandLabel'))}</label>
            <input id="inv-brand" class="form-input" type="text">
          </div>
          <div class="form-group">
            <label class="form-label" for="inv-model">${esc(t('inventory.modelLabel'))}</label>
            <input id="inv-model" class="form-input" type="text">
          </div>
        </div>
        <div class="inventory-form-row">
          <div class="form-group">
            <label class="form-label" for="inv-serial">${esc(t('inventory.serialNumberLabel'))}</label>
            <input id="inv-serial" class="form-input" type="text">
          </div>
          <div class="form-group">
            <label class="form-label" for="inv-vendor">${esc(t('inventory.vendorLabel'))}</label>
            <input id="inv-vendor" class="form-input" type="text">
          </div>
        </div>
        <div class="inventory-form-row">
          <div class="form-group">
            <label class="form-label" for="inv-warranty">${esc(t('inventory.warrantyMonthsLabel'))}</label>
            <input id="inv-warranty" class="form-input" type="number" min="0" max="600" step="1" inputmode="numeric">
            <p class="inventory-warranty-status" id="inv-warranty-status" hidden></p>
          </div>
          <div class="form-group">
            <label class="form-label" for="inv-condition">${esc(t('inventory.conditionLabel'))}</label>
            <select id="inv-condition" class="form-input">${conditionOptions}</select>
          </div>
        </div>
        <div class="form-group">
          <span class="form-label">${esc(t('inventory.trackedDatesLabel'))}</span>
          <p class="inventory-tracked-dates-hint">${esc(t('inventory.trackedDatesHint'))}</p>
          <div class="inventory-tracked-dates-rows" id="inv-tracked-dates-rows">
            ${(isEdit ? (item.tracked_dates || []) : []).map(trackedDateRowHtml).join('')}
          </div>
          <button type="button" class="btn btn--secondary btn--sm" id="inv-tracked-dates-add">
            <i data-lucide="plus" aria-hidden="true"></i> ${esc(t('inventory.addTrackedDate'))}
          </button>
        </div>
        <div class="form-group">
          <label class="form-label" for="inv-notes">${esc(t('inventory.notesLabel'))}</label>
          <textarea id="inv-notes" class="form-input" rows="3" placeholder="${esc(t('inventory.notesPlaceholder'))}"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label" for="inv-attachment-category">${esc(t('inventory.attachmentCategoryLabel'))}</label>
          <select id="inv-attachment-category" class="form-input">${documentCategoryOptions}</select>
        </div>
        ${renderDocumentAttachField({
          attachments: isEdit ? (item.attachments || []) : [],
          label: t('inventory.attachmentsLabel'),
          hint: t('inventory.attachmentsHint'),
        })}`,
      { open: isEdit && (!!item.brand || !!item.model || !!item.serial_number || !!item.notes || (item.attachments?.length ?? 0) > 0) })}
      <div class="modal-panel__footer modal-panel__footer--plain">
        ${isEdit ? `<button type="button" class="btn btn--danger-ghost" id="inv-delete">${esc(t('common.delete'))}</button>` : ''}
        <button type="button" class="btn btn--secondary" data-action="close-modal">${esc(t('common.cancel'))}</button>
        <button type="button" class="btn btn--primary" id="inv-save">${esc(isEdit ? t('common.save') : t('common.add'))}</button>
      </div>`;

  function wire(panel) {
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

    updateWarrantyStatus(panel);
    panel.querySelector('#inv-purchase-date').addEventListener('input', () => updateWarrantyStatus(panel));
    panel.querySelector('#inv-warranty').addEventListener('input', () => updateWarrantyStatus(panel));

    wireTrackedDateRows(panel);

    wireBlurValidation(panel);
    const attachments = bindDocumentAttachField(panel, {
      category: () => panel.querySelector('#inv-attachment-category').value,
      folderName: t('documents.inventoryFolder'),
      documentName: (file) => t('inventory.attachmentDocumentName', {
        name: panel.querySelector('#inv-name').value.trim() || file.name,
      }),
    });
    if (isEdit) {
      renderLinkedEntries(panel, item);
      panel.querySelector('[data-action="add-booking"]').addEventListener('click', async () => {
        const picked = await openBookingPicker(panel, {
          includeRole: true,
          initialMonth: item.purchase_date ? item.purchase_date.slice(0, 7) : undefined,
        });
        if (!picked) return;
        try {
          const res = await api.post(`/inventory/items/${item.id}/entries`, {
            entry_id: picked.entry.id, role: picked.role,
          });
          item = res.data;
          renderLinkedEntries(panel, item);
          await loadItems();
          renderList();
        } catch (err) {
          window.yuvomi?.showToast(err.data?.error ?? t('common.errorGeneric'), 'danger');
        }
      });
      panel.querySelector('[data-linked-entries]').addEventListener('click', async (event) => {
        const button = event.target.closest('[data-remove-entry]');
        if (!button) return;
        try {
          const res = await api.delete(`/inventory/items/${item.id}/entries/${button.dataset.removeEntry}`);
          item = res.data;
          renderLinkedEntries(panel, item);
          await loadItems();
          renderList();
        } catch (err) {
          window.yuvomi?.showToast(err.data?.error ?? t('common.errorGeneric'), 'danger');
        }
      });
    } else {
      panel.querySelector('[data-action="link-booking"]').addEventListener('click', async () => {
        const picked = await openBookingPicker(panel, { includeRole: false });
        if (!picked) return;
        pickedBooking = picked;
        const chip = panel.querySelector('[data-picked-booking-chip]');
        chip.hidden = false;
        chip.replaceChildren();
        chip.insertAdjacentHTML('beforeend', `
          <span class="inventory-picked-booking-chip">
            ${esc(t('inventory.pendingBookingLabel', { title: picked.entry.title }))}
            <button type="button" data-clear-picked-booking
                    aria-label="${esc(t('inventory.removeBookingAction', { title: picked.entry.title }))}">
              <i data-lucide="x" aria-hidden="true"></i>
            </button>
          </span>`);
        chip.querySelector('[data-clear-picked-booking]').addEventListener('click', () => {
          pickedBooking = null;
          chip.hidden = true;
          chip.replaceChildren();
        });
        if (window.lucide) window.lucide.createIcons({ el: chip });
        const priceInput = panel.querySelector('#inv-purchase-price');
        if (!priceInput.value.trim()) priceInput.value = String(Math.abs(picked.entry.amount));
      });
    }

    panel.querySelector('#inv-save').addEventListener('click', () => saveItem(panel, mode, item, attachments, pickedBooking));
    panel.querySelector('#inv-delete')?.addEventListener('click', async () => {
      closeSharedModal({ force: true });
      await removeItem(item);
    });

    if (window.lucide) window.lucide.createIcons({ el: panel });
  }

  return { title: isEdit ? t('common.editItem') : t('inventory.addItem'), content, wire };
}

function openItemModal(mode, item = null) {
  const form = buildItemForm({ mode, item });
  openSharedModal({ title: form.title, size: 'md', content: form.content, onSave: form.wire });
}

async function saveItem(panel, mode, item, attachments, pickedBooking) {
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
    tracked_dates: collectTrackedDates(panel),
  };

  saveBtn.disabled = true;
  try {
    if (attachments) payload.attachment_document_ids = await attachments.commit();
    if (pickedBooking) payload.entry_id = pickedBooking.entry.id;
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
    await Promise.all([
      loadLocations(),
      loadCategories(),
      loadItems(),
      api.get('/preferences').then((res) => { _householdCurrency = res.data?.currency ?? 'EUR'; }).catch(() => {}),
    ]);
    renderList();
  } catch (err) {
    window.yuvomi?.showToast(err.data?.error ?? t('common.errorGeneric'), 'danger');
    list.replaceChildren();
  }
}
