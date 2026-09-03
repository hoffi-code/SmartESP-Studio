// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";

import BuilderAutomationOverview from "./BuilderAutomationOverview.vue";
import { DEFAULT_LOCALE, setLocale } from "../../i18n";

const entry = (overrides = {}) => ({
  kind: "component",
  sourceLabel: "Wohnzimmer",
  scopeId: "component:0",
  triggerKey: "on_press",
  path: ["on_press"],
  actions: ["switch.toggle"],
  origin: { type: "field", scopeId: "component:0", path: ["on_press"], modeLevel: "" },
  ...overrides
});

const mountOverview = (entries = []) =>
  mount(BuilderAutomationOverview, { props: { entries } });

afterEach(() => setLocale(DEFAULT_LOCALE));

describe("BuilderAutomationOverview", () => {
  it("shows an empty state without entries", () => {
    const wrapper = mountOverview();
    expect(wrapper.get(".note").text()).toBe("No automations in this project yet.");
    expect(wrapper.findAll(".automation-overview__row")).toHaveLength(0);
  });

  it("groups entries by source", () => {
    const wrapper = mountOverview([
      entry(),
      entry({ triggerKey: "on_release", path: ["on_release"] }),
      entry({ kind: "section", sourceLabel: "logger", scopeId: "tab:System:logger", triggerKey: "on_message" })
    ]);
    const titles = wrapper.findAll(".schema-list-title").map((title) => title.text());
    expect(titles).toHaveLength(2);
    expect(titles[0]).toContain("Wohnzimmer");
    expect(titles[1]).toContain("logger");
    expect(wrapper.findAll(".automation-overview__row")).toHaveLength(3);
  });

  it("renders the action chain of an entry", () => {
    const wrapper = mountOverview([entry({ actions: ["delay", "switch.toggle"] })]);
    expect(wrapper.get(".automation-overview__actions").text()).toBe("delay → switch.toggle");
  });

  it("emits the whole entry so the caller can reuse its origin", async () => {
    const target = entry();
    const wrapper = mountOverview([target]);
    await wrapper.get(".automation-overview__row button").trigger("click");
    expect(wrapper.emitted("jump")).toEqual([[target]]);
  });
});
