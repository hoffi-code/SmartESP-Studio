// @vitest-environment jsdom
import { nextTick, ref } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useBuilderDeployment } from "./useBuilderDeployment";

const jsonResponse = (body, ok = true) => ({
  ok,
  status: ok ? 200 : 500,
  json: async () => body
});

const buildHarness = ({ fetchImpl, projectFilenameValue = "", getCompileIsActive = () => false } = {}) => {
  const config = ref({ ui: {} });
  const saveConfig = vi.fn();
  const projectFilename = ref(projectFilenameValue);
  const sourceProjectFilename = ref("");
  const writeBuilderSessionProjectName = vi.fn();
  const addonFetch = vi.fn(fetchImpl || (async () => jsonResponse({ status: "ok", device: null })));

  const deployment = useBuilderDeployment({
    config,
    saveConfig,
    addonFetch,
    projectFilename,
    sourceProjectFilename,
    writeBuilderSessionProjectName,
    getCompileIsActive
  });

  return { deployment, config, saveConfig, projectFilename, sourceProjectFilename, addonFetch };
};

describe("useBuilderDeployment", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts offline with no active connection when nothing is configured", async () => {
    const { deployment } = buildHarness();
    await nextTick();
    expect(deployment.builderDeviceStatusLabel.value).toBe("Offline");
    expect(deployment.canUseOtaInstall.value).toBe(false);
    expect(deployment.canLogsForCurrentDevice.value).toBe(false);
  });

  it("flips to online after a successful status refresh", async () => {
    const { deployment, addonFetch } = buildHarness({
      projectFilenameValue: "kitchen_sensor.yaml",
      fetchImpl: async (url) => {
        if (String(url).startsWith("api/devices/status")) {
          return jsonResponse({
            status: "ok",
            device: { device_key: "kitchen_sensor", status: "online", host: "kitchen_sensor.local", name: "kitchen_sensor" }
          });
        }
        return jsonResponse({ status: "ok" });
      }
    });
    await nextTick();

    await deployment.refreshCurrentDeviceStatus({ refresh: true });

    expect(deployment.builderDeviceStatusLabel.value).toBe("Online");
    expect(deployment.builderDeviceStatusClass.value).toBe("is-online");
    expect(deployment.canLogsForCurrentDevice.value).toBe(true);
    expect(deployment.activeConnectionHost.value).toBe("kitchen_sensor.local");
    expect(deployment.canUseOtaInstall.value).toBe(true);
    expect(addonFetch).toHaveBeenCalledWith(expect.stringContaining("api/devices/status"));
  });

  it("registers the device and persists deployment state after a successful OTA install", async () => {
    const projectData = { schemaVersion: 1 };
    const { deployment, addonFetch } = buildHarness({
      projectFilenameValue: "kitchen_sensor.yaml",
      fetchImpl: async (url, options = {}) => {
        const method = options.method || "GET";
        if (String(url).startsWith("api/devices/register")) {
          return jsonResponse({ status: "ok" });
        }
        if (String(url).startsWith("projects/load")) {
          return jsonResponse({ status: "ok", data: projectData });
        }
        if (String(url).startsWith("projects/save") && method === "POST") {
          return jsonResponse({ status: "ok" });
        }
        if (String(url).startsWith("api/devices/status")) {
          return jsonResponse({ status: "ok", device: null });
        }
        return jsonResponse({ status: "ok" });
      }
    });
    await nextTick();

    const projectsUpdatedListener = vi.fn();
    window.addEventListener("app:projects-updated", projectsUpdatedListener);

    await deployment.persistDeploymentAfterInstallSuccess({ action: "ota", yaml: "kitchen_sensor.yaml" });

    window.removeEventListener("app:projects-updated", projectsUpdatedListener);

    const calledUrls = addonFetch.mock.calls.map((call) => String(call[0]));
    expect(calledUrls.some((url) => url.startsWith("api/devices/register"))).toBe(true);
    expect(calledUrls.some((url) => url.startsWith("projects/load"))).toBe(true);
    expect(calledUrls.some((url) => url.startsWith("projects/save"))).toBe(true);
    expect(projectsUpdatedListener).toHaveBeenCalledTimes(1);
  });

  it("does nothing for an install action outside the deployment-relevant set", async () => {
    const { deployment, addonFetch } = buildHarness({ projectFilenameValue: "kitchen_sensor.yaml" });
    await nextTick();
    addonFetch.mockClear();

    await deployment.persistDeploymentAfterInstallSuccess({ action: "validate", yaml: "kitchen_sensor.yaml" });

    expect(addonFetch).not.toHaveBeenCalled();
  });

  it("wires and tears down the visibilitychange listener via initialize/dispose", async () => {
    const { deployment } = buildHarness();
    await nextTick();

    const addSpy = vi.spyOn(document, "addEventListener");
    const removeSpy = vi.spyOn(document, "removeEventListener");

    deployment.initialize();
    expect(addSpy).toHaveBeenCalledWith("visibilitychange", expect.any(Function));

    deployment.dispose();
    expect(removeSpy).toHaveBeenCalledWith("visibilitychange", expect.any(Function));

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
