import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { ok } from "@openmonetis/shared/api";
import {
  AssistantCatalogOutputSchema,
  AssistantExtractionInputSchema,
  AssistantExtractionOutputSchema,
  AssistantExtractionTemplateOutputSchema,
} from "@openmonetis/validators/assistant";
import type { AssistantService } from "../services/assistant.service";
import type { ApiVariables } from "../types/context";
import { ErrorResponseSchema as ErrorSchema, validationHook } from "../utils/openapi";

const tags = ["Assistant"];
const security = [{ deviceBearer: [] }];
const unauthorized = {
  description: "Invalid token",
  content: {
    "application/json": { schema: z.object({ valid: z.literal(false), error: z.string() }) },
  },
};

function dataResponse<T extends z.ZodType>(schema: T) {
  return z.object({ data: schema, error: z.null() });
}

/** For an external message processor, authenticated with a device token of the user. */
export function createAssistantRoute(service: AssistantService) {
  const route = new OpenAPIHono<{ Variables: ApiVariables }>({ defaultHook: validationHook });

  route.openapi(
    createRoute({
      method: "get",
      path: "/catalog",
      tags,
      security,
      responses: {
        200: {
          description: "Products and stores, so Claude can match names to ids",
          content: {
            "application/json": { schema: dataResponse(AssistantCatalogOutputSchema) },
          },
        },
        401: unauthorized,
      },
    }),
    async (context) => context.json(ok(await service.catalog(context.get("userId"))), 200),
  );

  route.openapi(
    createRoute({
      method: "get",
      path: "/extraction-template",
      tags,
      security,
      responses: {
        200: {
          description: "The prompt and JSON Schema Breathe suggests for reading a message",
          content: {
            "application/json": {
              schema: dataResponse(AssistantExtractionTemplateOutputSchema),
            },
          },
        },
        401: unauthorized,
      },
    }),
    async (context) => context.json(ok(await service.extractionTemplate()), 200),
  );

  route.openapi(
    createRoute({
      method: "post",
      path: "/extractions",
      tags,
      security,
      request: {
        body: {
          required: true,
          content: { "application/json": { schema: AssistantExtractionInputSchema } },
        },
      },
      responses: {
        200: {
          description: "Drafts created for review, with the text to answer the sender",
          content: {
            "application/json": { schema: dataResponse(AssistantExtractionOutputSchema) },
          },
        },
        400: {
          description: "Invalid extraction",
          content: { "application/json": { schema: ErrorSchema } },
        },
        401: unauthorized,
      },
    }),
    async (context) =>
      context.json(
        ok(await service.recordExtraction(context.get("userId"), context.req.valid("json"))),
        200,
      ),
  );

  return route;
}
