import { t } from '/i18n.js';
import { toggleRowHtml } from '/settings/components.js';
import { getPreferences, savePreferences } from '/settings/preferences-cache.js';

/**
 * Gesundheits-Ansichten, die nur für mich gelten (#760).
 *
 * Eigenes Blatt und nicht in `modules-options`: ob der Haushalt den Zyklus
 * überhaupt führt, ist eine Admin-Entscheidung und steht dort. Ob ich ihn sehen
 * will, ist meine - und nicht jede Person im Haushalt hat einen Zyklus. Das
 * adminOnly-`modules-options` könnten fünf von sechs Familienmitgliedern gar
 * nicht öffnen; derselbe Fehler steckte schon einmal in `modules-calendar`
 * (Critique 2026-07-27) und in `sync-reminders` (#695).
 *
 * Die beiden Schalter verrechnet der Server zu `health_cycle_effective`; hier
 * wird nur gezeigt, welcher von beiden gerade das Sagen hat.
 */

function renderPage(container, preferences) {
  // Der Haushalt hat den Zyklus abgeschaltet: dann ändert der persönliche
  // Schalter nichts mehr. Ihn trotzdem bedienbar zu lassen wäre eine Lüge über
  // die eigene Wirkung, also wird er gesperrt und der Grund benannt.
  const householdEnabled = preferences.health_cycle_enabled !== false;
  const personalEnabled = preferences.health_cycle_enabled_user !== false;

  container.replaceChildren();
  container.insertAdjacentHTML('beforeend', `
    <section class="settings-section">
      <!-- Bewusst NICHT der Blatt-Titel "Gesundheit": die Shell zeigt ihn bereits
           darüber, und ein h2, das ihn wiederholt, ist eine Überschrift ohne
           Aussage (Guard in test-typography.js). -->
      <h2 class="settings-section__title">${t('health.tabs.cycle')}</h2>
      <div class="settings-card">
        <p class="settings-card-description">${t('settings.healthCyclePersonalHint')}</p>
        ${toggleRowHtml({
          label: t('settings.healthCyclePersonalLabel'),
          checked: personalEnabled,
          disabled: !householdEnabled,
          attrs: { id: 'health-cycle-personal' },
        })}
        ${householdEnabled ? '' : `<p class="form-hint">${t('settings.healthCyclePersonalHouseholdOff')}</p>`}
      </div>
    </section>
  `);
}

function bindEvents(container) {
  const input = container.querySelector('#health-cycle-personal');
  input?.addEventListener('change', async () => {
    input.disabled = true;
    try {
      await savePreferences({ health_cycle_enabled_user: input.checked });
      window.yuvomi?.showToast(t('settings.healthCyclePersonalSaved'), 'success');
    } catch (error) {
      input.checked = !input.checked; // Rollback nur bei Save-Fehler
      window.yuvomi?.showToast(error.message || t('common.errorGeneric'), 'danger');
    } finally {
      if (input.isConnected) input.disabled = false;
    }
  });
}

export async function render(container, { user }) {
  void user;
  const preferences = await getPreferences();
  renderPage(container, preferences);
  bindEvents(container);
}
