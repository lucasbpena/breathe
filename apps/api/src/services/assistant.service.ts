import { z } from "@hono/zod-openapi";
import type { AssistantExtractionInput } from "@openmonetis/validators/assistant";
import { MessageExtractionSchema } from "@openmonetis/validators/receipt-capture";
import { formatMessageReply } from "./whatsapp-capture.reply";
import {
  recordExtraction,
  toPromptCatalog,
  type WhatsAppCaptureRepository,
} from "./whatsapp-capture.service";

export type AssistantRepository = Pick<
  WhatsAppCaptureRepository,
  | "loadCatalog"
  | "ensureProcessedMessage"
  | "createDrafts"
  | "createMeasurementDraft"
  | "listLatestMeasurements"
>;

/**
 * What an external message processor needs from Breathe. It reads the catalog, asks for the
 * extraction format and hands back what it read; Breathe keeps every rule and only creates drafts,
 * so nothing is saved without review.
 */
export function createAssistantService(
  repository: AssistantRepository,
  options: { loadExtractionPrompt(): Promise<string> },
) {
  return {
    async catalog(userId: string) {
      return toPromptCatalog(await repository.loadCatalog(userId));
    },

    async extractionTemplate() {
      return {
        prompt: await options.loadExtractionPrompt(),
        outputSchema: z.toJSONSchema(MessageExtractionSchema) as Record<string, unknown>,
      };
    },

    /** Safe to repeat: the same message never creates drafts twice. */
    async recordExtraction(userId: string, input: AssistantExtractionInput) {
      const { extraction, ...fields } = input;
      const message = { ...fields, receivedAt: new Date(input.receivedAt) };
      const id = await repository.ensureProcessedMessage(userId, message);
      const catalog = await repository.loadCatalog(userId);
      const { receipts, measurements } = await recordExtraction(
        repository,
        userId,
        { ...message, id },
        extraction,
        catalog,
      );
      return {
        reply: formatMessageReply({
          answer: null,
          // Answering needs the data snapshot, which this API does not expose yet.
          answerFailed: extraction.question !== null,
          receipts,
          catalog,
          measurements,
          warnings: extraction.warnings,
          notice: extraction.notice,
        }),
      };
    },
  };
}

export type AssistantService = ReturnType<typeof createAssistantService>;
