export const ID_REF_EMPTY_OPTION = "(empty)";

export const buildIdRefOptions = ({
  idIndex = [],
  domain = "",
  contextComponentId = "",
  contextScopeId = "",
  allowSelfReference = false
} = {}) => {
  const seen = new Set();
  const options = [];
  // domain kann ein einzelner String ODER ein Array sein (z.B. LVGL bind_id: ein Label
  // darf an sensor/text_sensor/binary_sensor/number/select binden) -- leer/[] bedeutet
  // "alle Domains", wie bisher.
  const domains = Array.isArray(domain) ? domain.filter(Boolean) : domain ? [domain] : [];

  (idIndex || []).forEach((entry) => {
    if (!allowSelfReference) {
      if (contextScopeId && entry.scopeId === contextScopeId) return;
      if (!contextScopeId && contextComponentId && entry.componentId === contextComponentId) return;
    }
    if (domains.length && !domains.includes(entry.domain)) return;
    if (seen.has(entry.idLower)) return;
    seen.add(entry.idLower);
    options.push(entry.id);
  });

  return options.sort((a, b) => a.localeCompare(b));
};

export const buildIdRefMenuOptions = (options = []) =>
  options.length ? options : [ID_REF_EMPTY_OPTION];

export const isIdRefEmptyOption = (value) => value === ID_REF_EMPTY_OPTION;
