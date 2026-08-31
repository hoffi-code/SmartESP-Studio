// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import DisplayInspectorAnimation from "./DisplayInspectorAnimation.vue";

const baseElement = () => ({
  type: "animation",
  x: 0,
  y: 0,
  w: 40,
  h: 20,
  animationId: "anim_1",
  animationFile: "wave.gif",
  animationType: "BINARY",
  loopEnabled: false,
  autoAnimate: false
});

const images = [{ file: "wave.gif" }, { file: "spin.gif" }, { file: "logo.png" }];

describe("DisplayInspectorAnimation", () => {
  it("only lists .gif files as animation options", () => {
    const wrapper = mount(DisplayInspectorAnimation, {
      props: { selectedElement: baseElement(), images }
    });

    const options = wrapper.findAll("#animationFile option").map((o) => o.element.value);
    expect(options).toEqual(["", "spin.gif", "wave.gif"]);
  });

  it("flags a blank animation ID as invalid", () => {
    const wrapper = mount(DisplayInspectorAnimation, {
      props: { selectedElement: { ...baseElement(), animationId: "" }, images }
    });

    expect(wrapper.get("#animationId").classes()).toContain("field-error");
  });

  it("shows the interval field only when auto-animate is on", async () => {
    const wrapper = mount(DisplayInspectorAnimation, {
      props: { selectedElement: baseElement(), images }
    });
    expect(wrapper.find("#animationInterval").exists()).toBe(false);

    await wrapper.get("#animationAuto").setValue("true");
    expect(wrapper.emitted("update")).toEqual([[{ autoAnimate: true }]]);
  });

  it("shows loop start/end/repeat only when loop is enabled", () => {
    const wrapper = mount(DisplayInspectorAnimation, {
      props: { selectedElement: { ...baseElement(), loopEnabled: true }, images }
    });

    expect(wrapper.find("#animationLoopStart").exists()).toBe(true);
    expect(wrapper.find("#animationLoopRepeat").exists()).toBe(true);
  });

  it("keeps aspect ratio locked when height changes", async () => {
    const wrapper = mount(DisplayInspectorAnimation, {
      props: { selectedElement: baseElement(), images }
    });

    await wrapper.get("#sizeH").setValue("10");
    expect(wrapper.emitted("update")).toEqual([[{ w: 20, h: 10 }]]);
  });

  it("does not lock aspect ratio for non-size numeric fields like the interval", async () => {
    const wrapper = mount(DisplayInspectorAnimation, {
      props: { selectedElement: { ...baseElement(), autoAnimate: true }, images }
    });

    await wrapper.get("#animationInterval").setValue("500");
    expect(wrapper.emitted("update")).toEqual([[{ intervalMs: 500 }]]);
  });

  it("updates animationFile + animationUrl when the file changes", async () => {
    const wrapper = mount(DisplayInspectorAnimation, {
      props: { selectedElement: baseElement(), images, assetsBase: "/base/" }
    });

    await wrapper.get("#animationFile").setValue("spin.gif");
    expect(wrapper.emitted("update")[0]).toEqual([{ animationFile: "spin.gif", animationUrl: "/base/images/spin.gif" }]);
  });
});
