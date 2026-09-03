import { ref } from "vue";

// Virtuelle Uhr fuer die Simulation (Teil 1) -- treibt zeitbasierte Filter (P4), delay-
// Actions und interval:/on_time-Trigger (P6). Bewusst ein einzelner setInterval statt
// requestAnimationFrame: es geht um simulierte Sekunden/Minuten, keine Frame-Praezision.
//
// scheduleAt/drainDue sind die einzige Schnittstelle zu "geplanten Ereignissen" -- ein
// flaches Array, linear gescannt. Bei der zu erwartenden Groessenordnung (Dutzende
// gleichzeitig laufende Filter/Delays in einer Simulation) ist eine Heap-Struktur
// unnoetiger Aufwand.
export const useVirtualClock = ({ tickIntervalMs = 250 } = {}) => {
  const currentTick = ref(0);
  const running = ref(false);
  const speedFactor = ref(1);
  const queue = ref([]);

  let intervalHandle = null;
  let nextEventId = 1;

  const advance = (deltaMs) => {
    currentTick.value += deltaMs;
  };

  const play = () => {
    if (running.value) return;
    running.value = true;
    intervalHandle = setInterval(() => advance(tickIntervalMs * speedFactor.value), tickIntervalMs);
  };

  const pause = () => {
    running.value = false;
    if (intervalHandle) {
      clearInterval(intervalHandle);
      intervalHandle = null;
    }
  };

  const setSpeed = (factor) => {
    const allowed = [1, 2, 5, 10];
    speedFactor.value = allowed.includes(factor) ? factor : 1;
  };

  const reset = () => {
    pause();
    currentTick.value = 0;
    queue.value = [];
  };

  // dueTick ist absolut (currentTick.value + Verzoegerung), nicht relativ -- der Aufrufer
  // rechnet das selbst aus, damit ein Speed-Wechsel zwischen Planung und Faelligkeit keine
  // Ueberraschung ist.
  const scheduleAt = (dueTick, kind, payload) => {
    const id = nextEventId;
    nextEventId += 1;
    queue.value.push({ id, dueTick, kind, payload });
    return id;
  };

  const cancel = (id) => {
    queue.value = queue.value.filter((event) => event.id !== id);
  };

  // Entfernt und liefert alle Ereignisse mit dueTick <= tick (Default: aktueller Tick).
  const drainDue = (tick = currentTick.value) => {
    const due = [];
    const remaining = [];
    queue.value.forEach((event) => {
      if (event.dueTick <= tick) due.push(event);
      else remaining.push(event);
    });
    queue.value = remaining;
    due.sort((a, b) => a.dueTick - b.dueTick);
    return due;
  };

  return {
    currentTick,
    running,
    speedFactor,
    queue,
    play,
    pause,
    setSpeed,
    reset,
    scheduleAt,
    cancel,
    drainDue
  };
};
