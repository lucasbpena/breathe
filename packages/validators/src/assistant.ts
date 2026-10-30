import { z } from "@hono/zod-openapi";
import { whatsappCaptureMaximumTextLength } from "@openmonetis/domain/receipt-capture";
import { MessageExtractionSchema } from "./receipt-capture";

export const AssistantExtractionInputSchema = z
  .object({
    externalId: z.string().trim().min(1).max(128),
    senderNumber: z.string().trim().min(1).max(20),
    kind: z.enum(["text", "image"]),
    text: z.string().trim().max(whatsappCaptureMaximumTextLength).nullable(),
    receivedAt: z.iso.datetime({ offset: true }),
    extraction: MessageExtractionSchema,
  })
  .openapi("AssistantExtractionInput");

export const AssistantExtractionOutputSchema = z
  .object({ reply: z.string() })
  .openapi("AssistantExtractionOutput");

export const AssistantCatalogOutputSchema = z
  .object({
    products: z.array(
      z.object({
        id: z.uuid(),
        name: z.string(),
        aliases: z.array(z.string()),
        unit: z.string(),
      }),
    ),
    stores: z.array(
      z.object({
        id: z.uuid(),
        name: z.string(),
        branch: z.string().nullable(),
        neighborhood: z.string().nullable(),
      }),
    ),
  })
  .openapi("AssistantCatalog");

export const AssistantExtractionTemplateOutputSchema = z
  .object({
    prompt: z.string(),
    outputSchema: z.record(z.string(), z.unknown()),
  })
  .openapi("AssistantExtractionTemplate");

export type AssistantExtractionInput = z.infer<typeof AssistantExtractionInputSchema>;
