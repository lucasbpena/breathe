import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { ok } from "@openmonetis/shared/api";
import {
  CreateStoreInputSchema,
  StoreOutputSchema,
  StoreParamsSchema,
  UpdateStoreInputSchema,
} from "@openmonetis/validators/stores";
import type { StoresService } from "../services/stores.service";
import type { ApiVariables } from "../types/context";
import { ErrorResponseSchema as ErrorSchema, validationHook } from "../utils/openapi";

const StoreResponseSchema = z.object({ data: StoreOutputSchema, error: z.null() });
const StoresResponseSchema = z.object({ data: z.array(StoreOutputSchema), error: z.null() });
const DeleteResponseSchema = z.object({ data: z.object({ id: z.uuid() }), error: z.null() });
const errors = {
  400: { description: "Invalid store", content: { "application/json": { schema: ErrorSchema } } },
  401: {
    description: "Authentication required",
    content: { "application/json": { schema: ErrorSchema } },
  },
  404: { description: "Store not found", content: { "application/json": { schema: ErrorSchema } } },
  409: {
    description: "Store name already used or store has purchases",
    content: { "application/json": { schema: ErrorSchema } },
  },
} as const;

export function createStoresRoute(service: StoresService) {
  const route = new OpenAPIHono<{ Variables: ApiVariables }>({ defaultHook: validationHook });
  route.openapi(
    createRoute({
      method: "get",
      path: "/",
      tags: ["Stores"],
      responses: {
        200: {
          description: "Stores for the authenticated user",
          content: { "application/json": { schema: StoresResponseSchema } },
        },
        401: errors[401],
      },
    }),
    async (context) => context.json(ok(await service.list(context.get("userId"))), 200),
  );

  route.openapi(
    createRoute({
      method: "post",
      path: "/",
      tags: ["Stores"],
      request: {
        body: {
          required: true,
          content: { "application/json": { schema: CreateStoreInputSchema } },
        },
      },
      responses: {
        201: {
          description: "Created store",
          content: { "application/json": { schema: StoreResponseSchema } },
        },
        400: errors[400],
        401: errors[401],
        409: errors[409],
      },
    }),
    async (context) =>
      context.json(ok(await service.create(context.req.valid("json"), context.get("userId"))), 201),
  );

  route.openapi(
    createRoute({
      method: "patch",
      path: "/{id}",
      tags: ["Stores"],
      request: {
        params: StoreParamsSchema,
        body: {
          required: true,
          content: { "application/json": { schema: UpdateStoreInputSchema } },
        },
      },
      responses: {
        200: {
          description: "Updated store",
          content: { "application/json": { schema: StoreResponseSchema } },
        },
        ...errors,
      },
    }),
    async (context) =>
      context.json(
        ok(
          await service.update(
            context.req.valid("param").id,
            context.get("userId"),
            context.req.valid("json"),
          ),
        ),
        200,
      ),
  );

  route.openapi(
    createRoute({
      method: "delete",
      path: "/{id}",
      tags: ["Stores"],
      request: { params: StoreParamsSchema },
      responses: {
        200: {
          description: "Deleted store",
          content: { "application/json": { schema: DeleteResponseSchema } },
        },
        401: errors[401],
        404: errors[404],
        409: errors[409],
      },
    }),
    async (context) =>
      context.json(
        ok(await service.remove(context.req.valid("param").id, context.get("userId"))),
        200,
      ),
  );
  return route;
}
