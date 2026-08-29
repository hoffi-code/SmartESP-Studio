const ADDON_ROOT_FOLDER_ID = "root";
const ADDON_ROOT_FOLDER_LABEL = "Projects";

// Owns the backend persistence round-trip for the current project: saving the yaml file,
// the project JSON, and the shared projects.json index (folder placement + last-edited
// bookkeeping), plus the project-bundle rename that keeps those three in lockstep when the
// device name changes. Local-storage config hydration (loadConfig/normalizeConfig) stays in
// BuilderView — it's UI bootstrap (mode level, split-preview), not backend project persistence.
export const useBuilderProjectPersistence = ({
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
}) => {
  const yamlFilenameToProjectFilename = (yamlFilename) => {
    const normalized = String(yamlFilename || "").trim();
    if (!normalized) return "new_file.json";
    if (normalized.toLowerCase().endsWith(".yaml")) {
      return `${normalized.slice(0, -5)}.json`;
    }
    return `${normalized}.json`;
  };

  const sanitizeProjectJsonFilename = (value) => {
    const normalized = String(value || "").trim();
    if (!normalized) return "";
    if (!normalized.toLowerCase().endsWith(".json")) return "";
    return normalized;
  };

  const parseResponseMessage = async (response, fallback) => {
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

  const sanitizeLastEditedAt = (value) => {
    if (typeof value !== "string") return "";
    const normalized = value.trim();
    if (!normalized) return "";
    const timestamp = Date.parse(normalized);
    if (!Number.isFinite(timestamp)) return "";
    return new Date(timestamp).toISOString();
  };

  const createDefaultProjectsIndex = () => ({
    version: 1,
    updatedAt: new Date().toISOString(),
    folders: [{ id: ADDON_ROOT_FOLDER_ID, name: ADDON_ROOT_FOLDER_LABEL, parentId: null }],
    projectPlacement: []
  });

  const normalizeProjectsIndexForSave = (source) => {
    const fallback = createDefaultProjectsIndex();
    if (!source || typeof source !== "object") {
      return fallback;
    }

    const folderMap = new Map();
    if (Array.isArray(source.folders)) {
      source.folders.forEach((folder) => {
        if (!folder || typeof folder !== "object") return;
        const id = typeof folder.id === "string" ? folder.id.trim() : "";
        if (!id || folderMap.has(id)) return;
        const name = typeof folder.name === "string" && folder.name.trim() ? folder.name.trim() : id;
        const parentId =
          folder.parentId === null || folder.parentId === undefined
            ? null
            : String(folder.parentId).trim() || ADDON_ROOT_FOLDER_ID;
        folderMap.set(id, { id, name, parentId });
      });
    }

    if (!folderMap.has(ADDON_ROOT_FOLDER_ID)) {
      folderMap.set(ADDON_ROOT_FOLDER_ID, {
        id: ADDON_ROOT_FOLDER_ID,
        name: ADDON_ROOT_FOLDER_LABEL,
        parentId: null
      });
    } else {
      const root = folderMap.get(ADDON_ROOT_FOLDER_ID);
      folderMap.set(ADDON_ROOT_FOLDER_ID, {
        id: ADDON_ROOT_FOLDER_ID,
        name: root?.name || ADDON_ROOT_FOLDER_LABEL,
        parentId: null
      });
    }

    const validFolderIds = new Set(folderMap.keys());
    const folders = Array.from(folderMap.values()).map((folder) => {
      if (folder.id === ADDON_ROOT_FOLDER_ID) {
        return { ...folder, parentId: null };
      }
      if (!folder.parentId || !validFolderIds.has(folder.parentId) || folder.parentId === folder.id) {
        return { ...folder, parentId: ADDON_ROOT_FOLDER_ID };
      }
      return folder;
    });

    const placementByName = new Map();
    if (Array.isArray(source.projectPlacement)) {
      source.projectPlacement.forEach((entry) => {
        if (!entry || typeof entry !== "object") return;
        const name = typeof entry.name === "string" ? entry.name.trim() : "";
        if (!name || placementByName.has(name)) return;
        const folderId =
          typeof entry.folderId === "string" && validFolderIds.has(entry.folderId)
            ? entry.folderId
            : ADDON_ROOT_FOLDER_ID;
        const lastEditedAt = sanitizeLastEditedAt(entry.lastEditedAt);
        placementByName.set(name, {
          name,
          folderId,
          ...(lastEditedAt ? { lastEditedAt } : {})
        });
      });
    }

    return {
      version: 1,
      updatedAt: new Date().toISOString(),
      folders,
      projectPlacement: Array.from(placementByName.values())
    };
  };

  const upsertProjectInRoot = (indexData, projectJsonName, lastEditedAt) => {
    const normalized = normalizeProjectsIndexForSave(indexData);
    const placement = Array.isArray(normalized.projectPlacement) ? [...normalized.projectPlacement] : [];
    const existingIndex = placement.findIndex((entry) => entry.name === projectJsonName);
    const existingEntry = existingIndex >= 0 ? placement[existingIndex] : null;
    const normalizedLastEditedAt = sanitizeLastEditedAt(lastEditedAt);
    const rootEntry = {
      name: projectJsonName,
      folderId: existingEntry?.folderId || ADDON_ROOT_FOLDER_ID,
      ...(normalizedLastEditedAt ? { lastEditedAt: normalizedLastEditedAt } : {})
    };
    if (existingIndex >= 0) {
      placement.splice(existingIndex, 1, rootEntry);
    } else {
      placement.push(rootEntry);
    }
    normalized.projectPlacement = placement;
    normalized.updatedAt = new Date().toISOString();
    return normalized;
  };

  const buildProjectConfigPayload = () => cloneConfigForPersistence(config.value);

  const saveCurrentYamlFile = async () => {
    const yamlName = projectFilename.value || "config.yaml";
    const saveYamlResponse = await addonFetch("save", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        filename: yamlName,
        yaml: yamlPreview.value
      })
    });
    if (!saveYamlResponse.ok) {
      throw new Error(await parseResponseMessage(saveYamlResponse, "Failed to save YAML"));
    }
  };

  const resolveSourceProjectFilename = () => {
    const explicit = sanitizeProjectJsonFilename(sourceProjectFilename.value);
    if (explicit) return explicit;
    return yamlFilenameToProjectFilename(projectFilename.value || "config.yaml");
  };

  const renameProjectBundleIfNeeded = async (fromProjectName, toProjectName) => {
    const from = sanitizeProjectJsonFilename(fromProjectName);
    const to = sanitizeProjectJsonFilename(toProjectName);
    if (!from || !to || from === to) {
      return;
    }
    const response = await addonFetch("projects/rename", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        old_name: from,
        new_name: to
      })
    });
    if (!response.ok) {
      throw new Error(await parseResponseMessage(response, "Failed to rename project bundle"));
    }
  };

  const saveCurrentProjectAndYaml = async (silent = false) => {
    const yamlName = projectFilename.value || "config.yaml";
    const projectJsonName = yamlFilenameToProjectFilename(yamlName);
    const sourceProjectName = resolveSourceProjectFilename();
    const savedAt = new Date().toISOString();
    const hostToPersist = hostFromYamlName(yamlName);
    const currentHost = String(config.value?.ui?.deviceHost || "").trim();
    if (hostToPersist && currentHost !== hostToPersist) {
      config.value.ui = {
        ...(config.value.ui || {}),
        deviceHost: hostToPersist
      };
    }

    await renameProjectBundleIfNeeded(sourceProjectName, projectJsonName);
    sourceProjectFilename.value = projectJsonName;
    writeBuilderSessionProjectName(projectJsonName);
    await saveCurrentYamlFile();

    const saveProjectResponse = await addonFetch("projects/save", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: projectJsonName,
        data: {
          ...buildProjectConfigPayload(),
          isSaved: true
        }
      })
    });
    if (!saveProjectResponse.ok) {
      throw new Error(await parseResponseMessage(saveProjectResponse, "Failed to save project JSON"));
    }

    let projectsIndex = createDefaultProjectsIndex();
    const loadProjectsIndexResponse = await addonFetch("projects/load?name=projects.json");
    if (loadProjectsIndexResponse.ok) {
      try {
        const payload = await loadProjectsIndexResponse.json();
        if (payload?.data && typeof payload.data === "object") {
          projectsIndex = payload.data;
        }
      } catch {
        projectsIndex = createDefaultProjectsIndex();
      }
    } else if (loadProjectsIndexResponse.status !== 404) {
      throw new Error(await parseResponseMessage(loadProjectsIndexResponse, "Failed to load projects index"));
    }

    const nextProjectsIndex = upsertProjectInRoot(projectsIndex, projectJsonName, savedAt);
    const saveProjectsIndexResponse = await addonFetch("projects/save", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: "projects.json",
        data: nextProjectsIndex
      })
    });
    if (!saveProjectsIndexResponse.ok) {
      throw new Error(await parseResponseMessage(saveProjectsIndexResponse, "Failed to update projects.json"));
    }

    markProjectSavedFromCurrentState();
    sourceProjectFilename.value = projectJsonName;
    writeBuilderSessionProjectName(projectJsonName);
    await refreshCurrentDeviceStatus();
    emitProjectsUpdated();
    if (!silent) {
      projectSaveMessage.value = `Saved ${yamlName} and ${projectJsonName}.`;
    }
    return true;
  };

  const handleProjectSave = async (silent = false) => {
    if (isProjectSaving.value) return false;

    if (isProjectSaved.value) {
      if (!silent) {
        projectSaveError.value = "";
        projectSaveMessage.value = `${projectFilename.value} is already saved.`;
      }
      return true;
    }

    isProjectSaving.value = true;
    projectSaveError.value = "";
    if (!silent) {
      projectSaveMessage.value = "";
    }

    try {
      await saveCurrentProjectAndYaml(silent);
      return true;
    } catch (error) {
      projectSaveError.value = error instanceof Error ? error.message : "Unknown save error";
      return false;
    } finally {
      isProjectSaving.value = false;
    }
  };

  return {
    sanitizeProjectJsonFilename,
    handleProjectSave
  };
};
