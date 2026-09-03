import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useVirtualClock } from "./useVirtualClock";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useVirtualClock", () => {
  it("starts paused at tick 0", () => {
    const clock = useVirtualClock();
    expect(clock.currentTick.value).toBe(0);
    expect(clock.running.value).toBe(false);
  });

  it("advances currentTick only while playing", () => {
    const clock = useVirtualClock({ tickIntervalMs: 100 });
    vi.advanceTimersByTime(500);
    expect(clock.currentTick.value).toBe(0);

    clock.play();
    vi.advanceTimersByTime(500);
    expect(clock.currentTick.value).toBe(500);

    clock.pause();
    vi.advanceTimersByTime(500);
    expect(clock.currentTick.value).toBe(500);
  });

  it("play is idempotent -- calling it twice does not double the interval", () => {
    const clock = useVirtualClock({ tickIntervalMs: 100 });
    clock.play();
    clock.play();
    vi.advanceTimersByTime(300);
    expect(clock.currentTick.value).toBe(300);
  });

  it("applies the speed factor to real-time progression", () => {
    const clock = useVirtualClock({ tickIntervalMs: 100 });
    clock.setSpeed(5);
    clock.play();
    vi.advanceTimersByTime(200); // 2 real ticks * 5x
    expect(clock.currentTick.value).toBe(1000);
  });

  it("ignores an unsupported speed factor", () => {
    const clock = useVirtualClock();
    clock.setSpeed(1);
    clock.setSpeed(3);
    expect(clock.speedFactor.value).toBe(1);
  });

  it("reset pauses, zeroes the tick, and clears the queue", () => {
    const clock = useVirtualClock({ tickIntervalMs: 100 });
    clock.play();
    vi.advanceTimersByTime(300);
    clock.scheduleAt(1000, "delay", { id: "x" });

    clock.reset();

    expect(clock.running.value).toBe(false);
    expect(clock.currentTick.value).toBe(0);
    expect(clock.drainDue(10000)).toEqual([]);
  });

  it("drainDue returns only events due at or before the given tick, sorted, and removes them", () => {
    const clock = useVirtualClock();
    clock.scheduleAt(200, "b", "second");
    clock.scheduleAt(100, "a", "first");
    clock.scheduleAt(500, "c", "later");

    const due = clock.drainDue(300);
    expect(due.map((event) => event.payload)).toEqual(["first", "second"]);
    expect(clock.drainDue(1000).map((event) => event.payload)).toEqual(["later"]);
  });

  it("cancel removes a scheduled event before it becomes due", () => {
    const clock = useVirtualClock();
    const id = clock.scheduleAt(100, "delay", "x");
    clock.cancel(id);
    expect(clock.drainDue(1000)).toEqual([]);
  });
});
