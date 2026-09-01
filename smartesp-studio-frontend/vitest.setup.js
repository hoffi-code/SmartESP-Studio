// Every component spec renders under the app's i18n instance, so `useI18n()` in shared
// components (modals, schema fields, ...) resolves without each spec wiring the plugin.
import { config } from "@vue/test-utils";

import { i18n } from "./src/i18n";

config.global.plugins = [...(config.global.plugins || []), i18n];
