import { computed, ref, watch } from "vue";
import {
  mergeDeviceStatusCache,
  normalizeProjectKey,
  readDeviceStatusEntry
} from "../../utils/deviceStatusCache";
import {
  computePendingPromotion,
  computePostInstallDeploymentUpdate,
  createDeploymentIdentityFromYaml,
  readProjectDeploymentState,
  resolveActiveDeploymentHost,
  resolveActiveDeploymentKey,
  writeProjectDeploymentState
} from "../../utils/projectDeploymentState";

const PROJECTS_UPDATED_STORAGE_KEY = "vebProjectsUpdatedSignal";
const PROJECTS_UPDATED_CHANNEL = "smartesp-projects";

// Owns device-status polling/caching and the deployment-identity handshake (register/promote/
// unregister a device key against a yaml+host) that runs after a successful install. BuilderView
// feeds it config/fetch/project-name plumbing and a late-bound compileIsActive getter (installFlow,
// which needs a deployment callback of its own, is only created after this composable).
export const useBuilderDeployment = ({
  config,
  saveConfig,
  addonFetch,
  projectFilename,
  sourceProjectFilename,
  writeBuilderSessionProjectName,
  getCompileIsActive
}) => {
  const projectDeviceStatus = ref("offline");
  const projectDeviceHost = ref("");
  const projectDeviceName = ref("");
  let projectDevicePollId = null;
  let projectsUpdatedChannel = null;
  let deploymentSyncInFlight = false;
  let deviceStatusRefreshPromise = null;

  const initProjectsUpdatedChannel = () => {
    if (!("BroadcastChannel" in window) || projectsUpdatedChannel) return;
    try {
      projectsUpdatedChannel = new BroadcastChannel(PROJECTS_UPDATED_CHANNEL);
    } catch {
      projectsUpdatedChannel = null;
    }
  };

  const closeProjectsUpdatedChannel = () => {
    if (!projectsUpdatedChannel) return;
    projectsUpdatedChannel.close();
    projectsUpdatedChannel = null;
  };

  const emitProjectsUpdated = () => {
    const payload = { type: "projects-updated", ts: Date.now() };
    window.dispatchEvent(new CustomEvent("app:projects-updated", { detail: payload }));
    if (projectsUpdatedChannel) {
      projectsUpdatedChannel.postMessage(payload);
    }
    try {
      localStorage.setItem(PROJECTS_UPDATED_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // ignore storage errors
    }
  };

  const currentYamlDeviceName = computed(() => String(projectFilename.value || "").replace(/\.yaml$/i, ""));
  const currentProjectKey = computed(() => normalizeProjectKey(projectFilename.value));
  const hostFromYamlName = (yamlName) => {
    const normalized = String(yamlName || "").trim();
    if (!normalized) return "";
    const deviceName = normalized.replace(/\.yaml$/i, "").trim();
    return deviceName ? `${deviceName}.local` : "";
  };
  const savedDeviceHost = computed(() => String(config.value?.ui?.deviceHost || "").trim());
  const preferredDeviceHost = computed(() => {
    const explicit = savedDeviceHost.value;
    if (explicit) return explicit;
    return hostFromYamlName(projectFilename.value);
  });
  const deploymentState = computed(() => readProjectDeploymentState(config.value));
  const activeDeploymentKey = computed(() =>
    resolveActiveDeploymentKey(deploymentState.value, currentProjectKey.value)
  );
  const statusLookupProjectKey = computed(() => activeDeploymentKey.value || currentProjectKey.value);
  const activeConnectionHost = computed(() => {
    const fallbackHost = projectDeviceHost.value || preferredDeviceHost.value;
    return resolveActiveDeploymentHost(deploymentState.value, new Map(), fallbackHost);
  });

  const applyCachedCurrentDeviceStatus = () => {
    const key = statusLookupProjectKey.value;
    if (!key) {
      projectDeviceStatus.value = "offline";
      projectDeviceHost.value = "";
      projectDeviceName.value = "";
      return;
    }
    const cached = readDeviceStatusEntry(key);
    if (!cached) {
      projectDeviceStatus.value = "offline";
      projectDeviceHost.value = "";
      projectDeviceName.value = "";
      return;
    }
    projectDeviceStatus.value = String(cached.status || "").toLowerCase() === "online" ? "online" : "offline";
    projectDeviceHost.value = String(cached.host || "").trim();
    projectDeviceName.value = String(cached.name || currentYamlDeviceName.value).trim();
  };

  const cacheCurrentDeviceStatus = ({ status, host = "", name = "" }) => {
    const key = statusLookupProjectKey.value;
    if (!key) return;
    mergeDeviceStatusCache({
      [key]: {
        status: status === "online" ? "online" : "offline",
        host: String(host || "").trim(),
        name: String(name || "").trim(),
        updatedAt: Date.now()
      }
    });
  };

  const parseDeploymentResponseMessage = async (response, fallback) => {
    try {
      const payload = await response.json();
      if (payload && typeof payload.message === "string" && payload.message.trim()) {
        return payload.message;
      }
    } catch {
      // ignore non-json responses
    }
    return `${fallback} (HTTP ${response.status})`;
  };

  const registerDeploymentIdentity = async (identity) => {
    if (!identity?.yaml) return;
    const response = await addonFetch("api/devices/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        yaml: identity.yaml,
        ...(identity.host ? { host: identity.host } : {})
      })
    });
    if (!response.ok) {
      throw new Error(await parseDeploymentResponseMessage(response, "Device registration failed"));
    }
  };

  const unregisterDeviceByKey = async (deviceKey) => {
    const normalized = normalizeProjectKey(deviceKey);
    if (!normalized) return;
    const response = await addonFetch(`api/devices/unregister?name=${encodeURIComponent(normalized)}`, {
      method: "DELETE"
    });
    if (!response.ok) {
      throw new Error(await parseDeploymentResponseMessage(response, "Device unregister failed"));
    }
  };

  const resolveCurrentProjectJsonName = (yamlName = "") => {
    const sanitizeJson = (value) => {
      const normalized = String(value || "").trim();
      if (!normalized) return "";
      if (!normalized.toLowerCase().endsWith(".json")) return "";
      return normalized;
    };
    const yamlToJson = (value) => {
      const normalized = String(value || "").trim();
      if (!normalized) return "";
      if (normalized.toLowerCase().endsWith(".yaml")) {
        return `${normalized.slice(0, -5)}.json`;
      }
      return `${normalized}.json`;
    };

    const source = sanitizeJson(sourceProjectFilename.value);
    if (source) return source;
    const fromYaml = sanitizeJson(yamlToJson(yamlName || projectFilename.value || "config.yaml"));
    return fromYaml;
  };

  const loadProjectDataForDeployment = async (projectJsonName) => {
    const response = await addonFetch(`projects/load?name=${encodeURIComponent(projectJsonName)}`);
    if (!response.ok) {
      throw new Error(await parseDeploymentResponseMessage(response, "Failed to load project"));
    }
    const payload = await response.json();
    const data = payload?.data;
    if (!data || typeof data !== "object") {
      throw new Error("Invalid project payload");
    }
    return JSON.parse(JSON.stringify(data));
  };

  const saveProjectDataForDeployment = async (projectJsonName, data) => {
    const response = await addonFetch("projects/save", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: projectJsonName,
        data
      })
    });
    if (!response.ok) {
      throw new Error(await parseDeploymentResponseMessage(response, "Failed to persist deployment state"));
    }
  };

  const applyLocalDeploymentState = (nextState) => {
    const localPayload = {};
    writeProjectDeploymentState(localPayload, nextState);
    if (localPayload.deployment) {
      config.value.deployment = localPayload.deployment;
    } else {
      delete config.value.deployment;
    }
    saveConfig();
  };

  const persistCurrentProjectDeploymentState = async (nextState, yamlName = "") => {
    const projectJsonName = resolveCurrentProjectJsonName(yamlName);
    if (!projectJsonName) {
      throw new Error("Invalid project name for deployment state");
    }
    const data = await loadProjectDataForDeployment(projectJsonName);
    writeProjectDeploymentState(data, nextState);
    await saveProjectDataForDeployment(projectJsonName, data);
    applyLocalDeploymentState(readProjectDeploymentState(data));
    sourceProjectFilename.value = projectJsonName;
    writeBuilderSessionProjectName(projectJsonName);
  };

  const fetchDeviceStatusBySelector = async ({ deviceKey = "", yamlName = "", refresh = false } = {}) => {
    const key = normalizeProjectKey(deviceKey);
    const yaml = String(yamlName || "").trim();
    if (!key && !yaml) {
      return null;
    }
    const selector = key
      ? `name=${encodeURIComponent(key)}`
      : `yaml=${encodeURIComponent(yaml)}`;
    const response = await addonFetch(`api/devices/status?${selector}&refresh=${refresh ? 1 : 0}`);
    if (!response.ok) {
      return null;
    }
    const payload = await response.json();
    const match = payload?.device && typeof payload.device === "object" ? payload.device : null;
    if (!match) return null;
    return {
      deviceKey: normalizeProjectKey(match.device_key || match.name || match.yaml || key || yaml),
      status: String(match.status || "").toLowerCase() === "online" ? "online" : "offline",
      host: String(match.host || "").trim(),
      name: String(match.name || "").trim()
    };
  };

  const persistDeploymentAfterInstallSuccess = async ({ action, yaml } = {}) => {
    if (!["ota", "flash", "serial", "download"].includes(String(action || ""))) {
      return;
    }
    const yamlName = String(yaml || projectFilename.value || "").trim();
    if (!yamlName) return;
    const nextIdentity = createDeploymentIdentityFromYaml(
      yamlName,
      preferredDeviceHost.value || hostFromYamlName(yamlName)
    );
    if (!nextIdentity) return;

    const currentState = deploymentState.value;
    const transition = computePostInstallDeploymentUpdate({
      action,
      currentState,
      nextIdentity
    });

    deploymentSyncInFlight = true;
    try {
      if (transition.register) {
        await registerDeploymentIdentity(transition.register);
      }
      if (transition.changed) {
        await persistCurrentProjectDeploymentState(transition.state, yamlName);
      }
      for (const key of transition.unregisterKeys) {
        try {
          await unregisterDeviceByKey(key);
        } catch (error) {
          console.warn("Failed to unregister old deployment key", key, error);
        }
      }
    } finally {
      deploymentSyncInFlight = false;
    }

    const forceStatusRefresh = action === "ota" || action === "flash";
    await refreshCurrentDeviceStatus({ refresh: forceStatusRefresh });
    emitProjectsUpdated();
  };

  const refreshCurrentDeviceStatus = async ({ refresh = false } = {}) => {
    if (deviceStatusRefreshPromise) {
      return deviceStatusRefreshPromise;
    }

    const run = async () => {
      const yamlName = String(projectFilename.value || "").trim();
      const state = deploymentState.value;
      const activeKey = resolveActiveDeploymentKey(state, currentProjectKey.value);
      const pendingKey = normalizeProjectKey(state?.pending?.deviceKey || "");
      if (!yamlName && !activeKey && !pendingKey) {
        projectDeviceStatus.value = "offline";
        projectDeviceHost.value = "";
        projectDeviceName.value = "";
        return;
      }

      try {
        const shouldCheckPending = Boolean(pendingKey && pendingKey !== activeKey);
        const [activeStatus, pendingStatus] = await Promise.all([
          fetchDeviceStatusBySelector({
            deviceKey: activeKey,
            yamlName: activeKey ? "" : yamlName,
            refresh
          }),
          shouldCheckPending ? fetchDeviceStatusBySelector({ deviceKey: pendingKey, refresh }) : Promise.resolve(null)
        ]);

        const onlineKeys = new Set();
        if (activeStatus?.status === "online" && activeStatus.deviceKey) {
          onlineKeys.add(activeStatus.deviceKey);
        }
        if (pendingStatus?.status === "online" && pendingStatus.deviceKey) {
          onlineKeys.add(pendingStatus.deviceKey);
        }

        let effectiveState = state;
        let effectiveActiveStatus = activeStatus;
        const promotion = computePendingPromotion({
          currentState: state,
          onlineKeys
        });
        if (promotion.shouldPromote && !deploymentSyncInFlight) {
          deploymentSyncInFlight = true;
          try {
            await persistCurrentProjectDeploymentState(promotion.state, yamlName);
            effectiveState = promotion.state;
            effectiveActiveStatus = pendingStatus || activeStatus;
            for (const key of promotion.unregisterKeys) {
              try {
                await unregisterDeviceByKey(key);
              } catch (error) {
                console.warn("Failed to unregister old deployment key", key, error);
              }
            }
            emitProjectsUpdated();
          } catch (error) {
            console.warn("Failed to promote pending deployment", error);
          } finally {
            deploymentSyncInFlight = false;
          }
        }

        const displayStatus = effectiveActiveStatus || pendingStatus || activeStatus;
        const online = Boolean(
          (effectiveActiveStatus?.status || "") === "online" || (pendingStatus?.status || "") === "online"
        );

        projectDeviceStatus.value = online ? "online" : "offline";
        projectDeviceHost.value = String(
          displayStatus?.host || resolveActiveDeploymentHost(effectiveState, new Map(), preferredDeviceHost.value)
        ).trim();
        projectDeviceName.value = String(displayStatus?.name || currentYamlDeviceName.value).trim();

        const cacheEntries = {};
        if (activeKey) {
          cacheEntries[activeKey] = {
            status: activeStatus?.status || "offline",
            host: String(activeStatus?.host || "").trim(),
            name: String(activeStatus?.name || activeKey).trim(),
            updatedAt: Date.now()
          };
        }
        if (pendingKey && pendingKey !== activeKey) {
          cacheEntries[pendingKey] = {
            status: pendingStatus?.status || "offline",
            host: String(pendingStatus?.host || "").trim(),
            name: String(pendingStatus?.name || pendingKey).trim(),
            updatedAt: Date.now()
          };
        }
        mergeDeviceStatusCache(cacheEntries);
      } catch {
        projectDeviceStatus.value = "offline";
        projectDeviceHost.value = "";
        projectDeviceName.value = "";
        cacheCurrentDeviceStatus({ status: "offline" });
      }
    };

    deviceStatusRefreshPromise = run();
    try {
      await deviceStatusRefreshPromise;
    } finally {
      deviceStatusRefreshPromise = null;
    }
  };

  const startDeviceStatusPolling = () => {
    if (document.visibilityState !== "visible") return;
    if (projectDevicePollId) return;
    projectDevicePollId = setInterval(() => {
      if (getCompileIsActive()) return;
      refreshCurrentDeviceStatus({ refresh: true });
    }, 12000);
  };

  const stopDeviceStatusPolling = () => {
    if (!projectDevicePollId) return;
    clearInterval(projectDevicePollId);
    projectDevicePollId = null;
  };

  const handleBuilderVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      refreshCurrentDeviceStatus({ refresh: true });
      startDeviceStatusPolling();
      return;
    }
    stopDeviceStatusPolling();
  };

  const canUseOtaInstall = computed(
    () => projectDeviceStatus.value === "online" && Boolean(activeConnectionHost.value)
  );
  const canLogsForCurrentDevice = computed(
    () => projectDeviceStatus.value === "online"
  );
  const builderDeviceStatusLabel = computed(() => {
    if (projectDeviceStatus.value === "online") return "Online";
    return "Offline";
  });
  const builderDeviceStatusClass = computed(() => {
    if (projectDeviceStatus.value === "online") return "is-online";
    return "is-offline";
  });

  watch(
    () => projectFilename.value,
    (nextName) => {
      const host = hostFromYamlName(nextName);
      const currentHost = String(config.value?.ui?.deviceHost || "").trim();
      applyCachedCurrentDeviceStatus();
      if (currentHost === host) {
        refreshCurrentDeviceStatus({ refresh: true });
        return;
      }
      config.value.ui = {
        ...(config.value.ui || {}),
        deviceHost: host
      };
      refreshCurrentDeviceStatus({ refresh: true });
    },
    { immediate: true }
  );

  watch(
    () => savedDeviceHost.value,
    (host) => {
      if (!host) return;
      if (!projectDeviceHost.value) {
        projectDeviceHost.value = host;
      }
    },
    { immediate: true }
  );

  const initialize = () => {
    initProjectsUpdatedChannel();
    document.addEventListener("visibilitychange", handleBuilderVisibilityChange);
    startDeviceStatusPolling();
  };

  const dispose = () => {
    document.removeEventListener("visibilitychange", handleBuilderVisibilityChange);
    stopDeviceStatusPolling();
    closeProjectsUpdatedChannel();
  };

  return {
    activeConnectionHost,
    canUseOtaInstall,
    canLogsForCurrentDevice,
    builderDeviceStatusLabel,
    builderDeviceStatusClass,
    hostFromYamlName,
    persistDeploymentAfterInstallSuccess,
    refreshCurrentDeviceStatus,
    emitProjectsUpdated,
    initialize,
    dispose
  };
};
