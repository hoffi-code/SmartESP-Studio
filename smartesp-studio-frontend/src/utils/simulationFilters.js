// Simuliert die ESPHome-Filterketten (base_filters.json / base_binary_sensor_filters.json)
// rein in JS. Diese Runde (P2) deckt die zeitlosen Filtertypen ab; P4 ergaenzt die
// zeitbasierten (debounce/throttle/settle/sliding_window/timeout/heartbeat/delayed_on(_off)/
// autorepeat) um die virtuelle Uhr aus useVirtualClock.js.
//
// Rueckgabewert je Filter: ein neuer Wert (Kette laeuft weiter), FILTER_DROP (Kette stoppt,
// kein neuer Wert wird publiziert -- z.B. clamp mit ignore_out_of_range, filter_out,
// skip_initial), oder FILTER_MANUAL (lambda -- kein Interpreter im Projekt, siehe
// lambdaLint.js-Kommentar "kein C++-Parser"; die UI bietet dafuer einen manuellen Fallback).
//
// runtimeState ist ein pro Filter-INSTANZ (nicht Filtertyp) gehaltenes Objekt, das der
// Aufrufer (useSimulation.js) erzeugt und ueber mehrere Werte hinweg wiederverwendet --
// noetig fuer delta (letzter Wert), skip_initial (Zaehler), max/median/min/quantile (Puffer).

export const FILTER_DROP = Symbol("simulation-filter-drop");
export const FILTER_MANUAL = { manual: true };

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
    ntcTemperatureFromResistance(toNumber(value), toNumber(config.a), toNumber(config.b), toNumber(config.c))
};

// Binary-Sensor-Filter, zeitlos.
const BINARY_SENSOR_FILTERS = {
  invert: (value) => !isTruthy(value),
  lambda: () => FILTER_MANUAL
};

export const applySensorFilter = (filterEntry, value, state, ctx) => {
  const handler = SENSOR_FILTERS[filterEntry?.type];
  if (!handler) return value;
  return handler(value, filterEntry.config || {}, state, ctx);
};

export const applyBinarySensorFilter = (filterEntry, value, state) => {
  const handler = BINARY_SENSOR_FILTERS[filterEntry?.type];
  if (!handler) return value;
  return handler(value, filterEntry.config || {}, state);
};

// runtimeStateByIndex: {[filterIndex]: {}} vom Aufrufer gehalten, ueber mehrere
// runFilterChain-Aufrufe hinweg wiederverwendet (fuer delta/skip_initial/Fenster-Puffer).
export const runFilterChain = (filters, rawValue, runtimeStateByIndex, applyOne = applySensorFilter) => {
  let value = rawValue;
  for (let index = 0; index < (filters || []).length; index += 1) {
    if (value === FILTER_DROP || value === FILTER_MANUAL) return value;
    runtimeStateByIndex[index] = runtimeStateByIndex[index] || {};
    value = applyOne(filters[index], value, runtimeStateByIndex[index], {
      runChain: (nestedFilters, nestedValue, nestedState) =>
        runFilterChain(nestedFilters, nestedValue, nestedState, applyOne)
    });
  }
  return value;
};
