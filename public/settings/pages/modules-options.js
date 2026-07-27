import { api } from '/api.js';
import { t } from '/i18n.js';

/**
 * Drei Modul-Schalter, die vor dem IA-Umbau je ein eigenes Blatt hatten: Budget,
 * Gesundheit und Haushaltshilfe trugen zusammen drei Checkboxen, kosteten aber
 * drei Sidebar-Einträge, drei Navigationsschritte und drei Requests
 * (Critique 2026-07-27). Ein Schalter je Karte, ein Blatt.
 */
const APPEARANCE_PATH = '/settings/personal/appearance';

const TOGGLES = [
  {
    id: 'budget-mode-personal',
    key: 'budget_mode',
    // Der einzige Nicht-Boolean: die Route erwartet den Modus als String.
    read: (preferences) => preferences.budget_mode === 'personal',
    payload: (checked) => ({ budget_mode: checked ? 'personal' : 'shared' }),
    savedKey: 'settings.budgetModeSaved',
  },
  {
    id: 'health-cycle-enabled',
    key: 'health_cycle_enabled',
    read: (preferences) => preferences.health_cycle_enabled !== false,
    payload: (checked) => ({ health_cycle_enabled: checked }),
    savedKey: 'settings.healthCycleSaved',
  },
  {
    id: 'housekeeping-payment-tasks',
    key: 'housekeeping_payment_tasks',
    read: (preferences) => Boolean(preferences.housekeeping_payment_tasks),
    payload: (checked) => ({ housekeeping_payment_tasks: checked }),
    savedKey: 'settings.housekeepingPaymentTasksSaved',
  },
];

function checkedState(preferences) {
  return new Map(TOGGLES.map((toggle) => [toggle.id, toggle.read(preferences)]));
}

function renderPage(container, preferences) {
  const checked = checkedState(preferences);
  const attr = (id) => (checked.get(id) ? ' checked' : '');
  container.replaceChildren();
  container.insertAdjacentHTML('beforeend', `
    <section class="settings-section">
      <h2 class="settings-section__title">${t('settings.sectionBudget')}</h2>
      <div class="settings-card">
        <h3 class="settings-card__title">${t('settings.budgetModeTitle')}</h3>
        <p class="form-hint">${t('settings.budgetModeHint')}</p>
        <label class="toggle-row">
          <input type="checkbox" id="budget-mode-personal"${attr('budget-mode-personal')}>
          <span>${t('settings.budgetModePersonalLabel')}</span>
        </label>
        <p class="form-hint">
          ${t('settings.currencyMovedHint')}
          <a href="${APPEARANCE_PATH}" id="budget-region-link">${t('settings.regionTitle')}</a>
        </p>
      </div>
    </section>

    <section class="settings-section">
      <h2 class="settings-section__title">${t('nav.health')}</h2>
      <div class="settings-card">
        <h3 class="settings-card__title">${t('health.tabs.cycle')}</h3>
        <p class="form-hint">${t('settings.healthCycleHint')}</p>
        <label class="toggle-row">
          <input type="checkbox" id="health-cycle-enabled"${attr('health-cycle-enabled')}>
          <span>${t('settings.healthCycleEnableLabel')}</span>
        </label>
      </div>
    </section>

    <section class="settings-section">
      <h2 class="settings-section__title">${t('settings.sectionHousekeeping')}</h2>
      <div class="settings-card">
        <h3 class="settings-card__title">${t('settings.housekeepingPaymentsTitle')}</h3>
        <p class="form-hint">${t('settings.housekeepingPaymentTasksHint')}</p>
        <label class="toggle-row">
          <input type="checkbox" id="housekeeping-payment-tasks"${attr('housekeeping-payment-tasks')}>
          <span>${t('settings.housekeepingPaymentTasksLabel')}</span>
        </label>
      </div>
    </section>
  `);
}

function bindEvents(container) {
  const link = container.querySelector('#budget-region-link');
  link?.addEventListener('click', (event) => {
    if (!window.yuvomi?.navigate) return;
    event.preventDefault();
    window.yuvomi.navigate(APPEARANCE_PATH);
  });

  for (const toggle of TOGGLES) {
    const input = container.querySelector(`#${toggle.id}`);
    input?.addEventListener('change', async () => {
      input.disabled = true;
      try {
        await api.put('/preferences', toggle.payload(input.checked));
        window.yuvomi?.showToast(t(toggle.savedKey), 'success');
      } catch (error) {
        input.checked = !input.checked; // Rollback nur bei Save-Fehler
        window.yuvomi?.showToast(error.message || t('common.errorGeneric'), 'danger');
      } finally {
        if (input.isConnected) input.disabled = false;
      }
    });
  }
}

export async function render(container, { user }) {
  void user;
  const response = await api.get('/preferences');
  const preferences = response?.data ?? {};
  renderPage(container, preferences);
  bindEvents(container);
}
