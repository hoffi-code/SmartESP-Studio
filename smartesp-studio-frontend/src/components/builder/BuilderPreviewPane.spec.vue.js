// @vitest-environment jsdom
import { flushPromises, mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import BuilderPreviewPane from "./BuilderPreviewPane.vue";

const coreLines = [
  { text: "esphome:" },
  { text: '  name: "kitchen"' },
  { text: "" },
  { text: "web_server:" },
  { text: "  port: 80" }
];

const mountPane = () =>
  mount(BuilderPreviewPane, {
    props: {
      splitPreviewEnabled: true,
      previewTabs: [
        { key: "core", label: "Core", lines: coreLines, content: coreLines.map((l) => l.text).join("\n") }
      ],
      previewLines: coreLines,
      yamlPreview: coreLines.map((l) => l.text).join("\n")
    }
  });

describe("BuilderPreviewPane section comments", () => {
  it("lists the top-level keys of the active tab and emits edit-section-comment", async () => {
    const wrapper = mountPane();
    await flushPromises();

    const options = wrapper.findAll(".preview-section-comment option").map((o) => o.text());
    expect(options).toContain("esphome");
    expect(options).toContain("web_server");

    await wrapper.get(".preview-section-comment select").setValue("web_server");
    await wrapper.get(".preview-section-comment button").trigger("click");
    expect(wrapper.emitted("edit-section-comment").at(-1)).toEqual(["web_server"]);
  });
});
