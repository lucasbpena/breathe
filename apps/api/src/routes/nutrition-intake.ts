import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { ok } from "@openmonetis/shared/api";
import {
  NutritionIntakeOutputSchema,
  NutritionIntakeQuerySchema,
} from "@openmonetis/validators/nutrition-intake";
import type { NutritionIntakeService } from "../services/nutrition-intake.service";
import type { ApiVariables } from "../types/context";
import { ErrorResponseSchema as ErrorSchema, validationHook } from "../utils/openapi";

const NutritionIntakeResponseSchema = z.object({
  data: NutritionIntakeOutputSchema,
  error: z.null(),
});

export function createNutritionIntakeRoute(service: NutritionIntakeService) {
  const route = new OpenAPIHono<{ Variables: ApiVariables }>({ defaultHook: validationHook });

  route.openapi(
    createRoute({
      method: "get",
      path: "/",
      tags: ["Nutrition intake"],
      request: { query: NutritionIntakeQuerySchema },
      responses: {
        200: {
          description: "Calories and macros estimated from the receipt lines bought in the period",
          content: { "application/json": { schema: NutritionIntakeResponseSchema } },
        },
        400: {
          description: "Invalid period",
          content: { "application/json": { schema: ErrorSchema } },
        },
        401: {
          description: "Authentication required",
          content: { "application/json": { schema: ErrorSchema } },
        },
      },
    }),
    async (context) =>
      context.json(ok(await service.get(context.get("userId"), context.req.valid("query"))), 200),
  );

  return route;
}
