import { LAMBDA_GLOBAL_FUNCTIONS } from "./lambdaGlobalFunctions";
import { LAMBDA_MEMBER_CATALOG } from "./lambdaMemberCatalog";
import { LAMBDA_SCOPE_VARIABLES } from "./lambdaScopeVariables";
import { LAMBDA_SNIPPETS } from "./lambdaSnippets";

const CATEGORY_ORDER = ["logging", "strings", "math", "time", "core"];

// buildLambdaPaletteSections({ suggestedDomain }) -> [{ id, items: [{ id, insert }] }]
// "suggested" only when suggestedDomain resolves to a non-empty member catalog entry;
// "snippets" wraps LAMBDA_SNIPPETS verbatim, always present; "scope" wraps
// LAMBDA_SCOPE_VARIABLES verbatim, always present (not yet bound to the field's
// actual lambda context -- see lambdaScopeVariables.js); category sections group
// LAMBDA_GLOBAL_FUNCTIONS in a fixed reading order rather than alpha-sorted keys --
// few known categories, fixed reads better than alpha for a list this short.
export const buildLambdaPaletteSections = ({ suggestedDomain = "" } = {}) => {
  const sections = [];

  const suggestedItems = LAMBDA_MEMBER_CATALOG[suggestedDomain];
  if (suggestedItems?.length) {
    sections.push({ id: "suggested", items: suggestedItems });
  }

  sections.push({ id: "snippets", items: LAMBDA_SNIPPETS });
  sections.push({ id: "scope", items: LAMBDA_SCOPE_VARIABLES });

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
