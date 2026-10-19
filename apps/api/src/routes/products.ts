import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { ok } from "@openmonetis/shared/api";
import {
  CreateProductAliasInputSchema,
  CreateProductInputSchema,
  MergeProductsInputSchema,
  ProductAliasOutputSchema,
  ProductAliasParamsSchema,
  ProductOutputSchema,
  ProductParamsSchema,
  ProductPriceHistoryOutputSchema,
  ResolvedProductOutputSchema,
  ResolveProductQuerySchema,
  UpdateProductInputSchema,
} from "@openmonetis/validators/products";
import type { ProductsService } from "../services/products.service";
import type { ApiVariables } from "../types/context";
import { ErrorResponseSchema as ErrorSchema, validationHook } from "../utils/openapi";

const ProductResponseSchema = z.object({ data: ProductOutputSchema, error: z.null() });
const ProductsResponseSchema = z.object({ data: z.array(ProductOutputSchema), error: z.null() });
const AliasResponseSchema = z.object({ data: ProductAliasOutputSchema, error: z.null() });
const ResolvedResponseSchema = z.object({ data: ResolvedProductOutputSchema, error: z.null() });
const PriceHistoryResponseSchema = z.object({
  data: ProductPriceHistoryOutputSchema,
  error: z.null(),
});
const DeleteResponseSchema = z.object({ data: z.object({ id: z.uuid() }), error: z.null() });
const errors = {
  400: { description: "Invalid product", content: { "application/json": { schema: ErrorSchema } } },
  401: {
    description: "Authentication required",
    content: { "application/json": { schema: ErrorSchema } },
  },
  404: {
    description: "Product, alias or category not found",
    content: { "application/json": { schema: ErrorSchema } },
  },
  409: {
    description: "Name already used or product has purchases",
    content: { "application/json": { schema: ErrorSchema } },
  },
} as const;

export function createProductsRoute(service: ProductsService) {
  const route = new OpenAPIHono<{ Variables: ApiVariables }>({ defaultHook: validationHook });
  route.openapi(
    createRoute({
      method: "get",
      path: "/resolve",
      tags: ["Products"],
      request: { query: ResolveProductQuerySchema },
      responses: {
        200: {
          description: "Product matching a receipt name, if any",
          content: { "application/json": { schema: ResolvedResponseSchema } },
        },
        400: errors[400],
        401: errors[401],
      },
    }),
    async (context) =>
      context.json(
        ok(await service.resolve(context.req.valid("query").name, context.get("userId"))),
        200,
      ),
  );

  route.openapi(
    createRoute({
      method: "get",
      path: "/",
      tags: ["Products"],
      responses: {
        200: {
          description: "Products with their price summary",
          content: { "application/json": { schema: ProductsResponseSchema } },
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
      tags: ["Products"],
      request: {
        body: {
          required: true,
          content: { "application/json": { schema: CreateProductInputSchema } },
        },
      },
      responses: {
        201: {
          description: "Created product",
          content: { "application/json": { schema: ProductResponseSchema } },
        },
        ...errors,
      },
    }),
    async (context) =>
      context.json(ok(await service.create(context.req.valid("json"), context.get("userId"))), 201),
  );

  route.openapi(
    createRoute({
      method: "get",
      path: "/{id}",
      tags: ["Products"],
      request: { params: ProductParamsSchema },
      responses: {
        200: {
          description: "Get product",
          content: { "application/json": { schema: ProductResponseSchema } },
        },
        401: errors[401],
        404: errors[404],
      },
    }),
    async (context) =>
      context.json(
        ok(await service.get(context.req.valid("param").id, context.get("userId"))),
        200,
      ),
  );

  route.openapi(
    createRoute({
      method: "patch",
      path: "/{id}",
      tags: ["Products"],
      request: {
        params: ProductParamsSchema,
        body: {
          required: true,
          content: { "application/json": { schema: UpdateProductInputSchema } },
        },
      },
      responses: {
        200: {
          description: "Updated product",
          content: { "application/json": { schema: ProductResponseSchema } },
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
      tags: ["Products"],
      request: { params: ProductParamsSchema },
      responses: {
        200: {
          description: "Deleted product",
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

  route.openapi(
    createRoute({
      method: "post",
      path: "/{id}/aliases",
      tags: ["Products"],
      request: {
        params: ProductParamsSchema,
        body: {
          required: true,
          content: { "application/json": { schema: CreateProductAliasInputSchema } },
        },
      },
      responses: {
        201: {
          description: "Added receipt name",
          content: { "application/json": { schema: AliasResponseSchema } },
        },
        ...errors,
      },
    }),
    async (context) =>
      context.json(
        ok(
          await service.addAlias(
            context.req.valid("param").id,
            context.req.valid("json"),
            context.get("userId"),
          ),
        ),
        201,
      ),
  );

  route.openapi(
    createRoute({
      method: "delete",
      path: "/{id}/aliases/{aliasId}",
      tags: ["Products"],
      request: { params: ProductAliasParamsSchema },
      responses: {
        200: {
          description: "Removed receipt name",
          content: { "application/json": { schema: DeleteResponseSchema } },
        },
        401: errors[401],
        404: errors[404],
      },
    }),
    async (context) => {
      const params = context.req.valid("param");
      return context.json(
        ok(await service.removeAlias(params.id, params.aliasId, context.get("userId"))),
        200,
      );
    },
  );

  route.openapi(
    createRoute({
      method: "post",
      path: "/{id}/merge",
      tags: ["Products"],
      request: {
        params: ProductParamsSchema,
        body: {
          required: true,
          content: { "application/json": { schema: MergeProductsInputSchema } },
        },
      },
      responses: {
        200: {
          description: "Product that absorbed the source product",
          content: { "application/json": { schema: ProductResponseSchema } },
        },
        400: errors[400],
        401: errors[401],
        404: errors[404],
      },
    }),
    async (context) =>
      context.json(
        ok(
          await service.merge(
            context.req.valid("param").id,
            context.req.valid("json"),
            context.get("userId"),
          ),
        ),
        200,
      ),
  );

  route.openapi(
    createRoute({
      method: "get",
      path: "/{id}/price-history",
      tags: ["Products"],
      request: { params: ProductParamsSchema },
      responses: {
        200: {
          description: "Normalized price history by date, store and weekday",
          content: { "application/json": { schema: PriceHistoryResponseSchema } },
        },
        401: errors[401],
        404: errors[404],
      },
    }),
    async (context) =>
      context.json(
        ok(await service.getPriceHistory(context.req.valid("param").id, context.get("userId"))),
        200,
      ),
  );
  return route;
}
