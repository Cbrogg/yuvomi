import { api } from '/api.js';
import { formatDate, formatTime, t } from '/i18n.js';
import { esc } from '/utils/html.js';
import { closeModal, confirmModal, openModal } from '/components/modal.js';
import {
  createDisclosure,
  createInlineError,
  createRetryState,
  createStatusSummary,
  createToggleRow,
  toggleRowHtml,
} from '/settings/components.js';
import { withBusy } from '/utils/ux.js';

const MORE_PROVIDERS_ID = 'sync-more-providers';
const GOOGLE_PROVIDER_ID = 'sync-provider-google';
const APPLE_PROVIDER_ID = 'sync-provider-apple';

function formatSyncTime(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${formatDate(date)} ${formatTime(date)}`.trim();
}

function lastSyncDetail(value) {
  const formatted = formatSyncTime(value);
  return formatted
    ? t('settings.lastSyncValue', { value: formatted })
    : t('settings.neverSynced');
}

function enabledCalendarCount(calendars) {
  return calendars.filter((cal) => cal.enabled).length;
}

function showToast(message, tone = 'default') {
  window.yuvomi?.showToast(message, tone);
}

function providerConnectionStatus(status) {
  if (!status) return t('settings.notConnected');
  if (status.connected) {
    const formatted = formatSyncTime(status.lastSync);
    return formatted
      ? t('settings.connectedLastSync', { date: formatted })
      : t('settings.connected');
  }
  if (status.configured) {
    const formatted = formatSyncTime(status.lastSync);
    return formatted
      ? t('settings.configuredLastSync', { date: formatted })
      : t('settings.configured');
  }
  return t('settings.notConfigured');
}

// --------------------------------------------------------------------------
// Page scaffold
// --------------------------------------------------------------------------

function renderPage(container, user) {
  container.replaceChildren();
  container.insertAdjacentHTML('beforeend', `
    <div id="sync-calendar-banner"></div>

    <section class="settings-section">
      <h2 class="settings-section__title">${t('settings.caldavTitle')}</h2>
      <div class="settings-card">
        <p class="settings-card-description">${t('settings.caldavDescription')}</p>
        <div id="caldav-accounts" class="settings-sync-accounts"></div>
        ${user?.role === 'admin' ? `
          <div class="settings-form-actions">
            <button type="button" class="btn btn--primary" id="caldav-add-account-btn">
              ${t('settings.caldavAddAccount')}
            </button>
          </div>
        ` : ''}
      </div>
    </section>

    <section class="settings-section">
      <h2 class="settings-section__title">${t('settings.ics.title')}</h2>
      <div class="settings-card">
        <div id="ics-accounts" class="settings-sync-accounts"></div>
        <div id="ics-add-form-wrapper" hidden>
          <form id="ics-add-form" class="settings-form settings-form--compact" novalidate autocomplete="off">
            <div class="form-group">
              <label class="form-label" for="ics-url">${t('settings.ics.form.url')}</label>
              <input class="form-input" type="url" id="ics-url" required placeholder="https://..." />
            </div>
            <div class="form-group">
              <label class="form-label" for="ics-name">${t('settings.ics.form.name')}</label>
              <input class="form-input" type="text" id="ics-name" required maxlength="100" />
            </div>
            <div class="form-group">
              <label class="form-label" for="ics-color">${t('settings.ics.form.color')}</label>
              <input class="form-input form-input--color" type="color" id="ics-color" value="#6366f1" />
            </div>
            <div class="form-group">
              <label class="form-label" for="ics-assignee">${t('settings.sync.defaultAssignee')}</label>
              <select class="form-input" id="ics-assignee">
                <option value="">${t('settings.sync.defaultAssigneeNone')}</option>
                <option value="" disabled data-loading>${t('common.loading')}</option>
              </select>
              <p class="form-hint">${t('settings.sync.defaultAssigneeHint')}</p>
            </div>
            <div class="form-group">
              ${toggleRowHtml({
                label: t('settings.ics.form.shared'),
                attrs: { id: 'ics-shared' },
              })}
            </div>
            <div id="ics-add-error" class="form-error" role="alert" hidden></div>
            <div class="settings-form-actions">
              <button type="submit" class="btn btn--primary" id="ics-submit-btn">${t('settings.ics.actions.submit')}</button>
              <button type="button" class="btn btn--secondary" id="ics-cancel-btn">${t('settings.ics.actions.cancel')}</button>
            </div>
          </form>
        </div>
        <div class="settings-form-actions">
          <button type="button" class="btn btn--secondary" id="ics-add-btn">${t('settings.ics.add')}</button>
        </div>
      </div>
    </section>

    <section class="settings-section">
      <h2 class="settings-section__title">${t('settings.calendarImport.title')}</h2>
      <div class="settings-card">
        <p class="settings-card-description">${t('settings.calendarImport.description')}</p>
        <form id="cal-import-form" class="settings-form settings-form--compact" novalidate autocomplete="off">
          <div class="form-group">
            <label class="form-label" for="cal-import-file">${t('settings.calendarImport.fileLabel')}</label>
            <input class="form-input" type="file" id="cal-import-file" accept=".ics,text/calendar" />
          </div>
          <div class="form-group">
            <label class="form-label" for="cal-import-url">${t('settings.calendarImport.urlLabel')}</label>
            <input class="form-input" type="url" id="cal-import-url" placeholder="https://..." />
            <small class="form-hint">${t('settings.calendarImport.urlHint')}</small>
          </div>
          <div class="form-group">
            <label class="form-label" for="cal-import-color">${t('settings.calendarImport.colorLabel')}</label>
            <input class="form-input form-input--color" type="color" id="cal-import-color" value="#007AFF" />
          </div>
          <div id="cal-import-error" class="form-error" role="alert" hidden></div>
          <div class="settings-form-actions">
            <button type="submit" class="btn btn--primary" id="cal-import-submit">${t('settings.calendarImport.submit')}</button>
          </div>
        </form>
      </div>
    </section>

    <section class="settings-section">
      <div id="sync-more-providers-container"></div>
    </section>
  `);
}

// --------------------------------------------------------------------------
// Standard-Zuweisung pro Kalender-Sync-Ziel (#459)
// --------------------------------------------------------------------------

// Familienmitglieder einmal je Seitenaufruf laden (für die Assignee-Selects).
// Nur Erfolge cachen — ein transienter Fehler darf nicht die ganze Session mit
// leeren Selects zementieren.
let _familyUsers = null;
async function loadFamilyUsers() {
  if (_familyUsers) return _familyUsers;
  try {
    _familyUsers = (await api.get('/auth/users')).data ?? [];
    return _familyUsers;
  } catch {
    return [];
  }
}

/**
 * Kompaktes Auswahlfeld „Standard-Zuweisung" für eine synchronisierte
 * Kalenderzeile (Google/Apple/CalDAV). Schreibt provider-übergreifend über
 * PATCH /calendar/external-calendars. Options werden async nachgeladen, damit die
 * Zeile sofort rendert; Interaktionen werden vom Zeilen-Label entkoppelt.
 */
function buildCalendarAssigneeSelect({ source, externalId, currentId }) {
  const select = document.createElement('select');
  select.className = 'caldav-calendar-assignee';
  select.title = t('settings.sync.defaultAssignee');
  select.setAttribute('aria-label', t('settings.sync.defaultAssignee'));

  const none = document.createElement('option');
  none.value = '';
  none.textContent = t('settings.sync.defaultAssigneeNone');
  select.appendChild(none);

  // Kurzer Ladehinweis, bis die Nutzerliste aufgelöst ist.
  const loadingOpt = document.createElement('option');
  loadingOpt.value = '';
  loadingOpt.disabled = true;
  loadingOpt.textContent = t('common.loading');
  select.appendChild(loadingOpt);

  // Klicks/Änderungen nicht an das umschließende Label (Checkbox) weiterreichen.
  ['click', 'mousedown', 'change'].forEach((ev) =>
    select.addEventListener(ev, (e) => e.stopPropagation()));

  loadFamilyUsers().then((users) => {
    loadingOpt.remove();
    for (const u of users) {
      const opt = document.createElement('option');
      opt.value = String(u.id);
      opt.textContent = u.display_name;
      if (Number(currentId) === u.id) opt.selected = true;
      select.appendChild(opt);
    }
  });

  let last = currentId ? String(currentId) : '';
  select.addEventListener('change', async () => {
    const value = select.value;
    select.disabled = true;
    try {
      await api.patch('/calendar/external-calendars', {
        source,
        external_id: externalId,
        default_assignee_user_id: value ? Number(value) : null,
      });
      last = value;
      showToast(t('settings.ics.updatedToast'), 'success');
    } catch (err) {
      select.value = last;
      showToast(err.message || t('common.errorGeneric'), 'danger');
    } finally {
      select.disabled = false;
    }
  });

  return select;
}

// --------------------------------------------------------------------------
// CalDAV calendar accounts
// --------------------------------------------------------------------------

let calendarListSeq = 0;

function buildCalendarList(account, calendars) {
  const list = document.createElement('div');
  list.className = 'caldav-calendars-list';
  for (const cal of calendars) {
    const label = document.createElement('label');
    label.className = 'caldav-calendar-item';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'caldav-calendar-checkbox';
    checkbox.checked = Boolean(cal.enabled);

    const color = document.createElement('span');
    color.className = 'caldav-calendar-color';
    color.style.backgroundColor = cal.calendarColor || 'var(--color-accent)';

    const name = document.createElement('span');
    name.className = 'caldav-calendar-name';
    name.textContent = cal.calendarName || cal.calendarUrl;

    label.append(checkbox, color, name);
    // VOR DEM HAKEN, NICHT NACH DEM SYNC: Das Feld stand früher erst da, wenn
    // der Kalender aktiv UND einmal synchronisiert war - also frühestens, als
    // der erste Schwung Termine bereits ohne Zuweisung hereingekommen war, bei
    // Serien Dutzende (#730). Jetzt lässt es sich vorher setzen; der PATCH legt
    // die external_calendars-Zeile nötigenfalls selbst an, und der spätere Sync
    // aktualisiert daran nur Name und Farbe.
    label.appendChild(buildCalendarAssigneeSelect({
      source: 'caldav',
      externalId: cal.calendarUrl,
      currentId: cal.default_assignee_user_id,
    }));
    list.appendChild(label);

    checkbox.addEventListener('change', async () => {
      const enabled = checkbox.checked;

      // DIE FRAGE KOMMT NACH DEM ABWÄHLEN, NICHT DAVOR: Der Haken wirkt in
      // dieser Oberfläche sofort, wie jede andere Einstellung auch. Vorgeschaltet
      // hieße die Frage "willst du wirklich abwählen?" und stellte das Abwählen
      // in Zweifel, um das es gar nicht geht - gefragt ist nur, was mit den
      // bereits übernommenen Terminen geschehen soll (#732).
      //
      // Behalten ist der Weg von Escape und vom Nebenknopf, also die Vorgabe.
      // Ein versehentliches Abwählen ist der häufigere Fall - der Melder nennt
      // ihn selbst -, und Behalten ist der einzige der beiden Ausgänge, der sich
      // rückgängig machen lässt.
      let deleteEvents = false;
      if (!enabled && cal.eventCount > 0) {
        deleteEvents = await confirmModal(
          t('settings.syncCleanup.question', { count: cal.eventCount }),
          {
            danger: true,
            confirmLabel: t('settings.syncCleanup.delete'),
            cancelLabel: t('settings.syncCleanup.keep'),
            detail: t('settings.syncCleanup.detail'),
          },
        );
      }

      await withBusy(checkbox, async () => {
        try {
          const res = await api.patch(`/calendar/caldav/accounts/${account.id}/calendars`, {
            calendarUrl: cal.calendarUrl,
            enabled,
            deleteEvents,
          });
          const removed = res.data?.removed ?? 0;
          if (removed) cal.eventCount = 0;
          showToast(
            removed
              ? t('settings.syncCleanup.removed', { count: removed })
              : (enabled ? t('settings.calendarEnabled') : t('settings.calendarDisabled')),
            'success',
          );
        } catch (err) {
          checkbox.checked = !enabled;
          showToast(err.message || t('common.errorGeneric'), 'danger');
        }
      });
    });
  }

  // Seit dem Opt-in (#732) bringt ein frisch verbundenes Konto seine Kalender
  // abgewählt mit - ohne ein Wort dazu sähe das aus, als sei die Verbindung
  // gescheitert. Der Hinweis steht nur, solange wirklich keiner aktiv ist, und
  // verschwindet mit dem ersten Haken.
  const none = enabledCalendarCount(calendars) === 0 && calendars.length > 0;
  if (none) {
    const hint = document.createElement('p');
    hint.className = 'form-hint';
    hint.textContent = t('settings.calendarsNoneEnabledHint');
    list.insertBefore(hint, list.firstChild);
  }

  // Gleiche Aufklapp-Grammatik wie Kontakt-Sync und die Settings-Navigation:
  // geteilte Komponente mit Chevron und ARIA statt rohem <details>.
  // Eine Zahl statt zweier: „1 von 3 Kalendern" - gleiche Grammatik wie Kontakt-Sync.
  return createDisclosure({
    id: `caldav-calendars-${++calendarListSeq}`,
    summary: t('settings.calendarsEnabledOfTotal', {
      enabled: enabledCalendarCount(calendars),
      total: calendars.length,
      count: calendars.length,
    }),
    // Steht keiner an, ist die Auswahl der nächste Schritt und nicht eine
    // Nebensache hinter einem Chevron.
    expanded: none,
    content: list,
  });
}

function renderCalDAVAccount(container, account, calendars, refresh, user) {
  const card = document.createElement('article');
  card.className = 'caldav-account-item';

  // listAccounts() liefert camelCase (caldavUrl/lastSync), nicht die Roh-Spalten.
  // Zähler lebt im Aufklapp-Label; die URL ist Nachschlage-Information, ans Ende.
  const details = [lastSyncDetail(account.lastSync)];
  if (account.caldavUrl) details.push(account.caldavUrl);

  const syncBtn = document.createElement('button');
  syncBtn.type = 'button';
  // Gleiche Rangfolge wie Kontakt-Sync: Sync akzentuiert, Wartung still.
  syncBtn.className = 'btn btn--secondary btn--sm';
  syncBtn.textContent = t('settings.syncNow');
  syncBtn.addEventListener('click', async () => {
    syncBtn.disabled = true;
    try {
      await api.post('/calendar/caldav/sync');
      showToast(t('settings.caldavSyncSuccess'), 'success');
      await refresh();
    } catch (err) {
      showToast(err.message || t('settings.caldavSyncFailed'), 'danger');
      syncBtn.disabled = false;
    }
  });

  card.appendChild(createStatusSummary({
    title: account.name,
    status: account.lastSync ? t('settings.connected') : t('settings.notConnected'),
    details,
    action: syncBtn,
    tone: account.lastSync ? 'success' : 'neutral',
  }));

  card.appendChild(buildCalendarList(account, calendars));

  const actions = document.createElement('div');
  actions.className = 'caldav-account-actions';

  const refreshBtn = document.createElement('button');
  refreshBtn.type = 'button';
  refreshBtn.className = 'btn btn--ghost btn--sm';
  refreshBtn.textContent = t('settings.caldavRefreshCalendars');
  refreshBtn.addEventListener('click', async () => {
    refreshBtn.disabled = true;
    try {
      await api.get(`/calendar/caldav/accounts/${account.id}/calendars?refresh=true`);
      showToast(t('settings.calendarsRefreshed'), 'success');
      await refresh();
    } catch (err) {
      showToast(err.message || t('common.errorGeneric'), 'danger');
      refreshBtn.disabled = false;
    }
  });
  actions.appendChild(refreshBtn);

  if (user?.role === 'admin') {
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn btn--danger-outline btn--sm';
    deleteBtn.textContent = t('common.delete');
    deleteBtn.addEventListener('click', async () => {
      // Frage nennt das Konto, Detail nennt die Folge (mehrere Konten möglich).
      const confirmed = await confirmModal(
        t('settings.disconnectAccountConfirmTitle', { name: account.name }),
        {
          detail: t('settings.deleteAccountConfirm'),
          confirmLabel: t('common.delete'),
          danger: true,
        },
      );
      if (!confirmed) return;

      // Zweite Frage nur, wenn es etwas zu entscheiden gibt: Ohne sie war das
      // Trennen der einzige Weg, bei dem Termine sichtbar stehen bleiben und
      // dabei ihre Kalenderzuordnung verlieren - Waisen ohne erkennbare
      // Herkunft (#732). Die Vorgabe ist auch hier Behalten.
      let deleteEvents = false;
      if (account.eventCount > 0) {
        deleteEvents = await confirmModal(
          t('settings.syncCleanup.accountQuestion', { count: account.eventCount }),
          {
            danger: true,
            confirmLabel: t('settings.syncCleanup.delete'),
            cancelLabel: t('settings.syncCleanup.keep'),
            detail: t('settings.syncCleanup.accountDetail'),
          },
        );
      }

      try {
        const res = await api.delete(
          `/calendar/caldav/accounts/${account.id}?deleteEvents=${deleteEvents ? 'true' : 'false'}`
        );
        const removed = res.data?.removed ?? 0;
        showToast(
          removed
            ? t('settings.syncCleanup.removed', { count: removed })
            : t('settings.caldavAccountDeleted'),
          'success',
        );
        await refresh();
      } catch (err) {
        showToast(err.message || t('common.errorGeneric'), 'danger');
      }
    });
    actions.appendChild(deleteBtn);
  }

  card.appendChild(actions);
  container.appendChild(card);
}

async function loadCalDAVAccounts(container, user) {
  const listEl = container.querySelector('#caldav-accounts');
  if (!listEl) return;
  listEl.replaceChildren();

  const reload = () => loadCalDAVAccounts(container, user);

  let accounts;
  try {
    const res = await api.get('/calendar/caldav/accounts');
    accounts = res.data || [];
  } catch (err) {
    listEl.appendChild(createRetryState({
      message: err.message || t('settings.caldavConnectionFailed'),
      onRetry: reload,
    }));
    return;
  }

  if (accounts.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'form-hint';
    empty.textContent = t('settings.caldavEmptyState');
    listEl.appendChild(empty);
    return;
  }

  for (const account of accounts) {
    let calendars = [];
    try {
      const calRes = await api.get(`/calendar/caldav/accounts/${account.id}/calendars`);
      calendars = calRes.data || [];
    } catch (err) {
      const wrapper = document.createElement('div');
      wrapper.className = 'caldav-account-item';
      wrapper.appendChild(createStatusSummary({
        title: account.name,
        status: t('settings.notConnected'),
        details: [lastSyncDetail(account.lastSync)],
        tone: 'warning',
      }));
      wrapper.appendChild(createInlineError(err.message || t('common.errorGeneric')));
      listEl.appendChild(wrapper);
      continue;
    }
    renderCalDAVAccount(listEl, account, calendars, reload, user);
  }
  // Die Karten tragen Lucide-Platzhalter (Disclosure-Chevron) und entstehen bei
  // jedem Reload neu.
  window.lucide?.createIcons({ el: listEl });
}

function bindCalDAVAddButton(container, user) {
  const addBtn = container.querySelector('#caldav-add-account-btn');
  if (!addBtn) return;
  addBtn.addEventListener('click', () => {
    openModal({
      title: t('settings.caldavAddAccount'),
      size: 'sm',
      content: `
        <form id="caldav-add-form" novalidate autocomplete="off">
          <div class="form-group">
            <label class="form-label" for="caldav-name">${t('settings.caldavNameLabel')}<span class="required-marker" aria-hidden="true"> *</span></label>
            <input class="form-input" type="text" id="caldav-name" required
                   placeholder="${t('settings.caldavNamePlaceholder')}" maxlength="100" />
          </div>
          <div class="form-group">
            <label class="form-label" for="caldav-url">${t('settings.caldavUrlLabel')}<span class="required-marker" aria-hidden="true"> *</span></label>
            <input class="form-input" type="url" id="caldav-url" required
                   placeholder="${t('settings.caldavUrlPlaceholder')}" />
            <small class="form-hint">${t('settings.caldavUrlHint')}</small>
          </div>
          <div class="form-group">
            <label class="form-label" for="caldav-username">${t('settings.caldavUsernameLabel')}<span class="required-marker" aria-hidden="true"> *</span></label>
            <input class="form-input" type="text" id="caldav-username" required autocomplete="off" />
          </div>
          <div class="form-group">
            <label class="form-label" for="caldav-password">${t('settings.caldavPasswordLabel')}<span class="required-marker" aria-hidden="true"> *</span></label>
            <input class="form-input" type="password" id="caldav-password" required autocomplete="current-password" />
            <small class="form-hint">${t('settings.caldavPasswordHint')}</small>
          </div>
          <div id="caldav-add-error" class="form-error" role="alert" hidden></div>
          <div class="modal-actions">
            <button type="button" class="btn btn--ghost" id="caldav-add-cancel">${t('common.cancel')}</button>
            <button type="submit" class="btn btn--primary">${t('common.save')}</button>
          </div>
        </form>
      `,
      onSave: (panel) => {
        const form = panel.querySelector('#caldav-add-form');
        const errorEl = panel.querySelector('#caldav-add-error');
        panel.querySelector('#caldav-add-cancel')?.addEventListener('click', () => closeModal({ force: true }));

        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          errorEl.hidden = true;

          const name = panel.querySelector('#caldav-name').value.trim();
          const caldavUrl = panel.querySelector('#caldav-url').value.trim();
          const username = panel.querySelector('#caldav-username').value.trim();
          const password = panel.querySelector('#caldav-password').value;

          if (!name || !caldavUrl || !username || !password) {
            errorEl.textContent = t('common.requiredFields');
            errorEl.hidden = false;
            return;
          }

          try {
            await api.post('/calendar/caldav/accounts', {
              name,
              caldavUrl,
              username,
              password,
            });
            closeModal({ force: true });
            showToast(t('settings.caldavAccountAdded'), 'success');
            await loadCalDAVAccounts(container, user);
          } catch (err) {
            errorEl.textContent = err.message || t('common.errorGeneric');
            errorEl.hidden = false;
          }
        });
      },
    });
  });
}

// --------------------------------------------------------------------------
// ICS / Webcal subscriptions
// --------------------------------------------------------------------------

function renderIcsList(container, subs, user) {
  const listEl = container.querySelector('#ics-accounts');
  if (!listEl) return;
  listEl.replaceChildren();

  if (subs.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'form-hint';
    empty.textContent = t('settings.ics.empty');
    listEl.appendChild(empty);
    return;
  }

  const ul = document.createElement('ul');
  ul.className = 'settings-members';
  for (const sub of subs) {
    const li = document.createElement('li');
    // Dieselbe Zeilen-Grammatik wie die Kalenderauswahl darueber (#732): gleiche
    // Aufgabe, gleiche Zeile. Die Regel steht in settings.css, hier wird sie nur
    // angefordert.
    li.className = 'settings-member settings-member--sync-row';

    const dot = document.createElement('span');
    dot.className = 'settings-avatar settings-avatar--sm';
    dot.style.background = sub.color;
    dot.style.flexShrink = '0';
    li.appendChild(dot);

    const info = document.createElement('div');
    info.className = 'settings-member__info';

    const nameLine = document.createElement('span');
    nameLine.className = 'settings-member__name';
    nameLine.textContent = sub.name;

    const badge = document.createElement('span');
    badge.className = `badge ${sub.shared ? 'badge--success' : 'badge--neutral'}`;
    badge.style.marginLeft = 'var(--space-2)';
    badge.textContent = sub.shared ? t('settings.ics.badges.shared') : t('settings.ics.badges.private');
    nameLine.appendChild(badge);
    info.appendChild(nameLine);

    const meta = document.createElement('span');
    meta.className = 'settings-member__meta';
    const formatted = formatSyncTime(sub.last_sync);
    meta.textContent = formatted
      ? `${t('settings.ics.status.lastSync')} ${formatted}`
      : t('settings.ics.status.never');
    info.appendChild(meta);
    li.appendChild(info);

    const isOwner = sub.created_by === user?.id || user?.role === 'admin';
    if (isOwner) {
      li.appendChild(buildIcsActions(container, sub, subs, user));
    }
    ul.appendChild(li);
  }
  listEl.appendChild(ul);
  window.lucide?.createIcons({ el: listEl });
}

function buildIcsActions(container, sub, subs, user) {
  const actions = document.createElement('div');
  actions.className = 'cat-row__actions';

  const syncBtn = document.createElement('button');
  syncBtn.type = 'button';
  syncBtn.className = 'btn btn--icon btn--ghost';
  syncBtn.title = t('settings.ics.actions.sync');
  syncBtn.setAttribute('aria-label', t('settings.ics.actions.sync'));
  const syncIcon = document.createElement('i');
  syncIcon.setAttribute('data-lucide', 'refresh-cw');
  syncIcon.className = 'icon-md';
  syncIcon.setAttribute('aria-hidden', 'true');
  syncBtn.appendChild(syncIcon);
  syncBtn.addEventListener('click', async () => {
    syncBtn.disabled = true;
    try {
      const res = await api.post(`/calendar/subscriptions/${sub.id}/sync`, {});
      const idx = subs.findIndex((s) => s.id === sub.id);
      if (idx >= 0) subs[idx] = res.data;
      renderIcsList(container, subs, user);
      showToast(t('settings.ics.syncedToast'), 'success');
    } catch (err) {
      showToast(err.message || t('common.errorGeneric'), 'danger');
      syncBtn.disabled = false;
    }
  });
  actions.appendChild(syncBtn);

  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.className = 'btn btn--icon btn--ghost';
  editBtn.title = t('settings.ics.actions.edit');
  editBtn.setAttribute('aria-label', t('settings.ics.actions.edit'));
  const editIcon = document.createElement('i');
  editIcon.setAttribute('data-lucide', 'pencil');
  editIcon.className = 'icon-sm';
  editIcon.setAttribute('aria-hidden', 'true');
  editBtn.appendChild(editIcon);
  editBtn.addEventListener('click', () => openIcsEditModal(container, sub, subs, user));
  actions.appendChild(editBtn);

  const delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.className = 'btn btn--icon btn--danger-outline';
  delBtn.title = t('settings.ics.actions.delete');
  delBtn.setAttribute('aria-label', t('settings.ics.actions.delete'));
  const delIcon = document.createElement('i');
  delIcon.setAttribute('data-lucide', 'trash-2');
  delIcon.className = 'icon-sm';
  delIcon.setAttribute('aria-hidden', 'true');
  delBtn.appendChild(delIcon);
  delBtn.addEventListener('click', async () => {
    if (!await confirmModal(t('settings.ics.confirm_delete'), {
      danger: true,
      confirmLabel: t('common.delete'),
      detail: t('settings.ics.confirm_delete_detail'),
    })) return;
    try {
      await api.delete(`/calendar/subscriptions/${sub.id}`);
      const idx = subs.findIndex((s) => s.id === sub.id);
      if (idx >= 0) subs.splice(idx, 1);
      renderIcsList(container, subs, user);
      showToast(t('settings.ics.deletedToast'), 'default');
    } catch (err) {
      showToast(err.message || t('common.errorGeneric'), 'danger');
    }
  });
  actions.appendChild(delBtn);

  return actions;
}

function openIcsEditModal(container, sub, subs, user) {
  openModal({
    title: t('settings.ics.actions.edit'),
    size: 'sm',
    content: `
      <form id="ics-edit-form" class="settings-form">
        <div class="form-group">
          <label class="form-label" for="ics-edit-name">${t('settings.ics.form.name')}</label>
          <input class="form-input" type="text" id="ics-edit-name" value="${esc(sub.name)}" required maxlength="100" />
        </div>
        <div class="settings-name-color-row">
          <div class="form-group settings-color-field">
            <label class="form-label" for="ics-edit-color">${t('settings.ics.form.color')}</label>
            <input class="settings-color-button" type="color" id="ics-edit-color" value="${esc(sub.color) || '#3b82f6'}" />
          </div>
          <div class="form-group settings-color-field">
            ${toggleRowHtml({
              label: t('settings.ics.form.shared'),
              checked: !!sub.shared,
              attrs: { id: 'ics-edit-shared' },
            })}
          </div>
        </div>
        <div class="form-group">
          <label class="form-label" for="ics-edit-assignee">${t('settings.sync.defaultAssignee')}</label>
          <select class="form-input" id="ics-edit-assignee">
            <option value="">${t('settings.sync.defaultAssigneeNone')}</option>
            <option value="" disabled data-loading>${t('common.loading')}</option>
          </select>
          <p class="form-hint">${t('settings.sync.defaultAssigneeHint')}</p>
        </div>
        <div id="ics-edit-error" class="form-error" role="alert" hidden></div>
        <div class="settings-form-actions">
          <button type="button" class="btn btn--secondary" id="ics-edit-cancel">${t('common.cancel')}</button>
          <button type="submit" class="btn btn--primary">${t('settings.ics.actions.save')}</button>
        </div>
      </form>
    `,
    onSave(panel) {
      // Assignee-Optionen async nachladen — Modal öffnet sofort (kein Fetch-Block).
      const assigneeSel = panel.querySelector('#ics-edit-assignee');
      if (assigneeSel) {
        loadFamilyUsers().then((users) => {
          assigneeSel.querySelector('option[data-loading]')?.remove();
          for (const u of users) {
            const opt = document.createElement('option');
            opt.value = String(u.id);
            opt.textContent = u.display_name;
            if (Number(sub.default_assignee_user_id) === u.id) opt.selected = true;
            assigneeSel.appendChild(opt);
          }
        });
      }
      panel.querySelector('#ics-edit-cancel')?.addEventListener('click', () => closeModal());
      panel.querySelector('#ics-edit-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = panel.querySelector('[type=submit]');
        const errEl = panel.querySelector('#ics-edit-error');
        const name = panel.querySelector('#ics-edit-name').value.trim();
        const color = panel.querySelector('#ics-edit-color').value;
        const shared = panel.querySelector('#ics-edit-shared').checked ? 1 : 0;
        const assigneeVal = panel.querySelector('#ics-edit-assignee').value;
        const default_assignee_user_id = assigneeVal ? Number(assigneeVal) : null;
        errEl.hidden = true;
        submitBtn.disabled = true;
        try {
          const res = await api.patch(`/calendar/subscriptions/${sub.id}`, { name, color, shared, default_assignee_user_id });
          const idx = subs.findIndex((s) => s.id === sub.id);
          if (idx >= 0) subs[idx] = res.data;
          renderIcsList(container, subs, user);
          showToast(t('settings.ics.updatedToast'), 'success');
          closeModal({ force: true });
        } catch (err) {
          errEl.textContent = err.message || t('common.errorGeneric');
          errEl.hidden = false;
          submitBtn.disabled = false;
        }
      });
    },
  });
}

function bindIcsEvents(container, subs, user) {
  const addBtn = container.querySelector('#ics-add-btn');
  const formWrapper = container.querySelector('#ics-add-form-wrapper');
  const addForm = container.querySelector('#ics-add-form');
  const cancelBtn = container.querySelector('#ics-cancel-btn');
  const submitBtn = container.querySelector('#ics-submit-btn');
  const errorEl = container.querySelector('#ics-add-error');

  // Die Zuweisungsliste erst beim Aufklappen holen und nur einmal: Das Formular
  // steht dauerhaft im DOM, ein Nachladen bei jedem Öffnen wäre derselbe Abruf
  // ohne neues Ergebnis.
  const assigneeSel = container.querySelector('#ics-assignee');
  let assigneesLoaded = false;
  const fillAssignees = () => {
    if (assigneesLoaded || !assigneeSel) return;
    assigneesLoaded = true;
    loadFamilyUsers().then((users) => {
      assigneeSel.querySelector('option[data-loading]')?.remove();
      for (const u of users) {
        const opt = document.createElement('option');
        opt.value = String(u.id);
        opt.textContent = u.display_name;
        assigneeSel.appendChild(opt);
      }
    }).catch(() => { assigneesLoaded = false; });
  };

  addBtn?.addEventListener('click', () => {
    formWrapper.hidden = false;
    addBtn.hidden = true;
    fillAssignees();
    container.querySelector('#ics-url')?.focus();
  });

  cancelBtn?.addEventListener('click', () => {
    formWrapper.hidden = true;
    addBtn.hidden = false;
    addForm?.reset();
    errorEl.hidden = true;
  });

  addForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.hidden = true;
    const url = container.querySelector('#ics-url').value.trim();
    const name = container.querySelector('#ics-name').value.trim();
    const color = container.querySelector('#ics-color').value;
    const shared = container.querySelector('#ics-shared').checked ? 1 : 0;
    const assigneeVal = assigneeSel?.value || '';
    const default_assignee_user_id = assigneeVal ? Number(assigneeVal) : null;

    submitBtn.disabled = true;
    try {
      const res = await api.post('/calendar/subscriptions', {
        url, name, color, shared, default_assignee_user_id,
      });
      subs.push(res.data);
      renderIcsList(container, subs, user);
      addForm.reset();
      formWrapper.hidden = true;
      addBtn.hidden = false;
      if (res.syncError) {
        showToast(`${t('settings.ics.status.syncError')}: ${res.syncError}`, 'danger');
      } else {
        showToast(t('settings.ics.addedToast'), 'success');
      }
    } catch (err) {
      errorEl.textContent = err.message || t('common.errorGeneric');
      errorEl.hidden = false;
    } finally {
      submitBtn.disabled = false;
    }
  });
}

// --------------------------------------------------------------------------
// One-time calendar import (ICS file or shared feed → editable local events)
// --------------------------------------------------------------------------

function bindCalendarImport(container) {
  const form = container.querySelector('#cal-import-form');
  if (!form) return;
  const fileInput = container.querySelector('#cal-import-file');
  const urlInput = container.querySelector('#cal-import-url');
  const colorInput = container.querySelector('#cal-import-color');
  const errorEl = container.querySelector('#cal-import-error');
  const submitBtn = container.querySelector('#cal-import-submit');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.hidden = true;

    const file = fileInput.files?.[0];
    const url = urlInput.value.trim();
    if (!file && !url) {
      errorEl.textContent = t('settings.calendarImport.errorNoSource');
      errorEl.hidden = false;
      return;
    }

    submitBtn.disabled = true;
    try {
      const payload = { color: colorInput.value };
      if (file) payload.ics = await file.text();
      else payload.url = url;

      const res = await api.post('/calendar/import', payload);
      const { imported = 0, skipped = 0 } = res.data || {};
      form.reset();

      if (imported === 0 && skipped > 0) {
        showToast(t('settings.calendarImport.allDuplicates'), 'default');
      } else if (skipped > 0) {
        showToast(t('settings.calendarImport.successWithSkipped', { count: imported, skipped }), 'success');
      } else {
        showToast(t('settings.calendarImport.success', { count: imported }), 'success');
      }
    } catch (err) {
      errorEl.textContent = err.message || t('common.errorGeneric');
      errorEl.hidden = false;
    } finally {
      submitBtn.disabled = false;
    }
  });
}

// --------------------------------------------------------------------------
// More providers (Google · Apple)
// --------------------------------------------------------------------------

function buildGoogleProvider(googleStatus, user) {
  const section = document.createElement('div');
  section.className = 'settings-card settings-provider';
  section.id = `${GOOGLE_PROVIDER_ID}-panel`;

  const header = document.createElement('div');
  header.className = 'settings-provider__header';
  const title = document.createElement('h4');
  title.className = 'settings-provider__name';
  title.textContent = t('settings.googleCalendar');
  const badge = document.createElement('span');
  badge.className = 'badge badge--neutral settings-provider__badge';
  badge.textContent = t('settings.providerSpecific');
  header.append(title, badge);
  section.appendChild(header);

  const status = document.createElement('p');
  status.className = 'settings-sync-info__status';
  status.textContent = providerConnectionStatus(googleStatus);
  section.appendChild(status);

  if (!googleStatus?.configured) {
    section.appendChild(buildProviderHint(t('settings.notConfigured')));
    return section;
  }

  if (googleStatus.connected && user?.role === 'admin') {
    section.appendChild(buildGoogleCalendarPicker());
    section.appendChild(buildGoogleReadonlyToggle(googleStatus));
  }

  const actions = document.createElement('div');
  actions.className = 'settings-sync-actions';
  if (googleStatus.connected) {
    const syncBtn = document.createElement('button');
    syncBtn.type = 'button';
    syncBtn.className = 'btn btn--secondary';
    syncBtn.textContent = t('settings.syncNow');
    syncBtn.addEventListener('click', async () => {
      syncBtn.disabled = true;
      syncBtn.textContent = t('settings.synchronizing');
      try {
        await api.post('/calendar/google/sync', {});
        showToast(t('settings.syncSuccess', { provider: 'Google Calendar' }), 'success');
      } catch (err) {
        showToast(err.message || t('common.errorGeneric'), 'danger');
      } finally {
        syncBtn.disabled = false;
        syncBtn.textContent = t('settings.syncNow');
      }
    });
    actions.appendChild(syncBtn);

    if (user?.role === 'admin') {
      const disconnectBtn = document.createElement('button');
      disconnectBtn.type = 'button';
      disconnectBtn.className = 'btn btn--danger-outline';
      disconnectBtn.textContent = t('settings.disconnect');
      disconnectBtn.addEventListener('click', async () => {
        if (!await confirmModal(t('settings.googleDisconnectConfirm'),
          { danger: true, detail: t('settings.googleDisconnectConfirmDetail') })) return;
        try {
          await api.delete('/calendar/google/disconnect');
          showToast(t('settings.disconnectedToast', { provider: 'Google Calendar' }), 'default');
          window.yuvomi?.navigate('/settings/sync/calendar');
        } catch (err) {
          showToast(err.message || t('common.errorGeneric'), 'danger');
        }
      });
      actions.appendChild(disconnectBtn);
    }
  } else if (user?.role === 'admin') {
    const connect = document.createElement('a');
    connect.href = '/api/v1/calendar/google/auth';
    connect.className = 'btn btn--primary';
    connect.textContent = t('settings.connectGoogle');
    actions.appendChild(connect);
  } else {
    section.appendChild(buildProviderHint(t('settings.googleOnlyAdmin')));
  }
  if (actions.childElementCount) section.appendChild(actions);

  return section;
}

function buildProviderHint(text) {
  const hint = document.createElement('p');
  hint.className = 'form-hint';
  hint.textContent = text;
  return hint;
}

function buildGoogleCalendarPicker() {
  const group = document.createElement('div');
  group.className = 'form-group settings-google-calendars';

  const label = document.createElement('label');
  label.className = 'form-label';
  label.textContent = t('settings.googleCalendarsSelect');
  group.appendChild(label);

  const list = document.createElement('div');
  list.className = 'google-calendars-list';
  const loading = document.createElement('p');
  loading.className = 'form-hint';
  loading.textContent = t('common.loading');
  list.appendChild(loading);
  group.appendChild(list);

  const hint = document.createElement('p');
  hint.className = 'form-hint';
  hint.textContent = t('settings.googleCalendarsSelectHint');
  group.appendChild(hint);

  (async () => {
    try {
      const { data } = await api.get('/calendar/google/calendars');
      const calendars = data || [];
      list.replaceChildren();
      for (const cal of calendars) {
        const item = document.createElement('label');
        item.className = 'caldav-calendar-item';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'google-calendar-checkbox';
        checkbox.checked = Boolean(cal.enabled);

        const dot = document.createElement('span');
        dot.className = 'caldav-calendar-color';
        dot.style.backgroundColor = cal.backgroundColor || 'var(--color-accent)';

        const name = document.createElement('span');
        name.className = 'caldav-calendar-name';
        name.textContent = cal.summary || cal.id;

        item.append(checkbox, dot, name);
        // Wie bei CalDAV vor dem Haken setzbar (#730) - hier zählt es doppelt:
        // Das Aktivieren startet den Sync unmittelbar (PATCH /google/calendars),
        // eine Zuweisung danach käme für die erste Ladung immer zu spät.
        item.appendChild(buildCalendarAssigneeSelect({
          source: 'google',
          externalId: cal.id,
          currentId: cal.default_assignee_user_id,
        }));
        list.appendChild(item);

        checkbox.addEventListener('change', async () => {
          const enabled = checkbox.checked;
          await withBusy(checkbox, async () => {
            try {
              await api.patch('/calendar/google/calendars', { calendarId: cal.id, enabled });
              showToast(
                enabled ? t('settings.calendarEnabled') : t('settings.calendarDisabled'),
                'success',
              );
            } catch (err) {
              checkbox.checked = !enabled;
              showToast(err.message || t('common.errorGeneric'), 'danger');
            }
          });
        });
      }
    } catch (err) {
      const p = document.createElement('p');
      p.className = 'form-hint';
      p.textContent = err.message || t('common.errorGeneric');
      list.replaceChildren(p);
    }
  })();

  return group;
}

function buildGoogleReadonlyToggle(googleStatus) {
  const group = document.createElement('div');
  group.className = 'form-group';

  const row = createToggleRow({
    label: t('settings.googleReadonly'),
    checked: Boolean(googleStatus.readonly),
  });
  const checkbox = row.querySelector('input');
  group.appendChild(row);

  const hint = document.createElement('p');
  hint.className = 'form-hint';
  hint.textContent = t('settings.googleReadonlyHint');
  group.appendChild(hint);

  checkbox.addEventListener('change', async () => {
    const enabled = checkbox.checked;
    await withBusy(checkbox, async () => {
      try {
        await api.put('/calendar/google/readonly', { readonly: enabled });
      } catch (err) {
        checkbox.checked = !enabled;
        showToast(err.message || t('common.errorGeneric'), 'danger');
      }
    });
  });

  return group;
}

function buildAppleProvider(appleStatus, user) {
  const section = document.createElement('div');
  section.className = 'settings-card settings-provider';
  section.id = `${APPLE_PROVIDER_ID}-panel`;

  const header = document.createElement('div');
  header.className = 'settings-provider__header';
  const title = document.createElement('h4');
  title.className = 'settings-provider__name';
  title.textContent = t('settings.appleCalendar');
  const badge = document.createElement('span');
  badge.className = 'badge badge--warning settings-provider__badge settings-legacy-badge';
  badge.textContent = t('settings.legacy');
  header.append(title, badge);
  section.appendChild(header);

  const status = document.createElement('p');
  status.className = 'settings-sync-info__status';
  status.textContent = providerConnectionStatus(appleStatus);
  section.appendChild(status);

  const legacyHint = document.createElement('p');
  legacyHint.className = 'form-hint settings-legacy-hint';
  legacyHint.textContent = t('settings.appleLegacyHint');
  section.appendChild(legacyHint);

  if (appleStatus?.configured) {
    const actions = document.createElement('div');
    actions.className = 'settings-sync-actions';

    const syncBtn = document.createElement('button');
    syncBtn.type = 'button';
    syncBtn.className = 'btn btn--secondary';
    syncBtn.textContent = t('settings.syncNow');
    syncBtn.addEventListener('click', async () => {
      syncBtn.disabled = true;
      syncBtn.textContent = t('settings.synchronizing');
      try {
        await api.post('/calendar/apple/sync', {});
        showToast(t('settings.syncSuccess', { provider: 'Apple Calendar' }), 'success');
      } catch (err) {
        showToast(err.message || t('common.errorGeneric'), 'danger');
      } finally {
        syncBtn.disabled = false;
        syncBtn.textContent = t('settings.syncNow');
      }
    });
    actions.appendChild(syncBtn);

    if (appleStatus.connected && user?.role === 'admin') {
      const disconnectBtn = document.createElement('button');
      disconnectBtn.type = 'button';
      disconnectBtn.className = 'btn btn--danger-outline';
      disconnectBtn.textContent = t('settings.disconnect');
      disconnectBtn.addEventListener('click', async () => {
        if (!await confirmModal(t('settings.appleDisconnectConfirm'),
          { danger: true, detail: t('settings.appleDisconnectConfirmDetail') })) return;
        try {
          await api.delete('/calendar/apple/disconnect');
          showToast(t('settings.disconnectedToast', { provider: 'Apple Calendar' }), 'default');
          window.yuvomi?.navigate('/settings/sync/calendar');
        } catch (err) {
          showToast(err.message || t('common.errorGeneric'), 'danger');
        }
      });
      actions.appendChild(disconnectBtn);
    }
    section.appendChild(actions);
  } else if (user?.role === 'admin') {
    section.appendChild(buildAppleConnectForm());
  } else {
    section.appendChild(buildProviderHint(t('settings.appleOnlyAdmin')));
  }

  return section;
}

function buildAppleConnectForm() {
  const form = document.createElement('form');
  form.className = 'settings-form settings-form--compact';
  form.insertAdjacentHTML('beforeend', `
    <div class="form-group">
      <label class="form-label" for="apple-caldav-url">${t('settings.caldavUrlLabel')}</label>
      <input class="form-input" type="url" id="apple-caldav-url" placeholder="${t('settings.caldavUrlPlaceholder')}" required />
    </div>
    <div class="form-group">
      <label class="form-label" for="apple-username">${t('settings.appleIdLabel')}</label>
      <input class="form-input" type="email" id="apple-username" autocomplete="username" required />
    </div>
    <div class="form-group">
      <label class="form-label" for="apple-password">${t('settings.applePasswordLabel')}</label>
      <input class="form-input" type="password" id="apple-password" autocomplete="current-password" required />
      <span class="form-hint">${t('settings.applePasswordHint')}</span>
    </div>
    <div id="apple-connect-error" class="form-error" role="alert" hidden></div>
    <button type="submit" class="btn btn--primary" id="apple-connect-btn">${t('settings.appleConnectBtn')}</button>
  `);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = form.querySelector('#apple-connect-error');
    errorEl.hidden = true;
    const url = form.querySelector('#apple-caldav-url').value.trim();
    const username = form.querySelector('#apple-username').value.trim();
    const password = form.querySelector('#apple-password').value;
    const btn = form.querySelector('#apple-connect-btn');

    btn.disabled = true;
    btn.textContent = t('settings.appleConnecting');
    try {
      await api.post('/calendar/apple/connect', { url, username, password });
      showToast(t('settings.appleConnectedToast'), 'success');
      window.yuvomi?.navigate('/settings/sync/calendar');
    } catch (err) {
      errorEl.textContent = err.message || t('common.errorGeneric');
      errorEl.hidden = false;
    } finally {
      btn.disabled = false;
      btn.textContent = t('settings.appleConnectBtn');
    }
  });

  return form;
}

async function renderMoreProviders(container, user) {
  const host = container.querySelector('#sync-more-providers-container');
  if (!host) return;

  let googleStatus = null;
  let appleStatus = null;
  const [gRes, aRes] = await Promise.allSettled([
    api.get('/calendar/google/status'),
    api.get('/calendar/apple/status'),
  ]);
  if (gRes.status === 'fulfilled') googleStatus = gRes.value;
  if (aRes.status === 'fulfilled') appleStatus = aRes.value;

  const panel = document.createElement('div');
  panel.className = 'settings-providers';
  panel.appendChild(buildGoogleProvider(googleStatus, user));
  panel.appendChild(buildAppleProvider(appleStatus, user));

  const disclosure = createDisclosure({
    id: MORE_PROVIDERS_ID,
    summary: t('settings.moreProviders'),
    expanded: false,
    content: panel,
  });
  host.replaceChildren(disclosure);
  window.lucide?.createIcons({ el: host });
}

// --------------------------------------------------------------------------
// OAuth callback banner
// --------------------------------------------------------------------------

function expandMoreProviders(container, provider) {
  const trigger = container.querySelector(`#${MORE_PROVIDERS_ID}-trigger`);
  const panel = container.querySelector(`#${MORE_PROVIDERS_ID}-panel`);
  if (trigger && panel) {
    trigger.setAttribute('aria-expanded', 'true');
    panel.hidden = false;
    trigger.focus({ preventScroll: true });
  }
  const providerPanelId = provider === 'apple'
    ? `${APPLE_PROVIDER_ID}-panel`
    : `${GOOGLE_PROVIDER_ID}-panel`;
  container.querySelector(`#${providerPanelId}`)?.scrollIntoView({ block: 'nearest' });
}

function handleOAuthCallback(container, query) {
  const params = query instanceof URLSearchParams
    ? query
    : new URLSearchParams(query || '');
  const syncOk = params.get('sync_ok');
  const syncErr = params.get('sync_error');
  if (!syncOk && !syncErr) return;

  const banner = container.querySelector('#sync-calendar-banner');
  if (banner) {
    const provider = syncOk || syncErr;
    const message = syncOk
      ? (syncOk === 'google' ? t('settings.syncSuccessGoogle') : t('settings.syncSuccessApple'))
      : (syncErr === 'google' ? t('settings.syncErrorGoogle') : t('settings.syncErrorApple'));
    const el = document.createElement('div');
    el.className = `settings-banner ${syncOk ? 'settings-banner--success' : 'settings-banner--error'}`;
    el.setAttribute('role', syncOk ? 'status' : 'alert');
    el.textContent = message;
    banner.replaceChildren(el);
    expandMoreProviders(container, provider);
  }

  // Strip only the OAuth callback parameters, keep everything else.
  try {
    const url = new URL(location.href);
    url.searchParams.delete('sync_ok');
    url.searchParams.delete('sync_error');
    history.replaceState(history.state, '', url.pathname + url.search + url.hash);
  } catch {
    // location parsing can fail in restricted contexts; ignore.
  }
}

// --------------------------------------------------------------------------
// Entry point
// --------------------------------------------------------------------------

export async function render(container, { user, query } = {}) {
  renderPage(container, user);
  bindCalDAVAddButton(container, user);

  let icsSubs = [];
  const [icsRes] = await Promise.allSettled([api.get('/calendar/subscriptions')]);
  if (icsRes.status === 'fulfilled') icsSubs = icsRes.value.data || [];
  renderIcsList(container, icsSubs, user);
  bindIcsEvents(container, icsSubs, user);
  bindCalendarImport(container);

  await loadCalDAVAccounts(container, user);
  await renderMoreProviders(container, user);

  handleOAuthCallback(container, query);

  window.lucide?.createIcons({ el: container });
}
