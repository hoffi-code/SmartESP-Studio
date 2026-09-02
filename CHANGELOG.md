# Changelog

Alle nennenswerten Änderungen an SmartESP Studio. Format angelehnt an
[Keep a Changelog](https://keepachangelog.com/de/1.1.0/); Versionierung nach
[Semantic Versioning](https://semver.org/lang/de/). In der `0.x`-Phase dürfen
Breaking Changes in einem `MINOR`-Sprung passieren und sind hier als **Breaking**
markiert.

## [Unreleased]

### Added

- **LVGL `theme:` strukturiert editierbar** – im LVGL-Settings-Panel statt eines
  Textfelds ein Editor: Widget-Typ auswählen/entfernen, je Typ die Style-
  Eigenschaften (`bg_color`, `text_color`, `radius`, …) über die normalen
  Schema-Felder. Round-trip über `lvgl.options.theme`.
- **Vorschau beim Anlegen von Design-Elementen** – der „+"-Dialog und die
  Komponentenform zeigen für `image`/`font` eine Vorschau: Bild-Thumbnail (Asset
  oder `mdi:`), bzw. Font-Sample real gerendert (Google-Font geladen) oder als
  Hinweis bei lokalen/Web-Fonts.
- **LVGL Font-/Gruppen-Felder als Auswahl** – `default_font` und Widget-`text_font`
  sind jetzt Dropdowns (LVGL-Built-in-Fonts wie `montserrat_20` + definierte
  `font:`-IDs) mit „+ neu anlegen". `default_group` zeigt die bereits an Widgets
  vergebenen Gruppennamen (+ Freitext). `disp_bg_image` bekommt ebenfalls „+".
- **LVGL-Widget-Referenzen als Auswahl** – das `widget:`-Feld der
  `binary_sensor`/`light`/`number`/`select`/`switch`/`text`/`text_sensor`-LVGL-
  Plattformen und `align_to.id` im Widget-Inspektor bieten jetzt die im Projekt
  vergebenen LVGL-Widget-IDs zur Auswahl (Freitext bleibt erlaubt).
- **Feld-Hints flächendeckend** – die „?"-Erklärungen sind für ~2450 Felder aus der
  ESPHome-Schema-Referenz + LVGL-Doku vorbefüllt (`npm run seed:hints`). Erste
  Auto-Charge mit etwas Rest-Rauschen; Nacharbeit per `field.hint` bzw. direkt im
  Katalog.
- **Datei-Felder aus dem Asset-Store** – `image/file` `file` und die lokale
  `font:`-`path` sind jetzt `asset_ref`: Dropdown der hochgeladenen Bilder/Fonts
  (schreibt `esp_assets/images/…` bzw. `esp_assets/fonts/…`) + „…"-Button, der den
  Asset Manager öffnet. Freitext (`mdi:`, `gfonts://`, eigene Pfade) bleibt möglich.
- **`color:` als eigene Komponente** – Katalog-Kategorie „Color Components",
  Schema `color/color.json` (`hex` oder `red`/`green`/`blue`/`white` bzw. `*_int`).
  Als `id_ref`-Ziel mit „+" nutzbar; der Anlege-Dialog zeigt einen Farb-Swatch.
- **`font:` als eigene Komponente** – im Komponenten-Katalog unter „Font
  Components". Schema `font/font.json` mit `file` als Typ-Auswahl
  (`gfonts`/`local`/`web`), `size`, `bpp`, `glyphs`/`glyphsets`, `extras`. Ihre
  IDs fließen in den ID-Index, damit LVGL-Font-Felder sie referenzieren können.
- **id_ref „+ neu anlegen"** – Felder mit `creatable: true` (Typ `id_ref`) zeigen
  neben dem Auswahl-Dropdown einen „+"-Button. Klick öffnet einen Dialog
  (`IdDefinitionModal`), der die Ziel-Komponente über das volle Schema anlegt; die
  neue ID landet in `config.components[]`, erscheint sofort im Dropdown und ist
  ausgewählt. Für `image`- und `font`-Referenzen.
- **Feld-Hints** – jedes Schema-Feld kann einen „?"-Button vor dem Label bekommen,
  der beim Klick eine Kurz-Erklärung als Popover zeigt (`FieldHint.vue`). Texte
  kommen aus dem i18n-Katalog `schema.fields.<key>.hint` bzw. aus `field.hint` im
  Schema-JSON. Erste Charge: LVGL-Top-Level (`default_font`/`theme`/`disp_*`/…) +
  gängige Style-Props.
- **Lesbare Feld-Labels** – ohne explizites `label` zeigt ein Feld jetzt
  `schema.fields.<key>.label` aus dem Katalog, sonst den humanisierten Key
  (`default_font` → „Default font", Akronyme bleiben groß) statt des rohen Keys.
- **i18n: Builder-/Dashboard-View** – die verbliebenen fest verdrahteten Texte in
  `src/views/` (Builder-Sidebar, Preview-/Modus-Auswahl, Bestätigungsdialoge,
  Custom-Component-Labels; Dashboard-Resizer und Fallback-Titel) laufen jetzt über
  den Message-Katalog. Damit ist der i18n-Sweep über `components/` und `views/`
  abgeschlossen.
- **i18n: Display-Konfigurator** – Builder-Chrome, Werkzeugleiste und alle
  Inspektor-Panels (Text, Bild, Icon, Form, Animation, Diagramm, Legende) laufen
  jetzt über den Message-Katalog (`display.*`, `en` + `de`); technische Enum-Werte
  bleiben unverändert.
- **i18n: Dashboard** – Explorer-Toolbar, Ordnerbaum-Menüs, Projekt-Kontextmenü,
  Kachel-Anpassen-Dialog und die Projektkachel laufen jetzt über den
  Message-Katalog (`dashboard.*`, `en` + `de`).
- **i18n: LVGL-Builder** – die restlichen fest verdrahteten Texte im LVGL-Builder
  (Seiten-/Widget-Panel, Widget-Inspektor, Roh-YAML-Editor, Baum, Canvas-Tooltip)
  laufen jetzt über den Message-Katalog (`lvgl.builder.*` u. a., `en` + `de`).
- **Deutsche Feld-Hints** – für die häufigsten ESPHome-/LVGL-Feld-Keys (`id`,
  `name`, `update_interval`, `device_class`, Pin-Varianten, `restore_mode`,
  MQTT-/WLAN-/API-Keys, Style-Props, …) gibt es jetzt kuratierte deutsche Hints;
  der lange Rest fällt weiter bewusst auf `en` zurück.
- **i18n Lazy-Loading** – der große `schema`-Feld-Katalog (~210 KB) und der
  komplette `de`-Locale werden per Code-Splitting nachgeladen statt gebundelt; das
  Haupt-Bundle schrumpft entsprechend.
- **i18n-Fundament** – `vue-i18n` eingebunden (`en` Default/Fallback, `de`),
  Sprachumschalter im Header, Locale in `localStorage`. Message-Katalog nach
  Feature getrennt unter `src/i18n/locales/<locale>/`. Migriert: App-Topbar,
  geteilte Modals, Builder-Tabs, Kommentar-Modal, Schema-Feld-Labels/Hints.
  Übrige UI-Texte folgen schrittweise.
- **Kommentar-Modal** – Sektions-/Komponenten-Kommentare lassen sich jetzt in der
  UI pflegen (bisher nur beim Import): „Kommentar"-Button neben „Remove" je
  Komponente (schreibt `fieldComments[<domain>]`), Button oben links im
  YAML-Preview für den Datei-Kopf-Kommentar (`headerComment`), und eine
  Sektions-Auswahl im Preview für einen Kommentar an einem beliebigen Top-Level-
  Block. Bearbeiten mit Klartext, gespeichert wird mit `#`-Präfix.
- **LVGL Widget-Initialzustand** – neues gemeinsames Feld `state`
  (`checked`/`disabled`/`focused`/`pressed`/`edited`) für alle Widgets, das den
  ESPHome-Startzustand abbildet. Die Canvas-Vorschau liest `state.checked` und
  zeigt Switch/Checkbox jetzt korrekt als eingeschaltet.
- **LVGL `tabview` Style-Blöcke** – `tab_style` und `content_style` sind im
  Inspector unter „Style" editierbar (vorher nur als `extra` round-getrippt).
- **LVGL `meter.scales[].id`** – Scale-ID editierbar (für `lvgl.meter.*`-Actions
  auf einzelne Skalen).
- **LVGL Gruppen-Feinschliff** (P7) – Widgets in einem Tab/Tile lassen sich
  jetzt umsortieren (↑/↓/⇥/⇤ greifen in Gruppen) und per „Move to…"-Auswahl in
  einen anderen Tab/Tile oder zurück auf die Page verschieben. Bei ausgewähltem
  Tile-Group: `row`/`column`/`dir` direkt editierbar.
- **LVGL Tab-/Tile-Verwaltung** (P6) – Tab-/Tile-Gruppen sind im Widget-Baum
  auswählbar. Bei ausgewählter Gruppe: Widget hinzufügen (landet in der Gruppe),
  Tab umbenennen, Gruppe entfernen. „+ tab"/„+ tile" legt eine neue Gruppe an.
  Die Canvas-Tab-Leiste ist klickbar und schaltet um, welcher Tab gerendert wird
  (nur Vorschau-Zustand, nicht in der Config).
- **LVGL `tabview.tabs` / `tileview.tiles` mit Kind-Widgets** (P4) – die in
  Tabs/Tiles verschachtelten Widgets sind jetzt strukturiert (`node.tabs` /
  `node.tiles` je `{ …meta, widgets }`) statt als opaker `extra`-Block. Import und
  Export rekursieren in die Gruppen (verlustfreier Round-Trip), der Widget-Baum
  zeigt die Tab-/Tile-Gruppen, die Canvas-Vorschau rendert die Tab-Leiste mit
  echten Namen und das Layout des ersten Tabs. Widgets in Tabs sind aus-/abwählbar
  und editierbar; Umsortieren innerhalb einer Gruppe und Tab-Verwaltung folgen
  separat.
- **LVGL Canvas-Politur** (P5) – `image.angle`/`zoom` werden als CSS
  `rotate()`/`scale()` auf das Bild-Glyph angewandt, `textarea.password_mode`
  rendert den Text als `••••`, `spinbox` zeigt den Wert gemäß `decimal_places`
  formatiert.
- **LVGL `meter.scales` editierbar** (P3) – die Meter-Skalen sind jetzt voll
  modelliert (`scales` → `range_from/to`, `angle_range`, `ticks` inkl. `major`,
  `indicators` mit `line`/`arc`/`tick_style`/`image`) statt als opaker Block. Der
  Canvas zeichnet die Skala aus `scales[0]`: Tick-Anzahl, Nadeln aus
  `line`-Indikatoren, farbige Bögen aus `arc`-Indikatoren.
- **LVGL `buttonmatrix.rows` editierbar** (P2) – die Button-Matrix-Zeilen sind
  jetzt strukturiert modelliert (`rows` → `buttons` → `text`/`width`/`key_code`/
  `control`) statt als opaker `extra`-Block. Der Canvas zeichnet die echten
  Zeilen mit Beschriftung; `line` wird als Polyline seiner Punkte gerendert.
- **LVGL Widget-Felder vervollständigt** (P1) – die kuratierten Widget-Schemas
  decken jetzt alle flachen `config_vars` aus dem ESPHome-2026.8.2-Schema ab:
  `image` Transform (`angle`, `zoom`, `pivot_x/y`, `offset_x/y`, `antialias`),
  `label.long_mode`, `bar.start_value`, `arc.change_rate`, `checkbox.pad_column`,
  `roller`/`dropdown.selected_text`, `spinbox.rollover`/`selected_digit`,
  `buttonmatrix.pad_row/pad_column`, `on_update`-Trigger. Neuer
  `lvglWidgetFields.spec.js` hält das gegen den Schema-Dump fest.
- **LVGL Canvas rendert realistischer** – jeder Widget-Typ bekommt ein eigenes
  Aussehen statt eines generischen Kästchens: Button (gefüllt, Theme-Primärfarbe),
  Switch (Pill + gleitender Knopf, an/aus), Slider/Bar (Track + Indicator + Knopf),
  Checkbox (Tickbox + Haken), Dropdown (Wert + Chevron), Roller (drei Zeilen,
  Mitte hervorgehoben), Arc/Spinner/Meter (SVG-Ringe mit Indicator-Bogen),
  LED (Kreis + Glow), Text-/Spinbox (Feld + Cursor), Bild/QR, Tabview,
  Button-Matrix/Keyboard (Zellenraster). Farben kommen aus den Widget-Props
  (`bg_color`, `indicator`/`knob`-Blöcke, `arc_color`, ...), sonst aus dem
  LVGL-Default-Theme (Material, Primär `#2196f3`).
- **LVGL Live-Editor umgebaut** – die Konfig-Ansicht zeigt unter Pages/Widgets
  jetzt eine statische *Canvas-Preview*; ein Klick darauf öffnet ein Modal mit
  dem interaktiven Canvas (Drag, W/H/Zoom) links und dem vollen Widget-Inspektor
  (alle Gruppen aufgeklappt) rechts. Der YAML-Block sitzt jetzt im Form-Panel
  statt in einer eigenen Sektion (weiterhin nur ab Mode-Level *Advanced*).
- **LVGL-Baum-UX** – bei ausgewähltem Widget: Umsortieren (↑/↓), Einrücken
  (unter das vorige Geschwister hängen), Ausrücken (aus dem Eltern-Widget
  herausziehen) und „+ child" (gewählten Typ als Kind anlegen). Nicht
  unterstützte Widgets haben jetzt einen editierbaren Roh-YAML-Editor mit
  Validierung statt nur einem Hinweis; Kind-Widgets darunter bleiben im Baum
  bearbeitbar.

### Changed

- **Feld-Hints/-Labels pro Schema (i18n)** – die „?"-Erklärungen und Feld-Namen
  werden jetzt über einen schema-spezifischen Namespace aufgelöst
  (`schema.ns.<schemaId>.<key>`), damit gleichlautende Keys je Bereich die richtige
  Bedeutung bekommen (`mode` unter einem SPI-Bus ≠ unter einem `number` ≠ unter
  einem LVGL-Widget). Wo keine kontext-genaue Beschreibung ableitbar ist, zeigt ein
  polysemer Key (`mode`, `type`, `value` …) lieber gar keinen Hint als einen
  falschen. Die ~175 kuratierten `field.label` aus den Schema-JSONs liegen jetzt im
  übersetzbaren Katalog. Der bisherige flache Hint-Katalog bleibt als Fallback für
  Keys, die kein Namespace abdeckt. `npm run seed:hints` regeneriert alles.
- **LVGL-Vorschau berücksichtigt das Display** – der Canvas (inline **und** im
  Editor-Modal) zeichnet den Bildschirm-Hintergrund aus `disp_bg_color`
  (+ `disp_bg_opa`); bei einem 1-Bit-Display (`color_depth: 1` bzw.
  Display-Schema `monochrome`) wird strikt zweifarbig gerendert. `image`/`animimg`-
  Widgets zeigen jetzt das echte Bild (aufgelöst über die `image:`-Komponente).
  Weitere anzeige-relevante Props wirken sich aus: Deckkraft (`opa`/`bg_opa`/
  `text_opa`), Schriftgröße (`text_font`), `text_align`, `outline_*`,
  `line_color`/`line_width`, `arc_width`, QR-`dark_color`/`light_color`,
  `hidden` (Widget wird ausgeblendet).
- **LVGL-Konfiguration: Vorschau über dem Formular** – in der LVGL-Config stehen
  Vorschau und Formular jetzt gestapelt statt nebeneinander. Die Vorschau ist
  reine Anzeige mit einem „Bearbeiten"-Button, der den Editor öffnet.
- **Kommentar-Steuerung in die Configuration-Spalte** – die Buttons für Datei-Kopf-
  und Sektions-Kommentar sitzen nicht mehr in der YAML-Vorschau (wo sie den Code
  überlagerten), sondern als eigene Zeile unter der Modus-Auswahl im
  Configuration-Panel. Die Vorschau zeigt nur noch „Copy code". Sektions-Auswahl
  jetzt über alle Top-Level-Keys des ganzen Dokuments.
- **API-Section überarbeitet** – `listen_backlog`/`max_connections`/`max_send_queue`
  zeigen jetzt die echten ESPHome-Defaults (1/4/4). `encryption.key` nicht mehr
  hart „required", Hinweis auf `!secret`. `reboot_timeout` sichtbarer (Mode-Level
  „normal") mit „0s"-Hinweis. „Home Assistant services/states" korrekt beschriftet.
- **Color-Feld aufgeräumt** – der farbige Swatch öffnet jetzt selbst den
  Farbwähler, der separate „Pick"-Button entfällt. Im Farbwähler gibt es einen
  „Transparent / keine"-Button, der den Wert leert (der Key verschwindet dann aus
  dem YAML).
- **LVGL Canvas: Arc-/Meter-Winkel** – die Vorschau leitet den Bogen jetzt aus
  `start_angle`/`end_angle`/`rotation` (Arc) bzw. `angle_range`/`rotation`
  (Meter-Scale) ab statt aus festen 150°/240°. Default entspricht dem echten
  LVGL-Look (135°→45°, 270° Sweep, Lücke unten). Spinner rendert als Vollkreis
  mit `arc_length`-Segment.
- **LVGL Canvas: weitere Widget-Details** – Bar/Slider berücksichtigen `mode`
  (`RANGE`/`SYMMETRICAL`) und `start_value`, der Indikator beginnt am richtigen
  Punkt statt immer bei 0. Switch kippt bei `height > width` in die vertikale
  Orientierung. `image_recolor` färbt das Bild-Glyph ein. `state.disabled`
  blendet das Widget in der Vorschau aus.
- **LVGL Canvas: Verläufe, Schatten, `label.long_mode`** – `bg_grad_color` /
  `bg_grad_dir` rendern als CSS-Verlauf, `shadow_width` (+ Offset/Spread/Farbe)
  als `box-shadow`. Label mit `long_mode: WRAP` bricht mehrzeilig um,
  `CLIP`/`SCROLL` schneiden ohne „…" ab.
- **LVGL Inspector: Parts pro Widget-Typ** – die „Parts"-Sektion zeigt nur noch
  die Parts, die der gewählte Widget-Typ tatsächlich hat (Slider: indicator/knob,
  Roller: selected, …) statt aller sieben. Import/Export bleibt unverändert –
  jeder `part:`-Block round-trippt weiterhin über das Shared-Schema.
- **LVGL Schema-Konsistenz-Test** – prüft zusätzlich verschachtelte Blöcke
  (`scales`/`rows`/`points`/`tabs`/…) und die Gegenrichtung (kein kuratiertes
  Feld ohne Dump-Entsprechung).

### Fixed

- YAML-Ausgabe: `font:` / `image:` / `animation:` erscheinen nur noch **einmal**,
  auch wenn sowohl Display-Elemente als auch eigenständige
  `font:`/`image:`-Komponenten Einträge beisteuern (vorher zwei gleichnamige
  Top-Level-Keys).
- Tabbed YAML Preview: `image:`/`font:`/`animation:`/`graph:` erscheinen jetzt in
  einem eigenen „Assets"-Tab statt zwangsweise unter „Display".
- Tabbed YAML Preview: ein einleitender Kommentar über einer Sektion bleibt in
  deren Tab, statt am Ende der vorherigen Sektion zu landen
  (`parseYamlDocumentBlocks` hängt einen Kommentar-/Leerzeilen-Lauf jetzt an den
  folgenden Block).
- Kinder eines nicht unterstützten Widgets gingen beim Export verloren –
  `serializeWidgetNode` schreibt sie jetzt als `widgets:` unter den Roh-Block.

## [0.2.0] – 2026-08-31

### Added

- **LVGL-Konfigurator** – eigener „LVGL"-Tab im Builder, inline im Config-Frame
  (kein Modal). Wächst über die bisherigen Runden zu einem vollwertigen
  Widget-Builder:
  - Widget-Registry + ein generischer, schema-getriebener Inspector. ~24
    Widget-Typen (label/button/image sowie Tier-1/Tier-2: obj, led, line, arc,
    bar, slider, switch, checkbox, dropdown, roller, spinbox, textarea,
    buttonmatrix, meter, qrcode, spinner, animimg, tabview, tileview, keyboard,
    canvas). Ein neues Widget = eine Schema-JSON + ein Registry-Eintrag.
  - Gemeinsame Trigger je Widget (`on_click` / `on_press` / `on_release` /
    `on_long_press` / `on_focus` / `on_defocus`, `on_value` bei Wert-Widgets),
    gruppiert in einer „Events"-Sektion.
  - Kuratiertes Styling über eine geteilte `extends`-Kette (bg/border/outline/
    radius/pad/text/shadow/opa) – „Style"-Sektion im Inspector.
  - Editierbare **State- und Part-Style-Blöcke** pro Widget
    (`checked`/`pressed`/`focused`/`disabled`/`edited`/`hovered`/`scrolled` bzw.
    `indicator`/`knob`/`selected`/`items`/`ticks`/`cursor`/`scrollbar`).
  - **Flex-/Grid-Layout** und `align_to`: `layout`-Block (type, flex_flow,
    flex/grid-Ausrichtung, `grid_columns`/`grid_rows`, pad_row/pad_column),
    per-Zelle-Platzierung (`flex_grow`, `grid_cell_*`).
  - **Top-Level-`lvgl:`-Optionen** mit Settings-Panel (default_font, theme,
    disp_bg_*, color_depth, byte_order, log_level, full_refresh,
    style_definitions u. a.).
  - Bidirektionale Verknüpfung mit der YAML-Vorschau: Preview-Zeile anklicken →
    Sprung ins Formularfeld und umgekehrt.
  - Editierbarer `lvgl:`-YAML-Block (ab Mode-Level „Advanced").
  - Visuelle Canvas-Vorschau mit Drag-Positionierung (näherungsweises Layout,
    kein voller LVGL-Layout-Engine-Nachbau).
  - Vollständiger `lvgl.*`-Action-Katalog (64 Actions + 3 Conditions) für die
    Automation.
- **Farbfelder** – generischer Feldtyp `color` (Farb-Swatch + Freitext +
  Color-Picker-Modal). Alle LVGL- und Nextion-Farbfelder darauf umgestellt;
  `colorFormat` `hex` / `hex0x` / `rgb`.

### Changed

- Nicht unterstützte LVGL-Widgets sowie YAML-Keys außerhalb eines kuratierten
  Schemas werden verlustfrei als opake Raw-YAML-Knoten bzw. `extra`/`options`
  durchgereicht – Import→Export bleibt lossless.
- Top-Level-`lvgl:`-Keys ohne dediziertes Feld gingen beim Import bisher
  verloren; sie bleiben jetzt in `lvgl.options` erhalten.

### Removed

- Interner Aufräumschritt: der in jeder Widget-Schema-JSON wortgleich
  wiederholte Common-Block (id/x/y/width/height/align + Standard-Trigger) liegt
  jetzt einmal in `base_component/lvgl_widget_common.json`; ~2600 Zeilen aus den
  24 Widget-Schemas entfernt. Keine Verhaltensänderung.

### Fixed

- LVGL-Widgetbaum unsichtbar (weiß auf weiß) – der Baum-/Seiten-Zeilen fehlte
  eine `color`-Regel gegen das globale `button { color: #fff }`.

## [0.1.0] – 2026-08-31

Erstes Release des Forks `hoffi-code/SmartESP-Studio` (Upstream ESPConfig
Designer 1.3.3). Rebranding, Backend-Aufteilung in `ses/`-Module +
`create_app()`-Factory, Frontend-Entzerrung (BuilderView/DashboardView/
DisplayInspector), Paywall-Entfernung, Multistage-Docker (Standalone-Image),
Sicherheitsnetz (ESLint/Vitest/pytest/ruff/CI). Vollständige Historie und
Begründungen in `REFACTORING.md`.
