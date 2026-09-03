// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";

import SectionCommentButton from "./SectionCommentButton.vue";
import { DEFAULT_LOCALE, setLocale } from "../../i18n";

afterEach(() => setLocale(DEFAULT_LOCALE));

describe("SectionCommentButton", () => {
  it("renders nothing without a section key", () => {
    const wrapper = mount(SectionCommentButton, { props: { commentKey: "" } });
    expect(wrapper.find("button").exists()).toBe(false);
  });

  it("offers to add a comment when none exists", () => {
    const wrapper = mount(SectionCommentButton, { props: { commentKey: "logger" } });
    expect(wrapper.get("button").text()).toBe("Comment");
  });

  it("switches the label once a comment is stored", () => {
    const wrapper = mount(SectionCommentButton, {
      props: { commentKey: "logger", hasComment: true }
    });
    expect(wrapper.get("button").text()).toBe("Edit comment");
  });

  it("emits the section key on click", async () => {
    const wrapper = mount(SectionCommentButton, { props: { commentKey: "logger" } });
    await wrapper.get("button").trigger("click");
    expect(wrapper.emitted("open")).toEqual([["logger"]]);
  });
});
