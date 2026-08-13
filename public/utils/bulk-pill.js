/**
 * Modul: Sammelaktions-Pille
 * Zweck: WO die Sammelaktion einer Liste lebt - einmal, für die Shell, die die
 *        Schicht anlegt, und für jede Seite, die eine Teilmenge anbietet.
 *
 * ANLASS (Etappe 5, 2026-08-13): die Leiste stand als statischer Block ÜBER der
 * Liste und kostete dort gemessene 358x103px bei y=113 - der Scroller begann
 * dadurch erst bei y=216 statt 113, also 103 von 552px Listenfläche, sobald ein
 * einziger Artikel abgehakt war. Die 103px kamen aus `flex-wrap`: Label auf
 * Zeile eins, beide Knöpfe auf Zeile zwei.
 *
 * SIE IST JETZT SHELL, KEIN INHALT. Das Material war die Entscheidung
 * (2026-08-12): Shell-Glas wie der Undo-Toast, weil es diese Schicht schon gibt
 * und sie genau EIN Material hat. Damit fällt auch der Modulton weg - in der
 * Shell-Schicht gilt Shell-Material, nicht Modul-Tinte.
 *
 * DER WOHNORT IST DERSELBE STAPEL WIE DER TOAST, und das löst den einzigen
 * echten Zielkonflikt: beide sind fixiert am selben unteren Rand. Als
 * Geschwister in EINER Spalte (`.shell-bottom-stack`, layout.css) rechnet
 * Flexbox das Ausweichen selbst - der Toast bleibt, wo Toasts immer stehen (er
 * ist der mit der Fünf-Sekunden-Frist), die Pille rutscht um genau eine
 * Toasthöhe hoch. Kein `:has()`, keine Variable für eine Höhe, die nicht
 * konstant wäre.
 *
 * SIE IST EINZEILIG PER KONSTRUKTION, sonst ist sie der Block von vorher in
 * dunkel: die Aktionen sind Kapseln auf dem Toast-Material (`.toast__undo`
 * teilt sich die Regel mit `.list-bulkbar__action`), nicht `.btn`-Knöpfe mit
 * Icon. Der Rang bei Enge: die Aktionen schrumpfen nie, das Label gibt nach -
 * es führt mit der Zahl, und die überlebt die Kürzung.
 *
 * NICHT im aria-live-Bereich der Toasts: die Pille steht dauerhaft und ist eine
 * Bedienung, keine Meldung. Eine Live-Region würde jede Änderung der Zahl
 * ansagen und den Toasts ins Wort fallen.
 */
export const BULK_PILL_LAYER = 'bulk-pill-layer';

/** Die Schicht, oder null, solange die Shell noch nicht steht. */
export function bulkPillLayer() {
  return document.getElementById(BULK_PILL_LAYER);
}

/**
 * Setzt die Pille (und ersetzt eine bestehende).
 *
 * @param {object} spec
 * @param {string} spec.label   Was die Teilmenge IST - führt mit der Zahl.
 * @param {Array<{label: string, ariaLabel?: string, count?: number, onClick: (btn: HTMLButtonElement) => void}>} spec.actions
 *   `count` setzt eine Marke an die Kapsel, sichtbar erst dort, wo das Subjekt
 *   wegfällt (siehe unten). Gedacht für die Aktion, bei der ein fehlendes
 *   Objekt teuer ist.
 */
export function setBulkPill({ label, actions = [] }) {
  const layer = bulkPillLayer();
  if (!layer) return null;

  const bar = document.createElement('div');
  bar.className = 'list-bulkbar';
  // `group` plus Beschriftung: die Pille steht visuell losgelöst von ihrer
  // Liste, und ohne Rolle wäre sie für die Tastatur nur eine Folge von zwei
  // Knöpfen ohne Bezug. Die erklärende Zeile IST der Bezug.
  bar.setAttribute('role', 'group');

  // SUBJEKT, NICHT LABEL. Die Zeile beschriftet nicht die Knöpfe - die tragen
  // ihre eigenen Wörter -, sie nennt, WORAUF sie wirken. Der alte Name
  // `__label` las sich neben `__action` wie dessen Beschriftung, und der
  // Label-Verlust-Guard hat ihn genau so gelesen: er verlangte für die Kapseln
  // die volle Zielgröße, sobald das Subjekt bei 320px wegfällt. Der Guard hatte
  // recht über den Namen und unrecht über die Sache.
  //
  // Und `aria-labelledby` überlebt das Wegfallen: ein per `aria-labelledby`
  // referenzierter Knoten geht auch dann in den Namen ein, wenn er
  // `display: none` trägt - am Telefon bei 320px sieht man die Zahl nicht mehr,
  // ein Screenreader hört sie weiterhin.
  const subject = document.createElement('span');
  subject.className = 'list-bulkbar__subject';
  subject.id = 'bulk-pill-subject';
  subject.textContent = label;
  bar.setAttribute('aria-labelledby', subject.id);
  bar.appendChild(subject);

  for (const action of actions) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'list-bulkbar__action';
    btn.textContent = action.label;
    if (action.ariaLabel) btn.setAttribute('aria-label', action.ariaLabel);
    // DIE ZAHL HOLT DAS SUBJEKT EIN, WENN ES WEGFÄLLT (Etappe 6, 2026-08-13).
    // Bei 320px steht die Pille ohne ihre Zeile da, und übrig blieben zwei
    // Kapseln ohne genanntes Objekt - über einer Liste mit 23 Artikeln und bei
    // „Löschen" ohne Rückfrage. Gemessen: „Löschen" plus Marke bleibt bei rund
    // 191 von 264px Innenbreite einzeilig.
    //
    // Als MARKE, nicht als „(3)": „Beschriftung plus Anzahl daneben" ist ein
    // Muster, das die Listen-Tabs schon sprechen. Eine eigene Klammer-
    // Schreibweise wäre ein zweites Vokabular für dieselbe Aussage - und eine
    // Zahl ist keine Sprache, also braucht sie auch keinen Locale-Key.
    // Der Name der Kapsel ändert sich dadurch nicht: `aria-label` schlägt den
    // Inhalt, die Zahl steht dort ohnehin schon.
    if (action.count != null) {
      const count = document.createElement('span');
      count.className = 'list-bulkbar__action-count';
      count.textContent = String(action.count);
      btn.appendChild(count);
    }
    btn.addEventListener('click', () => action.onClick(btn));
    bar.appendChild(btn);
  }

  layer.replaceChildren(bar);
  return bar;
}

/**
 * Nimmt die Pille weg. Entfernt statt `hidden`: die Schicht ist leer, wenn es
 * keine Teilmenge gibt, und `.shell-bottom-stack > :empty` nimmt sie damit aus
 * dem Stapel - eine leere Zelle zöge sonst ihre Lücke zwischen die Toasts.
 */
export function clearBulkPill() {
  bulkPillLayer()?.replaceChildren();
}
