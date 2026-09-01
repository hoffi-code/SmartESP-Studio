import js from "@eslint/js";
import pluginVue from "eslint-plugin-vue";
import globals from "globals";

// Essential rules only: catch real errors (parse errors, undefined vars, broken
// templates, mutated props) without imposing a formatting pass on the existing
// codebase. Prettier is a separate step.
export default [
  {
    ignores: ["dist/**", "runtime/**", "public/**"]
  },
  js.configs.recommended,
  ...pluginVue.configs["flat/essential"],
  {
    files: ["**/*.{js,mjs,vue}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        __APP_VERSION__: "readonly"
      }
    },
    rules: {
      "no-unused-vars": ["warn", { args: "none", ignoreRestSiblings: true }],
      // ~90 hits, all in schemaYaml.js code-generation strings. Cleaning them
      // needs the YAML-emission tests first; keep visible as warnings until then.
      "no-useless-escape": "warn",
      "vue/multi-word-component-names": "off"
    }
  },
  {
    files: ["vite.config.js", "eslint.config.js", "vitest.config.js", "vitest.setup.js", "scripts/**"],
    languageOptions: {
      globals: { ...globals.node }
    }
  }
];
