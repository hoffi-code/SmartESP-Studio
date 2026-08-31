import { ref } from "vue";
import { describe, expect, it, vi } from "vitest";

import { useBuilderProjectPersistence } from "./useBuilderProjectPersistence";

const jsonResponse = (body, ok = true, status = ok ? 200 : 500) => ({
  ok,
  status,
  json: async () => body
});

const buildHarness = ({ fetchImpl, isProjectSavedValue = false, sourceProjectFilenameValue = "" } = {}) => {
  const config = ref({ ui: {} });
  const projectFilename = ref("kitchen_sensor.yaml");
  const sourceProjectFilename = ref(sourceProjectFilenameValue);
  const writeBuilderSessionProjectName = vi.fn();
  const yamlPreview = ref("esphome:\n  name: kitchen_sensor");
  const hostFromYamlName = vi.fn(() => "kitchen_sensor.local");
  const refreshCurrentDeviceStatus = vi.fn(async () => {});
  const emitProjectsUpdated = vi.fn();
  const markProjectSavedFromCurrentState = vi.fn();
  const cloneConfigForPersistence = (source) => JSON.parse(JSON.stringify(source));
  const isProjectSaving = ref(false);
  const projectSaveError = ref("");
  const projectSaveMessage = ref("");
  const isProjectSaved = ref(isProjectSavedValue);

  const addonFetch = vi.fn(fetchImpl || (async () => jsonResponse({ status: "ok" })));

  const persistence = useBuilderProjectPersistence({
    config,
    projectFilename,
    sourceProjectFilename,
    writeBuilderSessionProjectName,
    addonFetch,
    yamlPreview,
    hostFromYamlName,
    refreshCurrentDeviceStatus,
    emitProjectsUpdated,
    markProjectSavedFromCurrentState,
    cloneConfigForPersistence,
    isProjectSaving,
    projectSaveError,
    projectSaveMessage,
    isProjectSaved
  });

  return {
    persistence,
    addonFetch,
    isProjectSaving,
    projectSaveError,
    projectSaveMessage,
    isProjectSaved,
    markProjectSavedFromCurrentState,
    refreshCurrentDeviceStatus,
    emitProjectsUpdated,
    sourceProjectFilename
  };
};

const defaultFetchImpl = async (url, options = {}) => {
  const method = options.method || "GET";
  const target = String(url);
  if (target.startsWith("projects/rename")) return jsonResponse({ status: "ok" });
  if (target === "save" && method === "POST") return jsonResponse({ status: "ok" });
  if (target.startsWith("projects/load?name=projects.json")) return jsonResponse({ status: "ok" }, false, 404);
  if (target.startsWith("projects/save") && method === "POST") return jsonResponse({ status: "ok" });
  return jsonResponse({ status: "ok" });
};

describe("useBuilderProjectPersistence", () => {
  describe("sanitizeProjectJsonFilename", () => {
    it("accepts a .json filename and rejects anything else", () => {
      const { persistence } = buildHarness();
      expect(persistence.sanitizeProjectJsonFilename("kitchen_sensor.json")).toBe("kitchen_sensor.json");
      expect(persistence.sanitizeProjectJsonFilename("kitchen_sensor.yaml")).toBe("");
      expect(persistence.sanitizeProjectJsonFilename("")).toBe("");
    });
  });

  describe("handleProjectSave", () => {
    it("saves the yaml, the project json, and the projects index, then marks the project saved", async () => {
      const harness = buildHarness({
        fetchImpl: defaultFetchImpl,
        sourceProjectFilenameValue: "old_device_name.json"
      });

      const result = await harness.persistence.handleProjectSave(false);

      expect(result).toBe(true);
      const calls = harness.addonFetch.mock.calls.map(([url, options]) => ({
        url: String(url),
        method: options?.method || "GET"
      }));
      expect(calls).toEqual(
        expect.arrayContaining([
          { url: "projects/rename", method: "POST" },
          { url: "save", method: "POST" },
          { url: "projects/save", method: "POST" },
          { url: "projects/load?name=projects.json", method: "GET" }
        ])
      );
      const renameCall = harness.addonFetch.mock.calls.find(([url]) => String(url) === "projects/rename");
      expect(JSON.parse(renameCall[1].body)).toEqual({
        old_name: "old_device_name.json",
        new_name: "kitchen_sensor.json"
      });
      expect(harness.markProjectSavedFromCurrentState).toHaveBeenCalledTimes(1);
      expect(harness.refreshCurrentDeviceStatus).toHaveBeenCalledTimes(1);
      expect(harness.emitProjectsUpdated).toHaveBeenCalledTimes(1);
      expect(harness.sourceProjectFilename.value).toBe("kitchen_sensor.json");
      expect(harness.projectSaveMessage.value).toBe("Saved kitchen_sensor.yaml and kitchen_sensor.json.");
      expect(harness.isProjectSaving.value).toBe(false);
    });

    it("short-circuits without any network calls when the project is already saved", async () => {
      const harness = buildHarness({ fetchImpl: defaultFetchImpl, isProjectSavedValue: true });

      const result = await harness.persistence.handleProjectSave(false);

      expect(result).toBe(true);
      expect(harness.addonFetch).not.toHaveBeenCalled();
      expect(harness.projectSaveMessage.value).toBe("kitchen_sensor.yaml is already saved.");
    });

    it("returns false immediately when a save is already in flight", async () => {
      const harness = buildHarness({ fetchImpl: defaultFetchImpl });
      harness.isProjectSaving.value = true;

      const result = await harness.persistence.handleProjectSave(false);

      expect(result).toBe(false);
      expect(harness.addonFetch).not.toHaveBeenCalled();
    });

    it("surfaces a backend failure via projectSaveError and resets isProjectSaving", async () => {
      const harness = buildHarness({
        fetchImpl: async (url) => {
          if (String(url).startsWith("projects/rename")) return jsonResponse({ status: "ok" });
          if (String(url) === "save") return jsonResponse({ message: "disk full" }, false, 500);
          return jsonResponse({ status: "ok" });
        }
      });

      const result = await harness.persistence.handleProjectSave(false);

      expect(result).toBe(false);
      expect(harness.projectSaveError.value).toBe("disk full");
      expect(harness.isProjectSaving.value).toBe(false);
      expect(harness.markProjectSavedFromCurrentState).not.toHaveBeenCalled();
    });
  });
});
