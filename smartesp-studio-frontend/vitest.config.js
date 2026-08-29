import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vitest/config";

// *.spec.js stays under the default "node" environment. *.spec.dom.js / *.spec.vue.js
// opt into jsdom via a `// @vitest-environment jsdom` docblock at the top of the file.
export default defineConfig({
  plugins: [vue()],
  test: {
    environment: "node",
    include: ["src/**/*.spec.js", "src/**/*.spec.dom.js", "src/**/*.spec.vue.js"]
  }
});
