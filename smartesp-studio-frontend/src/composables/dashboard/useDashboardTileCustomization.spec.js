import { ref } from "vue";
import { describe, expect, it, vi } from "vitest";

import { normalizeHexColor } from "../../utils/displayColor";
import { useDashboardTileCustomization } from "./useDashboardTileCustomization";

const jsonResponse = (body, ok = true, status = ok ? 200 : 500) => ({
  ok,
  status,
  json: async () => body
});

const sanitizeProjectName = (value) => {
  if (typeof value !== "string") return "";
  const name = value.trim();
  if (!name || name.toLowerCase() === "projects.json" || !name.toLowerCase().endsWith(".json")) return "";
  return name;
};

const sanitizeIconName = (value) => {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "";
  const withoutPrefix = raw.startsWith("mdi:") ? raw.slice(4) : raw;
  return withoutPrefix.trim().toLowerCase();
};

const hasTileCustomization = (tile) => {
  if (!tile || typeof tile !== "object") return false;
  return Boolean(tile.iconName || tile.iconColor || tile.backgroundColor || tile.titleColor || tile.metaColor);
};

const normalizeTileCustomization = (source) => {
  const tile = source && typeof source === "object" ? source : {};
  return {
    iconName: sanitizeIconName(tile.icon),
    iconColor: normalizeHexColor(tile.iconColor) || "",
    backgroundColor: normalizeHexColor(tile.backgroundColor) || "",
    titleColor: normalizeHexColor(tile.titleColor) || "",
    metaColor: normalizeHexColor(tile.metaColor) || ""
  };
};

const buildHarness = ({ fetchJsonImpl, addonFetchImpl, initialCustomizations = new Map() } = {}) => {
  const projectTileCustomizations = ref(initialCustomizations);
  const projectDisplayNames = ref(new Map());
  const projectPlacementByName = ref(new Map());
  const emitProjectsUpdated = vi.fn();
  const getOpenProjectMenuProject = vi.fn(() => "kitchen_sensor.json");
  const closeProjectMenu = vi.fn();
  const parseResponseMessage = async (response, fallback) => {
    try {
      const payload = await response.json();
      if (payload && typeof payload.message === "string" && payload.message.trim()) {
        return payload.message;
      }
    } catch {
      // ignore
    }
    return `${fallback} (HTTP ${response.status})`;
  };

  const fetchJson = vi.fn(fetchJsonImpl || (async () => jsonResponse({ status: "ok", data: { schemaVersion: 1 } })));
  const addonFetch = vi.fn(addonFetchImpl || (async () => jsonResponse({ status: "ok" })));

  const tileCustomization = useDashboardTileCustomization({
    projectTileCustomizations,
    projectDisplayNames,
    projectPlacementByName,
    fetchJson,
    addonFetch,
    projectLoadUrl: (name) => `projects/load?name=${encodeURIComponent(name)}`,
    parseResponseMessage,
    sanitizeProjectName,
    sanitizeIconName,
    normalizeHexColor,
    fallbackProjectTitle: (name) => name.replace(/\.json$/i, ""),
    projectYamlName: (name) => name.replace(/\.json$/i, ".yaml"),
    formatLastEditedAt: () => "just now",
    iconUrlFromName: (name) => `https://cdn.example/${name}.svg`,
    hasTileCustomization,
    normalizeTileCustomization,
    emitProjectsUpdated,
    getOpenProjectMenuProject,
    closeProjectMenu,
    DEFAULT_TILE_ICON_NAME: "memory",
    DEFAULT_TILE_ICON_COLOR: "#0F2E4C",
    DEFAULT_TILE_BACKGROUND_COLOR: "#FFFFFF",
    DEFAULT_TILE_TITLE_COLOR: "#1F3F6D",
    DEFAULT_TILE_META_COLOR: "#7190B8"
  });

  return { tileCustomization, projectTileCustomizations, fetchJson, addonFetch, emitProjectsUpdated, closeProjectMenu };
};

describe("useDashboardTileCustomization", () => {
  describe("openCustomizeModal / requestCustomizeProjectFromMenu", () => {
    it("prefills the draft from the existing customization and opens the modal", () => {
      const { tileCustomization } = buildHarness({
        initialCustomizations: new Map([
          ["kitchen_sensor.json", { iconName: "thermometer", iconColor: "#FF0000", backgroundColor: "", titleColor: "", metaColor: "" }]
        ])
      });

      tileCustomization.openCustomizeModal("kitchen_sensor.json");

      expect(tileCustomization.customizeModalOpen.value).toBe(true);
      expect(tileCustomization.customizeDraft.value.iconName).toBe("thermometer");
      expect(tileCustomization.customizeDraft.value.iconColor).toBe("#FF0000");
    });

    it("resolves the target project from the open context menu", () => {
      const { tileCustomization, closeProjectMenu } = buildHarness();

      tileCustomization.requestCustomizeProjectFromMenu();

      expect(closeProjectMenu).toHaveBeenCalledTimes(1);
      expect(tileCustomization.customizeModalOpen.value).toBe(true);
    });
  });

  describe("applyProjectCustomization", () => {
    it("saves the draft onto the project's ui.dashboardTile and updates the local cache", async () => {
      const { tileCustomization, projectTileCustomizations, addonFetch, emitProjectsUpdated } = buildHarness({
        fetchJsonImpl: async () => jsonResponse({ status: "ok", data: { schemaVersion: 1, ui: {} } })
      });
      tileCustomization.openCustomizeModal("kitchen_sensor.json");
      tileCustomization.customizeDraft.value.iconName = "thermometer";
      tileCustomization.customizeDraft.value.iconColor = "#ff0000";

      await tileCustomization.applyProjectCustomization();

      expect(addonFetch).toHaveBeenCalledWith("projects/save", expect.objectContaining({ method: "POST" }));
      const [, options] = addonFetch.mock.calls[0];
      const savedBody = JSON.parse(options.body);
      expect(savedBody.data.ui.dashboardTile).toEqual({ icon: "mdi:thermometer", iconColor: "#FF0000" });
      expect(projectTileCustomizations.value.get("kitchen_sensor.json")).toEqual({
        iconName: "thermometer",
        iconColor: "#FF0000",
        backgroundColor: "",
        titleColor: "",
        metaColor: ""
      });
      expect(emitProjectsUpdated).toHaveBeenCalledTimes(1);
      expect(tileCustomization.customizeModalOpen.value).toBe(false);
    });

    it("removes the customization when the draft is cleared back to defaults", async () => {
      const { tileCustomization, projectTileCustomizations } = buildHarness({
        initialCustomizations: new Map([
          ["kitchen_sensor.json", { iconName: "thermometer", iconColor: "#FF0000", backgroundColor: "", titleColor: "", metaColor: "" }]
        ]),
        fetchJsonImpl: async () =>
          jsonResponse({ status: "ok", data: { schemaVersion: 1, ui: { dashboardTile: { icon: "mdi:thermometer" } } } })
      });
      tileCustomization.openCustomizeModal("kitchen_sensor.json");
      tileCustomization.resetProjectCustomization();

      await tileCustomization.applyProjectCustomization();

      expect(projectTileCustomizations.value.has("kitchen_sensor.json")).toBe(false);
    });

    it("surfaces a backend failure via customizeError and keeps the modal open", async () => {
      const { tileCustomization } = buildHarness({
        fetchJsonImpl: async () => jsonResponse({ message: "project not found" }, false, 404)
      });
      tileCustomization.openCustomizeModal("kitchen_sensor.json");

      await tileCustomization.applyProjectCustomization();

      expect(tileCustomization.customizeError.value).toBe("project not found");
      expect(tileCustomization.customizeBusy.value).toBe(false);
    });
  });

  describe("closeCustomizeModal", () => {
    it("refuses to close while busy unless forced", () => {
      const { tileCustomization } = buildHarness();
      tileCustomization.openCustomizeModal("kitchen_sensor.json");
      tileCustomization.customizeBusy.value = true;

      tileCustomization.closeCustomizeModal();
      expect(tileCustomization.customizeModalOpen.value).toBe(true);

      tileCustomization.closeCustomizeModal(true);
      expect(tileCustomization.customizeModalOpen.value).toBe(false);
    });
  });

  describe("customizeColorPickerValue", () => {
    it("returns the draft color matching the active picker target, with defaults", () => {
      const { tileCustomization } = buildHarness();
      tileCustomization.openCustomizeModal("kitchen_sensor.json");

      tileCustomization.openCustomizeColorPicker("background");
      expect(tileCustomization.customizeColorPickerValue.value).toBe("#FFFFFF");

      tileCustomization.handleCustomizeColorSelect("#123456");
      expect(tileCustomization.customizeColorPickerValue.value).toBe("#123456");
      expect(tileCustomization.customizeDraft.value.backgroundColor).toBe("#123456");
    });
  });
});
