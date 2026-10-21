import { z } from "@hono/zod-openapi";
import { productContentUnits } from "@openmonetis/domain/products";

export const productContentSchema = z
  .number()
  .finite()
  .positive()
  .multipleOf(0.001)
  .max(999_999_999.999);
const nutrientSchema = z.number().finite().nonnegative().multipleOf(0.01).max(999_999.99);
const priceSchema = z.number().nonnegative();

export const CreateProductInputSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    categoryId: z.uuid(),
    contentUnit: z.enum(productContentUnits),
    packageContent: productContentSchema.nullable().optional(),
    energyKcal: nutrientSchema.nullable().optional(),
    proteinGrams: nutrientSchema.nullable().optional(),
    carbohydrateGrams: nutrientSchema.nullable().optional(),
    addedSugarGrams: nutrientSchema.nullable().optional(),
    fatGrams: nutrientSchema.nullable().optional(),
  })
  .openapi("CreateProductInput");

export const UpdateProductInputSchema = CreateProductInputSchema.partial()
  .refine((input) => Object.keys(input).length > 0, "Provide at least one field to update")
  .openapi("UpdateProductInput");

export const ProductParamsSchema = z
  .object({ id: z.uuid().openapi({ param: { name: "id", in: "path" } }) })
  .openapi("ProductParams");

export const ProductAliasParamsSchema = z
  .object({
    id: z.uuid().openapi({ param: { name: "id", in: "path" } }),
    aliasId: z.uuid().openapi({ param: { name: "aliasId", in: "path" } }),
  })
  .openapi("ProductAliasParams");

export const CreateProductAliasInputSchema = z
  .object({ name: z.string().trim().min(1).max(160) })
  .openapi("CreateProductAliasInput");

export const MergeProductsInputSchema = z
  .object({ sourceProductId: z.uuid() })
  .openapi("MergeProductsInput");

export const ResolveProductQuerySchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1)
      .max(160)
      .openapi({ param: { name: "name", in: "query" }, example: "MONSTER TRAD 473ML" }),
  })
  .openapi("ResolveProductQuery");

export const ResolvedProductOutputSchema = z
  .object({ productId: z.uuid().nullable() })
  .openapi("ResolvedProduct");

export const ProductAliasOutputSchema = z
  .object({ id: z.uuid(), name: z.string() })
  .openapi("ProductAlias");

export const ProductPriceSummaryOutputSchema = z
  .object({
    purchaseCount: z.number().int().nonnegative(),
    lastPrice: priceSchema.nullable(),
    lastPurchaseDate: z.iso.date().nullable(),
    averagePrice: priceSchema.nullable(),
    minPrice: priceSchema.nullable(),
    maxPrice: priceSchema.nullable(),
  })
  .openapi("ProductPriceSummary");

export const ProductOutputSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    categoryId: z.uuid().nullable(),
    categoryName: z.string().nullable(),
    categoryIcon: z.string().nullable(),
    categoryTracksNutrition: z.boolean(),
    contentUnit: z.enum(productContentUnits),
    packageContent: z.number().positive().nullable(),
    energyKcal: z.number().nonnegative().nullable(),
    proteinGrams: z.number().nonnegative().nullable(),
    carbohydrateGrams: z.number().nonnegative().nullable(),
    addedSugarGrams: z.number().nonnegative().nullable(),
    fatGrams: z.number().nonnegative().nullable(),
    aliases: z.array(ProductAliasOutputSchema),
    priceSummary: ProductPriceSummaryOutputSchema,
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi("Product");

export const ProductPriceHistoryOutputSchema = z
  .object({
    contentUnit: z.enum(productContentUnits),
    summary: ProductPriceSummaryOutputSchema,
    points: z.array(
      z.object({
        purchaseId: z.uuid(),
        purchaseDate: z.iso.date(),
        storeId: z.uuid(),
        normalizedPrice: priceSchema,
      }),
    ),
    stores: z.array(
      ProductPriceSummaryOutputSchema.extend({
        storeId: z.uuid(),
        storeName: z.string(),
        storeBranch: z.string().nullable(),
        storeNeighborhood: z.string().nullable(),
      }),
    ),
    weekdays: z.array(
      z.object({
        weekday: z.number().int().min(0).max(6),
        purchaseCount: z.number().int().nonnegative(),
        averagePrice: priceSchema.nullable(),
      }),
    ),
  })
  .openapi("ProductPriceHistory");

export type CreateProductInput = z.infer<typeof CreateProductInputSchema>;
export type UpdateProductInput = z.infer<typeof UpdateProductInputSchema>;
export type CreateProductAliasInput = z.infer<typeof CreateProductAliasInputSchema>;
export type MergeProductsInput = z.infer<typeof MergeProductsInputSchema>;
export type ProductAliasOutput = z.infer<typeof ProductAliasOutputSchema>;
export type ProductOutput = z.infer<typeof ProductOutputSchema>;
export type ProductPriceHistoryOutput = z.infer<typeof ProductPriceHistoryOutputSchema>;
export type ResolvedProductOutput = z.infer<typeof ResolvedProductOutputSchema>;
