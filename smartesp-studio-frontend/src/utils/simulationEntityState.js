// Reine Funktionen fuer den simulierten Entity-Zustand (Teil 1 der Simulation, ohne
// echtes Geraet). Der useSimulation.js-Composable ist nur ein duenner ref-Wrapper darum,
// analog zu useBuilderValidation.js -> builderValidationRules.js.
//
// Kein 1:1-Modell fuer alle ESPHome-Domains -- das waere Scope-Sprengung ohne Nutzen fuer
// die drei UI-Ziele (Entity-Tabelle, LVGL-Canvas, Display-Canvas). Drei Stufen:
//   Tier 1 (voll simuliert):  sensor/number -> numeric, text_sensor/select/datetime/time
//                             -> text, binary_sensor/switch/lock/button -> boolean,
//                             globals -> je nach deklariertem C++-Typ.
//   Tier 2 (reduzierter struct): light/cover/fan/climate mit den wichtigsten Feldern.
//   Tier 3 (unsupported): alles andere -- taucht in der Tabelle gedimmt auf, kein Fehler.

const DOMAIN_KIND = {
  sensor: "numeric",
  number: "numeric",
  text_sensor: "text",
  select: "text",
  datetime: "text",
  time: "text",
  binary_sensor: "boolean",
  switch: "boolean",
  lock: "boolean",
  button: "boolean",
  light: "struct",
  cover: "struct",
  fan: "struct",
  climate: "struct",
  // Nachgetragen fuer P6 (simulationExecutor.js): valve.open/close brauchen ein Ziel wie
  // cover, dessen struct-Form (position/state) es 1:1 teilt.
  valve: "struct"
};

const STRUCT_DEFAULTS = {
  light: { on: false, brightness: 1 },
  cover: { position: 1, state: "open" },
  fan: { on: false, speed: 0 },
  climate: { mode: "off", target_temperature: 20, current_temperature: 20 },
  valve: { position: 1, state: "open" }
};

const COMPONENT_SCOPE_RE = /^component:(\d+)$/;

export const kindForDomain = (domain) => {
  if (domain === "globals") return "globals";
  return DOMAIN_KIND[domain] || "unsupported";
};

const defaultValueForKind = (kind) => {
  if (kind === "boolean") return false;
  if (kind === "numeric") return 0;
  if (kind === "text") return "";
  return null;
};

const globalValueKind = (type) => {
  const normalized = String(type || "").toLowerCase();
  if (normalized.includes("bool")) return "boolean";
  if (normalized.includes("int") || normalized.includes("float") || normalized.includes("double")) return "numeric";
  return "text";
};

const parseGlobalInitialValue = (kind, raw) => {
  if (raw === undefined || raw === null || raw === "") return defaultValueForKind(kind);
  if (kind === "boolean") return raw === true || raw === "true";
  if (kind === "numeric") {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return String(raw);
};

const componentConfigForScope = (components, scopeId) => {
  const match = COMPONENT_SCOPE_RE.exec(scopeId || "");
  if (!match) return null;
  return components[Number(match[1])]?.config || null;
};

// entities: idIndex-Eintraege {id, domain, componentId, scopeId}. config: das ganze
// Projekt-Config-Objekt (fuer globals-Startwerte und die Filterketten der Sensor-Domains).
export const buildSimulationEntities = (idIndex, config) => {
  const components = Array.isArray(config?.components) ? config.components : [];
  const globals = Array.isArray(config?.automation?.globals) ? config.automation.globals : [];
  const globalsById = new Map(globals.filter((entry) => entry?.id).map((entry) => [entry.id, entry]));

  const entities = [];
  const seen = new Set();

  (idIndex || []).forEach((entry) => {
    if (!entry?.id || seen.has(entry.id)) return;
    seen.add(entry.id);
    const domain = entry.domain || "";
    const base = { id: entry.id, domain, componentId: entry.componentId || "", scopeId: entry.scopeId || "" };

    if (domain === "globals") {
      const globalEntry = globalsById.get(entry.id);
      const kind = globalValueKind(globalEntry?.type);
      entities.push({ ...base, kind, value: parseGlobalInitialValue(kind, globalEntry?.initial_value), fields: null });
      return;
    }

    const kind = kindForDomain(domain);
    if (kind === "unsupported") {
      entities.push({ ...base, kind, value: null, fields: null });
      return;
    }

    if (kind === "struct") {
      entities.push({ ...base, kind, value: null, fields: { ...STRUCT_DEFAULTS[domain] } });
      return;
    }

    // sensor/switch/binary_sensor/... kennen in ESPHome kein "initial value"-Feld -- der
    // reale Startwert kommt vom Geraet (Hardware-Messung bzw. restore_mode). Der
    // Domain-Default (0/false/"") ist die ehrliche Vereinfachung dafuer. filters: wird
    // trotzdem mitgegeben, die Filter-Pipeline (simulationFilters.js) braucht sie.
    const componentConfig = componentConfigForScope(components, entry.scopeId);
    entities.push({
      ...base,
      kind,
      value: defaultValueForKind(kind),
      fields: null,
      filters: Array.isArray(componentConfig?.filters) ? componentConfig.filters : []
    });
  });

  return entities;
};

export const buildEntityStateMap = (idIndex, config) => {
  const map = {};
  buildSimulationEntities(idIndex, config).forEach((entity) => {
    map[entity.id] = entity;
  });
  return map;
};

export const setEntityValue = (state, id, value) => {
  const entity = state[id];
  if (!entity) return state;
  entity.value = value;
  return state;
};

export const setEntityField = (state, id, fieldKey, value) => {
  const entity = state[id];
  if (!entity || entity.kind !== "struct") return state;
  entity.fields = { ...(entity.fields || {}), [fieldKey]: value };
  return state;
};
