import { computed, ref } from "vue";

// Owns the "customize tile" modal: reading the current per-project icon/color overrides,
// editing them in a draft, and persisting the draft back onto the project JSON's ui.dashboardTile
// field. Everything else (which project is selected, the project list, menu state) lives in
// DashboardView and is passed in.
export const useDashboardTileCustomization = ({
  projectTileCustomizations,
  projectDisplayNames,
  projectPlacementByName,
  fetchJson,
  addonFetch,
  projectLoadUrl,
  parseResponseMessage,
  sanitizeProjectName,
  sanitizeIconName,
  normalizeHexColor,
  fallbackProjectTitle,
  projectYamlName,
  formatLastEditedAt,
  iconUrlFromName,
  hasTileCustomization,
  normalizeTileCustomization,
  emitProjectsUpdated,
  getOpenProjectMenuProject,
  closeProjectMenu,
  DEFAULT_TILE_ICON_NAME,
  DEFAULT_TILE_ICON_COLOR,
  DEFAULT_TILE_BACKGROUND_COLOR,
  DEFAULT_TILE_TITLE_COLOR,
  DEFAULT_TILE_META_COLOR
}) => {
  const customizeModalOpen = ref(false);
  const customizeProjectName = ref("");
  const customizeBusy = ref(false);
  const customizeError = ref("");
  const customizeIconPickerOpen = ref(false);
  const customizeIconQuery = ref("");
  const customizeColorPickerOpen = ref(false);
  const customizeColorTarget = ref("icon");
  const customizeDraft = ref({
    iconName: "",
    iconColor: "",
    backgroundColor: "",
    titleColor: "",
    metaColor: ""
  });

  const readCustomizationFromProject = (projectName) => {
    const custom = projectTileCustomizations.value.get(projectName);
    return {
      iconName: sanitizeIconName(custom?.iconName || ""),
      iconColor: normalizeHexColor(custom?.iconColor) || "",
      backgroundColor: normalizeHexColor(custom?.backgroundColor) || "",
      titleColor: normalizeHexColor(custom?.titleColor) || "",
      metaColor: normalizeHexColor(custom?.metaColor) || ""
    };
  };

  const customizeProjectTitle = computed(() => {
    const projectName = customizeProjectName.value;
    if (!projectName) return "Project";
    return projectDisplayNames.value.get(projectName) || fallbackProjectTitle(projectName);
  });

  const customizePreviewYamlName = computed(() => {
    return projectYamlName(customizeProjectName.value || "");
  });

  const customizePreviewDateLabel = computed(() => {
    const projectName = customizeProjectName.value;
    if (!projectName) return "No save timestamp";
    const placement = projectPlacementByName.value.get(projectName);
    return formatLastEditedAt(placement?.lastEditedAt || "");
  });

  const customizeIconValue = computed({
    get: () => (customizeDraft.value.iconName ? `mdi:${customizeDraft.value.iconName}` : ""),
    set: (value) => {
      customizeDraft.value.iconName = sanitizeIconName(value);
    }
  });

  const customizePreviewStyle = computed(() => {
    const tile = {
      iconName: customizeDraft.value.iconName || DEFAULT_TILE_ICON_NAME,
      iconColor: normalizeHexColor(customizeDraft.value.iconColor) || DEFAULT_TILE_ICON_COLOR,
      backgroundColor: normalizeHexColor(customizeDraft.value.backgroundColor) || DEFAULT_TILE_BACKGROUND_COLOR,
      titleColor: normalizeHexColor(customizeDraft.value.titleColor) || DEFAULT_TILE_TITLE_COLOR,
      metaColor: normalizeHexColor(customizeDraft.value.metaColor) || DEFAULT_TILE_META_COLOR
    };
    return {
      background: tile.backgroundColor,
      "--tile-title-color": tile.titleColor,
      "--tile-meta-color": tile.metaColor
    };
  });

  const customizePreviewIconStyle = computed(() => {
    const iconName = customizeDraft.value.iconName || DEFAULT_TILE_ICON_NAME;
    const iconColor = normalizeHexColor(customizeDraft.value.iconColor) || DEFAULT_TILE_ICON_COLOR;
    return {
      "--project-icon-url": `url("${iconUrlFromName(iconName)}")`,
      color: iconColor
    };
  });

  const customizeColorPickerValue = computed(() => {
    if (customizeColorTarget.value === "background") {
      return normalizeHexColor(customizeDraft.value.backgroundColor) || DEFAULT_TILE_BACKGROUND_COLOR;
    }
    if (customizeColorTarget.value === "title") {
      return normalizeHexColor(customizeDraft.value.titleColor) || DEFAULT_TILE_TITLE_COLOR;
    }
    if (customizeColorTarget.value === "meta") {
      return normalizeHexColor(customizeDraft.value.metaColor) || DEFAULT_TILE_META_COLOR;
    }
    return normalizeHexColor(customizeDraft.value.iconColor) || DEFAULT_TILE_ICON_COLOR;
  });

  const openCustomizeIconPicker = () => {
    customizeIconQuery.value = customizeDraft.value.iconName || "";
    customizeIconPickerOpen.value = true;
  };

  const handleCustomizeIconPickerClose = (payload) => {
    customizeIconPickerOpen.value = false;
    if (payload && typeof payload === "object" && typeof payload.query === "string") {
      customizeIconQuery.value = payload.query;
    }
  };

  const handleCustomizeIconSelect = (iconName) => {
    customizeDraft.value.iconName = sanitizeIconName(iconName);
    customizeIconPickerOpen.value = false;
  };

  const openCustomizeColorPicker = (target) => {
    if (target === "background" || target === "title" || target === "meta") {
      customizeColorTarget.value = target;
    } else {
      customizeColorTarget.value = "icon";
    }
    customizeColorPickerOpen.value = true;
  };

  const handleCustomizeColorSelect = (color) => {
    const normalized = normalizeHexColor(color) || "";
    if (customizeColorTarget.value === "background") {
      customizeDraft.value.backgroundColor = normalized;
    } else if (customizeColorTarget.value === "title") {
      customizeDraft.value.titleColor = normalized;
    } else if (customizeColorTarget.value === "meta") {
      customizeDraft.value.metaColor = normalized;
    } else {
      customizeDraft.value.iconColor = normalized;
    }
    customizeColorPickerOpen.value = false;
  };

  const closeCustomizeModal = (force = false) => {
    if (customizeBusy.value && !force) return;
    customizeModalOpen.value = false;
    customizeProjectName.value = "";
    customizeError.value = "";
    customizeIconPickerOpen.value = false;
    customizeColorPickerOpen.value = false;
  };

  const openCustomizeModal = (projectName) => {
    const normalized = sanitizeProjectName(projectName);
    if (!normalized) return;
    const current = readCustomizationFromProject(normalized);
    customizeProjectName.value = normalized;
    customizeDraft.value = {
      iconName: current.iconName,
      iconColor: current.iconColor,
      backgroundColor: current.backgroundColor,
      titleColor: current.titleColor,
      metaColor: current.metaColor
    };
    customizeError.value = "";
    customizeModalOpen.value = true;
  };

  const requestCustomizeProjectFromMenu = () => {
    const projectName = getOpenProjectMenuProject();
    if (!projectName) return;
    closeProjectMenu();
    openCustomizeModal(projectName);
  };

  const persistProjectCustomization = async (projectName, tile) => {
    const response = await fetchJson(projectLoadUrl(projectName));
    if (!response.ok) {
      throw new Error(await parseResponseMessage(response, "Failed to load project for customization"));
    }
    const payload = await response.json();
    if (!payload?.data || typeof payload.data !== "object") {
      throw new Error("Invalid project payload");
    }

    const nextData = JSON.parse(JSON.stringify(payload.data));
    nextData.ui = nextData.ui && typeof nextData.ui === "object" ? nextData.ui : {};
    if (hasTileCustomization(tile)) {
      nextData.ui.dashboardTile = {
        ...(tile.iconName ? { icon: `mdi:${tile.iconName}` } : {}),
        ...(tile.iconColor ? { iconColor: tile.iconColor } : {}),
        ...(tile.backgroundColor ? { backgroundColor: tile.backgroundColor } : {}),
        ...(tile.titleColor ? { titleColor: tile.titleColor } : {}),
        ...(tile.metaColor ? { metaColor: tile.metaColor } : {})
      };
    } else if (nextData.ui && typeof nextData.ui === "object") {
      delete nextData.ui.dashboardTile;
    }

    const saveResponse = await addonFetch("projects/save", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: projectName,
        data: nextData
      })
    });
    if (!saveResponse.ok) {
      throw new Error(await parseResponseMessage(saveResponse, "Failed to save project customization"));
    }
  };

  const applyProjectCustomization = async () => {
    const projectName = sanitizeProjectName(customizeProjectName.value);
    if (!projectName || customizeBusy.value) return;
    customizeBusy.value = true;
    customizeError.value = "";
    try {
      const tile = normalizeTileCustomization({
        icon: customizeDraft.value.iconName,
        iconColor: customizeDraft.value.iconColor,
        backgroundColor: customizeDraft.value.backgroundColor,
        titleColor: customizeDraft.value.titleColor,
        metaColor: customizeDraft.value.metaColor
      });
      await persistProjectCustomization(projectName, tile);
      const next = new Map(projectTileCustomizations.value);
      if (hasTileCustomization(tile)) {
        next.set(projectName, tile);
      } else {
        next.delete(projectName);
      }
      projectTileCustomizations.value = next;
      emitProjectsUpdated();
      closeCustomizeModal(true);
    } catch (error) {
      customizeError.value = error instanceof Error ? error.message : "Customization save failed";
    } finally {
      customizeBusy.value = false;
    }
  };

  const resetProjectCustomization = () => {
    customizeDraft.value = {
      iconName: "",
      iconColor: "",
      backgroundColor: "",
      titleColor: "",
      metaColor: ""
    };
  };

  return {
    customizeModalOpen,
    customizeProjectName,
    customizeBusy,
    customizeError,
    customizeIconPickerOpen,
    customizeIconQuery,
    customizeColorPickerOpen,
    customizeColorTarget,
    customizeDraft,
    customizeProjectTitle,
    customizePreviewYamlName,
    customizePreviewDateLabel,
    customizeIconValue,
    customizePreviewStyle,
    customizePreviewIconStyle,
    customizeColorPickerValue,
    openCustomizeIconPicker,
    handleCustomizeIconPickerClose,
    handleCustomizeIconSelect,
    openCustomizeColorPicker,
    handleCustomizeColorSelect,
    closeCustomizeModal,
    openCustomizeModal,
    requestCustomizeProjectFromMenu,
    applyProjectCustomization,
    resetProjectCustomization
  };
};
