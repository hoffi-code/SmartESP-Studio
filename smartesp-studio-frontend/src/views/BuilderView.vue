<template>
  <div class="builder-layout">
    <BuilderModalHost
      :confirm-open="confirmOpen"
      :confirm-title="confirmTitle"
      :confirm-message="confirmMessage"
      :confirm-confirm-text="confirmConfirmText"
      :confirm-cancel-text="confirmCancelText"
      :gpio-guide-open="gpioGuideOpen"
      :gpio-guide="gpioGuide"
      :gpio-guide-fallback-title="gpioGuideFallbackTitle"
      :asset-manager-open="assetManagerOpen"
      :display-images="displayImages"
      :display-fonts="displayFonts"
      :display-audio="displayAudio"
      :assets-loading="assetsLoading"
      :assets-working="assetsWorking"
      :assets-error="assetsError"
      :secrets-modal-open="secretsModalOpen"
      :secrets-raw-content="secretsRawContent"
      :secrets-loading="secretsLoading"
      :secrets-saving="secretsSaving"
      :secrets-error="secretsError"
      :form-errors-modal-open="formErrorsModalOpen"
      :form-errors="formErrors"
      :import-summary-modal-open="importSummaryModalOpen"
      :import-summary-modal-rows="importSummaryModalRows"
      :import-summary-modal-message="importSummaryModalMessage"
      :project-save-error="projectSaveError"
      :project-save-message="projectSaveMessage"
      :compile-modal-open="compileModalOpen"
      :terminal-title="terminalTitle"
      :compile-state-class="compileStateClass"
      :compile-state-label="compileStateLabel"
      :compile-is-reconnecting="compileIsReconnecting"
      :compile-auto-scroll="compileAutoScroll"
      :compile-log-lines="compileLogLines"
      :serial-ha-selection-open="serialHaSelectionOpen"
      :serial-ha-selection-busy="serialHaSelectionBusy"
      :serial-ha-ports="serialHaPorts"
      :serial-ha-ports-loading="serialHaPortsLoading"
      :serial-ha-ports-error="serialHaPortsError"
      :can-download-compiled-binary="canDownloadCompiledBinary"
      :can-close-compile="canCloseCompile"
      :set-compile-console-element="setCompileConsoleElement"
      @confirm-remove="confirmRemove"
      @cancel-remove="cancelRemove"
      @close-gpio-guide="gpioGuideOpen = false"
      @close-asset-manager="assetManagerOpen = false"
      @refresh-assets="refreshAssets(true)"
      @upload-asset="handleAssetUpload"
      @rename-asset="handleAssetRename"
      @delete-asset="handleAssetDelete"
      @save-secrets="handleSecretsSave"
      @close-secrets="closeSecretsModal"
      @close-form-errors="formErrorsModalOpen = false"
      @close-import-summary="importSummaryModalOpen = false"
      @toggle-compile-autoscroll="toggleCompileAutoscroll"
      @download-binary="downloadBinary"
      @refresh-ha-serial-ports="loadHaSerialPorts"
      @select-ha-serial-port="selectHaSerialPort"
      @close-compile-modal="closeCompileModal"
    />
    <CommentEditModal
      :open="commentEditRequest !== null"
      :title="commentEditRequest?.title || t('builder.comment.modalTitleDefault')"
      :value="commentEditValue"
      @save="saveComment"
      @delete="deleteComment"
      @close="closeCommentEditor"
    />
    <IdDefinitionModal
      :open="idDefinitionRequest !== null"
      :title="idDefinitionRequest ? t('schema.idRef.create') : ''"
      :component-id="idDefinitionRequest?.item?.id || ''"
      :schema-path="idDefinitionRequest ? normalizeSchemaPath(idDefinitionRequest.item.schemaPath) : ''"
      :initial-id="idDefinitionRequest?.initialName || ''"
      :existing-ids="idDefinitionExistingIds"
      :id-registry="idRegistry"
      :name-registry="nameRegistry"
      :id-index="idIndex"
      :gpio-options="gpioOptions"
      :gpio-usage="gpioUsageIndex"
      :gpio-title="gpioTitle"
      :global-store="globalStore"
      :display-images="displayImages"
      :display-fonts="displayFonts"
      :display-google-fonts="displayGoogleFonts"
      :assets-base="assetsBase"
      @confirm="confirmIdDefinition"
      @cancel="cancelIdDefinition"
      @open-asset-manager="assetManagerOpen = true"
    />
    <div class="builder-shell">
      <aside class="builder-sidebar">
        <div class="sidebar-top">
          <button type="button" class="btn-standard secondary sidebar-back-button" @click="handleBackToDashboard">
            <span class="sidebar-back-button-icon" aria-hidden="true"></span>
            <span>Back to Dashboard</span>
          </button>

          <section class="sidebar-panel sidebar-panel--project" aria-label="Current project">
            <div class="sidebar-panel__header">
              <h4>Project</h4>
              <span class="project-status-badge" :class="builderDeviceStatusClass">
                {{ builderDeviceStatusLabel }}
              </span>
            </div>
            <div class="sidebar-panel__body project-summary-body">
              <dl class="project-summary-list">
                <div class="project-summary-item">
                  <dt>name:</dt>
                  <dd>{{ projectSummaryName }}</dd>
                </div>
                <div class="project-summary-item">
                  <dt>file:</dt>
                  <dd class="project-summary-file" :class="{ 'is-unsaved': !isProjectSaved }">
                    {{ projectFilenameLabel }}
                  </dd>
                </div>
                <div class="project-summary-item">
                  <dt>platform:</dt>
                  <dd>{{ projectSummaryPlatform }}</dd>
                </div>
                <div v-if="projectSummaryComment" class="project-summary-item">
                  <dt>comment:</dt>
                  <dd>{{ projectSummaryComment }}</dd>
                </div>
              </dl>
            </div>
          </section>
        </div>
        <div class="sidebar-middle">
          <div class="sidebar-panel sidebar-panel--components">
            <div class="sidebar-panel__header">
              <h4>Components</h4>
            </div>
            <div class="sidebar-panel__body">
              <div class="sidebar-components">
                <div class="components-toolbar">
                  <button
                    v-for="tab in tabs"
                    :key="`tab-${tab}`"
                    class="component-chip"
                    :class="{
                      active: activeTab === tab,
                      'component-chip--pulse': isTabPulsing(tab),
                      'component-chip--error': hasTabErrors(tab)
                    }"
                    @click="activeTab = tab"
                  >
                    <span>{{ tab }}</span>
                  </button>
                  <button class="component-chip" type="button" @click="openAssetManagerFromSidebar">
                    <span>Assets</span>
                  </button>
                  <div class="component-separator-line"></div>
                  <div class="component-separator">
                    <div class="component-separator__row">
                      <span>User components</span>
                      <button
                        class="secondary compact btn-add sidebar-components-add"
                        type="button"
                        aria-label="Add component"
                        @click="addComponentSlot"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                  <button
                    v-for="(componentEntry, index) in config.components"
                    :key="`${componentIdFromEntry(componentEntry) || 'component'}-${index}`"
                    class="component-chip"
                    type="button"
                    :class="{
                      active: activeComponentSlot === index && activeTab === 'Components',
                      'component-chip--error': hasComponentErrors(index)
                    }"
                    @click="openComponentViewer(index)"
                  >
                    <span>{{ componentEntryLabel(componentEntry) }}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div class="builder-content">
        <section class="builder-grid">
        <div class="builder-panel">
          <div class="config-title">
            <select
              id="viewSelect"
              class="config-title-select"
              v-model="previewMode"
              @change="handleSelectBlur"
            >
              <option value="single">Single YAML Preview</option>
              <option value="tabs">Tabbed YAML Preview</option>
            </select>
          </div>
          <BuilderPreviewPane
            :split-preview-enabled="splitPreviewEnabled"
            :preview-tabs="previewTabs"
            :preview-lines="yamlPreviewDocument.lines"
            :yaml-preview="yamlPreview"
            :main-preview-target-key="mainPreviewTargetKey"
            :preview-sync-request="previewSyncRequest"
            :preview-pulse-request="lvglPreviewPulse"
            :is-hydrating="isHydrating"
            :display-automation-has-interval="displayAutomationHasInterval"
            :hub-notice-domains="hubNoticeDomains"
            :header-comment="config.headerComment || ''"
            @yaml-line-click="handleYamlLineClick"
            @edit-header-comment="openCommentEditor({ scope: 'header', title: t('builder.comment.headerTitle') })"
          />
        </div>

        <div class="builder-panel">
          <div class="config-title">
            <select
              id="modeSelect"
              class="config-title-select"
              v-model="activeModeLevel"
              @change="handleSelectBlur"
            >
              <option value="Simple">Simple configuration</option>
              <option value="Normal">Normal configuration</option>
              <option value="Advanced">Advanced configuration</option>
            </select>
          </div>
          <div class="config-scroll">
        <BuilderCoreTab
          v-if="activeTab === 'Core'"
          :active-tab-help-url="activeTabHelpUrl"
          :esphome-core-id="esphomeCoreId"
          :esphome-core-config="esphomeCoreConfig"
          :substitutions-core-id="substitutionsCoreId"
          :substitutions-core-config="substitutionsCoreConfig"
          :config="config"
          :active-mode-level="activeModeLevel"
          :id-registry="idRegistry"
          :name-registry="nameRegistry"
          :id-index="idIndex"
          :gpio-options="gpioOptions"
          :gpio-usage-index="gpioUsageIndex"
          :gpio-title="gpioTitle"
          :esphome-core-scope-id="esphomeCoreScopeId"
          :substitutions-core-scope-id="substitutionsCoreScopeId"
          :global-store="globalStore"
          :should-show-mode-upgrade="shouldShowModeUpgrade('core')"
          :mode-upgrade-button-label="modeUpgradeButtonLabel"
          @update-core-schema="handleCoreSchemaUpdate"
          @update-substitutions-schema="handleSubstitutionsSchemaUpdate"
          @open-secrets="openSecretsModal"
          @mode-upgrade-availability="handleModeUpgradeAvailability"
          @promote-mode-level="promoteModeLevel"
        />

        <BuilderPlatformTab
          v-if="activeTab === 'Platform'"
          :active-tab-help-url="activeTabHelpUrl"
          :platform-core-id="platformCoreId"
          :platform-core-config="platformCoreConfig"
          :platform-detail-id="platformDetailId"
          :config="config"
          :active-mode-level="activeModeLevel"
          :id-registry="idRegistry"
          :name-registry="nameRegistry"
          :id-index="idIndex"
          :gpio-options="gpioOptions"
          :gpio-usage-index="gpioUsageIndex"
          :gpio-title="gpioTitle"
          :platform-core-scope-id="platformCoreScopeId"
          :platform-detail-scope-id="platformDetailScopeId"
          :global-store="globalStore"
          :should-show-mode-upgrade="shouldShowModeUpgrade('platform')"
          :mode-upgrade-button-label="modeUpgradeButtonLabel"
          @update-platform-schema="handlePlatformSchemaUpdate"
          @open-secrets="openSecretsModal"
          @mode-upgrade-availability="handleModeUpgradeAvailability"
          @promote-mode-level="promoteModeLevel"
        />

        <BuilderNetworkTab
          v-if="activeTab === 'Network'"
          :active-tab-help-url="activeTabHelpUrl"
          :network-core-id="networkCoreId"
          :network-core-config="networkCoreConfig"
          :network-detail-id="networkDetailId"
          :config="config"
          :active-mode-level="activeModeLevel"
          :id-registry="idRegistry"
          :name-registry="nameRegistry"
          :id-index="idIndex"
          :gpio-options="gpioOptions"
          :gpio-usage-index="gpioUsageIndex"
          :gpio-title="gpioTitle"
          :network-transport-scope-id="networkTransportScopeId"
          :network-detail-scope-id="networkDetailScopeId"
          :network-ota-scope-id="networkOtaScopeId"
          :network-web-server-scope-id="networkWebServerScopeId"
          :global-store="globalStore"
          :should-show-mode-upgrade="shouldShowModeUpgrade('network')"
          :mode-upgrade-button-label="modeUpgradeButtonLabel"
          @update-network-schema="handleNetworkSchemaUpdate"
          @open-secrets="openSecretsModal"
          @mode-upgrade-availability="handleModeUpgradeAvailability"
          @promote-mode-level="promoteModeLevel"
        />

        <BuilderProtocolsTab
          v-if="activeTab === 'Protocols'"
          :active-tab-help-url="activeTabHelpUrl"
          :protocol-tabs="protocolTabs"
          :active-protocol-key="activeProtocolKey"
          :protocol-detail-id="protocolDetailId"
          :protocol-detail-config="protocolDetailConfig"
          :protocol-detail-scope-id="protocolDetailScopeId"
          :config="config"
          :active-mode-level="activeModeLevel"
          :id-registry="idRegistry"
          :name-registry="nameRegistry"
          :id-index="idIndex"
          :gpio-options="gpioOptions"
          :gpio-usage-index="gpioUsageIndex"
          :gpio-title="gpioTitle"
          :global-store="globalStore"
          :should-show-mode-upgrade="shouldShowModeUpgrade('protocols')"
          :mode-upgrade-button-label="modeUpgradeButtonLabel"
          @update:active-protocol-key="activeProtocolKey = $event"
          @update-protocol-detail="handleProtocolDetailUpdate"
          @open-secrets="openSecretsModal"
          @mode-upgrade-availability="handleModeUpgradeAvailability"
          @promote-mode-level="promoteModeLevel"
        />

        <BuilderBussesTab
          v-if="activeTab === 'Busses'"
          :active-tab-help-url="activeTabHelpUrl"
          :busses-tabs="bussesTabs"
          :active-busses-key="activeBussesKey"
          :active-bus-label="activeBusLabel"
          :is-multi-instance-bus="isActiveMultiInstanceBus"
          :bus-instances="activeBusInstances"
          :busses-detail-id="bussesDetailId"
          :busses-detail-config="bussesDetailConfig"
          :busses-detail-field-filter="bussesDetailFieldFilter"
          :busses-detail-scope-id="bussesDetailScopeId"
          :config="config"
          :active-mode-level="activeModeLevel"
          :id-registry="idRegistry"
          :name-registry="nameRegistry"
          :id-index="idIndex"
          :gpio-options="gpioOptions"
          :gpio-usage-index="gpioUsageIndex"
          :gpio-title="gpioTitle"
          :global-store="globalStore"
          :should-show-mode-upgrade="shouldShowModeUpgrade('busses')"
          :mode-upgrade-button-label="modeUpgradeButtonLabel"
          @add-bus-instance="addActiveBusInstance"
          @update:active-busses-key="activeBussesKey = $event"
          @update-busses-detail="handleBussesDetailUpdate"
          @update-bus-instance="handleBusInstanceUpdate"
          @remove-bus-instance="removeActiveBusInstance"
          @open-secrets="openSecretsModal"
          @mode-upgrade-availability="handleModeUpgradeAvailability"
          @promote-mode-level="promoteModeLevel"
        />

        <BuilderSystemTab
          v-if="activeTab === 'System'"
          :active-tab-help-url="activeTabHelpUrl"
          :other-tabs="otherTabs"
          :active-other-key="activeOtherKey"
          :other-detail-id="otherDetailId"
          :other-detail-config="otherDetailConfig"
          :other-detail-scope-id="otherDetailScopeId"
          :config="config"
          :active-mode-level="activeModeLevel"
          :id-registry="idRegistry"
          :name-registry="nameRegistry"
          :id-index="idIndex"
          :gpio-options="gpioOptions"
          :gpio-usage-index="gpioUsageIndex"
          :gpio-title="gpioTitle"
          :global-store="globalStore"
          :should-show-mode-upgrade="shouldShowModeUpgrade('system')"
          :mode-upgrade-button-label="modeUpgradeButtonLabel"
          @update:active-other-key="activeOtherKey = $event"
          @update-other-detail="handleOtherDetailUpdate"
          @open-secrets="openSecretsModal"
          @mode-upgrade-availability="handleModeUpgradeAvailability"
          @promote-mode-level="promoteModeLevel"
        />

        <BuilderAutomationTab
          v-if="activeTab === 'Automation'"
          :active-tab-help-url="activeTabHelpUrl"
          :automation-tabs="automationTabs"
          :active-automation-key="activeAutomationKey"
          :automation-detail-id="automationDetailId"
          :automation-detail-config="automationDetailConfig"
          :automation-detail-scope-id="automationDetailScopeId"
          :generated-automation="generatedAutomation"
          :generated-entry-lines="generatedEntryLines"
          :config="config"
          :active-mode-level="activeModeLevel"
          :id-registry="idRegistry"
          :name-registry="nameRegistry"
          :id-index="idIndex"
          :gpio-options="gpioOptions"
          :gpio-usage-index="gpioUsageIndex"
          :gpio-title="gpioTitle"
          :global-store="globalStore"
          :should-show-mode-upgrade="shouldShowModeUpgrade('automation')"
          :mode-upgrade-button-label="modeUpgradeButtonLabel"
          @update:active-automation-key="activeAutomationKey = $event"
          @update-automation-detail="handleAutomationDetailUpdate"
          @open-secrets="openSecretsModal"
          @mode-upgrade-availability="handleModeUpgradeAvailability"
          @promote-mode-level="promoteModeLevel"
        />

        <div class="module-card" v-if="activeTab === 'LVGL'">
          <LvglBuilder
            :lvgl-config="config.lvgl"
            :widget-schemas="lvglWidgetSchemas"
            :id-index="idIndex"
            :external-select="lvglExternalSelect"
            :active-mode-level="activeModeLevel"
            @update="handleLvglUpdate"
            @field-edit="handleLvglFieldEdit"
          />
        </div>

        <div class="module-card" v-if="activeTab === 'Components'">
          <div class="components-header">
            <div class="components-title">
              <h2>{{ componentsHeader }}</h2>
              <a
                v-if="activeTabHelpUrl"
                class="filter-help"
                :href="activeTabHelpUrl"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Documentation"
              >
                ?
              </a>
            </div>
            <div class="components-actions">
              <button
                v-if="isComponentPickerOpen"
                type="button"
                class="secondary compact btn-standard"
                :disabled="isComponentsImporting"
                @click="openComponentsZipPicker"
              >
                {{ isComponentsImporting ? "Uploading..." : "Upload Components" }}
              </button>
              <button
                v-if="!isComponentPickerOpen && activeComponentSlot !== null && activeComponentCommentKey"
                type="button"
                class="secondary compact btn-standard"
                @click="openActiveComponentCommentEditor"
              >
                {{ activeComponentHasComment ? t("builder.comment.buttonEdit") : t("builder.comment.buttonAdd") }}
              </button>
              <button
                v-if="!isComponentPickerOpen && activeComponentSlot !== null"
                type="button"
                class="secondary compact btn-standard"
                @click="requestRemoveComponent(activeComponentSlot)"
              >
                Remove
              </button>
              <input
                ref="componentsZipInput"
                type="file"
                accept=".zip,application/zip"
                class="components-upload-input"
                @change="handleComponentsZipSelected"
              />
            </div>
          </div>
          <div :class="['module-card__body', { 'module-card__body--picker': isComponentPickerOpen }]">
            <BuilderComponentPicker
              v-if="isComponentPickerOpen"
              :components-query="componentsQuery"
              :component-catalog-error="componentCatalogError"
              :components-import-error="customComponentSaveError"
              :filtered-categories="filteredCategories"
              :selected-component-keys="selectedComponentKeys"
              :is-component-available="isComponentAvailable"
              :is-resolving-component-selection="isResolvingComponentSelection"
              :is-saved-custom-component-item="isSavedCustomComponentItem"
              :deleting-custom-component-id="deletingCustomComponentId"
              @update:components-query="componentsQuery = $event"
              @select-component="selectComponent"
              @delete-saved-custom-component="requestDeleteSavedCustomComponentWithConfirm"
            />
            <BuilderComponentForm
              v-else
              :active-component-bus-labels="activeComponentBusLabels"
              :active-component-protocol-labels="activeComponentProtocolLabels"
              :active-component-system-labels="activeComponentSystemLabels"
              :active-component-network-labels="activeComponentNetworkLabels"
              :active-component-component-labels="activeComponentComponentLabels"
              :active-component-id="activeComponentId"
              :active-component-schema-path="activeComponentSchemaPath"
              :active-component-config="activeComponentConfig"
              :active-component-field-errors="activeComponentFieldErrors"
              :active-component-custom-config="activeComponentCustomConfig"
              :active-mode-level="activeModeLevel"
              :id-registry="idRegistry"
              :name-registry="nameRegistry"
              :id-index="idIndex"
              :gpio-options="gpioOptions"
              :gpio-usage-index="gpioUsageIndex"
              :gpio-title="gpioTitle"
              :active-component-scope-id="activeComponentScopeId"
              :global-store="globalStore"
              :display-images="displayImages"
              :display-fonts="displayFonts"
              :display-google-fonts="displayGoogleFonts"
              :assets-base="assetsBase"
              :should-show-mode-upgrade="shouldShowModeUpgrade('components')"
              :mode-upgrade-button-label="modeUpgradeButtonLabel"
              :show-save-custom-component-action="showSaveCustomComponentAction"
              :can-save-custom-component="canSaveCustomComponent"
              :is-saving-custom-component="isSavingCustomComponent"
              :custom-component-action-label="customComponentActionLabel"
              :custom-component-save-error="customComponentSaveError"
              @focus-bus="focusRequiredBus"
              @focus-protocol="focusRequiredProtocol"
              @focus-system="focusRequiredSystem"
              @focus-network="focusRequiredNetwork"
              @update-schema="handleSchemaUpdate"
              @update-custom-config="handleCustomConfigUpdate"
              @open-asset-manager="openAssetManager"
              @open-secrets="openSecretsModal"
              @mode-upgrade-availability="handleModeUpgradeAvailability"
              @promote-mode-level="promoteModeLevel"
              @save-custom-component-template="saveCustomComponentTemplate"
            />
          </div>
        </div>
          </div>


      </div>

      </section>
    </div>
  </div>
  </div>
</template>

<script setup>
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  provide,
  ref,
  watch
} from "vue";
import BuilderAutomationTab from "../components/builder/BuilderAutomationTab.vue";
import BuilderComponentForm from "../components/builder/BuilderComponentForm.vue";
import CommentEditModal from "../components/builder/CommentEditModal.vue";
import IdDefinitionModal from "../components/builder/IdDefinitionModal.vue";
import BuilderComponentPicker from "../components/builder/BuilderComponentPicker.vue";
import BuilderCoreTab from "../components/builder/BuilderCoreTab.vue";
import LvglBuilder from "../components/lvgl/LvglBuilder.vue";
import BuilderBussesTab from "../components/builder/BuilderBussesTab.vue";
import BuilderModalHost from "../components/builder/BuilderModalHost.vue";
import BuilderNetworkTab from "../components/builder/BuilderNetworkTab.vue";
import BuilderPlatformTab from "../components/builder/BuilderPlatformTab.vue";
import BuilderPreviewPane from "../components/builder/BuilderPreviewPane.vue";
import BuilderProtocolsTab from "../components/builder/BuilderProtocolsTab.vue";
import BuilderSystemTab from "../components/builder/BuilderSystemTab.vue";
import { useBuilderComponentCatalog } from "../composables/builder/useBuilderComponentCatalog";
import { useBuilderDeployment } from "../composables/builder/useBuilderDeployment";
import { useBuilderProjectPersistence } from "../composables/builder/useBuilderProjectPersistence";
import { useBuilderSchemaCatalog } from "../composables/builder/useBuilderSchemaCatalog";
import { useBuilderValidation } from "../composables/builder/useBuilderValidation";
import { useBuilderYamlPreview, ASSET_PREVIEW_BLOCK_KEYS } from "../composables/builder/useBuilderYamlPreview";
import { useInstallConsoleFlow } from "../composables/useInstallConsoleFlow";
import { loadGpioData, resolveGpioKey } from "../utils/gpioData";
import { loadSchemaByPath } from "../utils/schemaLoader";
import { LVGL_WIDGETS } from "../utils/lvglWidgets";
import { resolveDirtyState } from "../utils/builderDirtyState";
import {
  buildGpioUsageIndex,
  isObjectArrayLikeField
} from "../utils/builderValidationRules";
import { buildDisplayAnimationIntervals, resolveSchemaDomain } from "../utils/schemaYaml";
import { encodeFieldPath } from "../utils/yamlDocumentModel";
import { buildGlobalRegistry, isFieldVisible as isSchemaFieldVisible } from "../utils/schemaVisibility";
import { MODE_LEVELS, modeLevelRank, normalizeModeLevel } from "../utils/schemaModeLevel";
import { getRequiredDependencies } from "../utils/schemaRequirements";
import {
  generateFieldValue,
  hasGeneratedPasswordSeedValue,
  resolveFieldValue,
  resolveGenerationSpec
} from "../utils/schemaAuto";
import {
  BUILDER_CONFIG_STORAGE_KEY,
  readBuilderSessionProjectName,
  writeBuilderSessionProjectName
} from "../utils/builderSession";
import { createDefaultBuilderConfig } from "../utils/builderProjectModel";
import {
  createBusInstance,
  isMultiInstanceBusKey,
  normalizeBusConfigValue,
  normalizeBusInstances
} from "../utils/busInstances";
import {
  buildAssetUrl,
  deleteAsset,
  fetchAssetsManifest,
  renameAsset,
  uploadAsset
} from "../utils/assetsApi";
import {
  normalizeAnimationElementEncoding,
  normalizeImageElementEncoding
} from "../utils/displayImageEncoding";
import { deriveGoogleFontStyle as deriveVariantStyle } from "../utils/displayFonts";
import { isDevOffline } from "../utils/devFlags";
import { apiFetch, apiUrl } from "../utils/api";
import { useI18n } from "vue-i18n";

// BuilderView is now mainly the orchestration shell for the schema-driven editor.
// UI-heavy sections, preview logic, catalog flow, schema loading, and validation are
// delegated to focused components/composables so the view can coordinate them.

const { t } = useI18n();

const tabs = ["Core", "Platform", "Network", "Protocols", "Busses", "System", "Automation", "LVGL"];
const activeTab = ref(tabs[0]);
const splitPreviewEnabled = ref(false);
const pulsingTabs = ref(new Set());
const tabPulseTimers = new Map();
const pendingPulseEntries = new Map();
const config = ref(defaultConfig());
const confirmOpen = ref(false);
const pendingRemoveIndex = ref(null);
const isSavingCustomComponent = ref(false);
const customComponentSaveError = ref("");
const confirmAction = ref(null);
const modeLevels = MODE_LEVELS;
const nextModeLevelByMode = {
  Simple: "Normal",
  Normal: "Advanced",
  Advanced: "Advanced"
};
const modeUpgradeButtonLabelByMode = {
  Simple: "Show Normal configuration",
  Normal: "Show Advanced configuration"
};
const modeUpgradeAvailability = ref({});
const isProjectSaving = ref(false);
const assetManagerOpen = ref(false);
const assetsLoading = ref(false);
const assetsWorking = ref(false);
const assetsError = ref("");
const secretsModalOpen = ref(false);
const secretsRawContent = ref("");
const secretsLoading = ref(false);
const secretsSaving = ref(false);
const secretsError = ref("");
const projectSaveMessage = ref("");
const projectSaveError = ref("");
const sourceProjectFilename = ref("");

const activeModeLevel = ref(modeLevels[0]);
const resolveModeLevel = (value) => normalizeModeLevel(value);
const modeUpgradeButtonLabel = computed(
  () => modeUpgradeButtonLabelByMode[resolveModeLevel(activeModeLevel.value)] || ""
);
const handleModeUpgradeAvailability = ({ section, key, available }) => {
  if (!section || !key) return;
  const next = {
    ...(modeUpgradeAvailability.value[section] || {}),
    [key]: Boolean(available)
  };
  modeUpgradeAvailability.value = {
    ...modeUpgradeAvailability.value,
    [section]: next
  };
};
const shouldShowModeUpgrade = (section) => {
  if (!modeUpgradeButtonLabel.value) return false;
  const sectionState = modeUpgradeAvailability.value[section] || {};
  return Object.values(sectionState).some(Boolean);
};
const promoteModeLevel = () => {
  const current = resolveModeLevel(activeModeLevel.value);
  const next = nextModeLevelByMode[current] || modeLevels[0];
  if (next === current) return;
  activeModeLevel.value = next;
};
const formErrorsModalOpen = ref(false);
const gpioGuideOpen = ref(false);
const gpioData = ref({ sections: {} });
const esphomeCoreSchema = ref(null);
const substitutionsCoreSchema = ref(null);
const platformCoreSchema = ref(null);
const platformDetailSchema = ref(null);
const networkDetailSchema = ref(null);
const networkCoreSchema = ref(null);
const protocolsSchemas = ref({});
const bussesSchemas = ref({});
const lvglWidgetSchemas = ref({});
const otherSchemas = ref({});
const automationSchemas = ref({});

const resolveComponentRenderAs = (schema) => {
  const renderAs = typeof schema?.renderAs === "string" ? schema.renderAs.trim().toLowerCase() : "";
  return renderAs === "root_map" ? "root_map" : "list";
};

const normalizeSchemaPath = (value) => {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return trimmed || "";
};

const {
  activeComponentSlot,
  addComponentSlot,
  catalogSchemaPathById,
  catalogSchemaPathForEntry,
  clearPendingDeleteSavedCustomComponent,
  componentCatalogError,
  componentCatalogItemsById,
  componentCatalogLabel,
  componentLabel,
  componentsQuery,
  componentsZipInput,
  deleteSavedCustomComponent,
  deletingCustomComponentId,
  filteredCategories,
  handleComponentsZipSelected,
  importSummaryModalMessage,
  importSummaryModalOpen,
  importSummaryModalRows,
  isComponentCatalogLoading,
  isComponentCatalogReady,
  isComponentPickerOpen,
  isComponentsImporting,
  isResolvingComponentSelection,
  isSavedCustomComponentItem,
  openComponentsZipPicker,
  openComponentViewer,
  pendingDeleteCustomItem,
  refreshComponentCatalog,
  requestDeleteSavedCustomComponent,
  selectedComponentKeys
} = useBuilderComponentCatalog({
  config,
  activeTab,
  componentIdFromEntry: (entry) => componentIdFromEntry(entry),
  componentCatalogKeyFromEntry: (entry) => componentCatalogKeyFromEntry(entry),
  normalizeSchemaPath,
  addonFetch: (...args) => addonFetch(...args),
  isDevOffline,
  localComponentCatalogUrl: () => localComponentCatalogUrl,
  customComponentSaveError
});

const { componentSchemas, componentSchemaStatus, ensureComponentSchema } = useBuilderSchemaCatalog({
  config,
  componentIdFromEntry: (entry) => componentIdFromEntry(entry),
  componentCatalogKeyFromEntry: (entry) => componentCatalogKeyFromEntry(entry),
  normalizeSchemaPath,
  catalogSchemaPathById,
  catalogSchemaPathForEntry,
  isComponentCatalogReady,
  componentCatalogItemsById
});

const componentEntryLabel = (entry) => {
  const componentId = componentIdFromEntry(entry);
  if (!componentId) return "";
  const schema = componentSchemas.value?.[componentId];
  const labelField = typeof schema?.uiLabelField === "string" ? schema.uiLabelField.trim() : "";
  if (labelField) {
    const candidate = entry?.config?.[labelField];
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  const fallbackLabel =
    typeof schema?.defaultLabel === "string" && schema.defaultLabel.trim()
      ? schema.defaultLabel.trim()
      : "";
  return componentCatalogLabel(entry) || fallbackLabel || componentLabel(componentId) || componentId;
};

const getRootMapConflictDomain = (componentId, slotToIgnore = -1) => {
  const schema = componentSchemas.value?.[componentId];
  if (!schema || resolveComponentRenderAs(schema) !== "root_map") return "";
  const domain = String(schema.domain || "").trim();
  if (!domain) return "";
  const hasConflict = (config.value.components || []).some((entry, index) => {
    if (index === slotToIgnore) return false;
    const existingId = componentIdFromEntry(entry);
    if (!existingId || (existingId === componentId && index === activeComponentSlot.value)) return false;
    const existingSchema = componentSchemas.value?.[existingId];
    if (!existingSchema || resolveComponentRenderAs(existingSchema) !== "root_map") return false;
    return String(existingSchema.domain || "").trim() === domain;
  });
  return hasConflict ? domain : "";
};

// A root_map component can only be added once; its section would otherwise
// collide with the existing one in the project.
const isComponentAvailable = (item) => {
  const componentId = String(item?.id || "").trim();
  if (!componentId) return false;
  return !getRootMapConflictDomain(componentId, activeComponentSlot.value ?? -1);
};

const componentsHeader = computed(() => {
  if (activeComponentSlot.value === null) return "Components";
  const entry = config.value.components[activeComponentSlot.value];
  return entry ? componentEntryLabel(entry) : "Add";
});

const projectFilename = computed(() => {
  const coreValue = config.value.esphomeCore || {};
  const coreFields = esphomeCoreSchema.value?.fields || [];
  const resolvedName = resolveFieldValue("name", coreValue, coreFields, config.value);
  const name = String(resolvedName || "").trim();
  if (!name) return "new_file.yaml";
  return name.toLowerCase().endsWith(".yaml") ? name : `${name}.yaml`;
});
const isProjectSaved = computed(() => config.value?.isSaved === true);
const projectFilenameLabel = computed(() =>
  isProjectSaved.value ? projectFilename.value : `${projectFilename.value}*`
);
const projectSummaryName = computed(() => {
  const coreValue = config.value.esphomeCore || {};
  const coreFields = esphomeCoreSchema.value?.fields || [];
  const friendly = String(resolveFieldValue("friendly_name", coreValue, coreFields, config.value) || "").trim();
  if (friendly) return friendly;
  const name = String(resolveFieldValue("name", coreValue, coreFields, config.value) || "").trim();
  return name || "-";
});
const projectSummaryComment = computed(() => {
  const coreValue = config.value.esphomeCore || {};
  const coreFields = esphomeCoreSchema.value?.fields || [];
  return String(resolveFieldValue("comment", coreValue, coreFields, config.value) || "").trim();
});
const projectSummaryPlatform = computed(() => {
  const platform = String(platformCoreConfig.value?.platform || "").trim().toUpperCase();
  const variant = String(platformCoreConfig.value?.variant || "").trim().toUpperCase();
  if (!platform) return "Unknown";
  if (!variant || variant === platform) return platform;
  return `${platform} (${variant})`;
});


const componentIdFromEntry = (entry) =>
  typeof entry === "string" ? entry : entry?.id || "";

const componentCatalogKeyFromEntry = (entry) => {
  if (!entry || typeof entry !== "object") return componentIdFromEntry(entry);
  const key = typeof entry.catalogKey === "string" ? entry.catalogKey.trim() : "";
  return key || componentIdFromEntry(entry);
};

const parseComponentId = (componentId) => {
  if (!componentId) return { domain: "", platform: "" };
  const separator = componentId.includes(".") ? "." : "/";
  const [domain, platform] = componentId.split(separator);
  return { domain: domain || "", platform: platform || "" };
};

const confirmTitle = computed(() =>
  confirmAction.value === "delete-custom" ? "Delete saved component" : "Confirm"
);
const confirmMessage = computed(() => {
  if (confirmAction.value === "delete-custom") {
    const name = pendingDeleteCustomItem.value?.name || "this component";
    return `Are you sure you want to delete \"${name}\"?`;
  }
  return "Are you sure?";
});
const confirmConfirmText = computed(() =>
  confirmAction.value === "delete-custom" ? "Delete" : "Yes"
);
const confirmCancelText = computed(() => "Cancel");

const schemaHelpUrl = (schema) => {
  const url = schema?.helpUrl;
  return typeof url === "string" ? url.trim() : "";
};

const BUSSES_HELP_URL = "https://esphome.io/components/#hardware-peripheral-interfacesbusses";

const activeTabHelpUrl = computed(() => {
  if (activeTab.value === "Core") {
    return schemaHelpUrl(esphomeCoreSchema.value) || schemaHelpUrl(substitutionsCoreSchema.value);
  }

  if (activeTab.value === "Platform") {
    return schemaHelpUrl(platformDetailSchema.value) || schemaHelpUrl(platformCoreSchema.value);
  }

  if (activeTab.value === "Network") {
    return schemaHelpUrl(networkDetailSchema.value) || schemaHelpUrl(networkCoreSchema.value);
  }

  if (activeTab.value === "Protocols") {
    return schemaHelpUrl(protocolsSchemas.value?.[activeProtocolKey.value]);
  }

  if (activeTab.value === "Busses") {
    return BUSSES_HELP_URL;
  }

  if (activeTab.value === "System") {
    return schemaHelpUrl(otherSchemas.value?.[activeOtherKey.value]);
  }

  if (activeTab.value === "LVGL") {
    return "https://esphome.io/components/lvgl/";
  }

  if (activeTab.value === "Automation") {
    return schemaHelpUrl(automationSchemas.value?.[activeAutomationKey.value]);
  }

  if (activeTab.value === "Components") {
    if (activeComponentSlot.value === null) return "";
    const componentId = componentIdFromEntry(config.value.components[activeComponentSlot.value]);
    if (!componentId) return "";
    return schemaHelpUrl(componentSchemas.value?.[componentId]);
  }

  return "";
});

const activeComponentEntry = computed(() => {
  if (activeComponentSlot.value === null) return null;
  return config.value.components[activeComponentSlot.value] || null;
});

const activeComponentId = computed(() => componentIdFromEntry(activeComponentEntry.value));
const activeComponentScopeId = computed(() =>
  activeComponentSlot.value === null ? "" : `component:${activeComponentSlot.value}`
);
const activeComponentSchemaPath = computed(
  () => catalogSchemaPathForEntry(activeComponentEntry.value) || catalogSchemaPathById(activeComponentId.value)
);

const activeComponentConfig = computed(() => activeComponentEntry.value?.config || {});
const activeComponentCustomConfig = computed(
  () => activeComponentEntry.value?.customConfig || ""
);
const activeComponentSchema = computed(() => componentSchemas.value?.[activeComponentId.value] || null);
const activeCustomComponentId = computed(() => {
  const componentId = String(activeComponentId.value || "").trim().toLowerCase();
  if (!componentId.startsWith("custom/")) return "";
  return componentId;
});
const isSavedCustomComponentActive = computed(
  () => Boolean(activeCustomComponentId.value) && activeCustomComponentId.value !== "custom/empty"
);
const showSaveCustomComponentAction = computed(
  () =>
    Boolean(activeCustomComponentId.value) &&
    activeComponentSchema.value?.renderStrategy === "verbatim_root"
);
const customComponentActionLabel = computed(() =>
  isSavedCustomComponentActive.value ? "Update Component" : "Save Component"
);
const activeCustomComponentName = computed(() => {
  const value = activeComponentConfig.value?.name;
  return typeof value === "string" ? value.trim() : "";
});
const existingSavedCustomNames = computed(() => {
  const names = new Map();
  componentCatalogItemsById.value.forEach((item, id) => {
    const normalizedId = String(id || "").trim().toLowerCase();
    if (!normalizedId.startsWith("custom/") || normalizedId === "custom/empty") return;
    const value = String(item?.name || "").trim().toLowerCase();
    if (value) {
      names.set(normalizedId, value);
    }
  });
  return names;
});
const isActiveCustomNameDuplicate = computed(() => {
  const normalized = activeCustomComponentName.value.toLowerCase();
  if (!normalized) return false;
  for (const [componentId, name] of existingSavedCustomNames.value.entries()) {
    if (componentId === activeCustomComponentId.value) continue;
    if (name === normalized) return true;
  }
  return false;
});
const activeComponentFieldErrors = computed(() => {
  if (!showSaveCustomComponentAction.value) return {};
  if (!isActiveCustomNameDuplicate.value) return {};
  return { name: "Component name already exists" };
});
const canSaveCustomComponent = computed(() => {
  if (!showSaveCustomComponentAction.value) return false;
  if (!activeCustomComponentName.value) return false;
  if (isActiveCustomNameDuplicate.value) return false;
  return !isSavingCustomComponent.value;
});

const esphomeCoreId = "general/core/core";
const esphomeCoreScopeId = "tab:Core:esphome";
const esphomeCoreConfig = computed(() => config.value.esphomeCore || {});
const substitutionsCoreId = "general/core/substitutions";
const substitutionsCoreScopeId = "tab:Core:substitutions";
const substitutionsCoreConfig = computed(() => config.value.substitutions || {});
const platformCoreId = "general/platform/platform";
const platformCoreScopeId = "tab:Platform:core";
const platformDetailScopeId = "tab:Platform:detail";
const platformCoreConfig = computed(() => config.value.platformCore || {});
const platformDetailId = computed(() => {
  const platform = platformCoreConfig.value?.platform;
  if (!platform) return "";
  return `general/platform/${platform}`;
});
const networkCoreId = "general/network/network";
const networkTransportScopeId = "tab:Network:transport";
const networkDetailScopeId = "tab:Network:detail";
const networkOtaScopeId = "tab:Network:ota";
const networkWebServerScopeId = "tab:Network:web_server";
const networkCoreConfig = computed(() => config.value.networkCore || {});
const networkDetailId = computed(() => {
  const transport = networkCoreConfig.value?.transport;
  if (!transport) return "";
  return `general/network/${transport}`;
});
const protocolsCoreConfig = computed(() => config.value.protocolsCore || {});
const protocolDefinitions = [
  { key: "api", label: "API", schemaId: "general/protocols/api" },
  { key: "mqtt", label: "MQTT", schemaId: "general/protocols/mqtt" },
  { key: "espnow", label: "ESP-NOW", schemaId: "general/protocols/esp-now" }
];
const activeProtocolKey = ref(protocolDefinitions[0]?.key || "");
const resolveProtocolEnabled = (key) => {
  const configEntry = protocolsCoreConfig.value?.[key] || {};
  if (configEntry.enabled !== undefined) return Boolean(configEntry.enabled);
  const schema = protocolsSchemas.value?.[key];
  const field = schema?.fields?.find((item) => item.key === "enabled");
  if (field?.default !== undefined) return Boolean(field.default);
  return false;
};
const enabledProtocolKeys = computed(() =>
  protocolDefinitions.filter((entry) => resolveProtocolEnabled(entry.key)).map((entry) => entry.key)
);
const bussesCoreConfig = computed(() => config.value.bussesCore || {});
const bussesDefinitions = [
  { key: "i2c", label: "I2C", schemaId: "general/busses/i2c" },
  { key: "spi", label: "SPI", schemaId: "general/busses/spi" },
  { key: "uart", label: "UART", schemaId: "general/busses/uart" },
  { key: "one_wire", label: "1-Wire", schemaId: "general/busses/one_wire" },
  { key: "i2s", label: "I2S", schemaId: "general/busses/i2s" },
  { key: "canbus", label: "CAN Bus", schemaId: "general/busses/canbus" },
  { key: "modbus", label: "Modbus", schemaId: "general/busses/modbus" }
];
const normalizeBussesCoreConfig = (source) => {
  const normalized = {};
  const sourceValue = source && typeof source === "object" && !Array.isArray(source) ? source : {};
  Object.entries(sourceValue).forEach(([key, value]) => {
    normalized[key] = value;
  });
  bussesDefinitions.forEach((entry) => {
    if (!Object.prototype.hasOwnProperty.call(sourceValue, entry.key)) return;
    normalized[entry.key] = normalizeBusConfigValue(entry.key, sourceValue[entry.key]);
  });
  return normalized;
};
const requiredDependencies = computed(() =>
  getRequiredDependencies({
    components: config.value.components || [],
    componentSchemas: componentSchemas.value,
    networkConfig: networkCoreConfig.value,
    networkSchema: networkDetailSchema.value,
    protocolsConfig: protocolsCoreConfig.value,
    enabledProtocols: enabledProtocolKeys.value,
    protocolsSchemas: protocolsSchemas.value
  })
);
const requiredBusses = computed(() => {
  const busses = new Set();
  requiredDependencies.value.forEach((id) => {
    const [namespace, targetKey] = String(id || "").split(":", 2);
    if (namespace === "bus" && targetKey) busses.add(targetKey);
  });
  return busses;
});
const otherDefinitions = [
  { key: "logger", label: "Logger", schemaId: "general/system/logger" },
  { key: "status_led", label: "Status LED", schemaId: "general/system/status_led" },
  { key: "debug", label: "Debug", schemaId: "general/system/debug" },
  { key: "psram", label: "PSRAM", schemaId: "general/system/psram" }
];
const systemConfig = computed(() => config.value.system || {});
const requirementLabelMap = {
  api: "API",
  canbus: "CAN Bus",
  esp32_ble_tracker: "ESP32 BLE Tracker",
  espnow: "ESP-NOW",
  gps: "GPS",
  i2c: "I2C",
  i2s: "I2S",
  i2s_audio: "I2S Audio",
  modbus: "Modbus",
  mqtt: "MQTT",
  one_wire: "1-Wire",
  openthread: "OpenThread",
  psram: "PSRAM",
  spi: "SPI",
  uart: "UART",
  wifi: "WiFi"
};
const formatRequirementLabel = (key) => {
  if (!key) return "";
  if (requirementLabelMap[key]) return requirementLabelMap[key];
  return key
    .replace(/[_-]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};
const getRequirementMetadata = (requirementId) => {
  const [namespace, targetKey] = String(requirementId || "").split(":", 2);
  const label = formatRequirementLabel(targetKey);
  if (!namespace || !targetKey) return null;
  if (namespace === "bus") return { id: requirementId, namespace, targetKey, tab: "Busses", label };
  if (namespace === "protocol") return { id: requirementId, namespace, targetKey, tab: "Protocols", label };
  if (namespace === "system") return { id: requirementId, namespace, targetKey, tab: "System", label };
  if (namespace === "network") return { id: requirementId, namespace, targetKey, tab: "Network", label };
  if (namespace === "component" && targetKey === "i2s_audio") {
    return { id: requirementId, namespace: "bus", targetKey: "i2s", tab: "Busses", label: "I2S Audio" };
  }
  if (namespace === "component") return { id: requirementId, namespace, targetKey, tab: "", label };
  return { id: requirementId, namespace, targetKey, tab: "", label };
};
const getEntryRequiredDependencyIds = (entry, componentId, supported = null) => {
  if (!entry || !componentId) return new Set();
  if (!componentSchemas.value?.[componentId]) return new Set();
  return getRequiredDependencies({
    components: [entry],
    componentSchemas: componentSchemas.value,
    supported
  });
};
const getRequirementDefinitionsForIds = (ids) =>
  Array.from(ids || [])
    .map((id) => getRequirementMetadata(id))
    .filter(Boolean);
const listRequirementLabels = (definitions) => definitions.map((entry) => entry.label).join("/");
const getRequirementDefinitionsForTab = (definitions, tab) => definitions.filter((entry) => entry.tab === tab);
const protocolTabs = computed(() =>
  protocolDefinitions.map((entry) => ({ key: entry.key, label: entry.label }))
);
const protocolDetailId = computed(() => {
  const entry = protocolDefinitions.find((item) => item.key === activeProtocolKey.value);
  return entry?.schemaId || "";
});
const protocolDetailScopeId = computed(() =>
  activeProtocolKey.value ? `tab:Protocols:${activeProtocolKey.value}` : "tab:Protocols"
);
const protocolDetailConfig = computed(() => {
  if (!activeProtocolKey.value) return {};
  return protocolsCoreConfig.value?.[activeProtocolKey.value] || {};
});
const activeBussesKey = ref(bussesDefinitions[0]?.key || "");
const getBusInstances = (key) => normalizeBusInstances(bussesCoreConfig.value?.[key]);
const resolveBusEnabled = (key) => {
  if (isMultiInstanceBusKey(key)) return getBusInstances(key).length > 0;
  const configEntry = bussesCoreConfig.value?.[key] || {};
  if (configEntry.enabled !== undefined) return Boolean(configEntry.enabled);
  const schema = bussesSchemas.value?.[key];
  const field = schema?.fields?.find((item) => item.key === "enabled");
  if (field?.default !== undefined) return Boolean(field.default);
  return false;
};
const activeComponentRequirementDefinitions = computed(() => {
  if (!activeComponentEntry.value) return [];
  return getRequirementDefinitionsForIds(getEntryRequiredDependencyIds(activeComponentEntry.value, activeComponentId.value));
});
const activeComponentRequiredBusDefinitions = computed(() =>
  getRequirementDefinitionsForTab(activeComponentRequirementDefinitions.value, "Busses")
);
const activeComponentRequiredBusses = computed(() => {
  return activeComponentRequiredBusDefinitions.value.map((entry) => entry.targetKey);
});
const activeComponentBusLabels = computed(() =>
  listRequirementLabels(activeComponentRequiredBusDefinitions.value)
);
const primaryRequiredBusKey = computed(() => activeComponentRequiredBusses.value[0] || "");
const activeComponentRequiredProtocolDefinitions = computed(() =>
  getRequirementDefinitionsForTab(activeComponentRequirementDefinitions.value, "Protocols")
);
const activeComponentRequiredProtocols = computed(() => {
  return activeComponentRequiredProtocolDefinitions.value.map((entry) => entry.targetKey);
});
const activeComponentProtocolLabels = computed(() =>
  listRequirementLabels(activeComponentRequiredProtocolDefinitions.value)
);
const primaryRequiredProtocolKey = computed(() => activeComponentRequiredProtocols.value[0] || "");
const activeComponentRequiredSystemDefinitions = computed(() =>
  getRequirementDefinitionsForTab(activeComponentRequirementDefinitions.value, "System")
);
const activeComponentRequiredSystem = computed(() =>
  activeComponentRequiredSystemDefinitions.value.map((entry) => entry.targetKey)
);
const activeComponentSystemLabels = computed(() =>
  listRequirementLabels(activeComponentRequiredSystemDefinitions.value)
);
const primaryRequiredSystemKey = computed(() => activeComponentRequiredSystem.value[0] || "");
const activeComponentRequiredNetworkDefinitions = computed(() =>
  getRequirementDefinitionsForTab(activeComponentRequirementDefinitions.value, "Network")
);
const activeComponentNetworkLabels = computed(() =>
  listRequirementLabels(activeComponentRequiredNetworkDefinitions.value)
);
const activeComponentRequiredComponentDefinitions = computed(() =>
  getRequirementDefinitionsForTab(activeComponentRequirementDefinitions.value, "")
);
const activeComponentComponentLabels = computed(() =>
  listRequirementLabels(activeComponentRequiredComponentDefinitions.value)
);

const focusRequiredBus = () => {
  activeTab.value = "Busses";
  if (primaryRequiredBusKey.value) {
    activeBussesKey.value = primaryRequiredBusKey.value;
  }
};

const focusRequiredProtocol = () => {
  activeTab.value = "Protocols";
  if (primaryRequiredProtocolKey.value) {
    activeProtocolKey.value = primaryRequiredProtocolKey.value;
  }
};

const getRequirementTabsForEntry = (entry, componentId) => {
  const definitions = getRequirementDefinitionsForIds(getEntryRequiredDependencyIds(entry, componentId));
  return Array.from(new Set(definitions.map((definition) => definition.tab).filter(Boolean)));
};

const triggerTabPulse = (tab) => {
  const active = new Set(pulsingTabs.value);
  const existingTimer = tabPulseTimers.get(tab);
  if (existingTimer) {
    clearTimeout(existingTimer);
    tabPulseTimers.delete(tab);
  }
  active.delete(tab);
  pulsingTabs.value = active;
  requestAnimationFrame(() => {
    const next = new Set(pulsingTabs.value);
    next.add(tab);
    pulsingTabs.value = next;
    const timer = setTimeout(() => {
      const current = new Set(pulsingTabs.value);
      current.delete(tab);
      pulsingTabs.value = current;
      tabPulseTimers.delete(tab);
    }, 3000);
    tabPulseTimers.set(tab, timer);
  });
};

const isTabPulsing = (tab) => pulsingTabs.value.has(tab);

const queuePulseForAddedComponent = (entry, componentId) => {
  if (!entry || !componentId) return;
  const schema = componentSchemas.value?.[componentId];
  if (schema === undefined) {
    const queue = pendingPulseEntries.get(componentId) || [];
    queue.push(entry);
    pendingPulseEntries.set(componentId, queue);
    return;
  }
  getRequirementTabsForEntry(entry, componentId).forEach((tab) => triggerTabPulse(tab));
};

const focusRequiredSystem = () => {
  activeTab.value = "System";
  if (primaryRequiredSystemKey.value) {
    activeOtherKey.value = primaryRequiredSystemKey.value;
  }
};

const focusRequiredNetwork = () => {
  activeTab.value = "Network";
};
const bussesTabs = computed(() =>
  bussesDefinitions.map((entry) => ({ key: entry.key, label: entry.label }))
);
const activeBusDefinition = computed(() =>
  bussesDefinitions.find((item) => item.key === activeBussesKey.value) || null
);
const activeBusLabel = computed(() => activeBusDefinition.value?.label || "Bus");
const isActiveMultiInstanceBus = computed(() => isMultiInstanceBusKey(activeBussesKey.value));
const activeBusInstances = computed(() => getBusInstances(activeBussesKey.value));
const bussesDetailId = computed(() => {
  return activeBusDefinition.value?.schemaId || "";
});
const bussesDetailScopeId = computed(() =>
  activeBussesKey.value ? `tab:Busses:${activeBussesKey.value}` : "tab:Busses"
);
const bussesDetailFieldFilter = computed(() => {
  const schema = bussesSchemas.value?.[activeBussesKey.value];
  const fields = Array.isArray(schema?.fields) ? schema.fields : [];
  if (!isActiveMultiInstanceBus.value) return [];
  return fields.map((field) => field.key).filter((key) => key && key !== "enabled");
});
const bussesDetailConfig = computed(() => {
  if (!activeBussesKey.value) return {};
  if (isActiveMultiInstanceBus.value) return {};
  return bussesCoreConfig.value?.[activeBussesKey.value] || {};
});
const activeOtherKey = ref(otherDefinitions[0]?.key || "");
const otherTabs = computed(() =>
  otherDefinitions.map((entry) => ({ key: entry.key, label: entry.label }))
);
const otherDetailId = computed(() => {
  const entry = otherDefinitions.find((item) => item.key === activeOtherKey.value);
  return entry?.schemaId || "";
});
const otherDetailScopeId = computed(() =>
  activeOtherKey.value ? `tab:System:${activeOtherKey.value}` : "tab:System"
);
const otherDetailConfig = computed(() => {
  if (!activeOtherKey.value) return {};
  const current = systemConfig.value?.[activeOtherKey.value] || {};
  return current;
});
const automationCoreConfig = computed(() => config.value.automation || {});
const automationDefinitions = [
  {
    key: "deep_sleep",
    label: "Deep Sleep",
    schemaId: "general/automation/deep_sleep"
  },
  { key: "script", label: "Script", schemaId: "general/automation/script" },
  {
    key: "globals",
    label: "Globals",
    schemaId: "general/automation/globals"
  },
  {
    key: "interval",
    label: "Interval",
    schemaId: "general/automation/interval"
  }
];
const activeAutomationKey = ref(automationDefinitions[0]?.key || "");
const automationTabs = computed(() =>
  automationDefinitions.map((entry) => ({ key: entry.key, label: entry.label }))
);
const automationDetailId = computed(() => {
  const entry = automationDefinitions.find((item) => item.key === activeAutomationKey.value);
  return entry?.schemaId || "";
});
const automationDetailScopeId = computed(() =>
  activeAutomationKey.value ? `tab:Automation:${activeAutomationKey.value}` : "tab:Automation"
);
const automationDetailSchema = computed(() => {
  if (!activeAutomationKey.value) return null;
  return automationSchemas.value?.[activeAutomationKey.value] || null;
});
const automationDetailConfig = computed(() => automationCoreConfig.value || {});
const automationItemFields = computed(() => {
  const key = activeAutomationKey.value;
  if (!key) return [];
  const fields = automationDetailSchema.value?.fields || [];
  const listField = fields.find((field) => field.key === key);
  return listField?.item?.fields || [];
});
const generatedAutomation = computed(() => ({
  deep_sleep: [],
  script: [],
  globals: [],
  interval: buildDisplayAnimationIntervals(
    config.value.components,
    componentSchemas.value,
    mdiSubstitutions.value
  )
}));

const embeddedDomainsByComponentDomain = computed(() => {
  const map = new Map();

  const collectEmbeddedDomains = (schemaLike, valueMap, domains) => {
    const embedded = Array.isArray(schemaLike?.embedded) ? schemaLike.embedded : [];
    const fields = Array.isArray(schemaLike?.fields) ? schemaLike.fields : [];
    if (!embedded.length || !fields.length) return;

    const fieldByKey = new Map(fields.map((field) => [field?.key, field]));

    embedded.forEach((definition) => {
      const key = typeof definition?.key === "string" ? definition.key.trim() : "";
      const fallbackDomain = typeof definition?.domain === "string" ? definition.domain.trim() : "";
      const domainBy = typeof definition?.domainBy === "string" ? definition.domainBy.trim() : "";
      const domainMap =
        definition?.domainMap && typeof definition.domainMap === "object" && !Array.isArray(definition.domainMap)
          ? definition.domainMap
          : null;
      const mappedDomainValue = domainBy ? valueMap?.[domainBy] : undefined;
      const mappedDomain =
        domainMap && mappedDomainValue !== undefined && domainMap[String(mappedDomainValue)]
          ? String(domainMap[String(mappedDomainValue)]).trim()
          : "";
      const domain = mappedDomain || fallbackDomain;
      if (!key || !domain) return;

      const sourceField = fieldByKey.get(key);
      if (!sourceField || sourceField.type !== "object") return;
      if (!isSchemaFieldVisible(sourceField, valueMap, fields, globalStore.value)) return;
      domains.add(domain);

      const nestedValue = valueMap?.[key];
      if (nestedValue && typeof nestedValue === "object" && !Array.isArray(nestedValue)) {
        collectEmbeddedDomains(sourceField, nestedValue, domains);
      }
    });
  };

  (config.value.components || []).forEach((entry) => {
    const componentId = componentIdFromEntry(entry);
    if (!componentId) return;
    const schema = componentSchemas.value?.[componentId];
    if (!schema) return;

    const componentDomain = String(schema.domain || parseComponentId(componentId).domain || "").trim();
    if (!componentDomain) return;
    const componentConfig =
      entry?.config && typeof entry.config === "object" && !Array.isArray(entry.config)
        ? entry.config
        : {};

    const domains = new Set();
    collectEmbeddedDomains(schema, componentConfig, domains);
    if (domains.size) {
      const existing = map.get(componentDomain);
      if (existing) {
        domains.forEach((domain) => existing.add(domain));
      } else {
        map.set(componentDomain, domains);
      }
    }
  });

  return map;
});

const hubDomainsInUse = computed(() => {
  const domains = new Set();
  embeddedDomainsByComponentDomain.value.forEach((domainSet) => {
    domainSet.forEach((domain) => domains.add(domain));
  });
  return domains;
});

const componentDomainsUsingHubs = computed(
  () => new Set(Array.from(embeddedDomainsByComponentDomain.value.keys()))
);

const formatGeneratedLine = (entry, field) => {
  if (!field?.key) return "";
  const value = entry?.[field.key];
  if (value === undefined || value === null || value === "") return "";
  if (field.key === "then" && Array.isArray(value)) {
    if (!value.length) return "";
    const first = value[0] || {};
    const type = first.type || "";
    const id = first?.config?.id ? `: ${first.config.id}` : "";
    if (type && value.length === 1) return `then: ${type}${id}`;
    return `then: ${value.length} actions`;
  }
  if (Array.isArray(value)) {
    if (!value.length) return "";
    return `${field.key}: ${value.length} items`;
  }
  if (typeof value === "object") {
    return `${field.key}: ${JSON.stringify(value)}`;
  }
  return `${field.key}: ${value}`;
};

const generatedEntryLines = (entry) =>
  automationItemFields.value
    .map((field) => formatGeneratedLine(entry, field))
    .filter(Boolean);
const platformForGpio = computed(() =>
  platformCoreConfig.value?.platform || config.value.device.platform
);
const platformVariantForGpio = computed(() =>
  platformCoreConfig.value?.variant || config.value.device.variant
);

const gpioGuideKey = computed(() =>
  resolveGpioKey(platformForGpio.value, platformVariantForGpio.value)
);

const gpioGuide = computed(() =>
  gpioGuideKey.value ? gpioData.value.sections?.[gpioGuideKey.value] || null : null
);

const gpioOptions = computed(() => gpioGuide.value?.rows || []);

const gpioTitle = computed(() => gpioGuide.value?.title || "GPIO Guide");

const mdiSubstitutions = ref({});
const displayImages = ref([]);
const displayFonts = ref([]);
const displayAudio = ref([]);
const displayGoogleFonts = ref([]);
const mdiIcons = ref([]);

provide("mdiIcons", mdiIcons);

const schemaEntries = computed(() => {
  const entries = [];

  const pushEntry = ({ scopeId, label, componentId, config, schema }) => {
    const fields = schema?.fields || [];
    if (!fields.length) return;
    entries.push({
      scopeId,
      label,
      componentId,
      config: config || {},
      fields,
      domain: schema?.domain || "",
      renderAs: typeof schema?.renderAs === "string" ? schema.renderAs : ""
    });
  };

  pushEntry({
    scopeId: "tab:Core",
    label: "core.esphome",
    componentId: esphomeCoreId,
    config: esphomeCoreConfig.value,
    schema: esphomeCoreSchema.value
  });
  pushEntry({
    scopeId: "tab:Core",
    label: "core.substitutions",
    componentId: substitutionsCoreId,
    config: substitutionsCoreConfig.value,
    schema: substitutionsCoreSchema.value
  });
  pushEntry({
    scopeId: "tab:Platform",
    label: "platform.core",
    componentId: platformCoreId,
    config: platformCoreConfig.value,
    schema: platformCoreSchema.value
  });
  pushEntry({
    scopeId: "tab:Platform",
    label: "platform.detail",
    componentId: platformDetailId.value,
    config: platformCoreConfig.value,
    schema: platformDetailSchema.value
  });
  pushEntry({
    scopeId: "tab:Network",
    label: "network.core",
    componentId: networkCoreId,
    config: networkCoreConfig.value,
    schema: networkCoreSchema.value
  });
  pushEntry({
    scopeId: "tab:Network",
    label: "network.detail",
    componentId: networkDetailId.value,
    config: networkCoreConfig.value,
    schema: networkDetailSchema.value
  });

  protocolDefinitions.forEach((entry) => {
    pushEntry({
      scopeId: "tab:Protocols",
      label: `protocols.${entry.key}`,
      componentId: entry.schemaId,
      config: protocolsCoreConfig.value?.[entry.key] || {},
      schema: protocolsSchemas.value?.[entry.key]
    });
  });

  bussesDefinitions.forEach((entry) => {
    const schema = bussesSchemas.value?.[entry.key];
    if (isMultiInstanceBusKey(entry.key)) {
      getBusInstances(entry.key).forEach((instance, index) => {
        pushEntry({
          scopeId: `tab:Busses:${entry.key}:${index}`,
          label: `busses.${entry.key}[${index}]`,
          componentId: entry.schemaId,
          config: instance,
          schema
        });
      });
      return;
    }
    pushEntry({
      scopeId: `tab:Busses:${entry.key}`,
      label: `busses.${entry.key}`,
      componentId: entry.schemaId,
      config: bussesCoreConfig.value?.[entry.key] || {},
      schema
    });
  });

  otherDefinitions.forEach((entry) => {
    pushEntry({
      scopeId: "tab:System",
      label: `system.${entry.key}`,
      componentId: entry.schemaId,
      config: systemConfig.value?.[entry.key] || {},
      schema: otherSchemas.value?.[entry.key]
    });
  });

  automationDefinitions.forEach((entry) => {
    pushEntry({
      scopeId: `tab:Automation:${entry.key}`,
      label: `automation.${entry.key}`,
      componentId: entry.schemaId,
      config: automationCoreConfig.value || {},
      schema: automationSchemas.value?.[entry.key]
    });
  });

  (config.value.components || []).forEach((entry, index) => {
    const componentId = componentIdFromEntry(entry);
    if (!componentId) return;
    const schema = componentSchemas.value?.[componentId];
    const name = componentEntryLabel(entry) || componentId.split(/[./]/).pop() || "component";
    pushEntry({
      scopeId: `component:${index}`,
      label: name,
      componentId,
      config: entry?.config || {},
      schema
    });
  });

  return entries;
});

const gpioUsageIndex = computed(() => {
  const transport = networkCoreConfig.value?.transport;
  const detailFields = networkDetailSchema.value?.fields || [];
  const detailConfig = transport ? config.value.networkCore || {} : null;
  const extraConfigs = detailConfig ? [{ config: detailConfig, fields: detailFields }] : [];

  const bussesExtra = [];
  bussesDefinitions.forEach((entry) => {
    if (!resolveBusEnabled(entry.key)) return;
    const schema = bussesSchemas.value?.[entry.key];
    if (!schema?.fields) return;
    if (isMultiInstanceBusKey(entry.key)) {
      getBusInstances(entry.key).forEach((instance) => {
        bussesExtra.push({
          config: instance,
          fields: schema.fields
        });
      });
      return;
    }
    bussesExtra.push({
      config: bussesCoreConfig.value?.[entry.key] || {},
      fields: schema.fields
    });
  });

  return buildGpioUsageIndex(
    config.value.components,
    componentSchemas.value,
    [...extraConfigs, ...bussesExtra],
    componentIdFromEntry
  );
});

// Global registry for cross-schema visibility (globalDependsOn).
const globalStore = computed(() => {
  const entries = [];
  const pushEntry = (configValue, fields) => {
    if (Array.isArray(fields) && fields.length) {
      entries.push({ config: configValue, fields });
    }
  };

  pushEntry(esphomeCoreConfig.value, esphomeCoreSchema.value?.fields);
  pushEntry(substitutionsCoreConfig.value, substitutionsCoreSchema.value?.fields);
  pushEntry(platformCoreConfig.value, platformCoreSchema.value?.fields);
  pushEntry(platformCoreConfig.value, platformDetailSchema.value?.fields);
  pushEntry(networkCoreConfig.value, networkCoreSchema.value?.fields);
  pushEntry(networkCoreConfig.value, networkDetailSchema.value?.fields);
  pushEntry(systemConfig.value?.logger || {}, otherSchemas.value?.logger?.fields);
  pushEntry(systemConfig.value?.status_led || {}, otherSchemas.value?.status_led?.fields);
  pushEntry(systemConfig.value?.debug || {}, otherSchemas.value?.debug?.fields);
  pushEntry(systemConfig.value?.psram || {}, otherSchemas.value?.psram?.fields);
  pushEntry(automationCoreConfig.value || {}, automationSchemas.value?.deep_sleep?.fields);
  pushEntry(automationCoreConfig.value || {}, automationSchemas.value?.script?.fields);
  pushEntry(automationCoreConfig.value || {}, automationSchemas.value?.globals?.fields);
  pushEntry(automationCoreConfig.value || {}, automationSchemas.value?.interval?.fields);

  (config.value.components || []).forEach((entry) => {
    const componentId = componentIdFromEntry(entry);
    if (!componentId) return;
    const schema = componentSchemas.value?.[componentId];
    if (!schema?.fields) return;
    pushEntry(entry?.config || {}, schema.fields);
  });

  return buildGlobalRegistry(entries);
});

const {
  formErrors,
  formErrorScopeIds,
  hasTabErrors,
  idIndex,
  idRegistry,
  nameRegistry
} = useBuilderValidation({
  schemaEntries,
  displayImages,
  mdiIcons
});

const hasComponentErrors = (index) => formErrorScopeIds.value.has(`component:${index}`);

const previewMode = computed({
  get: () => (splitPreviewEnabled.value ? "tabs" : "single"),
  set: (value) => {
    splitPreviewEnabled.value = value === "tabs";
  }
});
const previewSyncRequest = ref(0);
// { pageIndex, uiId, token } -- YAML preview line click -> select that LVGL widget.
const lvglExternalSelect = ref(null);
// { scopeId, path, token } -- LVGL inspector edit -> pulse the matching preview line.
const lvglPreviewPulse = ref(null);

watch(
  () => splitPreviewEnabled.value,
  (value) => {
    if (!config.value.ui || typeof config.value.ui !== "object") {
      config.value.ui = {};
    }
    config.value.ui.splitPreview = Boolean(value);
    try {
      localStorage.setItem("vebBuilderSplitPreview", value ? "1" : "0");
    } catch (error) {
      console.error("Failed to store preview mode", error);
    }
    saveConfig();
  }
);

watch(
  () => activeModeLevel.value,
  (value) => {
    if (!config.value.ui || typeof config.value.ui !== "object") {
      config.value.ui = {};
    }
    config.value.ui.modeLevel = resolveModeLevel(value);
    saveConfig();
  }
);

const selectComponent = async (item) => {
  if (activeComponentSlot.value === null) return;
  if (!isComponentAvailable(item)) return;
  if (isResolvingComponentSelection.value) return;
  isResolvingComponentSelection.value = true;
  try {
    const index = activeComponentSlot.value;
    const isNewComponent = index >= config.value.components.length;
    const existing = config.value.components[index];
    const existingId = componentIdFromEntry(existing);
    const selectedCatalogKey = String(item?.catalogKey || item?.path || item?.id || "").trim();
    const prefillConfig =
      existingId === item.id
        ? null
        : item?.prefillConfig && typeof item.prefillConfig === "object"
          ? JSON.parse(JSON.stringify(item.prefillConfig))
          : null;
    const schemaResolution = await ensureComponentSchema(item.id, normalizeSchemaPath(item.schemaPath));
    if (schemaResolution.status !== "ready") return;
    if (getRootMapConflictDomain(item.id, index)) return;
    const nextEntry = {
      id: item.id,
      catalogKey: selectedCatalogKey,
      config: existingId === item.id ? existing?.config || {} : prefillConfig || {},
      customConfig: existingId === item.id ? existing?.customConfig || "" : ""
    };
    if (index >= config.value.components.length) {
      config.value.components.push(nextEntry);
    } else {
      config.value.components.splice(index, 1, nextEntry);
    }
    if (isNewComponent) {
      queuePulseForAddedComponent(nextEntry, item.id);
    }
    isComponentPickerOpen.value = false;
  } finally {
    isResolvingComponentSelection.value = false;
  }
};

const handleSelectBlur = (event) => {
  event?.target?.blur?.();
};

const handleBackToDashboard = () => {
  window.dispatchEvent(
    new CustomEvent("app:route-switch-request", {
      detail: { routeName: "dashboard" }
    })
  );
};

const requestRemoveComponent = (index) => {
  pendingRemoveIndex.value = index;
  confirmAction.value = "remove-component";
  confirmOpen.value = true;
};

const confirmRemove = async () => {
  if (confirmAction.value === "delete-custom") {
    confirmOpen.value = false;
    await deleteSavedCustomComponent();
    confirmAction.value = null;
    return;
  }
  if (pendingRemoveIndex.value === null) return;
  config.value.components.splice(pendingRemoveIndex.value, 1);
  activeComponentSlot.value = null;
  pendingRemoveIndex.value = null;
  confirmAction.value = null;
  confirmOpen.value = false;
  addComponentSlot();
  saveConfig();
};

const cancelRemove = () => {
  pendingRemoveIndex.value = null;
  clearPendingDeleteSavedCustomComponent();
  confirmAction.value = null;
  confirmOpen.value = false;
};

function defaultConfig() {
  return createDefaultBuilderConfig();
}

const cloneConfigForPersistence = (source) => {
  if (!source || typeof source !== "object") return defaultConfig();
  let payload;
  try {
    payload = JSON.parse(safeStringify(source));
  } catch {
    payload = defaultConfig();
  }
  if (!payload || typeof payload !== "object") {
    payload = defaultConfig();
  }
  delete payload.isModified;
  if (payload.ui && typeof payload.ui === "object") {
    delete payload.ui.isModified;
    delete payload.ui.isSaved;
  }
  payload.isSaved = payload.isSaved === true;
  return payload;
};

const buildConfigFingerprint = (source) => {
  const payload = cloneConfigForPersistence(source);
  delete payload.isSaved;
  // Runtime deployment metadata is persisted, but it must not mark the editor dirty.
  // Dirty/saved reflects user-editable project content only.
  delete payload.deployment;
  return safeStringify(payload);
};

const persistedConfigFingerprint = ref("");

const resolveEmitModeForGeneration = (field) => {
  const mode = field?.emitYAML;
  if (mode === "never" || mode === "always" || mode === "visible" || mode === "dependsOn") {
    return mode;
  }
  if (field?.dependsOn || field?.globalDependsOn) return "dependsOn";
  return "visible";
};

const hasSatisfiedDependencies = (field, valueMap, schemaFields, globalStore) =>
  isSchemaFieldVisible(field, valueMap, schemaFields, globalStore);

const shouldConsiderFieldForGeneration = (field, valueMap, schemaFields, globalStore) => {
  const emitMode = resolveEmitModeForGeneration(field);
  if (emitMode === "never") return false;
  if (emitMode === "always") return true;
  const dependencySatisfied = hasSatisfiedDependencies(field, valueMap, schemaFields, globalStore);
  if (emitMode === "dependsOn") {
    if (field?.dependsOn || field?.globalDependsOn) return dependencySatisfied;
    return dependencySatisfied;
  }
  return dependencySatisfied;
};

const hasGeneratedPasswordValue = (value) => {
  return hasGeneratedPasswordSeedValue(value);
};

const hasGeneratablePasswordCandidate = (fields, valueMap, globalStore) => {
  if (!Array.isArray(fields) || !fields.length) return false;

  return fields.some((field) => {
    const key = field?.key;
    if (!key) return false;
    if (!shouldConsiderFieldForGeneration(field, valueMap, fields, globalStore)) return false;

    if (field.type === "password") {
      const spec = resolveGenerationSpec(field);
      return spec.mode !== "none" && spec.onEmpty;
    }

    const currentValue = valueMap?.[key];
    if (field.type === "object") {
      const nestedValue =
        currentValue && typeof currentValue === "object" && !Array.isArray(currentValue)
          ? currentValue
          : {};
      return hasGeneratablePasswordCandidate(field.fields || [], nestedValue, globalStore);
    }

    if (isObjectArrayLikeField(field, currentValue)) {
      return currentValue.some(
        (entry) =>
          entry &&
          typeof entry === "object" &&
          !Array.isArray(entry) &&
          hasGeneratablePasswordCandidate(field.item.fields, entry, globalStore)
      );
    }

    return false;
  });
};

const materializeGeneratedPasswordsInObject = (valueMap, fields, globalStore) => {
  if (!valueMap || typeof valueMap !== "object" || !Array.isArray(fields)) return false;

  let changed = false;

  fields.forEach((field) => {
    const key = field?.key;
    if (!key) return;
    if (!shouldConsiderFieldForGeneration(field, valueMap, fields, globalStore)) return;

    if (field.type === "password") {
      const spec = resolveGenerationSpec(field);
      if (spec.mode === "none" || !spec.onEmpty) return;
      const currentValue = valueMap[key];
      if (hasGeneratedPasswordValue(currentValue)) return;
      const generated = generateFieldValue(field);
      if (!generated) return;
      valueMap[key] = generated;
      changed = true;
      return;
    }

    const currentValue = valueMap[key];

    if (field.type === "object") {
      let nestedValue =
        currentValue && typeof currentValue === "object" && !Array.isArray(currentValue)
          ? currentValue
          : null;
      if (!nestedValue) {
        const hasCandidate = hasGeneratablePasswordCandidate(field.fields || [], {}, globalStore);
        if (!hasCandidate) return;
        valueMap[key] = {};
        nestedValue = valueMap[key];
        changed = true;
      }
      if (materializeGeneratedPasswordsInObject(nestedValue, field.fields || [], globalStore)) {
        changed = true;
      }
      return;
    }

    if (isObjectArrayLikeField(field, currentValue)) {
      currentValue.forEach((entry) => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) return;
        if (materializeGeneratedPasswordsInObject(entry, field.item.fields, globalStore)) {
          changed = true;
        }
      });
    }
  });

  return changed;
};

const materializeGeneratedPasswordsBySchemas = () => {
  const targetConfig = config.value;
  if (!targetConfig || typeof targetConfig !== "object") return false;

  const currentGlobalStore = globalStore.value || {};
  let changed = false;

  const processRootSection = (container, key, fields) => {
    if (!Array.isArray(fields) || !fields.length) return;
    if (!container || typeof container !== "object") return;

    let sectionValue = container[key];
    if (!sectionValue || typeof sectionValue !== "object" || Array.isArray(sectionValue)) {
      if (!hasGeneratablePasswordCandidate(fields, {}, currentGlobalStore)) return;
      container[key] = {};
      sectionValue = container[key];
      changed = true;
    }

    if (materializeGeneratedPasswordsInObject(sectionValue, fields, currentGlobalStore)) {
      changed = true;
    }
  };

  processRootSection(targetConfig, "esphomeCore", esphomeCoreSchema.value?.fields || []);
  processRootSection(targetConfig, "substitutions", substitutionsCoreSchema.value?.fields || []);
  processRootSection(targetConfig, "platformCore", platformCoreSchema.value?.fields || []);
  if (targetConfig.platformCore && typeof targetConfig.platformCore === "object") {
    if (
      materializeGeneratedPasswordsInObject(
        targetConfig.platformCore,
        platformDetailSchema.value?.fields || [],
        currentGlobalStore
      )
    ) {
      changed = true;
    }
  }

  processRootSection(targetConfig, "networkCore", networkCoreSchema.value?.fields || []);
  if (targetConfig.networkCore && typeof targetConfig.networkCore === "object") {
    if (
      materializeGeneratedPasswordsInObject(
        targetConfig.networkCore,
        networkDetailSchema.value?.fields || [],
        currentGlobalStore
      )
    ) {
      changed = true;
    }
  }

  if (!targetConfig.protocolsCore || typeof targetConfig.protocolsCore !== "object") {
    targetConfig.protocolsCore = {};
    changed = true;
  }
  protocolDefinitions.forEach((entry) => {
    processRootSection(targetConfig.protocolsCore, entry.key, protocolsSchemas.value?.[entry.key]?.fields || []);
  });

  if (!targetConfig.bussesCore || typeof targetConfig.bussesCore !== "object") {
    targetConfig.bussesCore = {};
    changed = true;
  }
  bussesDefinitions.forEach((entry) => {
    processRootSection(targetConfig.bussesCore, entry.key, bussesSchemas.value?.[entry.key]?.fields || []);
  });

  if (!targetConfig.system || typeof targetConfig.system !== "object") {
    targetConfig.system = {};
    changed = true;
  }
  otherDefinitions.forEach((entry) => {
    processRootSection(targetConfig.system, entry.key, otherSchemas.value?.[entry.key]?.fields || []);
  });

  if (!targetConfig.automation || typeof targetConfig.automation !== "object") {
    targetConfig.automation = {};
    changed = true;
  }
  if (Object.prototype.hasOwnProperty.call(targetConfig.automation, "time")) {
    delete targetConfig.automation.time;
    changed = true;
  }
  automationDefinitions.forEach((entry) => {
    if (
      materializeGeneratedPasswordsInObject(
        targetConfig.automation,
        automationSchemas.value?.[entry.key]?.fields || [],
        currentGlobalStore
      )
    ) {
      changed = true;
    }
  });

  (targetConfig.components || []).forEach((entry) => {
    const componentId = componentIdFromEntry(entry);
    if (!componentId) return;
    const fields = componentSchemas.value?.[componentId]?.fields || [];
    if (!fields.length) return;
    if (!entry.config || typeof entry.config !== "object") {
      entry.config = {};
      changed = true;
    }
    if (materializeGeneratedPasswordsInObject(entry.config, fields, currentGlobalStore)) {
      changed = true;
    }
  });

  return changed;
};

const isHydrating = ref(true);
let isMaterializingGeneratedPasswords = false;

// True for a tick after a deterministic post-load normalization (generated
// passwords, framework default) mutates config. The baseline fingerprint is
// snapshotted in loadConfig() before any schema loads, so those later fills
// would otherwise make an untouched saved project open showing "*". While the
// flag is set the config deep-watcher advances the baseline instead.
let autoNormalizationInFlight = false;
const flagAutoNormalization = () => {
  autoNormalizationInFlight = true;
  nextTick(() => {
    autoNormalizationInFlight = false;
  });
};

const runGeneratedPasswordMaterialization = () => {
  if (isHydrating.value) return;
  if (isMaterializingGeneratedPasswords) return;
  isMaterializingGeneratedPasswords = true;
  let changed = false;
  try {
    changed = materializeGeneratedPasswordsBySchemas();
  } finally {
    isMaterializingGeneratedPasswords = false;
  }
  if (changed) flagAutoNormalization();
};

const gpioGuideFallbackTitle = computed(() => {
  if (gpioGuide.value?.title) return gpioGuide.value.title;
  if (platformForGpio.value === "esp8266") return "ESP8266";
  if (platformForGpio.value === "esp32") {
    return platformVariantForGpio.value || "esp32";
  }
  return "";
});

watch(
  () => formErrors.value.length,
  (count) => {
    if (!count) {
      formErrorsModalOpen.value = false;
    }
  }
);

watch(
  () => config.value,
  () => {
    runGeneratedPasswordMaterialization();
  },
  { deep: true, immediate: true }
);

watch(
  () => [
    esphomeCoreSchema.value,
    substitutionsCoreSchema.value,
    platformCoreSchema.value,
    platformDetailSchema.value,
    networkCoreSchema.value,
    networkDetailSchema.value,
    protocolsSchemas.value,
    bussesSchemas.value,
    otherSchemas.value,
    automationSchemas.value,
    componentSchemas.value
  ],
  () => {
    runGeneratedPasswordMaterialization();
  },
  { deep: true }
);


// Safe stringify to avoid circular refs breaking persistence/preview.
const safeStringify = (value) => {
  const seen = new WeakSet();
  return JSON.stringify(
    value,
    (key, val) => {
      if (typeof val === "function") return undefined;
      if (typeof val === "object" && val !== null) {
        if (seen.has(val)) return undefined;
        seen.add(val);
      }
      return val;
    },
    2
  );
};

const jsonPreview = computed(() => safeStringify(config.value));

const { yamlPreviewDocument, yamlPreview, previewTabs } = useBuilderYamlPreview({
  config,
  substitutionsCoreSchema,
  esphomeCoreSchema,
  platformCoreConfig,
  platformDetailSchema,
  networkCoreConfig,
  networkDetailSchema,
  networkCoreSchema,
  protocolsCoreConfig,
  protocolsSchemas,
  protocolDefinitions,
  enabledProtocolKeys,
  otherSchemas,
  systemConfig,
  automationSchemas,
  automationCoreConfig,
  automationDefinitions,
  generatedAutomation,
  bussesCoreConfig,
  bussesSchemas,
  bussesDefinitions,
  resolveBusEnabled,
  getBusInstances,
  componentSchemas,
  componentSchemaStatus,
  componentIdFromEntry: (entry) => componentIdFromEntry(entry),
  parseComponentId,
  mdiSubstitutions,
  globalStore,
  hubDomainsInUse,
  substitutionsCoreScopeId,
  esphomeCoreScopeId,
  platformDetailScopeId,
  networkDetailScopeId,
  networkOtaScopeId,
  networkWebServerScopeId,
  lvglWidgetSchemas
});

const resolvePreviewTabKeyFromMain = () => {
  if (activeTab.value === "Busses") return "busses";
  if (activeTab.value === "Automation") return "automation";
  if (activeTab.value === "LVGL") return "lvgl";
  if (activeTab.value === "Components") {
    const componentId = activeComponentId.value || "";
    const schema = componentSchemas.value?.[componentId];
    if (schema?.renderStrategy === "verbatim_root") {
      return "custom";
    }
    const previewGroup = typeof schema?.previewGroup === "string" ? schema.previewGroup.trim() : "";
    if (previewGroup) {
      return `preview-group:${previewGroup}`;
    }
    const entryConfig = activeComponentEntry.value?.config && typeof activeComponentEntry.value.config === "object"
      ? activeComponentEntry.value.config
      : {};
    const fallbackDomain = String(schema?.domain || parseComponentId(componentId).domain || "").trim();
    const domainBy = typeof schema?.domainBy === "string" ? schema.domainBy.trim() : "";
    const domainMap = schema?.domainMap && typeof schema.domainMap === "object" && !Array.isArray(schema.domainMap)
      ? schema.domainMap
      : null;
    const mappedDomainValue = domainBy ? entryConfig?.[domainBy] : undefined;
    const mappedDomain =
      domainMap && mappedDomainValue !== undefined && domainMap[String(mappedDomainValue)]
        ? String(domainMap[String(mappedDomainValue)]).trim()
        : "";
    const domain = mappedDomain || fallbackDomain;
    if (!domain) return "";
    if (domain === "display") return "display";
    if (ASSET_PREVIEW_BLOCK_KEYS.has(domain)) return "assets";
    return domain;
  }
  return "core";
};
const mainPreviewTargetKey = computed(() => resolvePreviewTabKeyFromMain());
const displayAutomationHasInterval = computed(() => (generatedAutomation.value?.interval || []).length > 0);
const hubNoticeDomains = computed(() => Array.from(componentDomainsUsingHubs.value));

let yamlFocusPulseTimer = null;
let yamlFocusRequestId = 0;

const ensureYamlOriginModeVisible = (modeLevel) => {
  if (!modeLevel) return;
  const target = normalizeModeLevel(modeLevel);
  if (modeLevelRank(target) > modeLevelRank(activeModeLevel.value)) {
    activeModeLevel.value = target;
  }
};

const activateYamlOriginScope = (origin) => {
  const scopeId = String(origin?.scopeId || "");
  if (!scopeId) return;
  if (scopeId.startsWith("component:")) {
    const index = Number.parseInt(scopeId.slice("component:".length), 10);
    if (Number.isInteger(index) && index >= 0 && index < (config.value.components || []).length) {
      openComponentViewer(index);
    }
    return;
  }
  if (scopeId.startsWith("lvgl:")) {
    activeTab.value = "LVGL";
    const parts = scopeId.split(":"); // lvgl:page:<i>:widget:<uiId>
    const pageIndex = Number.parseInt(parts[2], 10);
    lvglExternalSelect.value = {
      pageIndex: Number.isInteger(pageIndex) ? pageIndex : 0,
      uiId: parts[4] || "",
      token: (lvglExternalSelect.value?.token || 0) + 1
    };
    return;
  }
  if (scopeId.startsWith("tab:Busses:")) {
    activeTab.value = "Busses";
    const [, , key, index] = scopeId.split(":");
    if (key) activeBussesKey.value = key;
    return;
  }
  if (scopeId.startsWith("tab:Protocols:")) {
    activeTab.value = "Protocols";
    const [, , key] = scopeId.split(":");
    if (key) activeProtocolKey.value = key;
    return;
  }
  if (scopeId.startsWith("tab:System:")) {
    activeTab.value = "System";
    const [, , key] = scopeId.split(":");
    if (key) activeOtherKey.value = key;
    return;
  }
  if (scopeId.startsWith("tab:Automation:")) {
    activeTab.value = "Automation";
    const [, , key] = scopeId.split(":");
    if (key) activeAutomationKey.value = key;
    return;
  }
  if (scopeId.startsWith("tab:Network")) {
    activeTab.value = "Network";
    return;
  }
  if (scopeId.startsWith("tab:Platform")) {
    activeTab.value = "Platform";
    return;
  }
  if (scopeId.startsWith("tab:Core")) {
    activeTab.value = "Core";
  }
};

const findYamlFocusTarget = (scopeId, path = [], { allowAncestorFallback = true } = {}) => {
  const encodedPath = encodeFieldPath(path);
  const candidates = Array.from(document.querySelectorAll(`[data-schema-scope-id="${scopeId}"]`));
  const exactMatch = candidates.find((element) => element.getAttribute("data-schema-field-path") === encodedPath);
  if (exactMatch || !allowAncestorFallback) return exactMatch || null;

  for (let length = path.length - 1; length >= 0; length -= 1) {
    const ancestorPath = encodeFieldPath(path.slice(0, length));
    const ancestorMatch = candidates.find((element) => element.getAttribute("data-schema-field-path") === ancestorPath);
    if (ancestorMatch) return ancestorMatch;
  }
  return null;
};

const findYamlSectionTarget = (scopeId) =>
  document.querySelector(`[data-schema-scope-id="${scopeId}"][data-schema-target="scope"]`);

const findYamlRawTarget = (scopeId) =>
  document.querySelector(`[data-schema-scope-id="${scopeId}"][data-schema-target="custom-config"]`);

const waitForYamlFocusTarget = async (scopeId, path = [], requestId, maxFrames = 45) => {
  for (let attempt = 0; attempt < maxFrames; attempt += 1) {
    if (requestId !== yamlFocusRequestId) return null;
    await nextTick();
    // The renderer container exists before its schema fields. Do not pulse that
    // container while waiting for the exact field after a tab switch.
    const target = findYamlFocusTarget(scopeId, path, { allowAncestorFallback: false });
    if (target) return target;
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
  return requestId === yamlFocusRequestId ? findYamlFocusTarget(scopeId, path) : null;
};

const waitForYamlTarget = async (findTarget, requestId, maxFrames = 45) => {
  for (let attempt = 0; attempt < maxFrames; attempt += 1) {
    if (requestId !== yamlFocusRequestId) return null;
    await nextTick();
    const target = findTarget();
    if (target) return target;
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
  return requestId === yamlFocusRequestId ? findTarget() : null;
};

const pulseYamlFocusTarget = (element, { scrollBehavior = "smooth" } = {}) => {
  if (!element) return;
  if (yamlFocusPulseTimer) {
    clearTimeout(yamlFocusPulseTimer);
    yamlFocusPulseTimer = null;
  }
  document.querySelectorAll(".schema-field--yaml-focus").forEach((node) => {
    node.classList.remove("schema-field--yaml-focus");
  });
  element.classList.remove("schema-field--yaml-focus");
  void element.offsetWidth;
  element.classList.add("schema-field--yaml-focus");
  element.scrollIntoView({ block: "center", behavior: scrollBehavior });
  yamlFocusPulseTimer = setTimeout(() => {
    element.classList.remove("schema-field--yaml-focus");
    yamlFocusPulseTimer = null;
  }, 1100);
};

const handleYamlLineClick = async (line) => {
  const origin = line?.origin;
  if (!origin?.scopeId) return;
  const requestId = ++yamlFocusRequestId;
  activateYamlOriginScope(origin);
  ensureYamlOriginModeVisible(origin.modeLevel);
  if (origin.suppressFocus) return;
  const target = origin.type === "section"
    ? await waitForYamlTarget(() => findYamlSectionTarget(origin.scopeId), requestId)
    : origin.contentKind === "raw_yaml"
      ? await waitForYamlTarget(() => findYamlRawTarget(origin.scopeId), requestId)
      : await waitForYamlFocusTarget(origin.scopeId, origin.path || [], requestId);
  if (requestId !== yamlFocusRequestId) return;
  pulseYamlFocusTarget(target, { scrollBehavior: origin.type === "section" ? "auto" : "smooth" });
};

onMounted(() => {
  initializeDeployment();
  window.addEventListener("keydown", handleBuilderKeydown);
  window.addEventListener("app:builder-export", handleAppExport);
  window.addEventListener("app:install-option", handleAppInstallOption);
  window.addEventListener("app:builder-logs", handleAppLogs);
  window.addEventListener("app:validate", handleAppValidate);
  window.addEventListener("app:builder-save-request", handleBuilderSaveRequest);
  emitCompileState();
});


const exportYaml = () => {
  if (formErrors.value.length) {
    formErrorsModalOpen.value = true;
    return;
  }
  const blob = new Blob([yamlPreview.value], { type: "text/yaml" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = projectFilename.value || "config.yaml";
  anchor.click();
  URL.revokeObjectURL(url);
};

const handleAppExport = () => {
  exportYaml();
};

const saveConfig = () => {
  if (isHydrating.value) return;
  try {
    const payload = safeStringify(cloneConfigForPersistence(config.value));
    localStorage.setItem(BUILDER_CONFIG_STORAGE_KEY, payload);
  } catch (error) {
    console.error("Failed to save config", error);
  }
};

const markProjectDirty = () => {
  if (config.value?.isSaved !== false) {
    config.value.isSaved = false;
  }
  saveConfig();
};

const markProjectSavedFromCurrentState = () => {
  persistedConfigFingerprint.value = buildConfigFingerprint(config.value);
  config.value.isSaved = true;
  saveConfig();
};

// Section/component YAML comments -- edited through CommentEditModal, stored the same way
// the importer captures them (config.fieldComments keyed by domain/path, config.headerComment).
const commentEditRequest = ref(null); // { key, title, scope: "field" | "header" }

const commentEditValue = computed(() => {
  const request = commentEditRequest.value;
  if (!request) return "";
  if (request.scope === "header") return config.value.headerComment || "";
  return config.value.fieldComments?.[request.key] || "";
});

const openCommentEditor = ({ key = "", title = "Kommentar", scope = "field" }) => {
  if (scope === "field" && !key) return;
  commentEditRequest.value = { key, title, scope };
};

const closeCommentEditor = () => {
  commentEditRequest.value = null;
};

const saveComment = (text) => {
  const request = commentEditRequest.value;
  if (!request) return;
  if (request.scope === "header") {
    config.value.headerComment = text;
  } else {
    if (!config.value.fieldComments || typeof config.value.fieldComments !== "object") {
      config.value.fieldComments = {};
    }
    config.value.fieldComments[request.key] = text;
  }
  markProjectDirty();
  closeCommentEditor();
};

const deleteComment = () => {
  const request = commentEditRequest.value;
  if (!request) return;
  if (request.scope === "header") {
    config.value.headerComment = "";
  } else if (config.value.fieldComments && request.key in config.value.fieldComments) {
    delete config.value.fieldComments[request.key];
  }
  markProjectDirty();
  closeCommentEditor();
};

const activeComponentCommentKey = computed(() => {
  const schema = activeComponentSchema.value;
  if (!schema) return "";
  return resolveSchemaDomain(schema, activeComponentConfig.value || {});
});

const activeComponentHasComment = computed(() =>
  Boolean(activeComponentCommentKey.value && config.value.fieldComments?.[activeComponentCommentKey.value])
);

const openActiveComponentCommentEditor = () => {
  const key = activeComponentCommentKey.value;
  if (!key) return;
  openCommentEditor({ key, title: t("builder.comment.componentTitle", { domain: key }) });
};

// "+ define a new one" flow behind creatable id_ref fields. IdRefField injects
// requestIdDefinition; on confirm we append a real config.components[] entry (mirroring
// selectComponent) so its id flows into idIndex and the dropdown next tick.
const ID_DEFINITION_CATALOG = { image: "image/file", font: "font/font" };

const idDefinitionRequest = ref(null); // { domain, item, resolve }

const requestIdDefinition = (domain, { initialName = "" } = {}) =>
  new Promise((resolve) => {
    const catalogId = ID_DEFINITION_CATALOG[domain];
    const item = catalogId ? componentCatalogItemsById.value.get(catalogId) : null;
    if (!item) {
      resolve(null);
      return;
    }
    idDefinitionRequest.value = { domain, item, initialName, resolve };
  });

provide("requestIdDefinition", requestIdDefinition);

const idDefinitionExistingIds = computed(() => {
  const domain = idDefinitionRequest.value?.domain;
  if (!domain) return [];
  return (idIndex.value || []).filter((entry) => entry.domain === domain).map((entry) => entry.id);
});

const resolveIdDefinition = (result) => {
  const request = idDefinitionRequest.value;
  idDefinitionRequest.value = null;
  if (request) request.resolve(result || null);
};

const confirmIdDefinition = async (draftConfig) => {
  const request = idDefinitionRequest.value;
  if (!request) return;
  const { item } = request;
  const resolution = await ensureComponentSchema(item.id, normalizeSchemaPath(item.schemaPath));
  const newId = String(draftConfig?.id || "").trim();
  if (resolution.status !== "ready" || !newId) {
    resolveIdDefinition(null);
    return;
  }
  config.value.components.push({
    id: item.id,
    catalogKey: String(item.catalogKey || item.path || item.id).trim(),
    config: JSON.parse(JSON.stringify(draftConfig)),
    customConfig: ""
  });
  markProjectDirty();
  resolveIdDefinition(newId);
};

const cancelIdDefinition = () => resolveIdDefinition(null);

const assetsBase = apiUrl("api/assets/");
const localComponentCatalogUrl = new URL("components_list/components_list.json", window.location.href).toString();

const buildAddonUrl = apiUrl;
const addonFetch = apiFetch;

const encodePathSegments = (value) =>
  String(value || "")
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join("/");

const toApiErrorMessage = (payload, fallback) => {
  const message = typeof payload?.message === "string" ? payload.message.trim() : "";
  if (message) return message;
  return fallback;
};

const toAssetFileSet = (items) =>
  new Set(
    (items || [])
      .map((item) => String(item?.file || "").trim())
      .filter((value) => Boolean(value))
  );

const getDefaultGoogleFont = () => {
  const first = displayGoogleFonts.value[0];
  if (!first) return null;
  const variant = first.variants?.includes("regular") ? "regular" : first.variants?.[0] || "regular";
  const { style, weight } = deriveVariantStyle(variant);
  return {
    source: "google",
    family: first.family || "",
    variant,
    url: first.files?.[variant] || "",
    style,
    weight
  };
};

const applyTextFontFallback = (element, defaultGoogleFont) => {
  if (!defaultGoogleFont) {
    element.fontSource = "";
    element.fontFamily = "";
    element.fontVariant = "regular";
    element.fontUrl = "";
    element.fontFile = "";
    element.fontWeight = 400;
    element.fontStyle = "normal";
    return;
  }
  element.fontSource = "google";
  element.fontFamily = defaultGoogleFont.family;
  element.fontVariant = defaultGoogleFont.variant;
  element.fontUrl = defaultGoogleFont.url;
  element.fontFile = "";
  element.fontWeight = defaultGoogleFont.weight;
  element.fontStyle = defaultGoogleFont.style;
};

const applyLegendFontFallback = (element, prefix, defaultGoogleFont) => {
  if (!defaultGoogleFont) {
    element[`${prefix}FontSource`] = "";
    element[`${prefix}FontFamily`] = "";
    element[`${prefix}FontVariant`] = "regular";
    element[`${prefix}FontUrl`] = "";
    element[`${prefix}FontFile`] = "";
    element[`${prefix}FontWeight`] = 400;
    element[`${prefix}FontStyle`] = "normal";
    return;
  }
  element[`${prefix}FontSource`] = "google";
  element[`${prefix}FontFamily`] = defaultGoogleFont.family;
  element[`${prefix}FontVariant`] = defaultGoogleFont.variant;
  element[`${prefix}FontUrl`] = defaultGoogleFont.url;
  element[`${prefix}FontFile`] = "";
  element[`${prefix}FontWeight`] = defaultGoogleFont.weight;
  element[`${prefix}FontStyle`] = defaultGoogleFont.style;
};

const validateCurrentProjectAssetReferences = () => {
  const imageFiles = toAssetFileSet(displayImages.value);
  const animationFiles = new Set([...imageFiles].filter((file) => file.toLowerCase().endsWith(".gif")));
  const fontFiles = toAssetFileSet(displayFonts.value);
  const defaultGoogleFont = getDefaultGoogleFont();
  let changed = false;

  (config.value.components || []).forEach((entry) => {
    const layout = entry?.config?._display_builder;
    if (!layout || !Array.isArray(layout.elements)) return;
    layout.elements.forEach((element) => {
      if (!element || typeof element !== "object") return;
      if (element.type === "image") {
        const normalized = normalizeImageElementEncoding(element);
        if (
          element.imageType !== normalized.imageType ||
          element.imageTransparency !== normalized.imageTransparency ||
          Boolean(element.imageInvertAlpha ?? element.invert) !== normalized.imageInvertAlpha ||
          element.imageDither !== normalized.imageDither ||
          element.imageByteOrder !== normalized.imageByteOrder
        ) {
          Object.assign(element, normalized);
          changed = true;
        }
        const file = String(element.image || "").trim();
        if (file && !imageFiles.has(file)) {
          element.image = "";
          element.imageUrl = "";
          changed = true;
        }
      }
      if (element.type === "animation") {
        const normalized = normalizeAnimationElementEncoding(element);
        if (
          element.animationType !== normalized.animationType ||
          element.animationTransparency !== normalized.animationTransparency ||
          Boolean(element.animationInvertAlpha) !== normalized.animationInvertAlpha ||
          element.animationDither !== normalized.animationDither ||
          element.animationByteOrder !== normalized.animationByteOrder
        ) {
          Object.assign(element, normalized);
          changed = true;
        }
        const file = String(element.animationFile || "").trim();
        if (file && !animationFiles.has(file)) {
          element.animationFile = "";
          element.animationUrl = "";
          changed = true;
        }
      }
      if (element.type === "text") {
        const fontFile = String(element.fontFile || "").trim();
        if (String(element.fontSource || "") === "local" && fontFile && !fontFiles.has(fontFile)) {
          applyTextFontFallback(element, defaultGoogleFont);
          changed = true;
        }
      }
      if (element.type === "graph") {
        const nameFile = String(element.legendNameFontFile || "").trim();
        if (String(element.legendNameFontSource || "") === "local" && nameFile && !fontFiles.has(nameFile)) {
          applyLegendFontFallback(element, "legendName", defaultGoogleFont);
          changed = true;
        }
        const valueFile = String(element.legendValueFontFile || "").trim();
        if (String(element.legendValueFontSource || "") === "local" && valueFile && !fontFiles.has(valueFile)) {
          applyLegendFontFallback(element, "legendValue", defaultGoogleFont);
          changed = true;
        }
      }
    });
  });

  if (changed) {
    markProjectDirty();
  }

  return changed;
};

const refreshAssets = async (refresh = false, validateProject = false) => {
  assetsError.value = "";
  assetsLoading.value = true;
  try {
    const payload = await fetchAssetsManifest(addonFetch, { kind: "all", refresh });
    const images = Array.isArray(payload?.images?.items) ? payload.images.items : [];
    const fonts = Array.isArray(payload?.fonts?.items) ? payload.fonts.items : [];
    const audio = Array.isArray(payload?.audio?.items) ? payload.audio.items : [];
    displayImages.value = images.map((item) => ({
      ...item,
      url: buildAssetUrl(buildAddonUrl, "images", item.file)
    }));
    displayFonts.value = fonts.map((item) => ({
      ...item,
      url: buildAssetUrl(buildAddonUrl, "fonts", item.file)
    }));
    displayAudio.value = audio.map((item) => ({
      ...item,
      url: buildAssetUrl(buildAddonUrl, "audio", item.file)
    }));
    displayGoogleFonts.value = Array.isArray(payload?.googleFonts) ? payload.googleFonts : [];
    if (validateProject) {
      validateCurrentProjectAssetReferences();
    }
  } catch (error) {
    assetsError.value = error instanceof Error ? error.message : "Assets load failed";
    displayImages.value = [];
    displayFonts.value = [];
    displayAudio.value = [];
    displayGoogleFonts.value = [];
  } finally {
    assetsLoading.value = false;
  }
};

const openAssetManager = () => {
  assetManagerOpen.value = true;
};

const openAssetManagerFromSidebar = () => {
  openAssetManager();
};

const readApiError = async (response, fallbackMessage) => {
  try {
    const payload = await response.json();
    const error = typeof payload?.error === "string" ? payload.error.trim() : "";
    const details = typeof payload?.details === "string" ? payload.details.trim() : "";
    if (error && details) return `${error}: ${details}`;
    if (error) return error;
    if (details) return details;
  } catch {
    // ignore JSON parse errors
  }
  return fallbackMessage;
};

const loadSecretsRaw = async () => {
  secretsError.value = "";
  secretsLoading.value = true;
  try {
    const response = await addonFetch("api/secrets/raw");
    if (!response.ok) {
      throw new Error(await readApiError(response, `Secrets load failed (${response.status})`));
    }
    const payload = await response.json();
    secretsRawContent.value = typeof payload?.content === "string" ? payload.content : "";
  } catch (error) {
    secretsError.value = error instanceof Error ? error.message : "Secrets load failed";
    secretsRawContent.value = "";
  } finally {
    secretsLoading.value = false;
  }
};

const openSecretsModal = async () => {
  if (secretsLoading.value || secretsSaving.value) return;
  secretsModalOpen.value = true;
  await loadSecretsRaw();
};

const closeSecretsModal = () => {
  if (secretsSaving.value) return;
  secretsModalOpen.value = false;
  secretsError.value = "";
};

const handleSecretsSave = async (content) => {
  if (secretsLoading.value || secretsSaving.value) return;
  secretsError.value = "";
  secretsSaving.value = true;
  try {
    const response = await addonFetch("api/secrets/raw", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: typeof content === "string" ? content : "" })
    });
    if (!response.ok) {
      throw new Error(await readApiError(response, `Secrets save failed (${response.status})`));
    }
    secretsRawContent.value = typeof content === "string" ? content : "";
  } catch (error) {
    secretsError.value = error instanceof Error ? error.message : "Secrets save failed";
  } finally {
    secretsSaving.value = false;
  }
};

const handleAssetUpload = async ({ kind, file }) => {
  const normalizedKind = ["images", "fonts", "audio"].includes(String(kind || "").toLowerCase())
    ? String(kind).toLowerCase()
    : "";
  if (!normalizedKind || !file) {
    assetsError.value = "Invalid kind";
    return;
  }
  assetsError.value = "";
  assetsWorking.value = true;
  try {
    await uploadAsset(addonFetch, { kind: normalizedKind, file });
    await refreshAssets(true, true);
  } catch (error) {
    assetsError.value = error instanceof Error ? error.message : "Asset upload failed";
  } finally {
    assetsWorking.value = false;
  }
};

const handleAssetRename = async ({ kind, from, to }) => {
  const normalizedKind = ["images", "fonts", "audio"].includes(String(kind || "").toLowerCase())
    ? String(kind).toLowerCase()
    : "";
  if (!normalizedKind) {
    assetsError.value = "Invalid kind";
    return;
  }
  assetsError.value = "";
  assetsWorking.value = true;
  try {
    await renameAsset(addonFetch, { kind: normalizedKind, from, to });
    await refreshAssets(true, true);
  } catch (error) {
    assetsError.value = error instanceof Error ? error.message : "Asset rename failed";
  } finally {
    assetsWorking.value = false;
  }
};

const handleAssetDelete = async ({ kind, file }) => {
  const normalizedKind = ["images", "fonts", "audio"].includes(String(kind || "").toLowerCase())
    ? String(kind).toLowerCase()
    : "";
  if (!normalizedKind) {
    assetsError.value = "Invalid kind";
    return;
  }
  assetsError.value = "";
  assetsWorking.value = true;
  try {
    await deleteAsset(addonFetch, { kind: normalizedKind, file });
    await refreshAssets(true, true);
  } catch (error) {
    assetsError.value = error instanceof Error ? error.message : "Asset delete failed";
  } finally {
    assetsWorking.value = false;
  }
};

const {
  activeConnectionHost,
  canUseOtaInstall,
  canLogsForCurrentDevice,
  builderDeviceStatusLabel,
  builderDeviceStatusClass,
  hostFromYamlName,
  persistDeploymentAfterInstallSuccess,
  refreshCurrentDeviceStatus,
  emitProjectsUpdated,
  initialize: initializeDeployment,
  dispose: disposeDeployment
} = useBuilderDeployment({
  config,
  saveConfig,
  addonFetch,
  projectFilename,
  sourceProjectFilename,
  writeBuilderSessionProjectName,
  getCompileIsActive: () => compileIsActive.value
});

const isPrivateIp = (host) => {
  const parts = host.split(".");
  if (parts.length !== 4) return false;
  const nums = parts.map((value) => Number(value));
  if (nums.some((value) => Number.isNaN(value) || value < 0 || value > 255)) return false;
  if (nums[0] === 10) return true;
  if (nums[0] === 127) return true;
  if (nums[0] === 192 && nums[1] === 168) return true;
  if (nums[0] === 172 && nums[1] >= 16 && nums[1] <= 31) return true;
  return false;
};

const isLocalHostname = (host) => {
  if (!host) return false;
  const normalized = host.toLowerCase();
  if (normalized === "localhost" || normalized.endsWith(".local")) return true;
  if (normalized === "::1" || normalized === "[::1]") return true;
  return isPrivateIp(normalized);
};


const canInstallProject = computed(() => {
  const currentName = String(projectFilename.value || "").trim();
  const currentYaml = String(yamlPreview.value || "").trim();
  return Boolean(currentName && currentYaml);
});

const installFlow = useInstallConsoleFlow({
  canInstall: () => canInstallProject.value,
  canValidate: () => canInstallProject.value,
  canUseOta: () => canUseOtaInstall.value,
  canLogs: () => canLogsForCurrentDevice.value,
  getYamlName: () => projectFilename.value,
  getDeviceHost: () => activeConnectionHost.value,
  fetchApi: addonFetch,
  streamUrl: buildAddonUrl,
  setError: (message) => {
    projectSaveError.value = message;
  },
  clearError: () => {
    projectSaveError.value = "";
  },
  prepareBeforeJob: async () => {
    const saved = await handleProjectSave(true);
    if (!saved) {
      throw new Error(projectSaveError.value || "Project save failed before install");
    }
    return true;
  },
  onInstallSuccess: async (payload) => {
    await persistDeploymentAfterInstallSuccess(payload);
  },
  preferLongPoll: !isLocalHostname(window.location.hostname || "")
});

const {
  compileModalOpen,
  compileAutoScroll,
  compileLogLines,
  compileIsReconnecting,
  localFlashRunning,
  compileIsActive,
  canDownloadCompiledBinary,
  canCloseCompile,
  terminalTitle,
  compileStateLabel,
  compileStateClass,
  setCompileConsoleElement,
  toggleCompileAutoscroll,
  closeCompileModal,
  handleInstallSerialPort,
  handleInstallHaSerialPort,
  serialHaSelectionOpen,
  serialHaSelectionBusy,
  serialHaPorts,
  serialHaPortsLoading,
  serialHaPortsError,
  loadHaSerialPorts,
  selectHaSerialPort,
  handleInstallOta,
  startLogs,
  startValidate,
  handleInstallDownload,
  downloadBinary,
  dispose: disposeInstallFlow
} = installFlow;

const emitCompileState = () => {
  window.dispatchEvent(
    new CustomEvent("app:builder-compile-state", {
      detail: {
        canInstall: canInstallProject.value,
        canValidate: canInstallProject.value,
        canUseOta: canUseOtaInstall.value,
        canLogs: canLogsForCurrentDevice.value,
        canExport: true,
        running: compileIsActive.value || localFlashRunning.value,
        hasUnsavedChanges: !isProjectSaved.value
      }
    })
  );
};


const handleAppInstallOption = (event) => {
  if (!canInstallProject.value || compileIsActive.value || localFlashRunning.value || isProjectSaving.value) return;
  if (formErrors.value.length) {
    formErrorsModalOpen.value = true;
    return;
  }
  const detail = event?.detail && typeof event.detail === "object" ? event.detail : {};
  const mode = typeof detail.mode === "string" ? detail.mode : "";
  if (mode === "ota") {
    if (!canUseOtaInstall.value) return;
    handleInstallOta();
    return;
  }
  if (mode === "download") {
    handleInstallDownload();
    return;
  }
  if (mode === "serial-ha") {
    handleInstallHaSerialPort();
    return;
  }
  handleInstallSerialPort();
};

const handleAppLogs = () => {
  startLogs();
};

const handleAppValidate = () => {
  if (!canInstallProject.value || compileIsActive.value || localFlashRunning.value || isProjectSaving.value) return;
  if (formErrors.value.length) {
    formErrorsModalOpen.value = true;
    return;
  }
  startValidate();
};

const handleBuilderKeydown = (event) => {
  if (event.defaultPrevented) return;
  const key = String(event.key || "").toLowerCase();
  const saveShortcutPressed = (event.ctrlKey || event.metaKey) && key === "s";
  if (!saveShortcutPressed || event.altKey) return;
  event.preventDefault();
  if (event.repeat) return;
  handleProjectSave(true);
};

const handleBuilderSaveRequest = async (event) => {
  const detail = event?.detail && typeof event.detail === "object" ? event.detail : {};
  const requestId = typeof detail.requestId === "string" ? detail.requestId : "";
  if (!requestId) return;

  let success = false;
  let message = "";
  try {
    success = await handleProjectSave(true);
    if (!success) {
      message = projectSaveError.value || "Project save failed.";
    }
  } catch (error) {
    success = false;
    message = error instanceof Error ? error.message : "Project save failed.";
  }

  window.dispatchEvent(
    new CustomEvent("app:builder-save-response", {
      detail: { requestId, success, message }
    })
  );
};

watch(
  () => [
    canInstallProject.value,
    canLogsForCurrentDevice.value,
    compileIsActive.value,
    localFlashRunning.value,
    projectFilename.value,
    yamlPreview.value,
    isProjectSaved.value
  ],
  () => {
    emitCompileState();
  },
  { immediate: true }
);

// Single deep watch for config autosave: persists to localStorage on every change and,
// when editing an already-saved project, flips isSaved so the UI shows unsaved changes.
// Used to be two separate deep watchers (here + useBuilderComponentCatalog) both calling
// saveConfig() on every change; consolidated to avoid the double write.
watch(
  () => config.value,
  () => {
    if (!isHydrating.value && isProjectSaved.value && persistedConfigFingerprint.value) {
      const action = resolveDirtyState({
        isHydrating: false,
        isProjectSaved: true,
        baseline: persistedConfigFingerprint.value,
        currentFingerprint: buildConfigFingerprint(config.value),
        autoNormalizationInFlight
      });
      if (action === "dirty") {
        config.value.isSaved = false;
      } else if (action === "rebaseline") {
        persistedConfigFingerprint.value = buildConfigFingerprint(config.value);
      }
    }
    saveConfig();
  },
  { deep: true }
);

const { sanitizeProjectJsonFilename, handleProjectSave } = useBuilderProjectPersistence({
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

const normalizeComponentEntry = (entry) => {
  if (typeof entry === "string" && entry) {
    return { id: entry, config: {} };
  }

  if (entry && typeof entry === "object") {
    const id = typeof entry.id === "string" ? entry.id : "";
    if (!id) return null;
    const catalogKey = typeof entry.catalogKey === "string" ? entry.catalogKey : "";
    const config = entry.config && typeof entry.config === "object" ? entry.config : {};
    const customConfig = typeof entry.customConfig === "string" ? entry.customConfig : "";
    return { id, catalogKey, config, customConfig };
  }

  return null;
};

const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const isActionTriggerKey = (key) => typeof key === "string" && key.startsWith("on_");

const looksLikeFlatActionEntry = (value) => {
  if (!isPlainObject(value)) return false;
  if (Object.prototype.hasOwnProperty.call(value, "then")) return false;
  return (
    typeof value.type === "string" ||
    Object.prototype.hasOwnProperty.call(value, "schemaUrl") ||
    Object.prototype.hasOwnProperty.call(value, "fields") ||
    Object.prototype.hasOwnProperty.call(value, "config") ||
    Object.prototype.hasOwnProperty.call(value, "definitionError")
  );
};

const looksLikeThenOnlyTriggerEntry = (value) => {
  if (!isPlainObject(value)) return false;
  const keys = Object.keys(value);
  if (!keys.length) return true;
  if (keys.some((key) => key !== "then")) return false;
  return value.then === undefined || Array.isArray(value.then);
};

const normalizeAutomationTriggerShape = (root) => {
  const visit = (node) => {
    if (Array.isArray(node)) {
      node.forEach((item) => visit(item));
      return;
    }
    if (!isPlainObject(node)) return;

    Object.keys(node).forEach((key) => {
      const value = node[key];
      if (isActionTriggerKey(key) && Array.isArray(value) && value.length > 0) {
        const isFlatList = value.every((item) => looksLikeFlatActionEntry(item));
        if (isFlatList) {
          return;
        }

        const isThenOnlyList = value.every((item) => looksLikeThenOnlyTriggerEntry(item));
        if (isThenOnlyList) {
          node[key] = value.flatMap((item) =>
            Array.isArray(item?.then)
              ? item.then.filter((entry) => looksLikeFlatActionEntry(entry))
              : []
          );
        }
      }

      visit(node[key]);
    });
  };

  visit(root);
};

const normalizeConfig = (raw) => {
  const fallback = defaultConfig();
  if (!raw || typeof raw !== "object") {
    return fallback;
  }

  const { logger: legacyLogger, otherCore: legacyOtherCore, ...rawWithoutLegacy } = raw;
  delete rawWithoutLegacy.isModified;

  const merged = {
    ...fallback,
    ...rawWithoutLegacy,
    isSaved:
      typeof rawWithoutLegacy.isSaved === "boolean"
        ? rawWithoutLegacy.isSaved
        : true,
    device: {
      ...fallback.device,
      ...(raw.device ?? {})
    },
    components: Array.isArray(raw.components)
      ? raw.components.map(normalizeComponentEntry).filter(Boolean)
      : fallback.components,
    protocolsCore: {
      ...fallback.protocolsCore,
      ...(raw.protocolsCore ?? {})
    },
    bussesCore: normalizeBussesCoreConfig(raw.bussesCore ?? fallback.bussesCore),
    system: {
      ...fallback.system,
      ...(raw.system ?? {})
    },
    ui: {
      ...fallback.ui,
      ...(raw.ui ?? {})
    }
  };

  if (merged.ui && typeof merged.ui === "object") {
    delete merged.ui.isModified;
    delete merged.ui.isSaved;
  }

  if (!merged.system?.logger || Object.keys(merged.system.logger || {}).length === 0) {
    if (legacyLogger && Object.keys(legacyLogger).length) {
      merged.system = {
        ...merged.system,
        logger: {
          enabled: true,
          ...legacyLogger
        }
      };
    }
  }

  normalizeAutomationTriggerShape(merged);

  return merged;
};

const loadConfig = () => {
  const stored = localStorage.getItem(BUILDER_CONFIG_STORAGE_KEY);
  if (!stored) {
    sourceProjectFilename.value = "";
    writeBuilderSessionProjectName("");
    const storedPreview = localStorage.getItem("vebBuilderSplitPreview");
    if (storedPreview !== null) {
      splitPreviewEnabled.value = storedPreview === "1";
      if (!config.value.ui || typeof config.value.ui !== "object") {
        config.value.ui = {};
      }
      config.value.ui.splitPreview = splitPreviewEnabled.value;
    }
    activeModeLevel.value = resolveModeLevel(config.value.ui?.modeLevel);
    if (!config.value.ui || typeof config.value.ui !== "object") {
      config.value.ui = {};
    }
    config.value.ui.modeLevel = activeModeLevel.value;
    persistedConfigFingerprint.value = "";
    isHydrating.value = false;
    return;
  }
  try {
    const parsed = JSON.parse(stored);
    sourceProjectFilename.value = sanitizeProjectJsonFilename(readBuilderSessionProjectName());
    if (parsed?.schemaVersion === 1) {
      config.value = normalizeConfig(parsed);
      try {
        localStorage.setItem(
          BUILDER_CONFIG_STORAGE_KEY,
          safeStringify(cloneConfigForPersistence(config.value))
        );
      } catch (error) {
        console.error("Failed to clean stored config", error);
      }
    }
    const storedPreview = localStorage.getItem("vebBuilderSplitPreview");
    if (storedPreview !== null) {
      splitPreviewEnabled.value = storedPreview === "1";
      if (!config.value.ui || typeof config.value.ui !== "object") {
        config.value.ui = {};
      }
      config.value.ui.splitPreview = splitPreviewEnabled.value;
    } else {
      splitPreviewEnabled.value = Boolean(config.value.ui?.splitPreview);
    }
    activeModeLevel.value = resolveModeLevel(config.value.ui?.modeLevel);
    if (!config.value.ui || typeof config.value.ui !== "object") {
      config.value.ui = {};
    }
    config.value.ui.modeLevel = activeModeLevel.value;
    persistedConfigFingerprint.value = isProjectSaved.value ? buildConfigFingerprint(config.value) : "";
    isHydrating.value = false;
  } catch (error) {
    sourceProjectFilename.value = "";
    persistedConfigFingerprint.value = "";
    isHydrating.value = false;
    // ignore invalid stored data
  }
};

const updateComponentField = (componentIndex, path, value) => {
  const entry = config.value.components[componentIndex];
  if (!entry) return;
  if (!entry.config || typeof entry.config !== "object") {
    entry.config = {};
  }

  let target = entry.config;
  const lastKey = path[path.length - 1];
  path.slice(0, -1).forEach((key) => {
    if (!target[key] || typeof target[key] !== "object") {
      target[key] = {};
    }
    target = target[key];
  });

  target[lastKey] = value;
};

const updateRootField = (targetRoot, path, value) => {
  if (!targetRoot || typeof targetRoot !== "object") return;
  let target = targetRoot;
  const lastKey = path[path.length - 1];
  path.slice(0, -1).forEach((key) => {
    if (!target[key] || typeof target[key] !== "object") {
      target[key] = {};
    }
    target = target[key];
  });
  target[lastKey] = value;
};

const handleSchemaUpdate = ({ path, value }) => {
  if (activeComponentSlot.value === null) return;
  updateComponentField(activeComponentSlot.value, path, value);
  if (showSaveCustomComponentAction.value) {
    customComponentSaveError.value = "";
  }
  if (path[path.length - 1] === "bus") {
    const entry = config.value.components[activeComponentSlot.value];
    if (!entry?.config) return;
    if (value === "i2c") {
      delete entry.config.cs_pin;
    }
    if (value === "spi") {
      delete entry.config.address;
    }
  }
  saveConfig();
};

const handleCoreSchemaUpdate = ({ path, value }) => {
  if (!config.value.esphomeCore || typeof config.value.esphomeCore !== "object") {
    config.value.esphomeCore = {};
  }
  updateRootField(config.value.esphomeCore, path, value);
  saveConfig();
};

const handleSubstitutionsSchemaUpdate = ({ path, value }) => {
  if (!config.value.substitutions || typeof config.value.substitutions !== "object") {
    config.value.substitutions = {};
  }
  updateRootField(config.value.substitutions, path, value);
  saveConfig();
};

const handlePlatformSchemaUpdate = ({ path, value }) => {
  if (!config.value.platformCore || typeof config.value.platformCore !== "object") {
    config.value.platformCore = {};
  }
  updateRootField(config.value.platformCore, path, value);
  saveConfig();
};

const handleNetworkSchemaUpdate = ({ path, value }) => {
  if (!config.value.networkCore || typeof config.value.networkCore !== "object") {
    config.value.networkCore = {};
  }
  updateRootField(config.value.networkCore, path, value);
  saveConfig();
};

const handleBussesDetailUpdate = ({ path, value }) => {
  const key = activeBussesKey.value;
  if (!key || isMultiInstanceBusKey(key)) return;
  if (!config.value.bussesCore || typeof config.value.bussesCore !== "object") {
    config.value.bussesCore = {};
  }
  if (!config.value.bussesCore[key] || typeof config.value.bussesCore[key] !== "object") {
    config.value.bussesCore[key] = {};
  }
  updateRootField(config.value.bussesCore[key], path, value);
  saveConfig();
};

const ensureBussesCore = () => {
  if (!config.value.bussesCore || typeof config.value.bussesCore !== "object" || Array.isArray(config.value.bussesCore)) {
    config.value.bussesCore = {};
  }
  return config.value.bussesCore;
};

const collectExistingIdValues = () => [
  ...idIndex.value.map((entry) => entry?.id || ""),
  ...activeBusInstances.value.map((entry) => entry?.id || "")
];

const addActiveBusInstance = () => {
  const key = activeBussesKey.value;
  if (!isMultiInstanceBusKey(key)) return;
  const bussesCore = ensureBussesCore();
  const instances = getBusInstances(key);
  const nextInstance = createBusInstance({
    key,
    schema: bussesSchemas.value?.[key],
    existingIds: collectExistingIdValues()
  });
  bussesCore[key] = [...instances, nextInstance];
  saveConfig();
  previewSyncRequest.value += 1;
};

const handleBusInstanceUpdate = ({ index, path, value }) => {
  const key = activeBussesKey.value;
  if (!isMultiInstanceBusKey(key) || !Number.isInteger(index) || index < 0) return;
  const bussesCore = ensureBussesCore();
  const instances = getBusInstances(key);
  if (!instances[index]) return;
  const nextInstance = { ...instances[index] };
  updateRootField(nextInstance, path, value);
  bussesCore[key] = instances.map((instance, itemIndex) => (itemIndex === index ? nextInstance : instance));
  saveConfig();
};

const removeActiveBusInstance = (index) => {
  const key = activeBussesKey.value;
  if (!isMultiInstanceBusKey(key) || !Number.isInteger(index) || index < 0) return;
  const bussesCore = ensureBussesCore();
  const instances = getBusInstances(key);
  if (!instances[index]) return;
  bussesCore[key] = instances.filter((_, itemIndex) => itemIndex !== index);
  saveConfig();
};

const handleProtocolDetailUpdate = ({ path, value }) => {
  const key = activeProtocolKey.value;
  if (!key) return;
  if (!config.value.protocolsCore || typeof config.value.protocolsCore !== "object") {
    config.value.protocolsCore = {};
  }
  if (!config.value.protocolsCore[key] || typeof config.value.protocolsCore[key] !== "object") {
    config.value.protocolsCore[key] = {};
  }
  updateRootField(config.value.protocolsCore[key], path, value);
  saveConfig();
};

const handleOtherDetailUpdate = ({ path, value }) => {
  const key = activeOtherKey.value;
  if (!key) return;
  if (!config.value.system || typeof config.value.system !== "object") {
    config.value.system = {};
  }
  if (!config.value.system[key] || typeof config.value.system[key] !== "object") {
    config.value.system[key] = {};
  }
  updateRootField(config.value.system[key], path, value);
  saveConfig();
};

const handleAutomationDetailUpdate = ({ path, value }) => {
  if (!activeAutomationKey.value) return;
  if (!config.value.automation || typeof config.value.automation !== "object") {
    config.value.automation = {};
  }
  updateRootField(config.value.automation, path, value);
  saveConfig();
};

const handleLvglUpdate = (nextLvgl) => {
  config.value.lvgl = nextLvgl;
  saveConfig();
};

const handleLvglFieldEdit = ({ scopeId, path } = {}) => {
  if (!scopeId) return;
  lvglPreviewPulse.value = { scopeId, path: path || [], token: (lvglPreviewPulse.value?.token || 0) + 1 };
};

const handleCustomConfigUpdate = (value) => {
  if (activeComponentSlot.value === null) return;
  const entry = config.value.components[activeComponentSlot.value];
  if (!entry) return;
  entry.customConfig = value;
  customComponentSaveError.value = "";
  saveConfig();
};

const saveCustomComponentTemplate = async () => {
  if (!canSaveCustomComponent.value) return;
  const isUpdate = isSavedCustomComponentActive.value;
  const activeSlot = activeComponentSlot.value;
  const submittedName = activeCustomComponentName.value;
  const submittedCustomConfig =
    typeof activeComponentConfig.value?.custom_config === "string"
      ? activeComponentConfig.value.custom_config
      : "";
  customComponentSaveError.value = "";
  isSavingCustomComponent.value = true;
  try {
    const endpoint = isUpdate
      ? `api/custom-components/${encodePathSegments(activeCustomComponentId.value)}`
      : "api/custom-components";
    const response = await addonFetch(endpoint, {
      method: isUpdate ? "PUT" : "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: submittedName,
        custom_config: submittedCustomConfig
      })
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(toApiErrorMessage(payload, "Failed to save component"));
    }
    const savedItem = payload?.item && typeof payload.item === "object" ? payload.item : null;
    const savedId = typeof savedItem?.id === "string" ? savedItem.id.trim() : "";
    if (activeSlot !== null) {
      const entry = config.value.components[activeSlot];
      if (entry && typeof entry === "object") {
        if (savedId) {
          entry.id = savedId;
        }
        if (!entry.config || typeof entry.config !== "object") {
          entry.config = {};
        }
        entry.config.name = submittedName;
        entry.config.custom_config = submittedCustomConfig;
      }
    }
    await refreshComponentCatalog();
    if (savedId) {
      ensureComponentSchema(savedId, normalizeSchemaPath(savedItem?.schemaPath || ""));
    }
  } catch (error) {
    customComponentSaveError.value =
      error instanceof Error ? error.message : "Failed to save component";
  } finally {
    isSavingCustomComponent.value = false;
  }
};

const requestDeleteSavedCustomComponentWithConfirm = (item) => {
  requestDeleteSavedCustomComponent(item);
  if (!pendingDeleteCustomItem.value) return;
  confirmAction.value = "delete-custom";
  confirmOpen.value = true;
};

watch(
  () => config.value.platformCore?.variant,
  (variant) => {
    if (!variant) return;
    if (!config.value.platformCore || typeof config.value.platformCore !== "object") {
      config.value.platformCore = {};
    }
    if (config.value.platformCore.framework === "esp-idf") return;
    // Deterministic default that also fires when a saved project is (re)loaded;
    // don't let it flag the project as edited.
    flagAutoNormalization();
    config.value.platformCore.framework = "esp-idf";
  }
);

watch(
  () => activeTab.value,
  (value) => {
    if (value !== "Automation") return;
    if (!automationDefinitions.length) return;
    if (!activeAutomationKey.value) {
      activeAutomationKey.value = automationDefinitions[0].key;
    }
  }
);

onMounted(async () => {
  loadConfig();
  await refreshComponentCatalog();
  try {
    const response = await addonFetch("api/assets/mdi-substitutions");
    const contentType = response.headers.get("content-type") || "";
    if (response.ok && contentType.includes("application/json")) {
      const payload = await response.json();
      mdiSubstitutions.value =
        payload?.substitutions && typeof payload.substitutions === "object"
          ? payload.substitutions
          : {};
    } else {
      mdiSubstitutions.value = {};
    }
  } catch (error) {
    console.error("MDI substitutions load failed", error);
    mdiSubstitutions.value = {};
  }
  try {
    const response = await fetch("https://cdn.jsdelivr.net/npm/@mdi/svg/meta.json");
    if (!response.ok) {
      throw new Error(`MDI icon list load failed (${response.status})`);
    }
    const data = await response.json();
    mdiIcons.value = Array.isArray(data)
      ? data.filter((icon) => !icon.deprecated).map((icon) => icon.name)
      : [];
  } catch (error) {
    console.error("MDI icon list load failed", error);
    mdiIcons.value = [];
  }
  await refreshAssets(true, true);
  try {
    gpioData.value = await loadGpioData();
  } catch (error) {
    console.error(error);
  }
  try {
    esphomeCoreSchema.value = await loadSchemaByPath("general/core/core.json");
  } catch (error) {
    console.error("ESPHome core schema load failed", error);
  }
  try {
    substitutionsCoreSchema.value = await loadSchemaByPath("general/core/substitutions.json");
  } catch (error) {
    console.error("Substitutions schema load failed", error);
  }
  try {
    platformCoreSchema.value = await loadSchemaByPath("general/platform/platform.json");
  } catch (error) {
    console.error("Platform core schema load failed", error);
  }
  try {
    const protocolsSchemasLoaded = {};
    await Promise.all(
      protocolDefinitions.map(async (entry) => {
        const schema = await loadSchemaByPath(`${entry.schemaId}.json`);
        protocolsSchemasLoaded[entry.key] = schema;
      })
    );
    protocolsSchemas.value = protocolsSchemasLoaded;
  } catch (error) {
    console.error("Protocols schemas load failed", error);
  }
  try {
    const otherSchemasLoaded = {};
    await Promise.all(
      otherDefinitions.map(async (entry) => {
        const schema = await loadSchemaByPath(`general/system/${entry.key}.json`);
        otherSchemasLoaded[entry.key] = schema;
      })
    );
    otherSchemas.value = otherSchemasLoaded;
  } catch (error) {
    console.error("System schemas load failed", error);
  }
  try {
    const automationSchemasLoaded = {};
    await Promise.all(
      automationDefinitions.map(async (entry) => {
        const schema = await loadSchemaByPath(`general/automation/${entry.key}.json`);
        automationSchemasLoaded[entry.key] = schema;
      })
    );
    automationSchemas.value = automationSchemasLoaded;
  } catch (error) {
    console.error("Automation schemas load failed", error);
  }
  try {
    const bussesSchemasLoaded = {};
    await Promise.all(
      bussesDefinitions.map(async (entry) => {
        const schema = await loadSchemaByPath(`general/busses/${entry.key}.json`);
        bussesSchemasLoaded[entry.key] = schema;
      })
    );
    bussesSchemas.value = bussesSchemasLoaded;
  } catch (error) {
    console.error("Busses schemas load failed", error);
  }
  try {
    networkCoreSchema.value = await loadSchemaByPath("general/network/network.json");
  } catch (error) {
    console.error("Network core schema load failed", error);
  }
  try {
    const loaded = await Promise.all(
      LVGL_WIDGETS.map(async (widget) => [widget.type, await loadSchemaByPath(widget.schemaPath)])
    );
    lvglWidgetSchemas.value = Object.fromEntries(loaded);
  } catch (error) {
    console.error("LVGL widget schemas load failed", error);
  }
  const platform = platformCoreConfig.value?.platform;
  if (platform) {
    try {
      platformDetailSchema.value = await loadSchemaByPath(`general/platform/${platform}.json`);
    } catch (error) {
      console.error("Platform schema load failed", error);
    }
  }
  const transport = networkCoreConfig.value?.transport;
  if (transport) {
    try {
      networkDetailSchema.value = await loadSchemaByPath(`general/network/${transport}.json`);
    } catch (error) {
      console.error("Network schema load failed", error);
    }
  }

  // The baseline was captured in loadConfig() before any schema loaded; the
  // schema-driven password materialization above may have filled deterministic
  // values since. Re-take it for a still-pristine saved project so it doesn't
  // open showing unsaved changes.
  await nextTick();
  if (isProjectSaved.value && !isHydrating.value) {
    persistedConfigFingerprint.value = buildConfigFingerprint(config.value);
  }
});

watch(
  () => platformCoreConfig.value?.platform,
  async (platform, previous) => {
    if (!platform) {
      platformDetailSchema.value = null;
      return;
    }
    if (previous && previous !== platform) {
      if (platform === "esp8266") {
        config.value.platformCore = { platform, board: "esp01_1m" };
      } else if (platform === "esp32") {
        config.value.platformCore = {
          platform,
          variant: "esp32",
          framework: "esp-idf"
        };
      } else if (platform === "rp2040") {
        config.value.platformCore = { platform, board: "rpipicow" };
      } else if (platform === "bk72xx") {
        config.value.platformCore = {
          platform,
          board: "generic-bk7231n-qfn32-tuya"
        };
      } else if (platform === "rtl87xx") {
        config.value.platformCore = {
          platform,
          board: "generic-rtl8710bn-2mb-788k"
        };
      } else if (platform === "ln882x") {
        config.value.platformCore = { platform, board: "generic-ln882hki" };
      } else if (platform === "nrf52") {
        config.value.platformCore = {
          platform,
          board: "adafruit_feather_nrf52840",
          dcdc: true
        };
      } else if (platform === "host") {
        config.value.platformCore = { platform, mac_address: "06:35:69:ab:f6:79" };
      } else {
        config.value.platformCore = { platform };
      }
    }
    try {
      platformDetailSchema.value = await loadSchemaByPath(`general/platform/${platform}.json`);
    } catch (error) {
      console.error("Platform schema load failed", error);
      platformDetailSchema.value = null;
    }
    if (platformDetailSchema.value?.fields?.length) {
      const allowedKeys = new Set([
        "platform",
        ...platformDetailSchema.value.fields.map((field) => field.key)
      ]);
      if (platform === "esp32") {
        allowedKeys.add("framework");
        allowedKeys.add("framework_config");
        allowedKeys.add("advanced");
        allowedKeys.add("components");
      }
      Object.keys(config.value.platformCore || {}).forEach((key) => {
        if (!allowedKeys.has(key)) {
          delete config.value.platformCore[key];
        }
      });
    }
    if (platform === "esp8266") {
      if (!config.value.platformCore || typeof config.value.platformCore !== "object") {
        config.value.platformCore = { platform, board: "esp01_1m" };
      }
      if (!config.value.platformCore.board) {
        config.value.platformCore.board = "esp01_1m";
      }
    }
    if (platform === "esp32") {
      if (!config.value.platformCore || typeof config.value.platformCore !== "object") {
        config.value.platformCore = {
          platform,
          variant: "esp32",
          framework: "esp-idf"
        };
      }
      if (!config.value.platformCore.variant) {
        config.value.platformCore.variant = "esp32";
      }
      if (!config.value.platformCore.framework) {
        config.value.platformCore.framework = "esp-idf";
      }
      if (previous === "esp8266" && config.value.platformCore.board === "esp01_1m") {
        delete config.value.platformCore.board;
      }
    }
    if (platform === "rp2040") {
      if (!config.value.platformCore || typeof config.value.platformCore !== "object") {
        config.value.platformCore = { platform, board: "rpipicow" };
      }
      if (!config.value.platformCore.board) {
        config.value.platformCore.board = "rpipicow";
      }
    }
    if (platform === "bk72xx") {
      if (!config.value.platformCore || typeof config.value.platformCore !== "object") {
        config.value.platformCore = {
          platform,
          board: "generic-bk7231n-qfn32-tuya"
        };
      }
      if (!config.value.platformCore.board) {
        config.value.platformCore.board = "generic-bk7231n-qfn32-tuya";
      }
    }
    if (platform === "rtl87xx") {
      if (!config.value.platformCore || typeof config.value.platformCore !== "object") {
        config.value.platformCore = {
          platform,
          board: "generic-rtl8710bn-2mb-788k"
        };
      }
      if (!config.value.platformCore.board) {
        config.value.platformCore.board = "generic-rtl8710bn-2mb-788k";
      }
    }
    if (platform === "ln882x") {
      if (!config.value.platformCore || typeof config.value.platformCore !== "object") {
        config.value.platformCore = { platform, board: "generic-ln882hki" };
      }
      if (!config.value.platformCore.board) {
        config.value.platformCore.board = "generic-ln882hki";
      }
    }
    if (platform === "nrf52") {
      if (!config.value.platformCore || typeof config.value.platformCore !== "object") {
        config.value.platformCore = {
          platform,
          board: "adafruit_feather_nrf52840",
          dcdc: true
        };
      }
      if (!config.value.platformCore.board) {
        config.value.platformCore.board = "adafruit_feather_nrf52840";
      }
      if (config.value.platformCore.dcdc === undefined) {
        config.value.platformCore.dcdc = true;
      }
    }
    if (platform === "host") {
      if (!config.value.platformCore || typeof config.value.platformCore !== "object") {
        config.value.platformCore = { platform, mac_address: "06:35:69:ab:f6:79" };
      }
      if (!config.value.platformCore.mac_address) {
        config.value.platformCore.mac_address = "06:35:69:ab:f6:79";
      }
    }
  }
);

watch(
  () => networkCoreConfig.value?.transport,
  async (transport, previous) => {
    if (!transport) {
      networkDetailSchema.value = null;
      return;
    }
    try {
      networkDetailSchema.value = await loadSchemaByPath(`general/network/${transport}.json`);
    } catch (error) {
      networkDetailSchema.value = null;
      console.error("Network schema load failed", error);
    }
  }
);

watch(
  () => networkCoreConfig.value?.ap?.enabled,
  (enabled) => {
    if (enabled === false) {
      config.value.networkCore.ap = { enabled: false };
    }
  }
);

watch(
  () => networkCoreConfig.value?.web_server?.enabled,
  (enabled) => {
    if (enabled === false) {
      config.value.networkCore.web_server = { enabled: false };
    }
  }
);

watch(
  () => networkCoreConfig.value?.ota?.enabled,
  (enabled) => {
    if (enabled === false) {
      const otaConfig = config.value.networkCore?.ota || {};
      otaConfig.use_password = false;
      config.value.networkCore.ota = otaConfig;
    }
  }
);

watch(
  () => [networkCoreConfig.value?.transport, networkCoreConfig.value?.type],
  ([transport, type], [previousTransport, previousType]) => {
    if (transport !== "ethernet") return;
    if (!type || type === previousType) return;
    const spiTypes = new Set(["W5500", "DM9051"]);
    const isSpiType = spiTypes.has(type);
    const networkCore = config.value.networkCore;
    if (!networkCore || typeof networkCore !== "object") return;

    const clearIfPresent = (key) => {
      if (networkCore[key] !== undefined) {
        delete networkCore[key];
      }
    };

    if (isSpiType) {
      clearIfPresent("mdc_pin");
      clearIfPresent("mdio_pin");
      clearIfPresent("power_pin");
      if (networkCore.clk && typeof networkCore.clk === "object") {
        delete networkCore.clk.pin;
        if (!Object.keys(networkCore.clk).length) {
          delete networkCore.clk;
        }
      }
      return;
    }

    clearIfPresent("cs_pin");
    clearIfPresent("interrupt_pin");
    clearIfPresent("reset_pin");

    if (!requiredBusses.value.has("spi")) {
      if (config.value.bussesCore && typeof config.value.bussesCore === "object") {
        if (Array.isArray(config.value.bussesCore.spi)) {
          config.value.bussesCore.spi = [];
        } else if (config.value.bussesCore.spi && typeof config.value.bussesCore.spi === "object") {
          config.value.bussesCore.spi = isMultiInstanceBusKey("spi") ? [] : {};
        }
      }
    }
  }
);

watch(
  () => activeTab.value,
  (value) => {
    if (value === "Protocols" && !activeProtocolKey.value) {
      activeProtocolKey.value = protocolDefinitions[0]?.key || "";
    }
    if (value === "Busses" && !activeBussesKey.value) {
      activeBussesKey.value = bussesDefinitions[0]?.key || "";
    }
    if (value !== "System") return;
    if (!activeOtherKey.value) {
      activeOtherKey.value = otherDefinitions[0]?.key || "";
    }
  }
);

watch(
  () => componentSchemas.value,
  () => {
    if (!pendingPulseEntries.size) return;

    Array.from(pendingPulseEntries.entries()).forEach(([componentId, queuedEntries]) => {
      const schema = componentSchemas.value?.[componentId];
      if (schema === undefined) return;
      pendingPulseEntries.delete(componentId);
      if (!schema) return;
      (queuedEntries || []).forEach((entry) => {
        getRequirementTabsForEntry(entry, componentId).forEach((tab) => triggerTabPulse(tab));
      });
    });
  },
  { deep: true }
);

onBeforeUnmount(() => {
  pendingPulseEntries.clear();
  if (yamlFocusPulseTimer) {
    clearTimeout(yamlFocusPulseTimer);
    yamlFocusPulseTimer = null;
  }
  Array.from(tabPulseTimers.values()).forEach((timer) => clearTimeout(timer));
  tabPulseTimers.clear();
  window.removeEventListener("keydown", handleBuilderKeydown);
  window.removeEventListener("app:builder-export", handleAppExport);
  window.removeEventListener("app:install-option", handleAppInstallOption);
  window.removeEventListener("app:builder-logs", handleAppLogs);
  window.removeEventListener("app:validate", handleAppValidate);
  window.removeEventListener("app:builder-save-request", handleBuilderSaveRequest);
  disposeInstallFlow();
  disposeDeployment();
  window.dispatchEvent(
    new CustomEvent("app:builder-compile-state", {
      detail: {
        canInstall: false,
        canValidate: false,
        canUseOta: false,
        canLogs: false,
        canExport: false,
        running: false,
        hasUnsavedChanges: false
      }
    })
  );
});
</script>
