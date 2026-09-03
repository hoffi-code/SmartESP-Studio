import { describe, expect, it } from "vitest";

import { useVirtualClock } from "../composables/builder/useVirtualClock";
import {
  FILTER_DROP,
  FILTER_MANUAL,
  FILTER_PENDING,
  applyBinarySensorFilter,
  applySensorFilter,
  runFilterChain
} from "./simulationFilters";

const sensorFilter = (type, config = {}) => ({ type, config });
const binaryFilter = (type, config = {}) => ({ type, config });

describe("applySensorFilter - arithmetic", () => {
  it("offset adds the constant", () => {
    expect(applySensorFilter(sensorFilter("offset", { value: 2.5 }), 10, {})).toBe(12.5);
  });

  it("multiply scales the value", () => {
    expect(applySensorFilter(sensorFilter("multiply", { value: 2 }), 10, {})).toBe(20);
  });

  it("round rounds to the configured decimal count", () => {
    expect(applySensorFilter(sensorFilter("round", { value: 1 }), 3.14159, {})).toBe(3.1);
  });

  it("round_to_multiple_of snaps to the nearest multiple", () => {
    expect(applySensorFilter(sensorFilter("round_to_multiple_of", { value: 5 }), 12, {})).toBe(10);
  });
});

describe("applySensorFilter - calibration", () => {
  it("calibrate_linear fits and applies a least-squares line", () => {
    const value = applySensorFilter(
      sensorFilter("calibrate_linear", { datapoints: ["0.0 -> 32.0", "100.0 -> 212.0"] }),
      50,
      {}
    );
    expect(value).toBeCloseTo(122); // Celsius->Fahrenheit-shaped fit
  });

  it("calibrate_polynomial fits an exact quadratic through 4 points", () => {
    const value = applySensorFilter(
      sensorFilter("calibrate_polynomial", { degree: 2, datapoints: ["0 -> 0", "1 -> 1", "2 -> 4", "3 -> 9"] }),
      4,
      {}
    );
    expect(value).toBeCloseTo(16); // y = x^2
  });

  it("to_ntc_resistance/to_ntc_temperature round-trip a real 10k NTC coefficient set", () => {
    const coefficients = { a: 0.001129148, b: 0.000234125, c: 0.0000000876741 };
    const resistance = applySensorFilter(sensorFilter("to_ntc_resistance", coefficients), 25, {});
    expect(resistance).toBeCloseTo(10000, -2); // 10k NTC at its 25C reference point
    const temperature = applySensorFilter(sensorFilter("to_ntc_temperature", coefficients), resistance, {});
    expect(temperature).toBeCloseTo(25, 1);
  });
});

describe("applySensorFilter - clamp/delta/filter_out/skip_initial", () => {
  it("clamp clips values inside the range without ignore_out_of_range", () => {
    expect(applySensorFilter(sensorFilter("clamp", { min_value: 0, max_value: 10 }), 20, {})).toBe(10);
  });

  it("clamp drops out-of-range values when ignore_out_of_range is set", () => {
    expect(applySensorFilter(sensorFilter("clamp", { min_value: 0, max_value: 10, ignore_out_of_range: true }), 20, {})).toBe(
      FILTER_DROP
    );
  });

  it("delta passes the first value, then only values past the threshold", () => {
    const state = {};
    const filter = sensorFilter("delta", { value: "5" });
    expect(applySensorFilter(filter, 10, state)).toBe(10);
    expect(applySensorFilter(filter, 12, state)).toBe(FILTER_DROP); // below threshold
    expect(applySensorFilter(filter, 16, state)).toBe(16); // >= 5 away from 10
  });

  it("delta supports a percentage threshold", () => {
    const state = {};
    const filter = sensorFilter("delta", { value: "10%" });
    applySensorFilter(filter, 100, state);
    expect(applySensorFilter(filter, 105, state)).toBe(FILTER_DROP); // 5% change
    expect(applySensorFilter(filter, 115, state)).toBe(115); // 15% change
  });

  it("filter_out drops configured values and passes everything else", () => {
    const filter = sensorFilter("filter_out", { values: [0, -1] });
    expect(applySensorFilter(filter, 0, {})).toBe(FILTER_DROP);
    expect(applySensorFilter(filter, 5, {})).toBe(5);
  });

  it("skip_initial drops the first N values then passes through", () => {
    const state = {};
    const filter = sensorFilter("skip_initial", { value: 2 });
    expect(applySensorFilter(filter, 1, state)).toBe(FILTER_DROP);
    expect(applySensorFilter(filter, 2, state)).toBe(FILTER_DROP);
    expect(applySensorFilter(filter, 3, state)).toBe(3);
  });
});

describe("applySensorFilter - windowed statistics (call-count based in this round)", () => {
  it("max/min/median/quantile aggregate over a rolling window", () => {
    const maxFilter = sensorFilter("max", { window_size: 3 });
    const minFilter = sensorFilter("min", { window_size: 3 });
    const medianFilter = sensorFilter("median", { window_size: 3 });
    const quantileFilter = sensorFilter("quantile", { window_size: 4, quantile: 0.75 });
    const states = { max: {}, min: {}, median: {}, quantile: {} };
    [1, 5, 3, 9].forEach((value) => {
      applySensorFilter(maxFilter, value, states.max);
      applySensorFilter(minFilter, value, states.min);
      applySensorFilter(medianFilter, value, states.median);
      applySensorFilter(quantileFilter, value, states.quantile);
    });
    // window_size 3, last 3 samples are [5, 3, 9]
    expect(applySensorFilter(maxFilter, 9, states.max)).toBe(9);
    expect(applySensorFilter(minFilter, 9, states.min)).toBe(3);
  });
});

describe("applySensorFilter - or / lambda", () => {
  it("or returns the first child that does not drop", () => {
    const orFilter = sensorFilter("or", {
      filters: [
        { type: "clamp", config: { min_value: 0, max_value: 10, ignore_out_of_range: true } },
        { type: "offset", config: { value: 1 } }
      ]
    });
    const result = applySensorFilter(orFilter, 20, {}, { runChain: runFilterChain });
    expect(result).toBe(21); // clamp drops 20, offset applies +1 to the original 20
  });

  it("lambda is not evaluated -- returns the manual fallback marker", () => {
    expect(applySensorFilter(sensorFilter("lambda", { value: "return x * 2;" }), 5, {})).toBe(FILTER_MANUAL);
  });
});

describe("applyBinarySensorFilter", () => {
  it("invert flips the boolean state", () => {
    expect(applyBinarySensorFilter({ type: "invert", config: {} }, true, {})).toBe(false);
    expect(applyBinarySensorFilter({ type: "invert", config: {} }, false, {})).toBe(true);
  });

  it("lambda is not evaluated -- returns the manual fallback marker", () => {
    expect(applyBinarySensorFilter({ type: "lambda", config: { value: "return !x;" } }, true, {})).toBe(FILTER_MANUAL);
  });
});

describe("runFilterChain", () => {
  it("threads a value through several filters in order", () => {
    const filters = [sensorFilter("offset", { value: 1 }), sensorFilter("multiply", { value: 2 })];
    expect(runFilterChain(filters, 5, {})).toBe(12); // (5 + 1) * 2
  });

  it("stops the chain once a filter drops the value", () => {
    const filters = [
      sensorFilter("clamp", { min_value: 0, max_value: 10, ignore_out_of_range: true }),
      sensorFilter("multiply", { value: 100 })
    ];
    expect(runFilterChain(filters, 20, {})).toBe(FILTER_DROP);
  });

  it("stops the chain once a filter needs a manual value", () => {
    const filters = [sensorFilter("lambda", { value: "return x;" }), sensorFilter("multiply", { value: 100 })];
    expect(runFilterChain(filters, 20, {})).toBe(FILTER_MANUAL);
  });

  it("reuses runtime state across calls for stateful filters", () => {
    const filters = [sensorFilter("skip_initial", { value: 1 })];
    const state = {};
    expect(runFilterChain(filters, 1, state)).toBe(FILTER_DROP);
    expect(runFilterChain(filters, 2, state)).toBe(2);
  });
});

describe("without a clock, time-based filters degrade to a passthrough", () => {
  it("debounce, throttle_average and delayed_on all just pass the value through", () => {
    expect(applySensorFilter(sensorFilter("debounce", { value: "5s" }), 10, {}, {})).toBe(10);
    expect(applySensorFilter(sensorFilter("throttle_average", { value: "5s" }), 10, {}, {})).toBe(FILTER_PENDING);
    expect(applyBinarySensorFilter(binaryFilter("delayed_on", { value: "5s" }), true, {}, {})).toBe(true);
  });
});

describe("time-based sensor filters (wired to a virtual clock)", () => {
  it("debounce waits for the value to settle, cancelling a superseded timer", () => {
    const clock = useVirtualClock();
    const state = {};
    const ctx = { clock, filterIndex: 0 };
    expect(applySensorFilter(sensorFilter("debounce", { value: "5s" }), 10, state, ctx)).toBe(FILTER_PENDING);

    clock.currentTick.value = 3000; // a new value arrives before the 5s settle time
    expect(applySensorFilter(sensorFilter("debounce", { value: "5s" }), 12, state, ctx)).toBe(FILTER_PENDING);
    expect(clock.drainDue(4999)).toEqual([]); // the first timer was cancelled, nothing fires here

    clock.currentTick.value = 8000; // 5s after the second value
    const due = clock.drainDue();
    expect(due).toHaveLength(1);
    expect(due[0]).toMatchObject({ kind: "filter-resume", payload: { filterIndex: 0, value: 12 } });
  });

  it("throttle rate-limits without scheduling anything", () => {
    const clock = useVirtualClock();
    const state = {};
    const ctx = { clock };
    const filter = sensorFilter("throttle", { value: "1s" });
    expect(applySensorFilter(filter, 1, state, ctx)).toBe(1);
    clock.currentTick.value = 500;
    expect(applySensorFilter(filter, 2, state, ctx)).toBe(FILTER_DROP);
    clock.currentTick.value = 1000;
    expect(applySensorFilter(filter, 3, state, ctx)).toBe(3);
  });

  it("throttle_with_priority lets priority values bypass an active throttle window", () => {
    const clock = useVirtualClock();
    const state = {};
    const ctx = { clock };
    const filter = sensorFilter("throttle_with_priority", { timeout: "1s", value: [99] });
    expect(applySensorFilter(filter, 1, state, ctx)).toBe(1);
    clock.currentTick.value = 200;
    expect(applySensorFilter(filter, 2, state, ctx)).toBe(FILTER_DROP);
    expect(applySensorFilter(filter, 99, state, ctx)).toBe(99); // priority value ignores the window
  });

  it("throttle_average accumulates and schedules a single periodic emission", () => {
    const clock = useVirtualClock();
    const state = {};
    const ctx = { clock, filterIndex: 2 };
    const filter = sensorFilter("throttle_average", { value: "10s" });
    applySensorFilter(filter, 10, state, ctx);
    applySensorFilter(filter, 20, state, ctx);
    expect(state.sum).toBe(30);
    expect(state.count).toBe(2);

    clock.currentTick.value = 10000;
    const due = clock.drainDue();
    expect(due).toHaveLength(1);
    expect(due[0]).toMatchObject({ kind: "filter-heartbeat", payload: { filterIndex: 2 } });
  });

  it("heartbeat withholds the immediate value by default and schedules the first period", () => {
    const clock = useVirtualClock();
    const state = {};
    const ctx = { clock, filterIndex: 0 };
    const filter = sensorFilter("heartbeat", { period: "1min" });
    expect(applySensorFilter(filter, 5, state, ctx)).toBe(FILTER_PENDING);
    clock.currentTick.value = 60000;
    expect(clock.drainDue()).toHaveLength(1);
  });

  it("heartbeat also publishes immediately when optimistic is set", () => {
    const clock = useVirtualClock();
    const state = {};
    const ctx = { clock, filterIndex: 0 };
    const filter = sensorFilter("heartbeat", { period: "1min", optimistic: true });
    expect(applySensorFilter(filter, 5, state, ctx)).toBe(5);
  });

  it("timeout passes the value through immediately and schedules a replacement", () => {
    const clock = useVirtualClock();
    const state = {};
    const ctx = { clock, filterIndex: 1 };
    const filter = sensorFilter("timeout", { timeout: "30s", value: "0" });
    expect(applySensorFilter(filter, 21.5, state, ctx)).toBe(21.5);
    clock.currentTick.value = 30000;
    const due = clock.drainDue();
    expect(due[0]).toMatchObject({ kind: "filter-resume", payload: { filterIndex: 1, value: 0 } });
  });
});

describe("time-based binary-sensor filters (wired to a virtual clock)", () => {
  it("delayed_on holds an ON transition and passes OFF through immediately", () => {
    const clock = useVirtualClock();
    const state = {};
    const ctx = { clock, filterIndex: 0 };
    const filter = binaryFilter("delayed_on", { value: "2s" });
    expect(applyBinarySensorFilter(filter, true, state, ctx)).toBe(FILTER_PENDING);
    clock.currentTick.value = 2000;
    expect(clock.drainDue()[0]).toMatchObject({ payload: { filterIndex: 0, value: true } });

    expect(applyBinarySensorFilter(filter, false, state, ctx)).toBe(false);
    clock.currentTick.value = 4000;
    expect(clock.drainDue()).toEqual([]); // pending ON timer was cancelled by the OFF value
  });

  it("delayed_off mirrors delayed_on for the OFF transition", () => {
    const clock = useVirtualClock();
    const state = {};
    const ctx = { clock, filterIndex: 0 };
    const filter = binaryFilter("delayed_off", { value: "2s" });
    expect(applyBinarySensorFilter(filter, true, state, ctx)).toBe(true);
    expect(applyBinarySensorFilter(filter, false, state, ctx)).toBe(FILTER_PENDING);
    clock.currentTick.value = 2000;
    expect(clock.drainDue()[0]).toMatchObject({ payload: { filterIndex: 0, value: false } });
  });

  it("delayed_on_off uses time_on/time_off independently, 0 meaning immediate", () => {
    const clock = useVirtualClock();
    const state = {};
    const ctx = { clock, filterIndex: 0 };
    const filter = binaryFilter("delayed_on_off", { time_on: "1s", time_off: "0s" });
    expect(applyBinarySensorFilter(filter, true, state, ctx)).toBe(FILTER_PENDING);
    expect(applyBinarySensorFilter(filter, false, state, ctx)).toBe(false); // time_off 0 -> immediate
  });

  it("settle publishes immediately then ignores changes for the settle window", () => {
    const clock = useVirtualClock();
    const state = {};
    const ctx = { clock };
    const filter = binaryFilter("settle", { value: "1s" });
    expect(applyBinarySensorFilter(filter, true, state, ctx)).toBe(true);
    clock.currentTick.value = 500;
    expect(applyBinarySensorFilter(filter, false, state, ctx)).toBe(FILTER_DROP);
    clock.currentTick.value = 1000;
    expect(applyBinarySensorFilter(filter, false, state, ctx)).toBe(false);
  });

  it("binary timeout force-resets an ON value after the timeout unless replaced sooner", () => {
    const clock = useVirtualClock();
    const state = {};
    const ctx = { clock, filterIndex: 0 };
    const filter = binaryFilter("timeout", { value: "5s" });
    expect(applyBinarySensorFilter(filter, true, state, ctx)).toBe(true);
    clock.currentTick.value = 5000;
    expect(clock.drainDue()[0]).toMatchObject({ payload: { filterIndex: 0, value: false } });
  });

  it("autorepeat passes the raw value through -- no interpreter for the pulse choreography", () => {
    expect(applyBinarySensorFilter(binaryFilter("autorepeat", { timings: [] }), true, {}, {})).toBe(true);
  });
});

describe("runFilterChain with a resumed chain (startIndex)", () => {
  it("without a clock, a time-based filter degrades to passthrough and the chain runs through", () => {
    const filters = [sensorFilter("debounce", { value: "1s" }), sensorFilter("multiply", { value: 2 })];
    const state = {};
    expect(runFilterChain(filters, 10, state)).toBe(20);
  });

  it("resumes at filterIndex + 1 with the scheduled value", () => {
    const filters = [sensorFilter("debounce", { value: "1s" }), sensorFilter("multiply", { value: 2 })];
    const clock = useVirtualClock();
    const state = {};
    expect(runFilterChain(filters, 10, state, { clock })).toBe(FILTER_PENDING);
    clock.currentTick.value = 1000;
    const [event] = clock.drainDue();
    const result = runFilterChain(filters, event.payload.value, state, { clock }, event.payload.filterIndex + 1);
    expect(result).toBe(20); // (debounced 10) * 2
  });
});
