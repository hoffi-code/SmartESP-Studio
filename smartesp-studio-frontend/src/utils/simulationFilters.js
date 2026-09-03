// Simuliert die ESPHome-Filterketten (base_filters.json / base_binary_sensor_filters.json)
// rein in JS. P2 deckte die zeitlosen Filtertypen ab; diese Runde (P4) ergaenzt die
// wirklich zeitbasierten (echtes duration-Feld im Schema): debounce, throttle,
// throttle_average, throttle_with_priority, timeout, heartbeat (Sensor), delayed_on,
// delayed_off, delayed_on_off, settle, timeout (Binary-Sensor).
//
// Korrektur gegenueber der urspruenglichen Planung: sliding_window_moving_average gehoert
// NICHT hierher. window_size/send_every/send_first_at sind im Schema "type": "number", keine
// Dauer -- ESPHome zaehlt dort Aufrufe, nicht Zeit. Es ist bereits in P2 bei max/median/min/
// quantile korrekt zeitlos behandelt (send_every/send_first_at werden dort bewusst
// ignoriert -- jeder Aufruf emittiert, das ist die dokumentierte Vereinfachung).
//
// Rueckgabewert je Filter: ein neuer Wert (Kette laeuft weiter), FILTER_DROP (Kette stoppt,
// kein neuer Wert wird publiziert), FILTER_MANUAL (lambda -- kein Interpreter im Projekt,
// siehe lambdaLint.js-Kommentar "kein C++-Parser"; die UI bietet dafuer einen manuellen
// Fallback), oder FILTER_PENDING (der Filter wird spaeter -- ueber die Uhr -- selbst
// publizieren; die aktuelle Kette liefert fuer DIESEN Aufruf keinen Wert).
//
// Zeitbasierte Filter brauchen dafuer ctx.clock (eine useVirtualClock-Instanz) und
// ctx.filterIndex (von runFilterChain injiziert). Sie planen ueber clock.scheduleAt() ihre
// eigene Fortsetzung; wer das Ereignis abholt (Treiber in P6/useSimulation.js) fuehrt die
// Kette ab filterIndex+1 mit dem geplanten Wert fort. Zwei Ereignis-Arten:
//   "filter-resume"         -- einmalig, Kette geht ab dem NAECHSTEN Filter weiter
//                               (debounce, delayed_on/_off/_on_off, sensor/binary timeout).
//   "filter-heartbeat"      -- periodisch, der Treiber ruft beim Feuern denselben Filter
//                               erneut auf (heartbeat, throttle_average) statt nur
//                               fortzusetzen, damit er sich selbst neu einplant.
// Ohne ctx.clock (z.B. ein isolierter Aufruf ohne Uhr-Anbindung) verhaelt sich ein
// zeitbasierter Filter als reiner Passthrough -- besser ein unveraendert durchgereichter
// Wert als eine stumm verschluckte Kette.

import { parseDuration } from "./simulationDuration";

export const FILTER_DROP = Symbol("simulation-filter-drop");
export const FILTER_MANUAL = { manual: true };
export const FILTER_PENDING = Symbol("simulation-filter-pending");

const cancelPending = (state, ctx) => {
  if (state.pendingId !== undefined && ctx.clock) ctx.clock.cancel(state.pendingId);
  state.pendingId = undefined;
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const isTruthy = (value) => value === true || value === "true" || value === "ON" || value === 1;

// ESPHome-Syntax je Zeile: "<measured> -> <true>". Nicht parsebare Zeilen werden ignoriert.
const parseDatapoints = (datapoints) =>
  (Array.isArray(datapoints) ? datapoints : [])
    .map((line) => {
      const match = /^\s*(-?[\d.eE+-]+)\s*->\s*(-?[\d.eE+-]+)\s*$/.exec(String(line || ""));
      if (!match) return null;
      const x = Number(match[1]);
      const y = Number(match[2]);
      return Number.isFinite(x) && Number.isFinite(y) ? [x, y] : null;
    })
    .filter(Boolean);

// Kleinste-Quadrate-Ausgleichsgerade y = a*x + b.
const linearFit = (points) => {
  if (points.length < 2) return { a: 1, b: 0 };
  const n = points.length;
  const sumX = points.reduce((sum, [x]) => sum + x, 0);
  const sumY = points.reduce((sum, [, y]) => sum + y, 0);
  const sumXY = points.reduce((sum, [x, y]) => sum + x * y, 0);
  const sumXX = points.reduce((sum, [x]) => sum + x * x, 0);
  const denominator = n * sumXX - sumX * sumX;
  if (!denominator) return { a: 1, b: 0 };
  const a = (n * sumXY - sumX * sumY) / denominator;
  const b = (sumY - a * sumX) / n;
  return { a, b };
};

// Polynom-Ausgleich per Normalgleichungen (Vandermonde-Matrix, Gauss-Elimination). Reicht
// fuer die kleinen Punktzahlen, die ein Kalibrier-Datenpunkt-Feld realistischerweise hat --
// kein Bedarf fuer eine numerische Bibliothek.
const polynomialFit = (points, degree) => {
  const order = Math.max(1, Math.round(degree || 1)) + 1;
  if (points.length < order) return points.length ? [points[points.length - 1][1]] : [0];

  const powSums = new Array(2 * order - 1).fill(0);
  const rhs = new Array(order).fill(0);
  points.forEach(([x, y]) => {
    let power = 1;
    for (let i = 0; i < 2 * order - 1; i += 1) {
      powSums[i] += power;
      power *= x;
    }
    power = 1;
    for (let i = 0; i < order; i += 1) {
      rhs[i] += power * y;
      power *= x;
    }
  });

  const matrix = Array.from({ length: order }, (_, row) =>
    Array.from({ length: order }, (_, col) => powSums[row + col]).concat(rhs[row])
  );

  for (let col = 0; col < order; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < order; row += 1) {
      if (Math.abs(matrix[row][col]) > Math.abs(matrix[pivot][col])) pivot = row;
    }
    if (!matrix[pivot][col]) continue;
    [matrix[col], matrix[pivot]] = [matrix[pivot], matrix[col]];
    for (let row = 0; row < order; row += 1) {
      if (row === col) continue;
      const factor = matrix[row][col] / matrix[col][col];
      for (let k = col; k <= order; k += 1) matrix[row][k] -= factor * matrix[col][k];
    }
  }

  return matrix.map((row, i) => (row[i] ? row[order] / row[i] : 0));
};

const evalPolynomial = (coefficients, x) =>
  coefficients.reduce((sum, coefficient, power) => sum + coefficient * x ** power, 0);

// Steinhart-Hart-aehnliche NTC-Umrechnung ueber die drei Koeffizienten a/b/c. calibration
// wird nur fuer eine grobe Faelligkeitspruefung gelesen (ESPHome berechnet a/b/c selbst
// daraus, das bildet dieser Simulator nicht nach -- a/b/c muessen im Projekt gesetzt sein).
const KELVIN_OFFSET = 273.15;
const ntcResistanceFromTemperature = (temperatureC, a, b, c) => {
  const t = temperatureC + KELVIN_OFFSET;
  const lnR = solveSteinhartHartLnR(1 / t, a, b, c);
  return Math.exp(lnR);
};
const ntcTemperatureFromResistance = (resistanceOhm, a, b, c) => {
  const lnR = Math.log(Math.max(resistanceOhm, 1e-6));
  const invT = a + b * lnR + c * lnR ** 3;
  return 1 / invT - KELVIN_OFFSET;
};
// Steinhart-Hart ist in ln(R) kubisch, nicht direkt nach lnR aufloesbar -- Newton-Verfahren
// mit wenigen Iterationen ist fuer eine Vorschau-Simulation ausreichend genau.
const solveSteinhartHartLnR = (invT, a, b, c) => {
  let lnR = 5;
  for (let i = 0; i < 20; i += 1) {
    const f = a + b * lnR + c * lnR ** 3 - invT;
    const fPrime = b + 3 * c * lnR ** 2;
    if (!fPrime) break;
    lnR -= f / fPrime;
  }
  return lnR;
};

const pushWindow = (state, value, windowSize) => {
  state.buffer = state.buffer || [];
  state.buffer.push(value);
  const limit = Math.max(1, Math.round(windowSize || 5));
  if (state.buffer.length > limit) state.buffer.shift();
  return state.buffer;
};

const quantileOf = (sorted, q) => {
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * q;
  const lower = Math.floor(pos);
  const upper = Math.ceil(pos);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (pos - lower);
};

// Sensor-Filter, zeitlos.
const SENSOR_FILTERS = {
  calibrate_linear: (value, config) => {
    const { a, b } = linearFit(parseDatapoints(config.datapoints));
    return a * toNumber(value) + b;
  },
  calibrate_polynomial: (value, config) => {
    const coefficients = polynomialFit(parseDatapoints(config.datapoints), toNumber(config.degree, 1));
    return evalPolynomial(coefficients, toNumber(value));
  },
  clamp: (value, config) => {
    const numeric = toNumber(value);
    const min = config.min_value !== undefined ? toNumber(config.min_value) : -Infinity;
    const max = config.max_value !== undefined ? toNumber(config.max_value) : Infinity;
    if (numeric < min || numeric > max) {
      if (isTruthy(config.ignore_out_of_range)) return FILTER_DROP;
      return Math.min(Math.max(numeric, min), max);
    }
    return numeric;
  },
  delta: (value, config, state) => {
    const numeric = toNumber(value);
    const raw = String(config.value || "").trim();
    const isPercent = raw.endsWith("%");
    const threshold = toNumber(raw.replace("%", ""));
    if (state.lastValue === undefined) {
      state.lastValue = numeric;
      return numeric;
    }
    const diff = Math.abs(numeric - state.lastValue);
    const required = isPercent ? Math.abs(state.lastValue) * (threshold / 100) : threshold;
    if (diff < required) return FILTER_DROP;
    state.lastValue = numeric;
    return numeric;
  },
  filter_out: (value, config) => {
    const targets = (Array.isArray(config.values) ? config.values : []).map((entry) => toNumber(entry));
    return targets.includes(toNumber(value)) ? FILTER_DROP : toNumber(value);
  },
  lambda: () => FILTER_MANUAL,
  max: (value, config, state) => {
    const window = pushWindow(state, toNumber(value), config.window_size);
    return Math.max(...window);
  },
  median: (value, config, state) => {
    const window = pushWindow(state, toNumber(value), config.window_size);
    return quantileOf([...window].sort((a, b) => a - b), 0.5);
  },
  min: (value, config, state) => {
    const window = pushWindow(state, toNumber(value), config.window_size);
    return Math.min(...window);
  },
  multiply: (value, config) => toNumber(value) * toNumber(config.value, 1),
  offset: (value, config) => toNumber(value) + toNumber(config.value),
  // "or": erster Kind-Filter, der einen Wert liefert (kein DROP) -- braucht Zugriff auf den
  // Chain-Runner selbst, deshalb ueber ctx.runChain statt eines flachen Handlers.
  or: (value, config, state, ctx) => {
    const children = Array.isArray(config.filters) ? config.filters : [];
    for (let i = 0; i < children.length; i += 1) {
      const childState = (state.children = state.children || {});
      const result = ctx.runChain([children[i]], value, (childState[i] = childState[i] || {}));
      if (result !== FILTER_DROP) return result;
    }
    return FILTER_DROP;
  },
  quantile: (value, config, state) => {
    const window = pushWindow(state, toNumber(value), config.window_size);
    return quantileOf([...window].sort((a, b) => a - b), toNumber(config.quantile, 0.9));
  },
  round: (value, config) => {
    const decimals = Math.max(0, Math.round(toNumber(config.value, 0)));
    const factor = 10 ** decimals;
    return Math.round(toNumber(value) * factor) / factor;
  },
  round_to_multiple_of: (value, config) => {
    const multiple = toNumber(config.value, 1) || 1;
    return Math.round(toNumber(value) / multiple) * multiple;
  },
  skip_initial: (value, config, state) => {
    const count = Math.max(0, Math.round(toNumber(config.value, 0)));
    state.skipped = state.skipped || 0;
    if (state.skipped < count) {
      state.skipped += 1;
      return FILTER_DROP;
    }
    return toNumber(value);
  },
  to_ntc_resistance: (value, config) =>
    ntcResistanceFromTemperature(toNumber(value), toNumber(config.a), toNumber(config.b), toNumber(config.c)),
  to_ntc_temperature: (value, config) =>
    ntcTemperatureFromResistance(toNumber(value), toNumber(config.a), toNumber(config.b), toNumber(config.c)),

  // Publiziert erst, wenn der Wert fuer duration stabil geblieben ist -- jeder neue Wert
  // verwirft die laufende Wartezeit und startet neu (klassisches Debounce).
  debounce: (value, config, state, ctx) => {
    if (!ctx.clock) return toNumber(value);
    cancelPending(state, ctx);
    const durationMs = parseDuration(config.value);
    state.pendingId = ctx.clock.scheduleAt(ctx.clock.currentTick.value + durationMs, "filter-resume", {
      filterIndex: ctx.filterIndex,
      value: toNumber(value)
    });
    return FILTER_PENDING;
  },

  // Reine Ratenbegrenzung: laesst hoechstens einen Wert pro duration durch, keine
  // Planung noetig -- ein einfaches Sperrfenster reicht.
  throttle: (value, config, state, ctx) => {
    const now = ctx.clock ? ctx.clock.currentTick.value : 0;
    const durationMs = parseDuration(config.value);
    if (state.nextAllowedAt !== undefined && now < state.nextAllowedAt) return FILTER_DROP;
    state.nextAllowedAt = now + durationMs;
    return toNumber(value);
  },

  // Sammelt Werte, publiziert periodisch den Mittelwert seit der letzten Emission.
  // Periodisch = "filter-heartbeat"-Ereignis-Art: der Treiber ruft den Filter beim Feuern
  // erneut auf, damit er sich selbst neu einplant (siehe Dateikopf).
  throttle_average: (value, config, state, ctx) => {
    state.sum = (state.sum || 0) + toNumber(value);
    state.count = (state.count || 0) + 1;
    if (!ctx.clock) return FILTER_PENDING;
    if (state.pendingId === undefined) {
      const durationMs = parseDuration(config.value);
      state.pendingId = ctx.clock.scheduleAt(ctx.clock.currentTick.value + durationMs, "filter-heartbeat", {
        filterIndex: ctx.filterIndex
      });
    }
    return FILTER_PENDING;
  },

  // Wie throttle, aber priorisierte Werte (config.value) umgehen die Sperre sofort und
  // setzen selbst ein neues Sperrfenster.
  throttle_with_priority: (value, config, state, ctx) => {
    const now = ctx.clock ? ctx.clock.currentTick.value : 0;
    const durationMs = parseDuration(config.timeout);
    const numeric = toNumber(value);
    const priorityValues = (Array.isArray(config.value) ? config.value : []).map((entry) => toNumber(entry));
    if (priorityValues.includes(numeric)) {
      state.nextAllowedAt = now + durationMs;
      return numeric;
    }
    if (state.nextAllowedAt !== undefined && now < state.nextAllowedAt) return FILTER_DROP;
    state.nextAllowedAt = now + durationMs;
    return numeric;
  },

  // Publiziert den aktuellen Wert sofort weiter UND legt in festen Abstaenden (period) den
  // zuletzt gesehenen Wert erneut auf -- "optimistic" schaltet die sofortige Publikation ab.
  heartbeat: (value, config, state, ctx) => {
    state.lastValue = toNumber(value);
    const optimistic = isTruthy(config.optimistic);
    if (!ctx.clock) return optimistic ? state.lastValue : FILTER_PENDING;
    if (state.pendingId === undefined) {
      const periodMs = parseDuration(config.period);
      state.pendingId = ctx.clock.scheduleAt(ctx.clock.currentTick.value + periodMs, "filter-heartbeat", {
        filterIndex: ctx.filterIndex
      });
    }
    return optimistic ? state.lastValue : FILTER_PENDING;
  },

  // "Wird kein neuer Wert innerhalb von timeout publiziert, sende einen Ersatzwert" -- der
  // aktuelle Wert geht sofort durch, der Ersatzwert wird nur faellig, wenn bis dahin kein
  // neuer Aufruf die Planung verwirft (cancelPending oben im naechsten Aufruf).
  timeout: (value, config, state, ctx) => {
    if (!ctx.clock) return toNumber(value);
    cancelPending(state, ctx);
    const durationMs = parseDuration(config.timeout);
    const replacement = config.value !== undefined && config.value !== "" ? toNumber(config.value) : 0;
    state.pendingId = ctx.clock.scheduleAt(ctx.clock.currentTick.value + durationMs, "filter-resume", {
      filterIndex: ctx.filterIndex,
      value: replacement
    });
    return toNumber(value);
  }
};

// Binary-Sensor-Filter, zeitlos.
const BINARY_SENSOR_FILTERS = {
  invert: (value) => !isTruthy(value),
  lambda: () => FILTER_MANUAL,

  // Nur der ON-Uebergang wird verzoegert (muss `duration` stabil ON bleiben); OFF geht
  // immer sofort durch und verwirft eine noch laufende ON-Verzoegerung.
  delayed_on: (value, config, state, ctx) => {
    if (!isTruthy(value)) {
      cancelPending(state, ctx);
      return false;
    }
    if (!ctx.clock) return true;
    cancelPending(state, ctx);
    const durationMs = parseDuration(config.value);
    state.pendingId = ctx.clock.scheduleAt(ctx.clock.currentTick.value + durationMs, "filter-resume", {
      filterIndex: ctx.filterIndex,
      value: true
    });
    return FILTER_PENDING;
  },

  // Spiegelbild von delayed_on: nur der OFF-Uebergang wird verzoegert.
  delayed_off: (value, config, state, ctx) => {
    if (isTruthy(value)) {
      cancelPending(state, ctx);
      return true;
    }
    if (!ctx.clock) return false;
    cancelPending(state, ctx);
    const durationMs = parseDuration(config.value);
    state.pendingId = ctx.clock.scheduleAt(ctx.clock.currentTick.value + durationMs, "filter-resume", {
      filterIndex: ctx.filterIndex,
      value: false
    });
    return FILTER_PENDING;
  },

  // Beide Richtungen verzoegert, je eigene Dauer (time_on/time_off, 0 = sofort).
  delayed_on_off: (value, config, state, ctx) => {
    const truthy = isTruthy(value);
    const durationMs = parseDuration(truthy ? config.time_on : config.time_off);
    if (!ctx.clock || durationMs <= 0) {
      cancelPending(state, ctx);
      return truthy;
    }
    cancelPending(state, ctx);
    state.pendingId = ctx.clock.scheduleAt(ctx.clock.currentTick.value + durationMs, "filter-resume", {
      filterIndex: ctx.filterIndex,
      value: truthy
    });
    return FILTER_PENDING;
  },

  // Publiziert sofort, ignoriert danach jede Aenderung fuer duration -- kein Timer noetig,
  // reines Sperrfenster wie throttle.
  settle: (value, config, state, ctx) => {
    const now = ctx.clock ? ctx.clock.currentTick.value : 0;
    const durationMs = parseDuration(config.value);
    if (state.ignoreUntil !== undefined && now < state.ignoreUntil) return FILTER_DROP;
    state.ignoreUntil = now + durationMs;
    return isTruthy(value);
  },

  // Kein Interpreter fuer die genaue Puls-Choreografie mehrerer Timings -- der Rohwert geht
  // unveraendert durch, statt eine falsche Naeherung stumm vorzugaukeln.
  autorepeat: (value) => isTruthy(value),

  // "Setzt den binary_sensor nach timeout zurueck" -- bleibt der Wert ON, wird nach
  // Ablauf zwangsweise OFF publiziert, sofern kein neuer Wert die Planung verwirft.
  timeout: (value, config, state, ctx) => {
    cancelPending(state, ctx);
    const truthy = isTruthy(value);
    if (!truthy || !ctx.clock) return truthy;
    const durationMs = parseDuration(config.value);
    state.pendingId = ctx.clock.scheduleAt(ctx.clock.currentTick.value + durationMs, "filter-resume", {
      filterIndex: ctx.filterIndex,
      value: false
    });
    return true;
  }
};

export const applySensorFilter = (filterEntry, value, state, ctx) => {
  const handler = SENSOR_FILTERS[filterEntry?.type];
  if (!handler) return value;
  return handler(value, filterEntry.config || {}, state, ctx);
};

export const applyBinarySensorFilter = (filterEntry, value, state, ctx) => {
  const handler = BINARY_SENSOR_FILTERS[filterEntry?.type];
  if (!handler) return value;
  return handler(value, filterEntry.config || {}, state, ctx);
};

// runtimeStateByIndex: {[filterIndex]: {}} vom Aufrufer gehalten, ueber mehrere
// runFilterChain-Aufrufe hinweg wiederverwendet (fuer delta/skip_initial/Fenster-Puffer/
// zeitbasierte Filter). ctx.clock (optional, useVirtualClock-Instanz) aktiviert die
// zeitbasierten Filter aus P4; ohne clock verhalten sie sich als Passthrough.
// startIndex setzt fort, statt von vorne zu beginnen -- der Treiber (P6) nutzt das, um nach
// einem gefeuerten "filter-resume"-Ereignis ab filterIndex+1 weiterzumachen.
export const runFilterChain = (filters, rawValue, runtimeStateByIndex, ctx = {}, startIndex = 0, applyOne = applySensorFilter) => {
  let value = rawValue;
  for (let index = startIndex; index < (filters || []).length; index += 1) {
    if (value === FILTER_DROP || value === FILTER_MANUAL || value === FILTER_PENDING) return value;
    runtimeStateByIndex[index] = runtimeStateByIndex[index] || {};
    const filterCtx = {
      ...ctx,
      filterIndex: index,
      runChain: (nestedFilters, nestedValue, nestedState) => runFilterChain(nestedFilters, nestedValue, nestedState, ctx, 0, applyOne)
    };
    value = applyOne(filters[index], value, runtimeStateByIndex[index], filterCtx);
  }
  return value;
};
