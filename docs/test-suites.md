# Test-Suiten

Vollständige, annotierte Liste aller `npm run test:*`-Suiten - welche Suite deckt welche Invariante ab.

Testinfrastruktur: In-Memory-SQLite (`--experimental-sqlite`), Node >= 22. Kein laufender Server nötig - Tests importieren die Route-Handler direkt.

Neue Suite - drei Schritte, alle drei Pflicht: (1) `test/test-[module].js` anlegen, (2) `test:[module]`-Skript in `package.json` eintragen, (3) das Skript in die `test`-Kette (`package.json`, Script `test`) einhängen - sonst läuft die Suite weder unter `npm test` noch in CI. Genau so sind fünf Suiten monatelang CI-blind geblieben. Imports von App-Code (`server/`, `public/`, `tools/`) und Root-Dateien via `../`.

```bash
npm test             # Alle Suiten (Node >=22)
npm run test:db
npm run test:rename-migration   # Oikos→Yuvomi Identifier-Migration: seamless rename invariants
npm run test:schema-reconcile   # Schema-Selbstheilung gegen Migrations-Drift (#538): reconcileCriticalSchema ergänzt fehlende Spalten, obwohl die Migration als angewendet vermerkt ist
npm run test:db-encryption      # DB_ENCRYPTION_KEY wirkt wirklich: Datei-Header verschlüsselt, Bestands-DB wird migriert, falscher Key bricht den Start ab
npm run test:db-isolation       # Test-Isolation: keine Suite lädt server/db.js ohne wirksames DB_PATH (init() beim Import würde sonst eine echte yuvomi.db im Repo-Root anlegen); prüft auch die Reihenfolge, da eine Zuweisung nach einem statischen Import zu spät kommt
npm run test:suite-chain        # Suite-Registry-Guard: jedes test:*-Script hängt in der npm-test-Kette (5 Suiten liefen 2026 monatelang CI-blind) + jede test/test-*.js hat ein Script
npm run test:tasks
npm run test:tasks-recurrence   # recurring task catch-up: nextOccurrenceAfter + Folgeinstanz über BEIDE Wege (PATCH status und PUT /:id, #650), Rücknahme, Vorlauf start_date→due_date; Atomarität via Trigger (scheitert der Spawn, bleibt die Aufgabe offen); Anker ab Erledigungstag (#658): nextDueAfterCompletion, Vererbung des Ankers auf die Folgeinstanz, POST/PUT-Rundreise (TZ=UTC festgenagelt, sonst wackelt "heute")
npm run test:tasks-routes       # Tasks-Routen-Schicht: PUT/:id, meta/options, Kategorie-CRUD (404/400/409), Filter (Mehrfachwerte je Achse ODER-verknüpft, #671), Verschachtelung, PATCH-Status, DELETE; Archiv als eigene Achse (#688): Ablegen lässt den Status stehen und storniert keine Punkte, Zurückholen bringt ihn unverändert wieder, Listen blenden das Archiv aus bis ?archived=1/only bzw. ?status=archived danach fragt
npm run test:task-default-points # Standard-Punkte (#578): Preference admin-only + Validierung, Prefill nur ohne expliziten Wert und nur für Hauptaufgaben, Rebase fasst nur offene Hauptaufgaben an (erledigte Punkte sind im Ledger gebucht)
npm run test:task-categories    # Aufgaben-Kategorien (#494/#357): Migration (Seed, Sonstiges→misc, Orphan-Adoption) + CRUD-Guards
npm run test:visibility         # Sichtbarkeit (#474): all|assignees|private Durchsetzung (Tasks+Termine), kein Admin-Bypass, normalizeVisibility
npm run test:sync-default-assignee   # Standard-Zuweisung pro Sync-Ziel (#459): assignDefaultToEvent (neu-only, idempotent, No-op bei verwaister Person)
npm run test:rewards            # Belohnungen: Punkte-Vergabe/Storno/Idempotenz, Katalog, Einlösen mit Freigabe, Bonus, Ledger
npm run test:rewards-routes     # Belohnungs-Routen: requireAdmin-Gates, Redemption-Autorisierung (Nicht-Admin nur für sich/Admin stellvertretend), Eltern-Freigabe pending vs. autoFulfill, 409-Idempotenz, Punkte-Reservierung/Rückbuchung
npm run test:health-overview    # Gesundheit: Übersichts-Tab
npm run test:health-vitals      # Gesundheit: Vitalwerte-Tab - Zeitraum-Bucketing/Aggregation plus das Anzeigeformat je Metrik (Paar/Dauer/Skala), Schlaf-Umrechnung Stunden↔Dezimalstunden und die Stufen-Klemmung der Stimmungsskala; der Längen-Guard über VITAL_TYPES macht jede neue Metrik sichtbar, statt sie einsickern zu lassen (#683: Größe + Kopfumfang, roh und ohne geklemmte Achse)
npm run test:health-meds        # Gesundheit: Medikamente-Tab
npm run test:health-labs        # Gesundheit: Laborwerte-Tab
npm run test:health-activity    # Gesundheit: Aktivitäts-Tab
npm run test:health-cycle       # Gesundheit: Zyklus-Tab (#450)
npm run test:health-export      # Gesundheit: CSV-Export - Formel-Injection-Schutz, Header/Spaltenbreiten-Kopplung über HEALTH_EXPORT_HEADERS, Labor-Fan-out und Zyklus-Längenberechnung
npm run test:health-api         # Gesundheit: Route-Handler + Betreuung (#584): Betreuer schreibt und liest fuer die betreute Person, Fremde erhalten 403, der Zyklus-Tab bleibt ausgenommen
npm run test:health-nav         # Gesundheit: Tab-Navigation
npm run test:health-structure   # Gesundheit: Routen-Split-Guard (45-Routen-Tabelle + Cluster-Disjunktheit)
npm run test:medication-scheduler   # Medikations-Erinnerungs-Scheduler
npm run test:shopping
npm run test:shopping-routes   # Shopping-Routen: Listen/Artikel-CRUD, Kategorie-Rename-Kaskade + Delete-Fallback + Letzte-Sperre, Essensplan-Import-Aggregation, Handsortierung je Kategorie (#678: vollstaendige Gruppe Pflicht, fremde IDs beruehren keine fremden Raenge, Kategoriewechsel und Delete-Umzug stellen hinten an, abgehaktes bleibt trotz Rang am Ende)
npm run test:shopping-order-migration   # Migration v133 (#678): der Backfill erhaelt die bisher sichtbare Reihenfolge (created_at) und nummeriert je (Liste, Kategorie); der Trigger stellt neue Zeilen ans Ende - auch die aus den sechs Modulen, die an der Route vorbei einfuegen
npm run test:meals
npm run test:meals-routes   # Meals-Routen: Validierung/404, Wiederholungs-Serien (Template/Exceptions/Instanzen, scope=series), Zutaten-CRUD, Zutaten→Einkaufsliste-Transfer inkl. Rücknahme (added_ids; das Undo setzt auch on_shopping_list zurück, sonst bliebe die Mahlzeit für immer „schon übertragen")
npm run test:recipes-routes   # Recipes-Routen: owner-403-Gate (kein Admin-Bypass), Validierung/404, Zutaten-Regeln (leerer Name, category-Default, Slicing), meal_types-Normalisierung, Replace-Set + CASCADE, Zutaten→Einkaufsliste-Transfer inkl. exakter Rücknahme über added_ids, gespiegelte Mealie-Rezepte sind serverseitig schreibgeschützt (403 auf PUT/DELETE, nicht nur in der UI ausgeblendet), Thumbnail-Proxy mit MIME-Allowlist
npm run test:pantry-routes    # Vorrats-Routen (#596): Validierung/404, Mengen-Normalisierung (Rundung/Klemmung/Default 1 statt 0), Einheit wird normalisiert statt abgelehnt, Lagerort-Guards (letzter Ort, NOCASE-Konflikt, ON DELETE SET NULL erhält Bestand), PATCH als Teil-Update, beide Import-Richtungen inkl. Chargen-Regel (gleiches MHD addiert, abweichendes MHD = eigene Zeile) Scope-Trennung (import-shopping räumt die Einkaufsliste nicht ab) und die geteilte Rücknahme (POST /shopping/items/undo-transfer: unbekannte IDs werden übergangen, removed sagt was zurückging)
npm run test:pantry-ownership-migration   # Migration v109 (#596 Follow-up): created_by nullable + ON DELETE SET NULL statt CASCADE - der Tabellen-Rebuild erhält Bestand, Lagerort, Indizes und updated_at-Trigger; das Löschen eines Mitglieds entkoppelt nur die Herkunft und vernichtet nicht den Haushaltsvorrat
npm run test:module-registry-parity       # Client-/Server-Modulregister-Parität: SCOPE_MODULE_KEYS gegen MODULE_KEYS, NAV_TO_MODULE gegen PERMISSION_MODULES.navIds, MODULE_ACCENT-Abdeckung, die drei Kitchen-Child-Listen, KITCHEN_NAV_IDS, TOGGLEABLE_MODULES und die sw.js-Caches. Fängt die Drift, die beim Vorrat alle sechs Client-Zwillinge übersprang, während der Server lückenlos verdrahtet war
npm run test:pantry-status    # Vorrats-Ableitungen (#596): Ablauf-Schwelle EXPIRY_SOON_DAYS (inklusiv, exakte Grenze), daysUntil über Monatswechsel, "fast leer" vs. "leer" (disjunkt), Filter-Zählung mit Mehrfachtreffern, Einheiten-/Mengen-Normalisierung und Stepper-Schrittweiten
npm run test:birthdays-routes   # Birthdays-Routen: Validierung/404 (Foto-Data-URL + Größenlimit), partielle COALESCE-Updates, limit-Clamp, GET-Sync-Seiteneffekt (calendar_events), Löschung inkl. Artefakt-Aufräumen
npm run test:birthday-import    # Geburtstags-Import aus Kontakten (#518): Migration v90 (contact_id + Unique-Index), Kandidaten/Import-Service (idempotent), Routen GET /import/candidates + POST /import
npm run test:birthday-localization   # Geburtstags-Lokalisierung (#524, #631, #632): Kalender-Read liefert birthday_name/birthday_date für die Client-Übersetzung; der gespeicherte Titel folgt der Datensprache des Haushalts (language → region → en), ein Sprachwechsel betitelt Bestandstermine um, der ICS-Feed exportiert die lokalisierte Fassung; Locale-Key-Parität
npm run test:calendar
npm run test:ncb            # notes, contacts, budget
npm run test:notes-routes   # Notes-Routen: Validierung (Inhalt-Pflicht, HEX-Farbe)/404, CRUD, Pin-Toggle, Pinned-zuerst-Sortierung
npm run test:contact-categories   # Kontakt-Kategorien (#357): Migration (Seed mit Icons, DE-Namen→Keys, Orphan-Adoption) + CRUD-Guards
npm run test:notes-reader   # Notizen Reader-Modus: Lese/Bearbeiten-Umschalter, i18n-Parität
npm run test:budget-recurrence   # recurring budget intervals + virtual budgeting; seit #636 Einheit + Anzahl (weekly/monthly/yearly, "alle N"): Terminaufzählung im Monat, Monatsende-Kappung, Skip je Fälligkeitstag
npm run test:budget-stats   # statistics tab: computeStatsRange, computeStats, GET /budget/stats, range CSV export
npm run test:subscriptions  # Budget subscription tracker: CRUD, renewals, currencies, SSRF-protected logo lookup
npm run test:budget-structure   # Budget-Routen-Split: 35-Routen-Tabelle + Re-Export-Fläche gepinnt; seit #637 zusätzlich die Regel, dass JEDE Summe über budget_entries erwartete Buchungen ausschließt
npm run test:budget-accounts    # Budget-Konten (#495): CRUD, laufender Saldo (Startsaldo + zugeordnete Einträge), Nettovermögen
npm run test:budget-ui          # Budget-UI-Verträge: TAB_CAPS (Zeitbezug/Neu-Aktion je Tab), Eintragsdatum folgt Monat, Tablist-/Filter-ARIA, Chart-Textalternativen + Datenreihen-Tokens, keine Text-/Farbliterale; geteilte Bausteine (v1.63.0/v1.64.0, als Regel über alle Modul-Dateien statt als Allowlist): ein Geld-Formatierer mit vier Rollen, eine Kennzahlkarte, Panel-Fläche + Kopfleiste geteilt, Arbeitsflächen opak (Glass nur mit Overlay-Rolle im Selektor), eingebettete Untertabs ohne eigenes Seiten-Chrome, eine Zeitachse (kein zweiter Stepper im Panel, Kopf-Slot nie leer), eine Umschalter-Optik (.budget-segmented, kein role="group" mit Auswahlzustand, jede tablist/radiogroup an wireTablist), Kontrast hängt nie an einer Datenfarbe; #636/#637: Intervall-Feld (Einheit + Anzahl, Einheitenwort aus rrule-ui statt zweiter Zuordnung), erwartete Buchung in der Zeile + Bestätigen-Dialog + Hinweiszeile unter den Karten
npm run test:budget-plans       # Budgetplan (#468): computePlanProgress (Plan vs. Ist + Sparziel), GET/PUT/DELETE /budget/plans
npm run test:budget-visibility  # Budget-Sichtbarkeit (#476/#505): owner-basiertes Modell (private/shared), Ansichts-Scope mine/household
npm run test:budget-routes-scope   # Budget-Routen im Personal-Modus (#476/#505): End-to-End über den echten Router, Default-Sichtbarkeit, Lese-Scope
npm run test:budget-loans-routes   # Loans-Routen: owner_id/visibility-Enforcement (#476/#505), mayEdit-Gates (kein Admin-Bypass), Repayment-Erbung, shared-Kontrast, Zins-Darlehen-Ableitung (#569), remaining_principal vs. remaining_amount in API + Summenkarte
npm run test:budget-loans-amortization   # Zins-Darlehen-Mathematik (#569): konstante Annuität, Phasenwechsel nach Zinsbindung, Restschuld nach Zinsbindung/Laufzeit-Ableitung, einphasiger variabler Modus, Schutzfälle (tilgt nicht / zu lang); Restschuld zum Ratenstand liegt unter der Summe der Restraten (Differenz = Restzinsen)
npm run test:budget-loans-migration   # Loans-Tabellen-Rebuild v101 (#569-Nachtrag, variabler Zins): Ratenzahlungen/Trigger/Indizes überleben den DROP, neuer Enum-Wert erlaubt, foreignKeysOff ist Pflicht
npm run test:budget-interval-migration # v128 (#636): half_year → monatlich x 6, Skip-Vermerke vom Monat auf den Fälligkeitstag (inkl. Monatsende-Kappung), verwaiste Vermerke fallen weg, PK/Kaskade der neuen Tabelle
npm run test:budget-entries-routes   # Eintrags-Routen: summary/export (CSV-Injektion), Filter, virtuelles Budget, Loan-Payment-Kopplung, Serien-Sichtbarkeitspropagation, Skip-Markierung (seit #636 je Tag); #637: erwartete Buchungen fehlen in allen Summen, PATCH /:id/confirm inkl. Vorzeichen-Erhalt und CSV-Status-Spalte
npm run test:split-expenses-attachments   # Belege an geteilten Ausgaben (#583-Nachrüstung): Sichtbarkeitsprüfung beim Verknüpfen/Serialisieren (privater Beleg bleibt vor der Gruppe und vor Admins verborgen), PUT ohne Feld lässt Belege stehen, fremder privater Beleg überlebt fremdes Speichern, proof_document_id einer Zahlung wird geprüft
npm run test:budget-attachments   # Belege an Buchungen (#583): attachment_document_ids in POST/PUT, Batch-Laden in GET; Sichtbarkeit des Dokumente-Moduls gilt weiter (privater Fremd-Beleg weder lesbar noch beim Speichern löschbar, kein Admin-Bypass), unbekannte IDs still verworfen, PUT ohne Feld lässt Belege stehen, Serien-PUT fasst sie nicht an, Cascade in beide Richtungen
npm run test:calendar-routes    # Kalender-Routen: GET//upcoming/search, Sichtbarkeit (kein Admin-Bypass), Serien-Expansion, requireAdmin-Sync-Gates, subscriptions/import/feed/holidays, CRUD, reset/exceptions (EXDATE)
npm run test:calendar-structure  # Kalender-Routen-Split: 46-Routen-Tabelle + Cluster-Disjunktheit + /:id-Reihenfolge-Vertrag + Re-Export-Fläche gepinnt
npm run test:calendar-exceptions  # Einzeltermin-Ausnahmen für Serien (EXDATE, #489): Migration v85 + POST /calendar/:id/exceptions
npm run test:calendar-defaults    # Standardwerte für neue Termine (#497/#498): per-User calendar_default_reminders (Offset-Liste, Cap, Validierung)
npm run test:preferences-calendar-target  # Standard-Sync-Ziel (#620): GET-Default '', PUT google:/caldav:-Kennungen, Formfehler -> 400, Per-User-Isolation, Wert auch in der PUT-Antwort
npm run test:sync-target        # Kennungsformat der Sync-Ziele (#620): bauen/zerlegen invers, Pipe in der CalDAV-URL überlebt, entfallenes Ziel bleibt sichtbar statt still zu verschwinden
npm run test:recurring-scope    # Serientermin-Scope (#532): truncateRuleBefore (RRULE-UNTIL-Kürzung) + shiftSeriesStart/shiftEndForStart + End-to-End-Expansion
npm run test:family-routes      # Family-Route GET /members: Worker-Ausschluss, NOCASE-Sortierung, LEFT JOIN contacts/birthdays
npm run test:modules        # Third-Party-Modul-Registry: Manifest-Validierung, Path-Traversal-Schutz, error-Fallback, admin-Filter, enable-Toggle, Asset-MIME
npm run test:budget-categories-routes   # Budget-Kategorien-Routen: CRUD Kategorien/Subkategorien, 409-Dubletten (NOCASE), in-use/letzte-Sperren, reorder, lokalisierte Leseliste
npm run test:reminders
npm run test:multi-reminders   # multiple reminders per calendar event: GET /reminders/all, PUT /reminders replace-set (#436)
npm run test:reminders-routes  # Reminders-Routen: HTTP-Schicht gegen den echten Router
npm run test:reminder-offset   # reminder remind_at offset calculation
npm run test:push           # Web Push: VAPID resolution, subscribe/unsubscribe routes, delivery, scheduler
npm run test:email          # SMTP-Service: config/env resolution, masking, sendMail/sendTest, admin routes
npm run test:password-reset # Reset tokens: create/verify/consume/cleanup + forgot/reset-password routes
npm run test:admin-password-reset # PATCH /auth/users/:id password field: admin sets existing member's password (#372)
npm run test:password-normalization # Passwort-Unicode: NFC-Hashing, Login mit NFD-Eingabe (Firefox/macOS), stille Migration alter NFD-Hashes, /me/password (#608)
npm run test:invites        # Einladungslinks: Token-Lebenszyklus (nur der Hash liegt in der DB, alle vier Ausschlussgründe beim Prüfen, Einlösen markiert statt löscht) + Routen: requireAdmin-Gate, CSRF, und Rolle/Familienrolle stammen aus der Einladung, nie aus dem Body des Eingeladenen
npm run test:notifications  # Notification-Kanäle (Gotify/ntfy): Provider-Mapping, Reminder-Fan-out, Admin-Routen, Payload-Body je entity_type (#581)
npm run test:mcp            # MCP-Server: JSON-RPC-Dispatch (initialize/tools/list/tools/call) + Tool-Logik (Tasks, Shopping, Kalender)
npm run test:token-scopes   # API-/MCP-Token-Scopes: scopes.js-Modell + Enforcement (tools/list-Filter, tools/call-Deny)
npm run test:permissions    # Rollen & Rechte: Resolver (Admin-Bypass, Rolle/Mitglied-Override, Widget-Kaskade), Session-Enforcement-Map, Sparse-Speicherung (#467); dazu der Abgleich der drei Widget-Listen (WIDGET_IDS in dashboard.js, PERMISSION_WIDGETS serverseitig, WIDGET_LABEL_KEYS in der Rechte-UI) - ein neues Widget fehlt sonst still in den Rechten oder trägt dort seinen rohen Slug
npm run test:permissions-routes   # Rechte-Routen: requireAdmin-Gate (kein Privilege-Escalation), Payload-Validierung, sparse-Persistenz/Round-Trip, Admin-Ziel-Sonderregel
npm run test:dashboard      # Widgets + Endpunkt; darunter der Guard, dass abgelegte Aufgaben (archived_at, #688) nicht in "Heute auf einen Blick" landen - sie tragen weiter ihren echten Status und rutschten sonst als offen durch
npm run test:ics-parser
npm run test:ics-sub        # ICS-Abos: SSRF-Guards, ETag/304, und unveränderte Läufe schreiben nicht (kein Rowid-Verbrauch, kein info-Log)
npm run test:ics-export     # ICS-Kalenderexport
npm run test:ics-import     # einmaliger ICS-/Feed-Import als bearbeitbare lokale Termine (#437)
npm run test:modal-utils
npm run test:detail-view    # Leseansicht vor dem Formular (Kalender, Aufgaben, Kontakte): Präsentationsweiche (Popover nur ab 768px UND mit Anker), die drei Fallen des Pane-Wechsels in fester Reihenfolge, Fußzeilen-Aktionen schließen mit force (versteckte Formulare zählen in den Dirty-Check), showEventPopup rückstandslos weg, neue i18n-Keys in allen Locales. Für Kontakte zusätzlich: beide Einstiege (Liste + Deep-Link) führen in die Leseansicht, edit.ready sperrt den Wechsel bis die Mehrfachwerte da sind (sonst löscht das Speichern die Zweitnummern), alle Nummern/Mails/Adressen statt der Legacy-Einzelwerte, Kontaktdaten nur über textContent, und die neuen Keys liegen unter contacts statt shopping
npm run test:category-manager   # generic oikos-category-manager component + budget wiring
npm run test:sortable-reorder   # SortableJS-Wrapper + Drag-and-Drop-Reorder im Category-Manager (Teil-Render, Fokus-Restore, aria-live, SW-Precache)
npm run test:datepicker         # yuvomi-datepicker: ISO-Wertkontrakt, form-association, Popover/Touch, min/max, i18n-Vollständigkeit
npm run test:ux-utils        # UX-Helfer: stagger/vibrate/withBusy, Datums-/Zeit-Parser, WCAG-Ink-Wahl; Undo-Löschen läuft ausschließlich über scheduleUndoableDelete (Undo verhindert den Server-Delete, ohne Undo commit nach Ablauf) - die alte deleteWithUndo-API löschte sofort und ist gesperrt
npm run test:skeleton-utils
npm run test:date-utils
npm run test:time-input     # flexible Zeiteingabe: 0930/09.30/9h30 → HH:MM parsing (#442)
npm run test:html-entities
npm run test:help
npm run test:changelog      # Changelog: GitHub-Releases-Proxy (normalizeVersion/cleanMarkdownText/parseReleaseBody/buildChangelogPayload) + der Versionsvergleich hinter dem Update-Punkt (#490): numerisch statt lexikografisch (1.10.0 > 1.9.0), v-Präfix der Tags, Vorabversion unter ihrem Release, Unlesbares löst nie einen Hinweis aus; dazu der Tag↔CHANGELOG-Paritäts-Guard (jeder getaggte Release hat einen Eintrag, kein Heading doppelt; skippt ohne Tags im Checkout)
npm run test:i18n           # App-Locales: Dateiabdeckung, Schlüsselidentität zu de.json, Platzhalter-Parität ({{name}}), 4-Space-Format
npm run test:i18n-plural    # Pluralformen in t(): Intl.PluralRules-Auswahl, Fallback auf Basisschlüssel, Varianten-Parität; dazu die Platzhalter-Ersetzung: Nutzerwerte werden eingesetzt statt interpretiert (kein `$&`/`` $` ``-Rückverweis, kein zweiter Durchgang über bereits Eingesetztes), unbekannte Platzhalter bleiben sichtbar
npm run test:lang-init
npm run test:sw-api-cache   # Service Worker: Read-only-Offline-API-Cache (Whitelist, Fallback, CLEAR_API_CACHE, activate-Cleanup)
npm run test:sw-precache    # Service Worker: Precache-Vollständigkeit (#616) - transitiver Modulgraph lückenlos gecacht, Bucket == fetch-Routing, jeder Pfad existiert (addAll ist All-or-Nothing)
npm run test:api
npm run test:openapi-structure   # OpenAPI-Modul-Split: jede paths/<modul>.js importiert+gespreadet, keine Pfad-Kollision
npm run test:multi-assignment
npm run test:kitchen-tabs
npm run test:caldav         # CalDAV-Sync: Multi-Account, Event-Loop-Yield (#519), Serien-Overrides (#549), No-op-Läufe bleiben still und schreiben unveränderte Termine nicht neu
npm run test:caldav-recurrence   # CalDAV/iOS-Serien mit Wochentags-Wiederholung (#549): FREQ=DAILY;BYDAY + DTSTART am Wochenende
npm run test:caldav-reminders   # VTODO-Inbound: Feld-Abbildung, Prune-Leerguard (#508), DUE als Wanduhrzeit statt UTC (#617; TZ=Europe/Berlin fixiert), RELATED-TO-Hierarchie inkl. Reihenfolge/Enkel/Zyklus (#671)
npm run test:caldav-todo-outbound   # Rückrichtung VTODO (#617): Patcher lässt Alarme/Kategorien stehen, Erledigt = STATUS+COMPLETED+PERCENT-COMPLETE (und weg beim Wiederöffnen), bandtreue Priorität/Status halten urgent und in_progress, DUE-Roundtrip zonenrichtig, Inbound überschreibt keine wartende Bearbeitung und legt Gelöschtes nicht neu an, ein gelöschtes Konto entkoppelt seine Spiegelzeilen statt sie unlöschbar zu machen (v123)
npm run test:caldav-event-target
npm run test:google-multi   # multiple Google calendars + per-event sync target
npm run test:google-outbound   # Löschen + Ändern + Umziehen Yuvomi → Google (#593): Tombstones, Dirty-Marker, events.move, 404/410, Retry-Limit, Inbound-Konfliktschutz; dazu Serien als Master (EXDATE aus Absagen/Verschiebungen, Altbestand-Zusammenführung nur beim Full-Resync)
npm run test:calendar-outbound-migration   # Migrationen v103-v106 gegen befüllte Bestands-DB: additiv, kein Rebuild, Marker starten neutral
npm run test:caldav-outbound   # Löschen + Ändern + Umziehen Yuvomi → CalDAV/Apple (#593): ICS-Patcher (Teilnehmer/Alarme/Overrides bleiben), Objekt-URL-Auflösung, Umzug = create+delete, Sofortversuch ohne Kalenderabruf
npm run test:google-calendar   # Google: Datumskonvertierung, Farbauflösung (#427/#219), unveränderte Events werden beim Full-Resync nicht neu geschrieben
npm run test:housekeeping
npm run test:housekeeping-routes   # Housekeeping-Routen: Worker-Anlage (Admin-Gate), Check-in/out-Lifecycle + Doppelbuchungs-Guard, Pay/Delete, Decay-CRUD, Supply-Requests, Maintenance-Log; dazu die Besuchs-Artefakte: Fallback-Titel folgen der Datensprache (ohne gesetzte Sprache bleibt Englisch), ein verschobener Besuch wird für den Provider-Push vorgemerkt und ein gelöschter räumt die Kopie beim Provider mit ab - beides nur bei gespiegelten Terminen
npm run test:documents          # Dokument-Preview: CSP-Header je MIME-Typ
npm run test:documents-ux       # Dokumente-UX-Verträge: Leerzustände, Kategorie-Facetten, Upload-Modal, Auswahlmodus, Popover-Menü
npm run test:document-storage   # Dokument-Storage-Migration und Invarianten
npm run test:google-drive-storage   # Google Drive als Dokument-Ablage: eigenes Credential-Paar (fail-closed bei halber Konfiguration), OAuth-Callback legt Yuvomi/Documents an und wählt nie Drive als Kalender
npm run test:document-folders   # Dokument-Ordner-Routen: umbenennen/löschen (PUT/DELETE) + ON DELETE SET NULL (#453)
npm run test:task-documents     # Task↔Dokument-Verknüpfungen (#503): GET/PUT /tasks/:id/documents, Sichtbarkeit, Replace-Set, document_count, CASCADE
npm run test:task-tags          # Aufgaben-Tags (#586): v114-Rebuild lässt Indizes/Suchtrigger intakt, Tags bleiben von der Kategorie getrennt, /tags und meta/options zeigen nur Sichtbares (#474), Serien erben ihre Tags, Umbenennen/Zusammenführen/Löschen und Bulk-Vergabe fassen nur Sichtbares an, die globale Suche findet Tags und gibt sie beim Entfernen wieder her (v117-Trigger auf den Tag-Tabellen), Einkaufsposten teilen die Achse ohne ihre Kategorie zu berühren, Unteraufgaben liefern ihre Tags mit
npm run test:dms-adapter        # DMS-Adapter: Paperless-ngx
npm run test:dms-routes         # DMS-Routen: account management, search, link, push
npm run test:dms-papra-adapter  # DMS-Adapter: Papra
npm run test:mealie-client      # Mealie-Adapter (#530): Bearer-Auth, Paginierung, Zutaten-Flattening (quantity 0 = Mealies "keine Menge"), Deep-Link aus external_url, Thumbnail-Abruf
npm run test:mealie-sync        # Mealie-Sync (#530): Upsert statt Neuanlage (Mahlzeitenplan-Verknüpfungen überleben ein Rename), unveränderte Rezepte werden übersprungen, ein fehlgeschlagener/leerer Abruf löscht NIE bestehende Spiegel, recipe_url wird aus dem Slug neu gebaut
npm run test:mealie-routes      # Mealie-Routen (#530): Konto-CRUD admin-only, Token nie in der Antwort, /status für alle Angemeldeten, manueller Sync, Verbindungstest
npm run test:weather            # Open-Meteo + OWM-Legacy provider resolution
npm run test:preferences-routes    # Preferences-Routen: HTTP-Schicht von server/routes/preferences.js gegen den echten Router
npm run test:preferences-budget-mode   # Budget-Modus in der Preferences-API (#476/#505): GET-Default 'shared', PUT shared/personal
npm run test:preferences-weather   # weather config fields in preferences API
npm run test:preferences-navigation   # preferences side-navigation language refresh
npm run test:preferences-weekstart   # household week-start preference (#484/#465): GET default, PUT monday/sunday/saturday, invalid rejected
npm run test:holidays           # holiday cache lookup, layer toggles, OpenHolidays sync (mocked)
npm run test:carddav        # CardDAV: vCard-Parser, Merge/Adoption (#531/#535), Multi-Values ohne Dubletten des primären Eintrags bei wiederholtem Sync
npm run test:carddav-addressbook-toggle   # Adressbuch-Umschaltung (#534): Frontend↔Router-Vertrag (PUT /addressbooks/:id), Feldnamen, 400/404
npm run test:carddav-account-lifecycle    # CardDAV-Konto: Bearbeiten (PUT, Passwort-Beibehaltung, 409/404), Sammelschalter, sichtbare Sync-Fehler (Migration 92/93)
npm run test:family-contacts
npm run test:contacts-routes   # Kontakt-Routen: Multi-Value (phones/emails/addresses) POST/PUT-Replacement, GET-Filter (category/q), vCard-Export + Escaping (inkl. BDAY), birthday-Persistenz, validateAddresses-Feldzweige, 404/403 (family-Löschschutz)
npm run test:vcard-parser      # vCard-Parser (public/utils/vcard.js): Multi-Card-Split, Feldextraktion, BDAY→birthday-Normalisierung
npm run test:contact-names     # Strukturierte Namensteile (#535): geteilter Helper, POST/PUT-Ableitung, Sortierung, vCard-N-Export, Familien-Spiegel, Dialog-Verträge
npm run test:phone             # Telefon: Frontend-Wrapper (Formatierung/tel:-E.164/Plausibilität/roher Fallback, netz-frei geprimt), server-E.164-Util, Migration-95-Backfill, format-unabhängiges CardDAV-Matching (Duplikat + NULL-Fallback)
npm run test:backup-scheduler
npm run test:backup-webdav
npm run test:backup-routes  # Backup-/Restore-Routen: requireAdmin-Gate, /status, /trigger, /database, /restore (400/413/Roundtrip), WebDAV-Konfig + Loopback-Stub
npm run test:split-expenses
npm run test:split-expenses-routes   # Split-Expenses-Routen: Autorisierung (requireGroupAccess/canManageGroup, Gast-Confinement) + Geld/Ledger-Integrität (Salden, Settlement, Edit/Delete) + Archivieren/Wiederherstellen (#574). Das Gast-Confinement deckt auch den verwaisten Gast ab (Gruppe gelöscht) und den Gast, der zusätzlich in einer fremden Gruppe steht: Gruppenliste, Dashboard-Salden, jüngste Ausgaben, Suche und /expenses/:id bleiben ihm verschlossen
npm run test:split-guest-migration   # Rebuild von split_expense_guest_users (v124): die Zeile trägt "ist beschränkt" (Existenz) und "worauf" (group_id) - das CASCADE aus v40 löschte beim Gruppen-Löschen beide und wertete den Gast zum Vollkonto auf. Prüft Bestandsübernahme (auf frischer DB ist die Tabelle bei v124 leer, der INSERT..SELECT liefe sonst ungetestet), Index, SET-NULL-Verhalten + Gegenbeweis auf dem Vor-v124-Stand
npm run test:search
npm run test:calendar-search   # calendar toolbar search (#471): FTS event search endpoint, location index, recurring next-instance, keyboard
npm run test:search-diacritics # diacritic-insensitive FTS (unicode61 remove_diacritics 2) + ß↔ss query expansion
npm run test:mobile-scroll-layout
npm run test:frontend-audit  # A11y- und Hard-Constraint-Guards des UX-Audits (innerHTML, i18n-Key-Parität, Touch-Targets, Kontraste, page-inline-pad) + Konsistenz-Invarianten: kanonische Breakpoints (640/768/1024/1440), Icon-Skala kollisionsfrei und ohne Inline-Größen, keine nativen Browser-Dialoge, border-radius nur via Token, Modal-Footer als Klasse statt Inline-Style, eine Antwort auf „keine Einkaufsliste", Rücknehmbarkeit jedes Ein-Tipp-Transfers, `{ force: true }` an jedem Löschen-Knopf im Modal, `confirmOverModal` statt `confirmModal` aus einem offenen Modal heraus, ein Folgentext (`detail`) an jedem `danger: true`-Dialog, ein eigener Folgentext je Nutzer des geteilten Category-Managers, eine Render-Funktion mit mehreren Aufrufern, die ihre Lucide-Icons selbst materialisiert, und der Page-FAB in der Shell statt im Scrollport (kein Stylesheet adressiert ihn über einen Modul-Kontext, #634) - alle Guards durchsuchen den Bestand statt einer Dateiliste
npm run test:layer-boundary  # Schicht-Guard: public/ importiert nie server/; server/ nur geteilte isomorphe Utils (Allowlist)
npm run test:typography      # Typo-Guard: font-size/letter-spacing nur via Token, Breakpoint- & Rollen-Schicht
npm run test:settings-copy      # Beschriftungswahrheit der Settings-Blätter: Registry-Metadaten und Blatt-Inhalte dürfen nicht auseinanderlaufen
npm run test:settings-navigation
npm run test:settings-cron-label  # Backup-Zeitplan als Klartext: Cron-Muster (täglich/wöchentlich/monatlich/Stundenintervall), null-Fallback für alles Übrige, Locale-Vollständigkeit
npm run test:region-presets   # Region/Format-Presets: Mapping-Validierung + detectRegion-Reverse-Lookup + BCP-47-Formprüfungen ({2,3}, damit fil-PH durchkommt)
npm run test:docker-publish   # Docker-Publish-Workflow: Tags, Plattformen, Trigger
npm run test:auth-userid
npm run test:setup
npm run test:oidc
npm run test:ssrf            # zentraler SSRF-Schutz (server/utils/ssrf.js): kanonische Klassifikationslogik
npm run test:http            # node-nativer Safe-HTTP-Client (server/utils/http.js) gegen echten lokalen Server
npm run test:router-guest-guard   # Regression Split-Guest-Redirect-Schleife (#480)
npm run test:installer-schema
npm run test:installer-env-write
npm run test:installer-static
npm run test:installer-i18n
npm run test:installer-cli-i18n
npm run test:installer-prereq
npm run test:installer-a11y
```

## Dokument-Guards (eigene Kette, nicht in `npm test`)

```bash
npm run test:document-guards   # Guard-Ebene 4: Invarianten, die nur das GERENDERTE Dokument kennt
```

Diese Suite ist die einzige, die **nicht** in der `npm test`-Kette hängt, und das ist Absicht: sie startet einen Serverprozess und einen Browser (Puppeteer, bereits devDependency), während die übrige Infrastruktur netzfrei und serverlos gegen In-Memory-SQLite läuft. `test:suite-chain` kennt die Zweiteilung als **Regel** und nicht als Namensausnahme - eine Suite, deren Datei den Browsertreiber importiert, gehört in diese Kette; jede andere in `npm test`. Wer eine zweite Browser-Suite anlegt, hängt sie an `test:document-guards` an, sonst schlägt der Registry-Guard fehl.

**Wozu eine vierte Ebene.** Drei Befundklassen des Architektur-Audits vom 2026-08-07 sind im Stylesheet unsichtbar und im Dokument offensichtlich: ein Kontrastverstoß, der erst durch die Komposition zweier Regeln entsteht (1.13:1, seit Runde 1 live, während beide Token-Paare für sich AA hielten); ein Kopf-Überlauf von 79px, den `overflow-x: hidden` verdeckte; Zielgrößen, die keine Textsuche misst. Alle drei fand ein Reviewer - das ist keine wiederholbare Absicherung.

**Sonden:**

| Sonde | Was sie misst | Umfang |
|---|---|---|
| 1 - Kopf-Überlauf | kein Nachfahre einer `.page-toolbar` ragt über die Viewport-Kante; Nachfahren in einem scrollenden oder clippenden Container sind ausgenommen, denn genau so schreibt die Shell-Regel die Tab-Leiste vor | 16 Routen × 375px × `de`/`uk`/`vi` |
| 2 - komponierter Kontrast | jeder sichtbare Text hält WCAG AA auf seinem **komponierten** Untergrund: die Vorfahren-Kette wird bis zur ersten deckenden Fläche zusammengerechnet, Alpha, `color-mix` und die Farbstops von Verläufen inklusive (bei einem Verlauf zählt der ungünstigste Stop) | 16 Routen × light/dark × desktop/mobile |
| 3 - Buttonform | jeder `button` / `a.btn` / `[role="button"]` trägt die Kapsel (Radius ≥ halbe Höhe) oder ist formlos; wer eine eigene Form hat, steht in `SHAPE_EXEMPT` **mit seiner Kategorie** | 16 Routen × 1280px |
| 4 - Zielgrößen | ein **freistehendes** Ziel hält die volle Zielgröße in mindestens einer Achse, ein **eingeengtes** (ein Ziel, das eine Klasse mit ihm teilt, steht < 16px entfernt) erfüllt allein WCAG 2.5.8; gemessen wird die **Trefferfläche**, an jeder Scrollposition | 16 Routen × mobil (48px) und desktop (40px) |
| 5 - Wischsemantik | sie **fährt die Geste** und liest, welches Reveal-Panel aufgeht: eine Liste mit Wischzeilen antwortet überhaupt, und die Rolle liegt an ihrer Kante (`--delete` nie am Zeilenanfang, `--done` nie am Ende). Der Finger geht vor dem Loslassen unter die Schwelle zurück, damit die Sonde nichts abhakt und nichts löscht | 16 Routen **und jede Sicht dahinter** × mobil × `de`/`ar` |
| 6 - Kennzahlreihen | die Kacheln **einer** `.metric-grid` sind gleich hoch, auch wenn die Reihe umbricht: die Höhe gehört dem Träger, nicht dem längsten Text einer Zelle | 16 Routen **und jede Sicht dahinter** × mobil/desktop |
| 7 - Kartenspalte | keine Folge gleichartiger Karten, die ihre Trennung dem `gap` ihres Trägers überlässt - die zweite Bauart von „eine Karte pro Zeile", die im Stylesheet unsichtbar ist. Gemeldet wird nur, was in **beiden** Größenklassen ein vertikaler Stapel ist: mobil bricht jedes Raster auf eine Spalte um | 16 Routen **und jede Sicht dahinter** × desktop **und** mobil |

**Bekannte Grenze von Sonde 2, gemessen statt vermutet:** sie liest den BAUM. Eine Fläche, die unter dem Text liegt, ohne ihn zu enthalten - die absolut positionierte Pille der Tab-Bar gleitet als Geschwister des aktiven Eintrags -, fällt heraus. Am gerenderten Pixel nachgeprüft: die Sonde meldet dort 4.20:1, das Bild zeigt 3.41:1. Sie findet den Fall also, urteilt aber zu milde. Ein Versuch über `elementsFromPoint` machte es schlechter (die Pille trägt `pointer-events: none` und fällt aus dem Stapel, dafür verschwand der Befund ganz); der ehrliche nächste Schritt ist der gerenderte Pixel, nicht der Elementstapel.

**Warum Sonde 5 die Geste wirklich fährt.** Sie ist die einzige Sonde, die etwas TUT statt zu messen, und der Grund steht in ihrem eigenen Befund: die Einkaufsliste verdrahtete ihre Wischgesten nur im Nachlade-Pfad (`updateItemsList`), also erst, wenn die Liste ein zweites Mal gebaut wurde. Beim ersten Öffnen der Seite antwortete keine Zeile - im Quelltext stand alles richtig da, und keine der drei statischen Ebenen kann das sehen. Der Fehler stand seit Einführung der Geste im März 2026 im Code. Die zweite Hälfte der Wischsemantik-Regel prüft dagegen Ebene 3 (`Eine Wischgeste, die löscht, hat einen Rückgängig-Weg`): sie folgt von jeder Richtung mit `--delete` der Kante zur aufgerufenen Funktion und verlangt dort `scheduleUndoableDelete`. Zwei Ebenen für eine Regel, jede prüft, was auf ihr prüfbar **ist**.

**Warum Sonde 5 in `ar` läuft.** Die Kante eines Reveal-Panels ist logisch (`inset-inline-start/-end`), die Fingerbewegung dahin ist in RTL die andere. Eine Sonde, die nur LTR misst, bemerkt eine gebrochene Spiegelung nie - und bis Runde 6 trugen die logischen Namen physische Eigenschaften, `.swipe-reveal--leading { left: 0 }`.

**Warum die Sonden hinter die Leisten klicken.** Eine Route ist nicht dasselbe wie eine Sicht. Von den sieben Kennzahlreihen der App liegt genau eine auf einer eigenen Route, die Abo-Wischliste auf gar keiner, und die Listenansicht der Dokumente ebenso wenig - Standard ist dort das Raster. Eine Sonde, die nur `ROUTES` abfährt, wird grün und hat die Hälfte der App nie gesehen.

Die Sonden 5, 6 und 7 nehmen deshalb denselben Helfer, `visitViews`. Er leitet die Sichten **aus dem Markup** ab statt aus einer Liste: `role="tab"` in einer Tablist und Gruppen von `aria-pressed`-Knöpfen unter einem Träger. Damit erreicht er alle vier Bauarten, die es heute gibt - Budget-Untertabs, Health-Routen, Housekeeping-Tabs und den Raster/Listen-Umschalter der Dokumente -, ohne dass eine davon namentlich genannt wäre. Gemessen sind es 92 Zustände je Gerät statt 16.

Zwei Grenzen hat er bewusst. Ein `<select>` fasst er **nicht** an: das ist ein Eingabefeld, und eine Sonde, die eines umstellt, schreibt in den Seed - dieselbe Grenze, die Sonde 5 für die Wischgeste zieht. Und er stellt jede Gruppe **zurück**, bevor er weitergeht: `localStorage` hängt am Origin, nicht an der Page, und die Dokumente merken sich ihre Ansicht. Ohne das Zurückstellen fände die nächste Sonde eine Seite vor, die so niemand öffnet.

Der Preis ist Laufzeit - rund vier Minuten für Sonde 7 -, und er ist bewusst gezahlt.

**Ein Finger, der unter der Falz aufsetzt, misst nichts.** `page.touchscreen` arbeitet in Viewport-Koordinaten. Auf den Hauptrouten steht die erste Wischzeile weit oben, im Abo-Tab liegt sie hinter Kennzahlen und Auswertung - bei 375px auf y=1157. Sonde 5 meldete die frisch verdrahtete Abo-Liste prompt als „nicht verdrahtet", und der Befund sah aus wie ein echter. Sie holt die Zeile jetzt per `scrollIntoView` ins Bild, wartet und misst das Rechteck **danach**: der kollabierende Kopf verschiebt beim Scrollen alles unter sich. Es ist derselbe Fehlertyp wie bei Sonde 4 vor dem Durchscrollen - **eine Sonde misst nur, wo sie hinsieht**, und das ist jedes Mal eine Eigenschaft der Sonde, nicht der Regel.

**Warum Sonde 3 neben einem statischen Guard steht, statt ihn zu ersetzen.** Die Buttonform-Regel gilt für „jedes Element, das eine Aktion auslöst und eine eigene Fläche oder Kante trägt". Im Stylesheet steht weder Tag noch Rolle; was dort scharf ist, ist die Form eines umgrenzten Ziels - gleiche Breite und Höhe. Diesen Ausschnitt prüft `ein quadratischer Icon-Knopf ist ein Kreis` (Ebene 3, `test:frontend-audit`), den Rest prüft Sonde 3, wo Tag, Rolle und Nachbarschaft bekannt sind. Zwei Ebenen für eine Regel, jede prüft, was auf ihr prüfbar **ist**. Beide führen ihre Ausnahmen als Kategorien und beide prüfen zusätzlich, dass jeder Ausnahme-Eintrag noch existiert - eine Ausnahme für etwas Verschwundenes ist eine Allowlist, die niemand mehr liest.

**Grenzen von Sonde 4, gemessen statt vermutet.** Sie misst die Trefferfläche über `elementFromPoint` und kennt damit nur den Viewport - deshalb scrollt sie jede Route in Schritten von 70 % der Sichthöhe durch (maximal sechs, mit 250ms Ruhe für den kollabierenden Kopf). Ohne das Scrollen blieb sie **grün, obwohl `.ydp__trigger` auf 40x40 zurückgedreht war**: der Knopf liegt auf `/health` unter der Falz. Die Box ist dabei die Untergrenze und das Tasten zählt nur, was sie erweitert (`max(Box, getastet)`) - an der unteren Viewport-Kante und an der Clip-Kante eines `overflow: hidden`-Moduls liefert `elementFromPoint` sonst den Shell-Container, und vier Ziele sahen aus, als wären sie zu einem Drittel verdeckt. Der WCAG-Zweig der Sonde ist mit dem heutigen Layout **nicht auslösbar** (jedes dichte Bauteil ist in einer Richtung breit genug); gegengeprüft wurde er mit zwei injizierten 18x18-Zielen auf 14px Zentrumsabstand.

**Fallen, teuer bezahlt:**

- **Das Repo-Regelmuster `(?:^|[}])\s*([^{}]*)\{([^}]*)\}` sah nur jede ZWEITE Regel.** Es konsumiert das schließende `}` der Vorgängerregel, danach findet die nächste kein Trennzeichen mehr. Ein Formscan über alle Stylesheets findet mit dem reparierten Muster 82 statt 45 Regeln. Der statische Buttonform-Guard war damit grün, während die Regel im Dokument für 41 Knöpfe nicht galt. Der Scanner steht seit Runde 6 Phase 3 als `eachRule()` an genau einer Stelle in `test-frontend-audit.js`; wer CSS parst, nimmt ihn und schreibt kein eigenes Muster. Seit Phase 3b läuft er über die Klammern statt über ein Regex und liefert zu jeder Regel die Kette der At-Präambeln (`at`) - ohne die kann ein Guard „im selben Media-Block" nicht prüfen, und eine responsive Zusage ist genau das.
- `color-mix()` rendert als `color(srgb …)`, nicht als `rgba()`. Ein Parser, der nur eine Notation kennt, meldet Fehltreffer - im ersten Auditlauf zwei falsche AA-Befunde. Der Parser im Harness liest beide.
- Der Service Worker wird abgeschnitten, indem `/sw.js` nicht ausgeliefert wird. `navigator.serviceWorker` wegzudefinieren lässt die App beim Aufbau abstürzen, und die Sonden messen dann ein leeres Dokument statt eines Moduls.
- Angemeldet wird **einmal** pro Lauf, das Cookie geht an alle Seiten. Der Login-Limiter lässt fünf Versuche pro Minute zu; eine Suite, die pro Sprache neu anmeldet, fällt beim zweiten Lauf hinein - und der 429 sieht aus wie ein fehlender Seed.

**Entwicklung:** `DOCUMENT_GUARDS_BASE_URL=http://localhost:PORT npm run test:document-guards` misst gegen einen bereits laufenden Server und spart Migration und Seed. Ohne die Variable legt der Harness eine temporäre SQLite-Datei an, migriert sie, seedet sie über `scripts/seed-demo.js` und räumt am Ende auf.
