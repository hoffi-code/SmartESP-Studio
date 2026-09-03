// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { defineComponent, h, inject } from "vue";
import { describe, expect, it } from "vitest";

import LambdaScopeVariablesScope from "./LambdaScopeVariablesScope.vue";

const Reader = defineComponent({
  setup() {
    const names = inject("lambdaScopeVariableNames", null);
    return () => h("span", { class: "reader" }, names ? names.value.join(",") : "none");
  }
});

describe("LambdaScopeVariablesScope", () => {
  it("provides the given names to a nested consumer", () => {
    const wrapper = mount(LambdaScopeVariablesScope, {
      props: { names: ["plug1_on", "plug2_on"] },
      slots: { default: () => h(Reader) }
    });
    expect(wrapper.get(".reader").text()).toBe("plug1_on,plug2_on");
  });

  it("defaults to an empty list without the names prop", () => {
    const wrapper = mount(LambdaScopeVariablesScope, { slots: { default: () => h(Reader) } });
    expect(wrapper.get(".reader").text()).toBe("");
  });

  // Zwei Instanzen (z.B. zwei api.actions[]-Eintraege in derselben Liste) duerfen sich
  // nicht gegenseitig ueberschreiben -- provide() gilt pro Komponenteninstanz.
  it("keeps sibling scopes independent", () => {
    const first = mount(LambdaScopeVariablesScope, {
      props: { names: ["a"] },
      slots: { default: () => h(Reader) }
    });
    const second = mount(LambdaScopeVariablesScope, {
      props: { names: ["b"] },
      slots: { default: () => h(Reader) }
    });
    expect(first.get(".reader").text()).toBe("a");
    expect(second.get(".reader").text()).toBe("b");
  });
});
