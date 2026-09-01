# LVGL-Builder – Vertiefung der bestehenden Widgets

## Ausgangslage (Stand `41d302d`)

Alle **25 Widget-Typen, die ESPHome-LVGL kennt**, sind bereits als editierbare
Widgets in der Registry (`src/utils/lvglWidgets.js`): animimg, arc, bar, button,
buttonmatrix, canvas, checkbox, container/obj, dropdown, image, keyboard, label,
led, line, meter, qrcode, roller, slider, spinbox, spinner, switch, tabview,
textarea, tileview.

**Nicht modellieren** – `chart`, `table`, `menu`, `msgbox`, `list`, `calendar`,
`win`, `spangroup`, `imagebutton`, `scale` sind LVGL-Core-Widgets, aber vom
ESPHome-LVGL-Component **nicht** exponiert (`LVGL_Docs/esphome/lvgl.md` Z. 76:
„Not all LVGL widgets are implemented, just those commonly used"). `msgboxes:`
ist eine Top-Level-Liste, kein Widget (gehört zum Settings-Panel).

Was fehlt ist **Tiefe**: einzelne flache Felder plus die verschachtelten
Listen-/Nested-Inhalte, die heute als `node.extra` roh (verlustfrei, aber nicht
editierbar) durchlaufen. Quelle für die Sollwerte: der eingecheckte Dump
`docs/esphome-schema-reference/2026.8.2/lvgl.json` →
`lvgl.schemas.WIDGET_TYPES.schema.config_vars.<type>`.

### Lücken je Widget (kuratiert vs. Dump)

| Widget | fehlt |
|---|---|
| meter | **`scales` komplett** (Ticks, Indicators, Ranges) – Schema leer |
| tabview | **`tabs[]` mit Kind-Widgets**, `tab_style`, `content_style` |
| tileview | **`tiles[]` mit Kind-Widgets** |
| line | `points[]` nur als opaker Key – kein `{x,y}`-Modell |
| buttonmatrix | `rows[]` (`{buttons:[{text,width,control}]}`) nur opak |
| image | `angle`/`rotation`, `zoom`/`scale`, `pivot_x/y`, `offset_x/y`, `antialias` |
| label | `long_mode` (WRAP/DOT/SCROLL/SCROLL_CIRCULAR/CLIP) |
| bar | `start_value` |
| arc | `change_rate` |
| checkbox | `pad_column` |
| roller / dropdown | `selected_text` |
| spinbox | `rollover`, `cursor` (nested style) |
| dropdown | `dropdown_list` (nested style) |
| keyboard | `items` (Preset-Map) |
| diverse | `on_update`-Trigger neben `on_value` |

---

## Runden

### P1 – Flache Feld-Vervollständigung  ·  Größe S  ·  nur JSON

Die fehlenden **flachen** `config_vars` in die kuratierten Widget-Schemas
eintragen: image-Transform-Felder, `label.long_mode`, `bar.start_value`,
`arc.change_rate`, `checkbox.pad_column`, `roller`/`dropdown.selected_text`,
`spinbox.rollover`, `on_update` wo der Dump es listet.

- Kein Code. Import/Export/Inspector tragen generisch.
- **Test:** neuer `src/utils/lvglWidgetFields.spec.js` – liest den 2026.8.2-Dump
  und die kuratierten Schemas, prüft: kein vom Dump als unterstützt gelistetes
  *flaches* Feld fehlt (bis auf eine dokumentierte Allowlist bewusst
  ausgelassener/Style-Felder).

### P2 – `line.points` + `buttonmatrix.rows`  ·  Größe M  ·  JSON + Canvas

- **`line.points`**: `type:list`, `item:{type:object, fields:[{key:x,type:text},
  {key:y,type:text}]}`. Parser/Serializer für verschachtelte Objekt-Listen
  existieren schon.
- **`buttonmatrix.rows`**: `type:list` von `{buttons:list<{text, width?,
  control?}>}`. `control` als Multi-Select (checkable/checked/disabled/hidden/
  no_repeat/…).
- **Canvas** (`LvglCanvas.vue`): `line` als echte `<polyline>` aus den Punkten
  (skaliert in die Box); `buttonmatrix` als beschriftetes Zellenraster statt
  generischem Grid.
- **Test:** Round-Trip in `yamlLvglImport.spec.js` / `schemaLvglYaml.spec.js`,
  Canvas-Render in `LvglCanvas.spec.vue.js`.

### P3 – `meter.scales`  ·  Größe M  ·  JSON tief + Canvas

`scales` als `type:list` von `object`:

```
range_from, range_to, angle_range (default 270), rotation,
ticks:  { count, width, length, color, major:{ stride, width, length, label_gap, color } },
indicators: list< one of:
  { line:  { id?, width, color, r_mod } }
  { arc:   { width, color, r_mod, start_value, end_value } }
  { tick_style: { start_value, end_value, color_start, color_end, local, width } }
  { image: { src, pivot_x, pivot_y, value } } >
```

- **Canvas:** Ticks + Major-Ticks auf dem Ring zeichnen; je Indicator eine Nadel
  (`line`), einen farbigen Bogen (`arc`) oder einen Bereichs-Tick.
- **Test:** Round-Trip + ein `meter`-Canvas-Snapshot.

### P5 – Canvas-Politur für die neuen Felder  ·  Größe S

Aus P1/P2/P3 im realistischen Canvas nachziehen:
- `image.angle`/`zoom` → CSS `transform: rotate()/scale()` auf dem Bild-Glyph.
- `textarea.password_mode` → Text als `••••` rendern.
- `spinbox.digits`/`decimal_places` → Wert entsprechend formatiert anzeigen.
- `label.long_mode` DOT → `…`-Ellipse sichtbar machen.

### P4 – Nested-Widget-Container: `tabview.tabs` / `tileview.tiles`  ·  Größe L  ·  Architektur

`tabs[]` bzw. `tiles[]` halten **Kind-Widgets** wie eine Page. Das ist die
einzige echte Datenmodell-Erweiterung.

**Datenmodell:** `WidgetNode` bekommt optional
`tabs: [{ name, widgets: WidgetNode[] }]` bzw.
`tiles: [{ row, column, dir, widgets: WidgetNode[] }]`.

**Umsetzung in 3 Commits:**

1. **Datenmodell + verlustfreier Round-Trip.** `yamlLvglImport.parseWidgetNode`
   und `schemaLvglYaml.serializeWidgetNode` rekursieren in `tabs[].widgets` /
   `tiles[].widgets` (heute in `extra`). `resolveLvglPageLayout` in
   `lvglLayout.js` steigt in den aktiven Tab/Tile ab. Noch keine UI – nur
   Struktur + Tests.
2. **Tree + Inspector.** `LvglWidgetTreeItem` zeigt Tab-/Tile-Gruppen als
   Zwischenebene; „Add child" / Reorder respektieren die Gruppe. Inspector-
   Sektion „Tabs" / „Tiles": Namen/Positionen bearbeiten, aktive Auswahl.
3. **Canvas.** Tab-Leiste mit echten Labels; nur die Widgets des aktiven Tabs
   rendern; Tile-Grid mit Positionen.

**Risiko:** berührt Import, Export, Layout, Tree, Inspector, Canvas – überall
Tests. Schritt 1 muss vollständig grün sein, bevor die UI dazukommt.

---

## Reihenfolge & Aufwand

`P1 (S)` → `P2 (M)` → `P3 (M)` → `P5 (S)` → `P4 (L)`

P1 zuerst (billig, deckt am meisten ab). P4 zuletzt (Architektur). Je Runde ein
PR gegen `main`, CI grün, `CHANGELOG.md` `[Unreleased]`-Eintrag im selben PR.

## Nicht-Ziele

- Neue Widget-Typen (chart/table/menu/… sind kein ESPHome-LVGL).
- `msgboxes:` / `style_definitions` / `gradients` – gehören zum Settings-Panel
  (Backlog G, teilweise erledigt), nicht zu den Widgets.
- Vollständige Pixel-Treue des Canvas – „nah genug am Gerät" genügt.
