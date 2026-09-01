# Lambda-Assist – Spike / Bewertung

## Ausgangslage (Stand `8d16591`)

Lambdas (ESPHome-C++-Ausdrücke) tauchen im Builder an zwei Stellen auf:

1. **`type: "lambda"`-Felder** – ~32 Schemadateien unter `public/schemas/`, u. a.
   alle `*/template.json` (`sensor`, `binary_sensor`, `switch`, `number`, `select`,
   `text`, `cover`, `valve`, `lock`, `datetime`), `*/modbus_controller.json`,
   `base_component/base_display.json` (`display:`-Lambda), `base_filters.json` /
   `base_binary_sensor_filters.json` (`lambda:`-Filter), diverse `display/*`.
2. **`templatable: true`-Felder** – Wert/Lambda-Umschalter (`schemaTemplatable.js`,
   `isTemplatableField = field.templatable === true`). Speichert
   `{ __templatable: true, mode: "literal" | "lambda", value }`. Im Lambda-Modus
   rendert derselbe Pfad wie (1).

### Ist-Rendering

`src/components/schema-fields/PrimitiveField.vue`:

- `:74` `isYamlField` und `:75` `isLambdaField` →
  `<textarea class="lambda-textarea" wrap="off" @input="onInput">`. Kein
  Highlighting, kein Autocomplete, keine Prüfung.
- `:48-71` `isTemplatableField` → Toolbar `Value` / `Lambda` + verschachteltes
  `<SchemaField>` mit `templatableEditorField` (Typ `lambda`), das wieder in
  denselben `<textarea>` mündet.

Der `display:`-Lambda hat zusätzlich den grafischen `DisplayBuilder`; der erzeugt
am Ende ebenfalls Lambda-Text. Kein Overlap mit diesem Spike.

### Was schon da ist (keine neue Abhängigkeit nötig)

- **`idIndex`** liegt bereits als Prop an `PrimitiveField` (`:203`) an und wird in
  den templatable-`SchemaField` durchgereicht (`:62`). Form je Eintrag:
  `{ id, idLower, domain, componentId, scopeId }` aus
  `buildIdIndex` (`src/utils/builderValidationRules.js:687`), reaktiv aus
  `useBuilderValidation.js`. Für ein `id(...)`-Autocomplete ist die Datenquelle
  also ohne zusätzliche Verdrahtung am Render-Ort verfügbar.
- **`highlight.js`** ist Dependency. Lazy-Load-Muster existiert in
  `src/utils/yamlSyntaxHighlight.js` (core + Sprachmodul dynamisch importiert,
  gecacht). Für C++ analog `highlight.js/lib/languages/cpp`.
- Kein CodeMirror / Monaco im Projekt – bewusst nicht einführen (Bundle-Größe,
  SSR-/Test-Aufwand). Ansatz bleibt `<textarea>` + darüberliegendes Read-Overlay.

## Bewertung der Ausbaustufen

Reihenfolge = aufsteigender Aufwand, jede Stufe für sich nützlich und mergebar.

### Stufe 1 – Syntax-Highlight (Read-Overlay)  ·  Aufwand: S

Neu `src/components/schema-fields/LambdaField.vue`, ersetzt die beiden nackten
`<textarea>`-Zweige. Aufbau wie die YAML-Preview: transparente `<textarea>` über
einem `<pre><code class="hljs">` mit synchronisiertem Scroll. Highlighter aus
neuem `src/utils/cppSyntaxHighlight.js` (Klon von `yamlSyntaxHighlight.js`, Sprache
`cpp`). Kein Verhalten geändert, reiner Lesbarkeitsgewinn.

Tests: `cppSyntaxHighlight.spec.js` (Marker-Spans), `LambdaField.spec.vue.js`
(Eingabe emittiert `update`, Overlay-Text folgt dem Wert).

Risiko: gering. `wrap="off"` + Zeilen-Sync ist der einzige fummelige Teil; das
YAML-Overlay ist die Vorlage.

### Stufe 2 – Leichter Lint (nicht-blockierend)  ·  Aufwand: S–M

Reine Funktion `lintLambda(text, idIndex)` in `src/utils/lambdaLint.js`:

- unbalancierte `(` / `)` / `{` / `}` / `"` / `'` → Warnung mit Offset.
- `id(<name>)` extrahieren; `<name>` nicht in `idIndex` → Warnung
  „unbekannte ID `<name>`". Reine Heuristik (Regex `id\(\s*([A-Za-z_]\w*)\s*\)`),
  kein Parser.
- Ausgabe als Liste unter dem Feld, Stil wie `.field-error`, aber `.field-warn`
  (nie `required`/Save blockieren – Lambdas sind absichtlich frei).

Tests: `lambdaLint.spec.js` (Klammer-Fälle, bekannte/unbekannte ID, leerer Text →
keine Warnung).

Risiko: gering, solange es strikt nicht-blockierend bleibt. Kein Eingriff in
Validierung/`buildDuplicateErrors`.

### Stufe 3 – `id(...)`-Autocomplete  ·  Aufwand: M

Im `LambdaField` bei Eingabe prüfen, ob der Cursor in einem offenen `id(`-Token
steht (Rückwärts-Scan bis `(` ohne schließende `)` / Zeilenumbruch, davor `id`).
Wenn ja: Popover mit `idIndex`-Einträgen, nach Präfix gefiltert, `domain` als
Sekundärtext. Auswahl fügt `name)` ein. Muster (Popover, Außenklick/Esc,
Tastatur-Navi) 1:1 von `IdRefField.vue`.

Optionale Erweiterung: nach `id(x).` die gängigen Accessoren vorschlagen
(`state`, `has_state()`, `position` …) – erfordert aber Domänen-Wissen je
Entity-Typ und lohnt erst, wenn Stufe 3 im Einsatz ist.

Tests: `LambdaField.spec.vue.js` – `id(` öffnet Popover mit Fixture-IDs; Auswahl
schreibt `id(sensor1)`; `)` bzw. Leerzeichen schließt.

Risiko: mittel. Cursor-/Token-Erkennung im `<textarea>` ist die Fehlerquelle;
Scope klein halten (nur `id(`-Trigger, kein generelles C++-Completion).

### Stufe 4 – Snippet-Palette  ·  Aufwand: S (nach Stufe 1)

Kleiner `+`-Button am Feld, Dropdown mit kuratierten Snippets:
`id(x).state`, `id(x).position`, `to_string(...)`, `str_sprintf("%.1f", x)`,
`ESP_LOGD("tag", "msg %d", x)`, `return x;`, LVGL:
`lv_label_set_text(id(x), "…")`. Einfügen an Cursor-Position. Statische Liste in
`src/utils/lambdaSnippets.js`, i18n für die Labels.

Tests: trivial (Klick fügt Text ein).

## Empfehlung

- **Stufe 1 + 2 zusammen als erster PR** (`LambdaField.vue` + cpp-Highlighter +
  `lambdaLint`). Hoher Lesbarkeits-/Fehlervermeidungs-Nutzen, klein, risikoarm,
  keine neue Dependency, kein Datenfluss-Umbau.
- **Stufe 3** als Folge-PR, wenn Stufe 1 steht und sich das Overlay bewährt hat.
- **Stufe 4** optionales Beiwerk, jederzeit einschiebbar.
- Nicht tun: vollwertiger C++-Editor / Sprachserver / `templatable` auf mehr
  Felder ausweiten. Kein erkennbarer Bedarf, hoher Aufwand.

## Kritische Dateien

- `src/components/schema-fields/PrimitiveField.vue` (`:74-75` Render-Zweige,
  `:48-71` templatable-Pfad)
- neu `src/components/schema-fields/LambdaField.vue`
- neu `src/utils/cppSyntaxHighlight.js` (Vorlage `src/utils/yamlSyntaxHighlight.js`)
- neu `src/utils/lambdaLint.js`, optional `src/utils/lambdaSnippets.js`
- `src/utils/builderValidationRules.js:687` (`buildIdIndex` – Datenquelle, unverändert)
- `src/components/schema-fields/IdRefField.vue` (Popover-/Tastatur-Vorlage für Stufe 3)
