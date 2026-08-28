import { describe, it, expect } from "vitest";
import { unwrapJson } from "./api";

const jsonResponse = (body, { ok = true, status = 200 } = {}) => ({
  ok,
  status,
  json: async () => body
});

const brokenBodyResponse = ({ ok = true, status = 200 } = {}) => ({
  ok,
  status,
  json: async () => {
    throw new SyntaxError("Unexpected end of JSON input");
  }
});

describe("unwrapJson", () => {
  it("returns the parsed payload on a 2xx response", async () => {
    await expect(unwrapJson(jsonResponse({ status: "ok", items: [1, 2] }))).resolves.toEqual({
      status: "ok",
      items: [1, 2]
    });
  });

  it("tolerates an empty or non-JSON body on success", async () => {
    await expect(unwrapJson(brokenBodyResponse())).resolves.toBeNull();
  });

  it("throws with the backend message on a non-2xx response", async () => {
    await expect(
      unwrapJson(jsonResponse({ status: "error", message: "Name already exists" }, { ok: false, status: 409 }))
    ).rejects.toMatchObject({ message: "Name already exists", status: 409 });
  });

  it("falls back to a generic message when the error body has none", async () => {
    await expect(
      unwrapJson(brokenBodyResponse({ ok: false, status: 500 }))
    ).rejects.toMatchObject({ message: "Request failed (500)", status: 500, payload: null });
  });
});
