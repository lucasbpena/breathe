import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { ok } from "@openmonetis/shared/api";
import {
  BodyMeasurementDraftOutputSchema,
  BodyMeasurementOutputSchema,
  BodyMeasurementParamsSchema,
  BodyMeasurementsOverviewOutputSchema,
  RecordBodyMeasurementsInputSchema,
} from "@openmonetis/validators/body-measurements";
import type { BodyMeasurementsService } from "../services/body-measurements.service";
import type { ApiVariables } from "../types/context";
import { ErrorResponseSchema as ErrorSchema, validationHook } from "../utils/openapi";

const OverviewResponseSchema = z.object({
  data: BodyMeasurementsOverviewOutputSchema,
  error: z.null(),
});
const MeasurementsResponseSchema = z.object({
  data: z.array(BodyMeasurementOutputSchema),
  error: z.null(),
});
const DeleteResponseSchema = z.object({ data: z.object({ id: z.uuid() }), error: z.null() });
const DraftsResponseSchema = z.object({
  data: z.array(BodyMeasurementDraftOutputSchema),
  error: z.null(),
});
const errors = {
  400: {
    description: "Invalid body measurements",
    content: { "application/json": { schema: ErrorSchema } },
  },
  401: {
    description: "Authentication required",
    content: { "application/json": { schema: ErrorSchema } },
  },
  404: {
    description: "Body measurement not found",
    content: { "application/json": { schema: ErrorSchema } },
  },
} as const;

export function createBodyMeasurementsRoute(service: BodyMeasurementsService) {
  const route = new OpenAPIHono<{ Variables: ApiVariables }>({ defaultHook: validationHook });
  route.openapi(
    createRoute({
      method: "get",
      path: "/",
      tags: ["Body measurements"],
      responses: {
        200: {
          description: "Weight and tape measurements with their history, one trend per kind",
          content: { "application/json": { schema: OverviewResponseSchema } },
        },
        401: errors[401],
      },
    }),
    async (context) => context.json(ok(await service.overview(context.get("userId"))), 200),
  );

  route.openapi(
    createRoute({
      method: "post",
      path: "/",
      tags: ["Body measurements"],
      request: {
        body: {
          required: true,
          content: { "application/json": { schema: RecordBodyMeasurementsInputSchema } },
        },
      },
      responses: {
        201: {
          description: "Recorded measurements; a kind already measured on the date is replaced",
          content: { "application/json": { schema: MeasurementsResponseSchema } },
        },
        400: errors[400],
        401: errors[401],
      },
    }),
    async (context) =>
      context.json(ok(await service.record(context.req.valid("json"), context.get("userId"))), 201),
  );

  route.openapi(
    createRoute({
      method: "get",
      path: "/drafts",
      tags: ["Body measurements"],
      responses: {
        200: {
          description: "Measurements read from WhatsApp messages, waiting for confirmation",
          content: { "application/json": { schema: DraftsResponseSchema } },
        },
        401: errors[401],
      },
    }),
    async (context) => context.json(ok(await service.drafts(context.get("userId"))), 200),
  );

  route.openapi(
    createRoute({
      method: "post",
      path: "/drafts/{id}/confirm",
      tags: ["Body measurements"],
      request: {
        params: BodyMeasurementParamsSchema,
        body: {
          required: true,
          content: { "application/json": { schema: RecordBodyMeasurementsInputSchema } },
        },
      },
      responses: {
        201: {
          description: "Recorded measurements from a confirmed draft",
          content: { "application/json": { schema: MeasurementsResponseSchema } },
        },
        400: errors[400],
        401: errors[401],
        404: errors[404],
      },
    }),
    async (context) =>
      context.json(
        ok(
          await service.confirmDraft(
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
      path: "/drafts/{id}",
      tags: ["Body measurements"],
      request: { params: BodyMeasurementParamsSchema },
      responses: {
        200: {
          description: "Discarded draft",
          content: { "application/json": { schema: DeleteResponseSchema } },
        },
        401: errors[401],
        404: errors[404],
      },
    }),
    async (context) =>
      context.json(
        ok(await service.discardDraft(context.req.valid("param").id, context.get("userId"))),
        200,
      ),
  );

  route.openapi(
    createRoute({
      method: "delete",
      path: "/{id}",
      tags: ["Body measurements"],
      request: { params: BodyMeasurementParamsSchema },
      responses: {
        200: {
          description: "Deleted measurement",
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
