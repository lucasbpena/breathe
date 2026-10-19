import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { ok } from "@openmonetis/shared/api";
import {
  CreateProductPurchaseInputSchema,
  CreateProductPurchasesInputSchema,
  ProductPurchaseOutputSchema,
  ProductPurchaseParamsSchema,
  ProductPurchasesByProductParamsSchema,
  ReplaceProductPurchaseInputSchema,
  TransactionProductPurchasesOutputSchema,
  TransactionProductPurchasesParamsSchema,
} from "@openmonetis/validators/product-purchases";
import type { ProductPurchasesService } from "../services/product-purchases.service";
import type { ApiVariables } from "../types/context";
import { ErrorResponseSchema as ErrorSchema, validationHook } from "../utils/openapi";

const PurchaseResponseSchema = z.object({ data: ProductPurchaseOutputSchema, error: z.null() });
const PurchasesResponseSchema = z.object({
  data: z.array(ProductPurchaseOutputSchema),
  error: z.null(),
});
const TransactionPurchasesResponseSchema = z.object({
  data: TransactionProductPurchasesOutputSchema,
  error: z.null(),
});
const DeleteResponseSchema = z.object({ data: z.object({ id: z.uuid() }), error: z.null() });
const errors = {
  400: {
    description: "Invalid purchase or transaction is not an expense",
    content: { "application/json": { schema: ErrorSchema } },
  },
  401: {
    description: "Authentication required",
    content: { "application/json": { schema: ErrorSchema } },
  },
  404: {
    description: "Purchase, transaction, product or store not found",
    content: { "application/json": { schema: ErrorSchema } },
  },
} as const;

export function createProductPurchasesRoute(service: ProductPurchasesService) {
  const route = new OpenAPIHono<{ Variables: ApiVariables }>({ defaultHook: validationHook });
  route.openapi(
    createRoute({
      method: "get",
      path: "/transaction/{transactionId}",
      tags: ["Product purchases"],
      request: { params: TransactionProductPurchasesParamsSchema },
      responses: {
        200: {
          description: "Receipt lines of an expense",
          content: { "application/json": { schema: TransactionPurchasesResponseSchema } },
        },
        ...errors,
      },
    }),
    async (context) =>
      context.json(
        ok(
          await service.listForTransaction(
            context.req.valid("param").transactionId,
            context.get("userId"),
          ),
        ),
        200,
      ),
  );

  route.openapi(
    createRoute({
      method: "get",
      path: "/product/{productId}",
      tags: ["Product purchases"],
      request: { params: ProductPurchasesByProductParamsSchema },
      responses: {
        200: {
          description: "Purchases of a product, newest first",
          content: { "application/json": { schema: PurchasesResponseSchema } },
        },
        401: errors[401],
        404: errors[404],
      },
    }),
    async (context) =>
      context.json(
        ok(
          await service.listForProduct(context.req.valid("param").productId, context.get("userId")),
        ),
        200,
      ),
  );

  route.openapi(
    createRoute({
      method: "post",
      path: "/",
      tags: ["Product purchases"],
      request: {
        body: {
          required: true,
          content: { "application/json": { schema: CreateProductPurchaseInputSchema } },
        },
      },
      responses: {
        201: {
          description: "Created receipt line",
          content: { "application/json": { schema: PurchaseResponseSchema } },
        },
        ...errors,
      },
    }),
    async (context) =>
      context.json(ok(await service.create(context.req.valid("json"), context.get("userId"))), 201),
  );

  route.openapi(
    createRoute({
      method: "post",
      path: "/batch",
      tags: ["Product purchases"],
      request: {
        body: {
          required: true,
          content: { "application/json": { schema: CreateProductPurchasesInputSchema } },
        },
      },
      responses: {
        201: {
          description: "Receipt lines created together; none are saved if one is invalid",
          content: { "application/json": { schema: TransactionPurchasesResponseSchema } },
        },
        ...errors,
      },
    }),
    async (context) =>
      context.json(
        ok(await service.createMany(context.req.valid("json"), context.get("userId"))),
        201,
      ),
  );

  route.openapi(
    createRoute({
      method: "put",
      path: "/{id}",
      tags: ["Product purchases"],
      request: {
        params: ProductPurchaseParamsSchema,
        body: {
          required: true,
          content: { "application/json": { schema: ReplaceProductPurchaseInputSchema } },
        },
      },
      responses: {
        200: {
          description: "Replaced receipt line",
          content: { "application/json": { schema: PurchaseResponseSchema } },
        },
        ...errors,
      },
    }),
    async (context) =>
      context.json(
        ok(
          await service.replace(
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
      tags: ["Product purchases"],
      request: { params: ProductPurchaseParamsSchema },
      responses: {
        200: {
          description: "Deleted receipt line",
          content: { "application/json": { schema: DeleteResponseSchema } },
        },
        401: errors[401],
        404: errors[404],
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
