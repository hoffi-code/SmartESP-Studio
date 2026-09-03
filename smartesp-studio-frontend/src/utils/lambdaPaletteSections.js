import { LAMBDA_GLOBAL_FUNCTIONS } from "./lambdaGlobalFunctions";
import { LAMBDA_MEMBER_CATALOG } from "./lambdaMemberCatalog";
import { LAMBDA_SCOPE_VARIABLES } from "./lambdaScopeVariables";
import { LAMBDA_SNIPPETS } from "./lambdaSnippets";

const CATEGORY_ORDER = ["logging", "strings", "math", "time", "core"];

// buildLambdaPaletteSections({ suggestedDomain, dynamicScopeVariables }) ->
// [{ id, items: [{ id, insert }] }]
// "suggested" only when suggestedDomain resolves to a non-empty member catalog entry;
// "snippets" wraps LAMBDA_SNIPPETS verbatim, always present; "scope" merges
// LAMBDA_SCOPE_VARIABLES (ESPHomes eingebaute Kontext-Variablen wie x/address/iteration)
// mit dynamicScopeVariables -- Namen, die fuer genau dieses Lambda gelten, z.B. aus einer
// variable_map im selben Action-Eintrag (siehe LambdaScopeVariablesScope.vue). Duplikate
// (gleicher Name in beiden Quellen) werden zusammengefuehrt; category sections gruppieren
// LAMBDA_GLOBAL_FUNCTIONS in fixer Lesereihenfolge statt alpha-sortierter Keys -- wenige
// bekannte Kategorien, fix liest sich besser als alpha bei einer so kurzen Liste.
export const buildLambdaPaletteSections = ({ suggestedDomain = "", dynamicScopeVariables = [] } = {}) => {
  const sections = [];

  const suggestedItems = LAMBDA_MEMBER_CATALOG[suggestedDomain];
  if (suggestedItems?.length) {
    sections.push({ id: "suggested", items: suggestedItems });
  }

  sections.push({ id: "snippets", items: LAMBDA_SNIPPETS });

  const seenScopeIds = new Set();
  const scopeItems = [
    ...dynamicScopeVariables.map((name) => ({ id: name, insert: name })),
    ...LAMBDA_SCOPE_VARIABLES
  ].filter((entry) => entry?.id && !seenScopeIds.has(entry.id) && seenScopeIds.add(entry.id));
  sections.push({ id: "scope", items: scopeItems });

  CATEGORY_ORDER.forEach((category) => {
    const items = LAMBDA_GLOBAL_FUNCTIONS.filter((entry) => entry.category === category);
    if (items.length) {
      sections.push({ id: `category:${category}`, items });
    }
  });

  return sections;
};

// filterLambdaPaletteSections(sections, term, { labelFor }) -> same shape
// Substring match (case-insensitive) on id/insert/labelFor(sectionId, item); sections
// left with zero items after filtering are dropped. labelFor is injected so this stays
// i18n-agnostic and unit-testable without mounting anything.
export const filterLambdaPaletteSections = (sections, term, options = {}) => {
  const query = String(term || "").trim().toLowerCase();
  if (!query) return sections;
  const labelFor = typeof options.labelFor === "function" ? options.labelFor : () => "";

  return sections
    .map((section) => {
      const items = section.items.filter((item) => {
        const id = String(item.id || "").toLowerCase();
        const insert = String(item.insert || "").toLowerCase();
        const label = String(labelFor(section.id, item) || "").toLowerCase();
        return id.includes(query) || insert.includes(query) || label.includes(query);
      });
      return { id: section.id, items };
    })
    .filter((section) => section.items.length > 0);
};
