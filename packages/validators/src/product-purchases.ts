import { z } from "@hono/zod-openapi";
import { productContentUnits } from "@openmonetis/domain/products";
import { productContentSchema } from "./products";

const amountSchema = z.number().finite().multipleOf(0.01).nonnegative().max(9_999_999_999.99);

const purchaseLineShape = {
  productId: z.uuid(),
  storeId: z.uuid(),
  extractedName: z.string().trim().min(1).max(160).nullable().optional(),
  packageCount: productContentSchema.nullable().optional(),
  totalContent: productContentSchema.nullable().optional(),
  paidAmount: amountSchema.positive(),
  discountAmount: amountSchema.default(0),
};

function hasQuantity(input: { packageCount?: number | null; totalContent?: number | null }) {
  return input.packageCount != null || input.totalContent != null;
}

const quantityMessage = {
  message: "Provide packageCount or totalContent",
  path: ["packageCount"],
};

export const CreateProductPurchaseInputSchema = z
  .object({ transactionId: z.uuid(), ...purchaseLineShape })
  .refine(hasQuantity, quantityMessage)
  .openapi("CreateProductPurchaseInput");

export const ReplaceProductPurchaseInputSchema = z
  .object(purchaseLineShape)
  .refine(hasQuantity, quantityMessage)
  .openapi("ReplaceProductPurchaseInput");

export const CreateProductPurchasesInputSchema = z
  .object({
    transactionId: z.uuid(),
    items: z.array(ReplaceProductPurchaseInputSchema).min(1).max(100),
  })
  .openapi("CreateProductPurchasesInput");

export const ProductPurchaseParamsSchema = z
  .object({ id: z.uuid().openapi({ param: { name: "id", in: "path" } }) })
  .openapi("ProductPurchaseParams");

export const TransactionProductPurchasesParamsSchema = z
  .object({
    transactionId: z.uuid().openapi({ param: { name: "transactionId", in: "path" } }),
  })
  .openapi("TransactionProductPurchasesParams");

export const ProductPurchasesByProductParamsSchema = z
  .object({ productId: z.uuid().openapi({ param: { name: "productId", in: "path" } }) })
  .openapi("ProductPurchasesByProductParams");

export const ProductPurchaseOutputSchema = z
  .object({
    id: z.uuid(),
    transactionId: z.uuid(),
    transactionName: z.string(),
    transactionPeriod: z.string().regex(/^[1-9]\d{3}-(0[1-9]|1[0-2])$/),
    purchaseDate: z.iso.date(),
    productId: z.uuid(),
    productName: z.string(),
    contentUnit: z.enum(productContentUnits),
    storeId: z.uuid(),
    storeName: z.string(),
    storeBranch: z.string().nullable(),
    storeNeighborhood: z.string().nullable(),
    extractedName: z.string().nullable(),
    packageCount: z.number().positive().nullable(),
    totalContent: z.number().positive(),
    paidAmount: z.number().positive(),
    discountAmount: z.number().nonnegative(),
    listAmount: z.number().positive(),
    pricePerPackage: z.number().nonnegative().nullable(),
    normalizedPrice: z.number().nonnegative(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi("ProductPurchase");

export const TransactionProductPurchasesOutputSchema = z
  .object({
    items: z.array(ProductPurchaseOutputSchema),
    summary: z.object({
      transactionAmount: z.number().nonnegative(),
      itemsAmount: z.number().nonnegative(),
      remainingAmount: z.number(),
    }),
  })
  .openapi("TransactionProductPurchases");

export type CreateProductPurchaseInput = z.infer<typeof CreateProductPurchaseInputSchema>;
export type ReplaceProductPurchaseInput = z.infer<typeof ReplaceProductPurchaseInputSchema>;
export type CreateProductPurchasesInput = z.infer<typeof CreateProductPurchasesInputSchema>;
export type ProductPurchaseOutput = z.infer<typeof ProductPurchaseOutputSchema>;
export type TransactionProductPurchasesOutput = z.infer<
  typeof TransactionProductPurchasesOutputSchema
>;
