# ESPHome Upstream-Schema (Referenz)

Rohe, maschinenlesbare Schema-Dumps aus [esphome/esphome-schema](https://github.com/esphome/esphome-schema).
Ein JSON pro ESPHome-Komponente, Key-Format `<platform>.<domain>` (z. B. `sgp4x.sensor`) bzw.
`<domain>` für Hub-/Basis-Komponenten ohne eigene Plattform (z. B. `rc522`). Struktur folgt exakt
dem `schema.zip`-Release-Asset des Upstream-Repos — nicht umsortiert, damit spätere Refreshs per
Diff vergleichbar bleiben.

Das ist **nicht** unser eigenes Schema-Format (`smartesp-studio-frontend/public/schemas/`), sondern
die Ground Truth von ESPHome selbst (aus den `CONFIG_SCHEMA`-Definitionen generiert). Dient als
Referenz für Vollständigkeits-Audits — siehe `docs/esphome-schema-audit-2026.8.2.md`.

## Ordner

- `2026.8.2/` — Stand ESPHome-Release 2026.8.2 (aktuellstes Release zum Zeitpunkt des Audits,
  2026-08-31).

## Refresh

```
curl -L -o schema.zip https://github.com/esphome/esphome-schema/releases/download/<version>/schema.zip
unzip schema.zip -d <tmp>
cp <tmp>/schema/*.json docs/esphome-schema-reference/<version>/
```

Danach neuen Audit-Durchlauf gegen `smartesp-studio-frontend/public/schemas/components/` fahren.
