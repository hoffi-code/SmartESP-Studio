# Changelog

Alle nennenswerten Änderungen an SmartESP Studio. Format angelehnt an
[Keep a Changelog](https://keepachangelog.com/de/1.1.0/); Versionierung nach
[Semantic Versioning](https://semver.org/lang/de/). In der `0.x`-Phase dürfen
Breaking Changes in einem `MINOR`-Sprung passieren und sind hier als **Breaking**
markiert.

## [Unreleased]

### Added

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

### Fixed

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
