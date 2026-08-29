// @vitest-environment jsdom
import { ref } from "vue";
import { describe, expect, it, vi } from "vitest";

import { useDashboardYamlImport } from "./useDashboardYamlImport";

const jsonResponse = (body, ok = true, status = ok ? 200 : 500) => ({
  ok,
  status,
  json: async () => body
});

const buildHarness = ({ addonFetchImpl, fetchJsonImpl } = {}) => {
  const dashboardActionError = ref("");
  const refreshProjectsFromBackend = vi.fn(async () => {});
  const selectedProjectName = ref("");
  const saveMessage = ref("visible");
  const sanitizeProjectName = (value) => String(value || "").trim();
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

  const addonFetch = vi.fn(addonFetchImpl || (async () => jsonResponse({ status: "ok" })));
  const fetchJson = vi.fn(fetchJsonImpl || (async () => jsonResponse({ status: "ok" })));

  const yamlImport = useDashboardYamlImport({
    addonFetch,
    fetchJson,
    parseResponseMessage,
    sanitizeProjectName,
    dashboardActionError,
    refreshProjectsFromBackend,
    selectedProjectName,
    saveMessage
  });

  return {
    yamlImport,
    addonFetch,
    fetchJson,
    dashboardActionError,
    refreshProjectsFromBackend,
    selectedProjectName,
    saveMessage
  };
};

const yamlFile = (name, content = "esphome:\n  name: test\n") =>
  new File([content], name, { type: "application/x-yaml" });

describe("useDashboardYamlImport", () => {
  describe("handleYamlImportFileSelected", () => {
    it("rejects a non-yaml file", async () => {
      const { yamlImport, dashboardActionError } = buildHarness();
      const event = { target: { files: [yamlFile("notes.txt")] } };

      await yamlImport.handleYamlImportFileSelected(event);

      expect(dashboardActionError.value).toBe("Please select a .yaml or .yml file.");
      expect(yamlImport.yamlImportModalOpen.value).toBe(false);
    });

    it("opens the import modal with the file content for a valid yaml file", async () => {
      const { yamlImport } = buildHarness({
        fetchJsonImpl: async () => jsonResponse({ status: "ok", yamlNames: [], projectNames: [] })
      });
      const event = { target: { files: [yamlFile("kitchen_sensor.yaml", "esphome:\n  name: kitchen_sensor\n")] } };

      await yamlImport.handleYamlImportFileSelected(event);

      expect(yamlImport.yamlImportModalOpen.value).toBe(true);
      expect(yamlImport.yamlImportFileName.value).toBe("kitchen_sensor.yaml");
      expect(yamlImport.yamlImportContent.value).toBe("esphome:\n  name: kitchen_sensor\n");
    });
  });

  describe("loadBuilderYamlImportCandidates", () => {
    it("keeps only .yaml-named candidates and normalizes their project name", async () => {
      const { yamlImport } = buildHarness({
        addonFetchImpl: async (url) => {
          if (String(url).startsWith("api/import/yaml-candidates")) {
            return jsonResponse({
              status: "ok",
              items: [
                { name: "device_a.yaml", size: 10, mtime: "2026-01-01T00:00:00Z", projectExists: true },
                { name: "secrets.yaml.bak" },
                { name: "device_b.yaml" }
              ]
            });
          }
          return jsonResponse({ status: "ok" });
        }
      });

      await yamlImport.loadBuilderYamlImportCandidates();

      expect(yamlImport.builderYamlImportItems.value.map((item) => item.name)).toEqual([
        "device_a.yaml",
        "device_b.yaml"
      ]);
      expect(yamlImport.builderYamlImportItems.value[0].projectExists).toBe(true);
      expect(yamlImport.builderYamlImportError.value).toBe("");
    });

    it("surfaces a backend error", async () => {
      const { yamlImport } = buildHarness({
        addonFetchImpl: async () => jsonResponse({ message: "disk offline" }, false, 500)
      });

      await yamlImport.loadBuilderYamlImportCandidates();

      expect(yamlImport.builderYamlImportItems.value).toEqual([]);
      expect(yamlImport.builderYamlImportError.value).toBe("disk offline");
    });
  });

  describe("handleBuilderYamlImportSelect", () => {
    it("loads the selected yaml file and opens the import modal", async () => {
      const { yamlImport } = buildHarness({
        addonFetchImpl: async (url) => {
          if (String(url).startsWith("api/import/yaml?")) {
            return jsonResponse({ status: "ok", name: "device_a.yaml", yaml: "esphome:\n  name: device_a\n" });
          }
          return jsonResponse({ status: "ok", yamlNames: [], projectNames: [] });
        },
        fetchJsonImpl: async () => jsonResponse({ status: "ok", yamlNames: [], projectNames: [] })
      });

      await yamlImport.handleBuilderYamlImportSelect({ name: "device_a.yaml" });

      expect(yamlImport.builderYamlImportModalOpen.value).toBe(false);
      expect(yamlImport.yamlImportModalOpen.value).toBe(true);
      expect(yamlImport.yamlImportFileName.value).toBe("device_a.yaml");
      expect(yamlImport.yamlImportContent.value).toBe("esphome:\n  name: device_a\n");
      expect(yamlImport.yamlImportCanReturnToSourceList.value).toBe(true);
    });
  });

  describe("handleYamlImportConfirm", () => {
    it("saves the analyzed project, refreshes the list, and selects the new project", async () => {
      const { yamlImport, refreshProjectsFromBackend, selectedProjectName, saveMessage } = buildHarness({
        fetchJsonImpl: async () => jsonResponse({ status: "ok", projectName: "device_a.json" })
      });
      yamlImport.yamlImportAnalysis.value = {
        projectData: { schemaVersion: 1 },
        generatedProjectName: "device_a.json",
        generatedYamlName: "device_a.yaml"
      };

      await yamlImport.handleYamlImportConfirm();

      expect(refreshProjectsFromBackend).toHaveBeenCalledTimes(1);
      expect(selectedProjectName.value).toBe("device_a.json");
      expect(saveMessage.value).toBe("");
      expect(yamlImport.yamlImportModalOpen.value).toBe(false);
      expect(yamlImport.yamlImportSaving.value).toBe(false);
    });

    it("does nothing when there is no analyzed project data", async () => {
      const { yamlImport, fetchJson } = buildHarness();

      await yamlImport.handleYamlImportConfirm();

      expect(fetchJson).not.toHaveBeenCalled();
    });

    it("surfaces a save failure via yamlImportSaveError", async () => {
      const { yamlImport } = buildHarness({
        fetchJsonImpl: async () => jsonResponse({ message: "name already exists" }, false, 409)
      });
      yamlImport.yamlImportAnalysis.value = {
        projectData: { schemaVersion: 1 },
        generatedProjectName: "device_a.json",
        generatedYamlName: "device_a.yaml"
      };

      await yamlImport.handleYamlImportConfirm();

      expect(yamlImport.yamlImportSaveError.value).toBe("name already exists");
      expect(yamlImport.yamlImportSaving.value).toBe(false);
    });
  });

  describe("closeYamlImportModal", () => {
    it("resets all import modal state", () => {
      const { yamlImport } = buildHarness();
      yamlImport.yamlImportModalOpen.value = true;
      yamlImport.yamlImportFileName.value = "device_a.yaml";
      yamlImport.yamlImportContent.value = "esphome:\n";
      yamlImport.yamlImportSaveError.value = "boom";

      yamlImport.closeYamlImportModal();

      expect(yamlImport.yamlImportModalOpen.value).toBe(false);
      expect(yamlImport.yamlImportFileName.value).toBe("");
      expect(yamlImport.yamlImportContent.value).toBe("");
      expect(yamlImport.yamlImportSaveError.value).toBe("");
    });
  });
});
