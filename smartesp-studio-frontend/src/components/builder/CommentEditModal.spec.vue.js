// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import CommentEditModal from "./CommentEditModal.vue";

const openWith = (value = "") => mount(CommentEditModal, { props: { open: true, value } });

describe("CommentEditModal", () => {
  it("renders nothing while closed", () => {
    const wrapper = mount(CommentEditModal, { props: { open: false } });
    expect(wrapper.find(".modal-backdrop").exists()).toBe(false);
  });

  it("strips the leading # for editing and re-adds it on save", async () => {
    const wrapper = openWith("# --- I2C bus for the display ---");
    const textarea = wrapper.get("textarea");
    expect(textarea.element.value).toBe("--- I2C bus for the display ---");

    await textarea.setValue("Backlight PWM output");
    await wrapper.get(".modal-actions button:last-child").trigger("click");

    expect(wrapper.emitted("save")).toEqual([["# Backlight PWM output"]]);
  });

  it("prefixes every non-blank line and keeps blank lines as bare #", async () => {
    const wrapper = openWith();
    await wrapper.get("textarea").setValue("first line\n\nsecond line");
    await wrapper.get(".modal-actions button:last-child").trigger("click");
    expect(wrapper.emitted("save")).toEqual([["# first line\n#\n# second line"]]);
  });

  it("disables save while the draft is empty", async () => {
    const wrapper = openWith();
    expect(wrapper.get(".modal-actions button:last-child").attributes("disabled")).toBeDefined();
    await wrapper.get("textarea").setValue("x");
    expect(wrapper.get(".modal-actions button:last-child").attributes("disabled")).toBeUndefined();
  });

  it("only offers Delete when a comment already exists", () => {
    expect(openWith("# note").text()).toContain("Löschen");
    expect(openWith("").text()).not.toContain("Löschen");
  });

  it("emits delete and close", async () => {
    const wrapper = openWith("# note");
    await wrapper.get(".modal-actions button:first-child").trigger("click");
    expect(wrapper.emitted("delete")).toHaveLength(1);

    await wrapper.get(".modal-backdrop").trigger("click");
    expect(wrapper.emitted("close")).toHaveLength(1);
  });
});
