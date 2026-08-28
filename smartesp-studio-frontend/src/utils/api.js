// Single entry point for backend calls. The page is always served from the
// add-on/app root, so resolving against `window.location` handles both HA
// ingress (/api/hassio_ingress/<token>/) and standalone (/) without config.

const apiBase = () => new URL("./", window.location.href).toString();

export const apiUrl = (path) => new URL(path, apiBase()).toString();

export function apiFetch(path, options = {}) {
  return fetch(apiUrl(path), { credentials: "include", ...options });
}

// Parse a fetch Response as JSON, turning a non-2xx into an Error that carries
// the backend `{status, message}` payload.
export async function unwrapJson(response) {
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok) {
    const message =
      (payload && typeof payload.message === "string" && payload.message.trim()) ||
      `Request failed (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

export async function apiJson(path, options = {}) {
  return unwrapJson(await apiFetch(path, options));
}
