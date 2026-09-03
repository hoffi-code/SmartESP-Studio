// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";

import BuilderHeaderCommentCard from "./BuilderHeaderCommentCard.vue";
import { DEFAULT_LOCALE, setLocale } from "../../i18n";

const mountCard = (headerComment = "") =>
  mount(BuilderHeaderCommentCard, { props: { headerComment } });

afterEach(() => setLocale(DEFAULT_LOCALE));

describe("BuilderHeaderCommentCard", () => {
  it("shows the stored comment without its hash prefix", () => {
    const wrapper = mountCard("# Wohnzimmer-Sensor\n# v2");
    expect(wrapper.get("textarea").element.value).toBe("Wohnzimmer-Sensor\nv2");
  });

  it("emits the hashed text while typing", async () => {
    const wrapper = mountCard();
    await wrapper.get("textarea").setValue("Wohnzimmer-Sensor");
    expect(wrapper.emitted("update:header-comment")?.at(-1)).toEqual(["# Wohnzimmer-Sensor"]);
  });

  it("emits an empty string once the field is cleared", async () => {
    const wrapper = mountCard("# Wohnzimmer-Sensor");
    await wrapper.get("textarea").setValue("");
    expect(wrapper.emitted("update:header-comment")?.at(-1)).toEqual([""]);
  });

  // Der Watcher darf nur auf echte Fremdaenderungen reagieren, sonst springt beim
  // Tippen der Cursor ans Ende.
  it("keeps the draft when the parent echoes the same value back", async () => {
    const wrapper = mountCard();
    await wrapper.get("textarea").setValue("Wohnzimmer");
    await wrapper.setProps({ headerComment: "# Wohnzimmer" });
    expect(wrapper.get("textarea").element.value).toBe("Wohnzimmer");
  });

  it("picks up a comment loaded from outside", async () => {
    const wrapper = mountCard();
    await wrapper.setProps({ headerComment: "# aus dem Import" });
    expect(wrapper.get("textarea").element.value).toBe("aus dem Import");
  });
});
