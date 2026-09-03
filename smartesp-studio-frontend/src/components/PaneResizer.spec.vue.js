// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import PaneResizer from "./PaneResizer.vue";

const dispatch = (type, clientX = 0) =>
  window.dispatchEvent(new MouseEvent(type, { clientX }));

describe("PaneResizer", () => {
  it("reports the pointer position only while dragging", async () => {
    const wrapper = mount(PaneResizer);

    dispatch("mousemove", 100);
    expect(wrapper.emitted("resize-move")).toBeUndefined();

    await wrapper.get(".pane-resizer").trigger("mousedown");
    dispatch("mousemove", 420);
    expect(wrapper.emitted("resize-move")).toEqual([[420]]);

    dispatch("mouseup");
    dispatch("mousemove", 500);
    expect(wrapper.emitted("resize-move")).toEqual([[420]]);
  });

  it("brackets the drag with resize-start and resize-end", async () => {
    const wrapper = mount(PaneResizer);
    await wrapper.get(".pane-resizer").trigger("mousedown");
    expect(wrapper.emitted("resize-start")).toHaveLength(1);

    dispatch("mouseup");
    expect(wrapper.emitted("resize-end")).toHaveLength(1);

    // Ein zweites mouseup ohne Drag darf nichts mehr melden.
    dispatch("mouseup");
    expect(wrapper.emitted("resize-end")).toHaveLength(1);
  });

  it("locks cursor and selection on the body during the drag", async () => {
    const wrapper = mount(PaneResizer);
    await wrapper.get(".pane-resizer").trigger("mousedown");
    expect(document.body.classList.contains("is-pane-resizing")).toBe(true);

    dispatch("mouseup");
    expect(document.body.classList.contains("is-pane-resizing")).toBe(false);
  });

  it("emits reset on double click", async () => {
    const wrapper = mount(PaneResizer);
    await wrapper.get(".pane-resizer").trigger("dblclick");
    expect(wrapper.emitted("reset")).toHaveLength(1);
  });

  it("drops its window listeners and the body class on unmount", async () => {
    const wrapper = mount(PaneResizer);
    await wrapper.get(".pane-resizer").trigger("mousedown");
    wrapper.unmount();

    expect(document.body.classList.contains("is-pane-resizing")).toBe(false);
    dispatch("mousemove", 300);
    expect(wrapper.emitted("resize-move")).toBeUndefined();
  });
});
