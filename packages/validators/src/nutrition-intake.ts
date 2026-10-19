import { z } from "@hono/zod-openapi";
import { productContentUnits } from "@openmonetis/domain/products";

/** One year is enough for the charts and keeps the daily series small. */
export const maxNutritionIntakeDays = 366;

const dateSchema = z.iso.date();

export const NutritionIntakeQuerySchema = z
  .object({
    from: dateSchema.openapi({ param: { name: "from", in: "query" }, example: "2026-10-01" }),
    to: dateSchema.openapi({ param: { name: "to", in: "query" }, example: "2026-10-31" }),
  })
  .superRefine((query, context) => {
    const days = (Date.parse(query.to) - Date.parse(query.from)) / 86_400_000 + 1;
    if (days < 1) {
      context.addIssue({ code: "custom", path: ["to"], message: "to must not be before from" });
    } else if (days > maxNutritionIntakeDays) {
      context.addIssue({
        code: "custom",
        path: ["to"],
        message: `Period must have at most ${maxNutritionIntakeDays} days`,
      });
    }
  })
  .openapi("NutritionIntakeQuery");

const amountSchema = z.number().nonnegative();

export const NutrientAmountsOutputSchema = z
  .object({
    energyKcal: amountSchema,
    proteinGrams: amountSchema,
    carbohydrateGrams: amountSchema,
    addedSugarGrams: amountSchema,
    fatGrams: amountSchema,
  })
  .openapi("NutrientAmounts");

const percentSchema = z.number().min(0).max(100);

export const NutritionIntakeOutputSchema = z
  .object({
    from: dateSchema,
    to: dateSchema,
    dayCount: z.number().int().positive(),
    totals: NutrientAmountsOutputSchema,
    dailyAverage: NutrientAmountsOutputSchema,
    energyShare: z
      .object({ protein: percentSchema, carbohydrate: percentSchema, fat: percentSchema })
      .nullable(),
    days: z.array(NutrientAmountsOutputSchema.extend({ date: dateSchema })),
    products: z.array(
      z.object({
        productId: z.uuid(),
        productName: z.string(),
        contentUnit: z.enum(productContentUnits),
        lineCount: z.number().int().positive(),
        totalContent: z.number().positive(),
        hasCalories: z.boolean(),
        nutrients: NutrientAmountsOutputSchema,
      }),
    ),
    lineCount: z.number().int().nonnegative(),
    linesWithoutCalories: z.number().int().nonnegative(),
  })
  .openapi("NutritionIntake");

export type NutritionIntakeQuery = z.infer<typeof NutritionIntakeQuerySchema>;
export type NutrientAmountsOutput = z.infer<typeof NutrientAmountsOutputSchema>;
export type NutritionIntakeOutput = z.infer<typeof NutritionIntakeOutputSchema>;
