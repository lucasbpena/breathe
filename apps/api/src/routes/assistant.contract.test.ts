import assert from "node:assert/strict";
import test from "node:test";
import { OpenAPIHono } from "@hono/zod-openapi";
import { createRequireDeviceToken } from "../middlewares/device-auth";
import { errorHandler, notFoundHandler } from "../middlewares/errors";
import type { AssistantService } from "../services/assistant.service";
import type { ApiVariables } from "../types/context";
import { validationHook } from "../utils/openapi";
import { createAssistantRoute } from "./assistant";

const userId = "00000000-0000-4000-8000-000000000002";
const validToken = `opm_${"a".repeat(43)}`;
const authorization = { Authorization: `Bearer ${validToken}` };
const extractionBody = {
  externalId: "wamid-1",
  senderNumber: "5531999998888",
  kind: "image",
  text: null,
  receivedAt: "2026-10-30T12:00:00.000Z",
  extraction: { receipts: [], measurements: null, question: null, warnings: [], notice: null },
};

function createTestApp(service: AssistantService) {
  const app = new OpenAPIHono<{ Variables: ApiVariables }>({ defaultHook: validationHook });
  app.onError(errorHandler);
  app.notFound(notFoundHandler);
  app.use(
    "/api/assistant/*",
    createRequireDeviceToken({
      authenticate: async (token) =>
        token === validToken
          ? {
              tokenId: "00000000-0000-4000-8000-000000000001",
              tokenName: "Breathe AI",
              userId,
              expiresAt: new Date("2027-01-01T00:00:00.000Z"),
            }
          : null,
    }),
  );
  app.route("/api/assistant", createAssistantRoute(service));
  return app;
}

const service: AssistantService = {
  catalog: async (requestedUserId) => {
    assert.equal(requestedUserId, userId);
    return { products: [], stores: [] };
  },
  extractionTemplate: async () => ({ prompt: "Leia", outputSchema: { type: "object" } }),
  recordExtraction: async (requestedUserId) => {
    assert.equal(requestedUserId, userId);
    return { reply: "Registrei." };
  },
};

test("every assistant route requires a device token", async () => {
  const app = createTestApp(service);
  for (const [path, method] of [
    ["/api/assistant/catalog", "GET"],
    ["/api/assistant/extraction-template", "GET"],
    ["/api/assistant/extractions", "POST"],
  ] as const) {
    const response = await app.request(path, { method });
    assert.equal(response.status, 401, path);
  }
});

test("the catalog answers in the usual envelope", async () => {
  const app = createTestApp(service);
  const response = await app.request("/api/assistant/catalog", { headers: authorization });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { data: { products: [], stores: [] }, error: null });
});

test("the template carries the prompt and the schema", async () => {
  const app = createTestApp(service);
  const response = await app.request("/api/assistant/extraction-template", {
    headers: authorization,
  });
  const { data } = await response.json();
  assert.deepEqual(data, { prompt: "Leia", outputSchema: { type: "object" } });
});

test("a valid extraction returns the reply text", async () => {
  const app = createTestApp(service);
  const response = await app.request("/api/assistant/extractions", {
    method: "POST",
    headers: { ...authorization, "Content-Type": "application/json" },
    body: JSON.stringify(extractionBody),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { data: { reply: "Registrei." }, error: null });
});

test("an extraction out of format is refused before reaching the service", async () => {
  const app = createTestApp({
    ...service,
    recordExtraction: async () => assert.fail("must not be called"),
  });
  const response = await app.request("/api/assistant/extractions", {
    method: "POST",
    headers: { ...authorization, "Content-Type": "application/json" },
    body: JSON.stringify({ ...extractionBody, extraction: { receipts: "nope" } }),
  });
  assert.equal(response.status, 400);
});
