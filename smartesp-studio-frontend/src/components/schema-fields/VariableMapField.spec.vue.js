// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";

import VariableMapField from "./VariableMapField.vue";
import { DEFAULT_LOCALE, setLocale } from "../../i18n";

afterEach(() => setLocale(DEFAULT_LOCALE));

describe("VariableMapField", () => {
  it("shows the empty state with no rows", () => {
    const wrapper = mount(VariableMapField, { props: { modelValue: [] } });
    expect(wrapper.get(".note").text()).toBe("No variables yet.");
    expect(wrapper.findAll(".schema-variable-map__row")).toHaveLength(0);
  });

  it("appends a row with the first type preselected", async () => {
    const wrapper = mount(VariableMapField, { props: { modelValue: [] } });
    await wrapper.get("button.btn-standard").trigger("click");
    expect(wrapper.emitted("update:model-value")).toEqual([[[{ name: "", type: "bool" }]]]);
  });

  it("edits the name of an existing row without touching others", async () => {
    const wrapper = mount(VariableMapField, {
      props: { modelValue: [{ name: "plug1_on", type: "bool" }, { name: "level", type: "int" }] }
    });
    await wrapper.findAll(".schema-variable-map__row input")[0].setValue("relay_on");
    expect(wrapper.emitted("update:model-value")[0][0]).toEqual([
      { name: "relay_on", type: "bool" },
      { name: "level", type: "int" }
    ]);
  });

  it("changes the type of a row via the select", async () => {
    const wrapper = mount(VariableMapField, { props: { modelValue: [{ name: "level", type: "bool" }] } });
    await wrapper.get(".schema-variable-map__row select").setValue("int");
    expect(wrapper.emitted("update:model-value")[0][0]).toEqual([{ name: "level", type: "int" }]);
  });

  it("removes a row by index", async () => {
    const wrapper = mount(VariableMapField, {
      props: { modelValue: [{ name: "a", type: "bool" }, { name: "b", type: "int" }] }
    });
    await wrapper.findAll(".schema-variable-map__row button")[0].trigger("click");
    expect(wrapper.emitted("update:model-value")[0][0]).toEqual([{ name: "b", type: "int" }]);
  });

  it("offers every ESPHome variable type in the select", () => {
    const wrapper = mount(VariableMapField, { props: { modelValue: [{ name: "a", type: "bool" }] } });
    const options = wrapper.findAll(".schema-variable-map__row select option").map((o) => o.element.value);
    expect(options).toEqual(["bool", "int", "float", "string", "bool[]", "int[]", "float[]", "string[]"]);
  });
});
