import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Ein on_*-Feld ist nur dann mit dem Action-Picker verdrahtet, wenn es eine Liste ist,
// deren item auf base_actions.json extended -- genau das prueft ListField zur Laufzeit.
// Ohne diesen Guard faellt ein Tippfehler im Schema erst im Browser auf.
const publicDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../public");
const readJson = (rel) => JSON.parse(readFileSync(resolve(publicDir, rel), "utf-8"));

const ACTION_EXTENDS = "base_actions.json";

const fieldsOf = (schema) => (Array.isArray(schema.fields) ? schema.fields : []);
const byKey = (schema, key) => fieldsOf(schema).find((field) => field.key === key);

const expectActionList = (field, label) => {
  expect(field, label).toBeTruthy();
  expect(field.type, label).toBe("list");
  expect(field.item?.extends, label).toBe(ACTION_EXTENDS);
};

// Trigger mit Nutzlast (Filter, Bedingung) tragen die Actions in einem then-Unterfeld.
const expectWrappedTrigger = (field, label, payloadKeys) => {
  expect(field, label).toBeTruthy();
  expect(field.type, label).toBe("list");
  const inner = field.item?.fields || [];
  const keys = inner.map((entry) => entry.key);
  for (const key of payloadKeys) expect(keys, label).toContain(key);
  expectActionList(inner.find((entry) => entry.key === "then"), `${label}.then`);
};

describe("action trigger coverage", () => {
  it("wires the component base schemas that were missing triggers", () => {
    const display = readJson("schemas/components/base_component/base_display.json");
    expectWrappedTrigger(byKey(display, "on_page_change"), "display.on_page_change", ["from", "to"]);

    const cover = readJson("schemas/components/base_component/base_cover.json");
    expectActionList(byKey(cover, "on_open"), "cover.on_open");

    for (const rel of [
      "schemas/components/base_component/hub_pn532.json",
      "schemas/components/base_component/hub_pn7160.json",
      "schemas/components/miscellaneous/pn7150_i2c.json"
    ]) {
      expectActionList(byKey(readJson(rel), "on_finished_write"), `${rel} on_finished_write`);
    }
  });

  it("covers all 36 remote_receiver protocol triggers", () => {
    const schema = readJson("schemas/components/wireless_communication/remote_receiver.json");
    const triggers = fieldsOf(schema).filter((field) => field.key.startsWith("on_"));
    expect(triggers).toHaveLength(36);
    for (const field of triggers) expectActionList(field, `remote_receiver.${field.key}`);
  });

  it("wires the top-level sections that were missing triggers", () => {
    const wifi = readJson("schemas/general/network/wifi.json");
    for (const key of ["on_connect", "on_disconnect", "on_error"]) {
      expectActionList(byKey(wifi, key), `wifi.${key}`);
    }

    const mqtt = readJson("schemas/general/protocols/mqtt.json");
    for (const key of ["on_connect", "on_disconnect", "on_json_message"]) {
      expectActionList(byKey(mqtt, key), `mqtt.${key}`);
    }
    expectWrappedTrigger(byKey(mqtt, "on_message"), "mqtt.on_message", ["topic", "qos", "payload"]);

    const logger = readJson("schemas/general/system/logger.json");
    expectWrappedTrigger(byKey(logger, "on_message"), "logger.on_message", ["level", "logger"]);

    const deepSleep = readJson("schemas/general/automation/deep_sleep.json");
    const item = byKey(deepSleep, "deep_sleep")?.item;
    expectActionList((item?.fields || []).find((field) => field.key === "on_wake"), "deep_sleep.on_wake");
  });

  // api.actions war bisher ein rohes yaml-Textfeld -- diese Runde deckt die Umstellung
  // auf ein echtes, picker-getriebenes Action-System ab.
  it("wires api.actions as a structured user-defined action list", () => {
    const api = readJson("schemas/general/protocols/api.json");
    const actions = byKey(api, "actions");
    expect(actions.type).toBe("list");
    const itemFields = actions.item?.fields || [];
    expect(itemFields.map((field) => field.key)).toEqual(["action", "variables", "then", "supports_response"]);
    expect(itemFields.find((field) => field.key === "action").required).toBe(true);
    expect(itemFields.find((field) => field.key === "variables").type).toBe("variable_map");
    expectActionList(itemFields.find((field) => field.key === "then"), "api.actions.then");
  });

  it("wires esp-now triggers as action lists instead of raw yaml", () => {
    const espNow = readJson("schemas/general/protocols/esp-now.json");
    expectWrappedTrigger(byKey(espNow, "on_receive"), "espnow.on_receive", ["address"]);
    expectWrappedTrigger(byKey(espNow, "on_broadcast"), "espnow.on_broadcast", ["address"]);
    expectActionList(byKey(espNow, "on_unknown_peer"), "espnow.on_unknown_peer");
  });
});
