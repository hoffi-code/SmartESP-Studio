// Core catalogs -- small, bundled eagerly. The large `schema` catalog and every
// non-default locale are loaded on demand (see src/i18n/index.js).
import app from "./app.json";
import common from "./common.json";
import builder from "./builder.json";
import dashboard from "./dashboard.json";
import modals from "./modals.json";
import lvgl from "./lvgl.json";

export default { app, common, builder, dashboard, modals, lvgl };
