import { z } from "@hono/zod-openapi";
import { bodyMeasurementKinds } from "@openmonetis/domain/body-measurements";
import { receiptMatchSources, receiptMaximumLines } from "@openmonetis/domain/receipt-capture";
import { paymentMethods } from "@openmonetis/domain/transactions";

const amountSchema = z.number().finite().nonnegative().max(999_999.99);
const optionalText = (maximumLength: number) => z.string().trim().max(maximumLength).nullable();

/**
 * What Claude must return for one WhatsApp message. It is also handed to `claude -p` as the JSON
 * Schema of the structured output, so the descriptions are instructions for the model.
 */
export const ReceiptExtractionLineSchema = z.object({
  extractedName: z
    .string()
    .trim()
    .min(1)
    .max(160)
    .describe("Item name exactly as printed on the receipt, abbreviations included."),
  packageCount: z
    .number()
    .positive()
    .max(9_999)
    .nullable()
    .describe("Number of units bought. Null for bulk items sold by weight or volume."),
  totalContent: z
    .number()
    .positive()
    .max(999_999)
    .nullable()
    .describe(
      "Total grams or milliliters when the receipt prints a weight or volume for a bulk item (e.g. 0.350 kg -> 350). Null otherwise.",
    ),
  paidAmount: z
    .number()
    .positive()
    .max(999_999.99)
    .describe("Amount paid for the line in BRL after its discount."),
  discountAmount: amountSchema.describe("Discount applied to the line in BRL, 0 when none."),
  productId: z
    .string()
    .nullable()
    .describe("Catalog product id when the line is clearly that product, otherwise null."),
});

export const ReceiptExtractionSchema = z.object({
  storeName: optionalText(120).describe("Store or company name, without the branch."),
  storeBranch: optionalText(80).describe("Branch label such as 'Loja 014', or null."),
  storeNeighborhood: optionalText(120),
  storeAddress: optionalText(255).describe("Street and number."),
  storeId: z
    .string()
    .nullable()
    .describe("Catalog store id when it is clearly the same store and branch, otherwise null."),
  purchasedAt: z
    .string()
    .nullable()
    .describe("Issue date and time as ISO 8601 with the -03:00 offset, or null when unreadable."),
  paymentMethod: z.enum(paymentMethods).nullable(),
  totalAmount: amountSchema.nullable().describe("Total paid in BRL as printed on the receipt."),
  items: z.array(ReceiptExtractionLineSchema).max(receiptMaximumLines),
  warnings: z
    .array(z.string().trim().min(1).max(200))
    .max(10)
    .describe("Short notes in Brazilian Portuguese about unreadable or doubtful fields."),
});

export const MeasurementExtractionSchema = z.object({
  measuredOn: z
    .string()
    .nullable()
    .describe("Date of the measurement as YYYY-MM-DD, or null to use the day the message arrived."),
  entries: z
    .array(
      z.object({
        kind: z.enum(bodyMeasurementKinds),
        value: z
          .number()
          .positive()
          .max(9_999.99)
          .describe("Kilograms for weight, centimeters for every tape measurement."),
      }),
    )
    .max(bodyMeasurementKinds.length),
});

export const MessageExtractionSchema = z.object({
  receipts: z
    .array(ReceiptExtractionSchema)
    .max(10)
    .describe("One entry per receipt or expense found in the message."),
  measurements: MeasurementExtractionSchema.nullable().describe(
    "Body weight or tape measurements the user is recording, or null.",
  ),
  question: optionalText(1000).describe(
    "When the message asks something or requests an answer instead of (or besides) recording data, the request rewritten as a clear standalone question in Brazilian Portuguese. Otherwise null.",
  ),
  warnings: z
    .array(z.string().trim().min(1).max(200))
    .max(10)
    .describe(
      "Short notes in Brazilian Portuguese about measurements that could not be recorded, such as a limb without its side.",
    ),
  notice: optionalText(300).describe(
    "When the message has no expense, measurement or question, a short explanation in Brazilian Portuguese. Otherwise null.",
  ),
});

/** Second step for questions: the answer sent back on WhatsApp. */
export const MessageAnswerSchema = z.object({
  answer: z
    .string()
    .trim()
    .min(1)
    .max(3000)
    .describe("Answer in Brazilian Portuguese, formatted for WhatsApp."),
});

export const InboxReceiptLineOutputSchema = z
  .object({
    id: z.uuid(),
    position: z.number().int().nonnegative(),
    extractedName: z.string(),
    productId: z.uuid().nullable(),
    productMatch: z.enum(receiptMatchSources),
    packageCount: z.number().positive().nullable(),
    totalContent: z.number().positive().nullable(),
    paidAmount: z.number().positive(),
    discountAmount: z.number().nonnegative(),
  })
  .openapi("InboxReceiptLine");

export const InboxReceiptOutputSchema = z
  .object({
    storeId: z.uuid().nullable(),
    storeMatch: z.enum(receiptMatchSources),
    storeName: z.string().nullable(),
    storeBranch: z.string().nullable(),
    storeNeighborhood: z.string().nullable(),
    storeAddress: z.string().nullable(),
    paymentMethod: z.enum(paymentMethods).nullable(),
    itemsAmount: z.number().nonnegative(),
    totalMismatch: z.boolean(),
    warnings: z.array(z.string()),
    hasMedia: z.boolean(),
    lines: z.array(InboxReceiptLineOutputSchema),
  })
  .openapi("InboxReceipt");

export type ReceiptExtraction = z.infer<typeof ReceiptExtractionSchema>;
export type MessageExtraction = z.infer<typeof MessageExtractionSchema>;
export type MessageAnswer = z.infer<typeof MessageAnswerSchema>;
export type InboxReceiptOutput = z.infer<typeof InboxReceiptOutputSchema>;
export type InboxReceiptLineOutput = z.infer<typeof InboxReceiptLineOutputSchema>;
