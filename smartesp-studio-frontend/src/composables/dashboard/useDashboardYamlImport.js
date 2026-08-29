import { ref } from "vue";
import { apiUrl } from "../../utils/api";
import {
  loadActionCatalog,
  loadActionDefinition,
  loadComponentSchema,
  loadConditionCatalog,
  loadConditionDefinition,
  loadFilterCatalog,
  loadSchemaByPath
} from "../../utils/schemaLoader";
import { importYamlToProjectConfig } from "../../utils/yamlProjectImport";

const componentCatalogUrl = apiUrl("components_list/components_list.json");

// Owns both import entry points shown on the dashboard: picking a local .yaml file, and
// browsing yaml files already sitting in the ESPHome config dir (the "builder" candidate
// list). Both funnel into the same analyze-then-confirm modal (importYamlToProjectConfig).
export const useDashboardYamlImport = ({
  addonFetch,
  fetchJson,
  parseResponseMessage,
  sanitizeProjectName,
  dashboardActionError,
  refreshProjectsFromBackend,
  selectedProjectName,
  saveMessage
}) => {
  const yamlImportProjectSaveUrl = apiUrl("api/import/project");
  const yamlImportTargetsUrl = apiUrl("api/import/targets");

  let yamlImportComponentCatalogPromise = null;
  let yamlImportAnalysisRequestId = 0;
  let yamlImportTargetsRequestId = 0;
  let builderYamlImportRequestId = 0;

  const yamlImportFileInput = ref(null);
  const yamlImportModalOpen = ref(false);
  const yamlImportFileName = ref("");
  const yamlImportContent = ref("");
  const yamlImportAnalysis = ref(null);
  const yamlImportAnalysisError = ref(null);
  const yamlImportAnalyzing = ref(false);
  const yamlImportReportVisible = ref(false);
  const yamlImportCanReturnToSourceList = ref(false);
  const yamlImportTargetYamlNames = ref([]);
  const yamlImportTargetProjectNames = ref([]);
  const yamlImportTargetsLoading = ref(false);
  const yamlImportSaving = ref(false);
  const yamlImportSaveError = ref("");
  const yamlImportComponentCatalog = ref(null);
  const yamlImportSourceName = ref("");
  const builderYamlImportModalOpen = ref(false);
  const builderYamlImportItems = ref([]);
  const builderYamlImportLoading = ref(false);
  const builderYamlImportLoadingName = ref("");
  const builderYamlImportError = ref("");

  const resetYamlImportInput = () => {
    if (yamlImportFileInput.value instanceof HTMLInputElement) {
      yamlImportFileInput.value.value = "";
    }
  };

  const isYamlFile = (file) => {
    const name = String(file?.name || "").trim().toLowerCase();
    return name.endsWith(".yaml") || name.endsWith(".yml");
  };

  const readYamlImportFile = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Failed to read YAML file"));
      reader.readAsText(file);
    });
  };

  const openYamlFilePicker = () => {
    dashboardActionError.value = "";
    resetYamlImportInput();
    yamlImportFileInput.value?.click?.();
  };

  const isYamlImportCandidateName = (value) => {
    const name = String(value || "").trim().toLowerCase();
    return Boolean(name && name.endsWith(".yaml"));
  };

  const normalizeYamlImportCandidate = (item) => {
    if (!item || typeof item !== "object") return null;
    const name = String(item.name || "").trim();
    if (!isYamlImportCandidateName(name)) return null;
    return {
      name,
      size: Number.isFinite(Number(item.size)) ? Number(item.size) : 0,
      mtime: typeof item.mtime === "string" ? item.mtime : "",
      projectName: sanitizeProjectName(item.projectName || name.replace(/\.yaml$/i, ".json")),
      projectExists: item.projectExists === true
    };
  };

  const loadBuilderYamlImportCandidates = async () => {
    const requestId = ++builderYamlImportRequestId;
    builderYamlImportLoading.value = true;
    builderYamlImportError.value = "";
    try {
      const response = await addonFetch("api/import/yaml-candidates");
      if (!response.ok) {
        throw new Error(await parseResponseMessage(response, "Failed to load YAML files"));
      }
      const payload = await response.json();
      const items = Array.isArray(payload?.items) ? payload.items : [];
      const normalized = items.map(normalizeYamlImportCandidate).filter(Boolean);
      if (requestId !== builderYamlImportRequestId) return;
      builderYamlImportItems.value = normalized;
    } catch (error) {
      if (requestId !== builderYamlImportRequestId) return;
      builderYamlImportItems.value = [];
      builderYamlImportError.value = error instanceof Error ? error.message : "Failed to load YAML files";
    } finally {
      if (requestId === builderYamlImportRequestId) {
        builderYamlImportLoading.value = false;
      }
    }
  };

  const openBuilderYamlImportModal = () => {
    dashboardActionError.value = "";
    builderYamlImportModalOpen.value = true;
    builderYamlImportError.value = "";
    loadBuilderYamlImportCandidates();
  };

  const closeBuilderYamlImportModal = () => {
    if (builderYamlImportLoadingName.value) return;
    builderYamlImportRequestId += 1;
    builderYamlImportModalOpen.value = false;
    builderYamlImportLoading.value = false;
    builderYamlImportLoadingName.value = "";
    builderYamlImportError.value = "";
  };

  const loadYamlImportTargets = async () => {
    const requestId = ++yamlImportTargetsRequestId;
    yamlImportTargetsLoading.value = true;
    try {
      const response = await fetchJson(yamlImportTargetsUrl);
      if (!response.ok) {
        throw new Error(await parseResponseMessage(response, "Failed to load import targets"));
      }
      const payload = await response.json();
      if (requestId !== yamlImportTargetsRequestId) return;
      yamlImportTargetYamlNames.value = Array.isArray(payload?.yamlNames) ? payload.yamlNames : [];
      yamlImportTargetProjectNames.value = Array.isArray(payload?.projectNames) ? payload.projectNames : [];
    } catch {
      if (requestId !== yamlImportTargetsRequestId) return;
      yamlImportTargetYamlNames.value = [];
      yamlImportTargetProjectNames.value = [];
    } finally {
      if (requestId === yamlImportTargetsRequestId) {
        yamlImportTargetsLoading.value = false;
      }
    }
  };

  const beginYamlImport = ({ fileName, content, sourceYamlName = "", canReturnToSourceList = false }) => {
    yamlImportFileName.value = fileName;
    yamlImportContent.value = content;
    yamlImportSourceName.value = sourceYamlName;
    yamlImportAnalysis.value = null;
    yamlImportAnalysisError.value = null;
    yamlImportAnalyzing.value = false;
    yamlImportReportVisible.value = false;
    yamlImportCanReturnToSourceList.value = canReturnToSourceList;
    yamlImportSaving.value = false;
    yamlImportSaveError.value = "";
    yamlImportModalOpen.value = true;
    yamlImportAnalysisRequestId += 1;
    loadYamlImportTargets();
  };

  const handleBuilderYamlImportSelect = async (item) => {
    const name = String(item?.name || "").trim();
    if (!isYamlImportCandidateName(name) || builderYamlImportLoadingName.value) return;
    builderYamlImportLoadingName.value = name;
    builderYamlImportError.value = "";
    try {
      const response = await addonFetch(`api/import/yaml?name=${encodeURIComponent(name)}`);
      if (!response.ok) {
        throw new Error(await parseResponseMessage(response, "Failed to load YAML file"));
      }
      const payload = await response.json();
      const loadedName = String(payload?.name || name).trim();
      if (!isYamlImportCandidateName(loadedName)) {
        throw new Error("Invalid YAML file returned by backend");
      }
      const content = typeof payload?.yaml === "string" ? payload.yaml : "";
      builderYamlImportModalOpen.value = false;
      beginYamlImport({ fileName: loadedName, content, sourceYamlName: loadedName, canReturnToSourceList: true });
    } catch (error) {
      builderYamlImportError.value = error instanceof Error ? error.message : "Failed to load YAML file";
    } finally {
      builderYamlImportLoadingName.value = "";
    }
  };

  const loadYamlImportComponentCatalog = async () => {
    if (yamlImportComponentCatalog.value) return yamlImportComponentCatalog.value;
    if (yamlImportComponentCatalogPromise) return yamlImportComponentCatalogPromise;
    yamlImportComponentCatalogPromise = (async () => {
      const response = await fetch(componentCatalogUrl, {
        cache: import.meta.env.DEV ? "no-store" : "default",
        credentials: "same-origin"
      });
      if (!response.ok) {
        throw new Error(`Component catalog load failed (HTTP ${response.status})`);
      }
      const payload = await response.json();
      if (!payload || typeof payload !== "object") {
        throw new Error("Invalid component catalog payload");
      }
      yamlImportComponentCatalog.value = payload;
      return payload;
    })().finally(() => {
      yamlImportComponentCatalogPromise = null;
    });
    return yamlImportComponentCatalogPromise;
  };

  const closeYamlImportModal = () => {
    yamlImportAnalysisRequestId += 1;
    yamlImportTargetsRequestId += 1;
    yamlImportModalOpen.value = false;
    yamlImportFileName.value = "";
    yamlImportContent.value = "";
    yamlImportAnalysis.value = null;
    yamlImportAnalysisError.value = null;
    yamlImportAnalyzing.value = false;
    yamlImportReportVisible.value = false;
    yamlImportCanReturnToSourceList.value = false;
    yamlImportTargetYamlNames.value = [];
    yamlImportTargetProjectNames.value = [];
    yamlImportTargetsLoading.value = false;
    yamlImportSaving.value = false;
    yamlImportSaveError.value = "";
    yamlImportSourceName.value = "";
    resetYamlImportInput();
  };

  const startYamlImportAnalysis = async (content, requestId) => {
    if (!content) return;
    yamlImportAnalyzing.value = true;
    yamlImportAnalysis.value = null;
    yamlImportAnalysisError.value = null;
    yamlImportSaveError.value = "";
    try {
      const componentCatalog = await loadYamlImportComponentCatalog();
      const result = await importYamlToProjectConfig({
        yamlText: content,
        sourceName: yamlImportFileName.value,
        componentCatalog,
        loadComponentSchema: (component) => loadComponentSchema(component.componentId, component.schemaPath),
        loadGeneralSchema: loadSchemaByPath,
        loadFilterCatalog,
        loadActionCatalog,
        loadActionDefinition,
        loadConditionCatalog,
        loadConditionDefinition
      });
      if (requestId !== yamlImportAnalysisRequestId) return;
      if (result.ok) {
        yamlImportAnalysis.value = result;
      } else {
        yamlImportAnalysisError.value = result.error || { message: "YAML parse failed", line: 0, column: 0 };
      }
    } catch (error) {
      if (requestId !== yamlImportAnalysisRequestId) return;
      yamlImportAnalysisError.value = {
        message: error instanceof Error ? error.message : "YAML import analysis failed",
        line: 0,
        column: 0
      };
    } finally {
      if (requestId === yamlImportAnalysisRequestId) {
        yamlImportAnalyzing.value = false;
      }
    }
  };

  const handleYamlImportContinue = (nextContent) => {
    const normalizedContent = typeof nextContent === "string" ? nextContent : "";
    const contentChanged = normalizedContent !== yamlImportContent.value;
    yamlImportContent.value = normalizedContent;
    if (contentChanged) {
      yamlImportSourceName.value = "";
    }
    yamlImportAnalysis.value = null;
    yamlImportAnalysisError.value = null;
    yamlImportReportVisible.value = false;
    yamlImportSaving.value = false;
    yamlImportSaveError.value = "";
    const requestId = ++yamlImportAnalysisRequestId;
    startYamlImportAnalysis(normalizedContent, requestId);
  };

  const handleYamlImportBackToSourceList = () => {
    closeYamlImportModal();
    openBuilderYamlImportModal();
  };

  const handleYamlImportConfirm = async () => {
    const analysis = yamlImportAnalysis.value;
    if (!analysis?.projectData || yamlImportSaving.value) return;
    yamlImportSaving.value = true;
    yamlImportSaveError.value = "";
    try {
      const response = await fetchJson(yamlImportProjectSaveUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName: analysis.generatedProjectName,
          yamlName: analysis.generatedYamlName,
          projectData: analysis.projectData,
          yaml: yamlImportContent.value,
          overwrite: false,
          importReport: analysis.importReport || null,
          ...(yamlImportSourceName.value ? { sourceYamlName: yamlImportSourceName.value } : {})
        })
      });
      if (!response.ok) {
        throw new Error(await parseResponseMessage(response, "YAML import failed"));
      }
      const payload = await response.json();
      const importedProjectName = sanitizeProjectName(payload?.projectName || analysis.generatedProjectName);
      closeYamlImportModal();
      await refreshProjectsFromBackend();
      if (importedProjectName) {
        selectedProjectName.value = importedProjectName;
        saveMessage.value = "";
      }
    } catch (error) {
      yamlImportSaveError.value = error instanceof Error ? error.message : "YAML import failed";
    } finally {
      yamlImportSaving.value = false;
    }
  };

  const handleYamlImportFileSelected = async (event) => {
    const file = event?.target?.files?.[0] || null;
    if (!file) return;
    dashboardActionError.value = "";
    if (!isYamlFile(file)) {
      dashboardActionError.value = "Please select a .yaml or .yml file.";
      resetYamlImportInput();
      return;
    }
    try {
      const content = await readYamlImportFile(file);
      beginYamlImport({ fileName: file.name, content });
    } catch (error) {
      dashboardActionError.value = error instanceof Error ? error.message : "Failed to read YAML file";
      resetYamlImportInput();
    }
  };

  const handleTopbarImportOption = (event) => {
    const detail = event?.detail && typeof event.detail === "object" ? event.detail : {};
    if (detail.source === "yaml-file") {
      openYamlFilePicker();
      return;
    }
    if (detail.source === "esphome-builder") {
      openBuilderYamlImportModal();
    }
  };

  return {
    yamlImportFileInput,
    yamlImportModalOpen,
    yamlImportFileName,
    yamlImportContent,
    yamlImportAnalysis,
    yamlImportAnalysisError,
    yamlImportAnalyzing,
    yamlImportReportVisible,
    yamlImportCanReturnToSourceList,
    yamlImportTargetYamlNames,
    yamlImportTargetProjectNames,
    yamlImportTargetsLoading,
    yamlImportSaving,
    yamlImportSaveError,
    yamlImportSourceName,
    builderYamlImportModalOpen,
    builderYamlImportItems,
    builderYamlImportLoading,
    builderYamlImportLoadingName,
    builderYamlImportError,
    openYamlFilePicker,
    openBuilderYamlImportModal,
    closeBuilderYamlImportModal,
    loadBuilderYamlImportCandidates,
    handleBuilderYamlImportSelect,
    handleYamlImportContinue,
    handleYamlImportBackToSourceList,
    handleYamlImportConfirm,
    handleYamlImportFileSelected,
    handleTopbarImportOption,
    closeYamlImportModal
  };
};
