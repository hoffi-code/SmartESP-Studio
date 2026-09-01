// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";

import DesignElementPreview from "./DesignElementPreview.vue";

afterEach(() => {
  document.head.querySelectorAll("link[href*='fonts.googleapis.com']").forEach((el) => el.remove());
});

describe("DesignElementPreview", () => {
  it("renders nothing for an unrelated domain", () => {
    expect(mount(DesignElementPreview, { props: { domain: "sensor" } }).find(".design-preview").exists()).toBe(false);
  });

  it("shows an <img> for an uploaded image asset", () => {
    const wrapper = mount(DesignElementPreview, {
      props: { domain: "image", config: { file: "logo.png" }, assetsBase: "/api/assets/" }
    });
    expect(wrapper.get("img").attributes("src")).toBe("/api/assets/images/logo.png");
  });

  it("resolves an mdi: reference to the icon svg", () => {
    const wrapper = mount(DesignElementPreview, { props: { domain: "image", config: { file: "mdi:home" } } });
    expect(wrapper.get("img").attributes("src")).toContain("@mdi/svg/svg/home.svg");
  });

  it("falls back to a hint when the image source is not resolvable", () => {
    const wrapper = mount(DesignElementPreview, { props: { domain: "image", config: { file: "some/build/path.ttf" } } });
    expect(wrapper.find("img").exists()).toBe(false);
    expect(wrapper.get(".design-preview__hint").exists()).toBe(true);
  });

  it("renders a live sample and injects the Google Fonts stylesheet for a gfonts font", () => {
    const wrapper = mount(DesignElementPreview, {
      props: { domain: "font", config: { file: { type: "gfonts", family: "Roboto" } } }
    });
    const sample = wrapper.get(".design-preview__sample");
    expect(sample.attributes("style")).toContain("Roboto");
    expect(document.head.querySelector("link[href*='family=Roboto']")).toBeTruthy();
  });

  it("shows an unrenderable hint for local/web fonts", () => {
    const wrapper = mount(DesignElementPreview, {
      props: { domain: "font", config: { file: { type: "local", path: "x.ttf" } } }
    });
    expect(wrapper.find(".design-preview__sample").exists()).toBe(false);
    expect(wrapper.get(".design-preview__hint").text()).toContain("can't be previewed");
  });

  it("renders a swatch for a color from hex or rgb ints", () => {
    const fromHex = mount(DesignElementPreview, { props: { domain: "color", config: { hex: "ff8800" } } });
    expect(fromHex.get(".design-preview__color").attributes("style")).toContain("rgb(255, 136, 0)");

    const fromRgb = mount(DesignElementPreview, {
      props: { domain: "color", config: { red_int: 255, green_int: 0, blue_int: 128 } }
    });
    expect(fromRgb.get(".design-preview__color").attributes("style")).toContain("rgb(255, 0, 128)");

    const empty = mount(DesignElementPreview, { props: { domain: "color", config: {} } });
    expect(empty.find(".design-preview__color").exists()).toBe(false);
    expect(empty.get(".design-preview__hint").exists()).toBe(true);
  });
});
