import { createHash } from "node:crypto";
import {
  type BodyMeasurementKind,
  reconcileCapturedMeasurements,
} from "@openmonetis/domain/body-measurements";
import type { ProductContentUnit } from "@openmonetis/domain/products";
import {
  type CaptureCatalog,
  findSelfSender,
  type ReceiptMatchSource,
  type ReconciledReceipt,
  reconcileReceipt,
  type WhatsAppMessageKey,
  type WhatsAppMessageKind,
  type WhatsAppMessageStatus,
  whatsappCaptureMaximumAttempts,
  whatsappCaptureMaximumMediaBytes,
  whatsappCaptureMaximumTextLength,
  whatsappCaptureSourceApp,
  whatsappCaptureSourceAppName,
} from "@openmonetis/domain/receipt-capture";
import type { PaymentMethod } from "@openmonetis/domain/transactions";
import { formatDateInBrazil, getCurrentDateInBrazil } from "@openmonetis/shared/date-time";
import {
  type MessageExtraction,
  MessageExtractionSchema,
} from "@openmonetis/validators/receipt-capture";
import {
  formatFailureReply,
  formatMessageReply,
  type MeasurementReply,
  unsupportedMessageReply,
} from "./whatsapp-capture.reply";

/** A failure while handling one message; transient ones are tried again on the next cycles. */
export class CaptureError extends Error {
  constructor(
    readonly code: string,
    readonly transient: boolean,
    options?: ErrorOptions,
  ) {
    super(code, options);
    this.name = "CaptureError";
  }
}

export type WhatsAppIncomingMessage = {
  id: string;
  key: WhatsAppMessageKey;
  type: WhatsAppMessageKind;
  text: string | null;
  receivedAt: Date;
};

export type WhatsAppGateway = {
  listMessages(from: Date, to: Date): Promise<WhatsAppIncomingMessage[]>;
  downloadMedia(messageId: string): Promise<{ mimeType: string; base64: string }>;
  sendText(number: string, text: string): Promise<string | null>;
};

export type ClaudeExtractionRunner = (input: {
  text: string;
  image: { mimeType: string; base64: string } | null;
}) => Promise<unknown>;

export type WhatsAppMessageRecord = {
  id: string;
  externalId: string;
  senderNumber: string;
  kind: WhatsAppMessageKind;
  text: string | null;
  mediaMimeType: string | null;
  media: Buffer | null;
  receivedAt: Date;
  attempts: number;
};

export type WhatsAppCaptureCatalog = {
  products: (CaptureCatalog["products"][number] & { contentUnit: ProductContentUnit })[];
  stores: (CaptureCatalog["stores"][number] & { neighborhood: string | null })[];
};

export type InboxReceiptDraft = {
  item: {
    clientId: string;
    sourceApp: string;
    sourceAppName: string;
    originalTitle: string | null;
    originalText: string;
    notificationTimestamp: Date;
    parsedName: string | null;
    parsedAmount: string | null;
    payloadFingerprint: string;
  };
  receipt: {
    storeId: string | null;
    storeMatch: ReceiptMatchSource;
    storeName: string | null;
    storeBranch: string | null;
    storeNeighborhood: string | null;
    storeAddress: string | null;
    paymentMethod: PaymentMethod | null;
    itemsAmount: string;
    totalMismatch: boolean;
    warnings: string[];
  };
  lines: {
    position: number;
    extractedName: string;
    productId: string | null;
    productMatch: ReceiptMatchSource;
    packageCount: string | null;
    totalContent: string | null;
    paidAmount: string;
    discountAmount: string;
  }[];
};

export type WhatsAppCaptureRepository = {
  findLatestReceivedAt(userId: string): Promise<Date | null>;
  /** Returns false when the message was already registered. */
  insertMessage(
    userId: string,
    message: Pick<
      WhatsAppMessageRecord,
      "externalId" | "senderNumber" | "kind" | "text" | "receivedAt"
    >,
  ): Promise<boolean>;
  listPending(
    userId: string,
    maximumAttempts: number,
    limit: number,
  ): Promise<WhatsAppMessageRecord[]>;
  startAttempt(id: string, userId: string): Promise<void>;
  saveMedia(id: string, userId: string, media: { mimeType: string; data: Buffer }): Promise<void>;
  finish(
    id: string,
    userId: string,
    result: {
      status: WhatsAppMessageStatus;
      errorCode: string | null;
      replyExternalId: string | null;
      processedAt: Date | null;
    },
  ): Promise<void>;
  loadCatalog(userId: string): Promise<WhatsAppCaptureCatalog>;
  createDrafts(
    userId: string,
    whatsappMessageId: string,
    drafts: InboxReceiptDraft[],
  ): Promise<void>;
  /** One pending measurement session per message; a retried message keeps the first one. */
  createMeasurementDraft(
    userId: string,
    whatsappMessageId: string,
    draft: {
      measuredOn: string;
      warnings: string[];
      entries: { kind: BodyMeasurementKind; value: string }[];
    },
  ): Promise<void>;
  listLatestMeasurements(
    userId: string,
  ): Promise<{ kind: BodyMeasurementKind; value: string; measuredOn: string }[]>;
};

/** Answers a question about the user's own data; built from read-only context. */
export type WhatsAppQuestionAnswerer = (
  question: string,
  receivedAt: Date,
  captured: CapturedInMessage,
) => Promise<string>;

/** What the same message recorded, still pending review, so the answer can take it into account. */
export type CapturedInMessage = {
  measurements: {
    measuredOn: string;
    entries: { kind: BodyMeasurementKind; value: number }[];
  } | null;
  receipts: { store: string | null; date: string | null; amount: number | null }[];
};

const supportedImageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const firstRunLookbackMs = 60 * 60 * 1000;
const maximumCatchUpMs = 48 * 60 * 60 * 1000;
const overlapMs = 10 * 60 * 1000;
const messagesPerCycle = 10;

export function createWhatsAppCaptureService(
  repository: WhatsAppCaptureRepository,
  options: {
    userId: string;
    selfNumber: string;
    gateway: WhatsAppGateway;
    runExtraction: ClaudeExtractionRunner;
    answerQuestion?: WhatsAppQuestionAnswerer;
    now?: () => Date;
  },
) {
  const { userId, selfNumber, gateway } = options;
  const now = options.now ?? (() => new Date());
  let cursor: Date | null = null;

  async function startingCursor(current: Date) {
    const latest = await repository.findLatestReceivedAt(userId);
    if (!latest) return new Date(current.getTime() - firstRunLookbackMs);
    return new Date(Math.max(latest.getTime(), current.getTime() - maximumCatchUpMs));
  }

  async function receive() {
    const current = now();
    cursor ??= await startingCursor(current);
    const messages = await gateway.listMessages(new Date(cursor.getTime() - overlapMs), current);
    let received = 0;
    for (const message of messages) {
      const senderNumber = findSelfSender(message.key, selfNumber);
      if (!senderNumber) continue;
      const inserted = await repository.insertMessage(userId, {
        externalId: message.id,
        senderNumber,
        kind: message.type,
        text: message.text?.slice(0, whatsappCaptureMaximumTextLength) ?? null,
        receivedAt: message.receivedAt,
      });
      if (inserted) received += 1;
    }
    cursor = current;
    return received;
  }

  async function processMessage(message: WhatsAppMessageRecord): Promise<WhatsAppMessageStatus> {
    const attempt = message.attempts + 1;
    await repository.startAttempt(message.id, userId);

    if (message.kind === "unsupported") {
      const replyExternalId = await reply(message, unsupportedMessageReply);
      await repository.finish(message.id, userId, {
        status: "ignored",
        errorCode: replyExternalId === undefined ? "reply_failed" : null,
        replyExternalId: replyExternalId ?? null,
        processedAt: now(),
      });
      return "ignored";
    }

    try {
      const image = message.kind === "image" ? await loadImage(message) : null;
      const catalog = await repository.loadCatalog(userId);
      const raw = await options.runExtraction({
        text: buildExtractionRequest(catalog, message.text, message.receivedAt),
        image,
      });
      const parsed = MessageExtractionSchema.safeParse(raw);
      if (!parsed.success) throw new CaptureError("invalid_extraction", true);
      const extraction = parsed.data;

      const receipts = extraction.receipts
        .map((receipt) => reconcileReceipt(receipt, catalog))
        .filter((receipt) => receipt.items.length > 0 || receipt.amount !== null);
      const drafts = receipts.map((receipt, index) => buildDraft(message, receipt, index));
      if (drafts.length) await repository.createDrafts(userId, message.id, drafts);

      const measurements = extraction.measurements?.entries.length
        ? await draftMeasurements(message, extraction.measurements, extraction.warnings)
        : null;

      let answer: string | null = null;
      let answerFailed = false;
      if (extraction.question) {
        try {
          answer = options.answerQuestion
            ? await options.answerQuestion(extraction.question, message.receivedAt, {
                measurements: measurements?.entries.length
                  ? { measuredOn: measurements.measuredOn, entries: measurements.entries }
                  : null,
                receipts: receipts.map((receipt) => ({
                  store: receipt.storeName,
                  date: receipt.purchasedAt,
                  amount: receipt.amount,
                })),
              })
            : null;
        } catch {
          answerFailed = true;
        }
      }

      const text = formatMessageReply({
        answer,
        answerFailed,
        receipts,
        catalog,
        measurements,
        warnings: extraction.warnings,
        notice: extraction.notice,
      });
      const replyExternalId = await reply(message, text);
      await repository.finish(message.id, userId, {
        status: "processed",
        errorCode: replyExternalId === undefined ? "reply_failed" : null,
        replyExternalId: replyExternalId ?? null,
        processedAt: now(),
      });
      return "processed";
    } catch (error) {
      const failure =
        error instanceof CaptureError
          ? error
          : new CaptureError("unexpected_error", true, { cause: error });
      const retry = failure.transient && attempt < whatsappCaptureMaximumAttempts;
      if (retry) {
        await repository.finish(message.id, userId, {
          status: "pending",
          errorCode: failure.code,
          replyExternalId: null,
          processedAt: null,
        });
        return "pending";
      }
      const replyExternalId = await reply(message, formatFailureReply(failure.code));
      await repository.finish(message.id, userId, {
        status: "failed",
        errorCode: failure.code,
        replyExternalId: replyExternalId ?? null,
        processedAt: now(),
      });
      return "failed";
    }
  }

  async function loadImage(message: WhatsAppMessageRecord) {
    if (message.media && message.mediaMimeType) {
      return { mimeType: message.mediaMimeType, base64: message.media.toString("base64") };
    }
    let media: { mimeType: string; base64: string };
    try {
      media = await gateway.downloadMedia(message.externalId);
    } catch (error) {
      throw new CaptureError("media_unavailable", true, { cause: error });
    }
    if (!supportedImageTypes.has(media.mimeType)) {
      throw new CaptureError("media_unsupported", false);
    }
    const data = Buffer.from(media.base64, "base64");
    if (!data.length || data.length > whatsappCaptureMaximumMediaBytes) {
      throw new CaptureError("media_too_large", false);
    }
    await repository.saveMedia(message.id, userId, { mimeType: media.mimeType, data });
    return { mimeType: media.mimeType, base64: media.base64 };
  }

  async function draftMeasurements(
    message: WhatsAppMessageRecord,
    captured: NonNullable<MessageExtraction["measurements"]>,
    warnings: string[],
  ): Promise<MeasurementReply> {
    const reconciled = reconcileCapturedMeasurements(
      captured,
      getCurrentDateInBrazil(message.receivedAt),
    );
    const kept = warnings.slice(0, 10);
    if (reconciled.entries.length) {
      await repository.createMeasurementDraft(userId, message.id, {
        measuredOn: reconciled.measuredOn,
        warnings: kept,
        entries: reconciled.entries.map((entry) => ({
          kind: entry.kind,
          value: entry.value.toFixed(2),
        })),
      });
    }
    const latest = await repository.listLatestMeasurements(userId);
    return {
      ...reconciled,
      warnings: kept,
      latest: new Map(
        latest.map((entry) => [
          entry.kind,
          { value: Number(entry.value), measuredOn: entry.measuredOn },
        ]),
      ),
    };
  }

  /** Replies only to the configured number. A failed reply never undoes the capture. */
  async function reply(message: WhatsAppMessageRecord, text: string) {
    try {
      return await gateway.sendText(message.senderNumber, text);
    } catch {
      return undefined;
    }
  }

  return {
    /** Fetches new messages, then works through the pending ones, oldest first. */
    async poll() {
      const received = await receive();
      const counts: Record<WhatsAppMessageStatus, number> = {
        pending: 0,
        processed: 0,
        failed: 0,
        ignored: 0,
      };
      const pending = await repository.listPending(
        userId,
        whatsappCaptureMaximumAttempts,
        messagesPerCycle,
      );
      for (const message of pending) counts[await processMessage(message)] += 1;
      return { received, ...counts };
    },
  };
}

/**
 * The message text goes inside tags so Claude reads it as data, next to the user's catalog and
 * the moment it arrived, which resolves words such as "hoje" and "ontem".
 */
export function buildExtractionRequest(
  catalog: WhatsAppCaptureCatalog,
  text: string | null,
  receivedAt: Date,
) {
  const products = catalog.products.map((product) => ({
    id: product.id,
    name: product.name,
    aliases: product.aliases,
    unit: product.contentUnit,
  }));
  const stores = catalog.stores.map((store) => ({
    id: store.id,
    name: store.name,
    branch: store.branch,
    neighborhood: store.neighborhood,
  }));
  const received = formatDateInBrazil(receivedAt, {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return [
    `<recebida_em>${getCurrentDateInBrazil(receivedAt)} (${received})</recebida_em>`,
    "<catalogo>",
    JSON.stringify({ products, stores }),
    "</catalogo>",
    "<mensagem>",
    text ?? "(sem texto; só a imagem)",
    "</mensagem>",
  ].join("\n");
}

function buildDraft(
  message: WhatsAppMessageRecord,
  receipt: ReconciledReceipt,
  index: number,
): InboxReceiptDraft {
  const parsedName = [receipt.storeName, receipt.storeBranch].filter(Boolean).join(" · ") || null;
  const purchasedAt = parsePurchasedAt(receipt.purchasedAt, message.receivedAt);
  const warnings = receipt.warnings.slice(0, 10);
  return {
    item: {
      clientId: `wpp_${message.externalId}_${index}`,
      sourceApp: whatsappCaptureSourceApp,
      sourceAppName: whatsappCaptureSourceAppName,
      originalTitle: null,
      originalText:
        message.text ??
        (message.kind === "image" ? "Foto enviada pelo WhatsApp" : "Mensagem do WhatsApp"),
      notificationTimestamp: purchasedAt,
      parsedName: parsedName?.slice(0, 160) ?? null,
      parsedAmount: receipt.amount && receipt.amount > 0 ? receipt.amount.toFixed(2) : null,
      payloadFingerprint: createHash("sha256")
        .update(JSON.stringify(receipt), "utf8")
        .digest("hex"),
    },
    receipt: {
      storeId: receipt.storeId,
      storeMatch: receipt.storeMatch,
      storeName: receipt.storeName,
      storeBranch: receipt.storeBranch,
      storeNeighborhood: receipt.storeNeighborhood,
      storeAddress: receipt.storeAddress,
      paymentMethod: receipt.paymentMethod,
      itemsAmount: receipt.itemsAmount.toFixed(2),
      totalMismatch: receipt.totalMismatch,
      warnings,
    },
    lines: receipt.items.map((line, position) => ({
      position,
      extractedName: line.extractedName,
      productId: line.productId,
      productMatch: line.productMatch,
      packageCount: line.packageCount === null ? null : line.packageCount.toFixed(3),
      totalContent: line.totalContent === null ? null : line.totalContent.toFixed(3),
      paidAmount: line.paidAmount.toFixed(2),
      discountAmount: line.discountAmount.toFixed(2),
    })),
  };
}

/** The receipt's own date when it is readable and not in the future, else when it was sent. */
function parsePurchasedAt(value: string | null, receivedAt: Date) {
  if (!value) return receivedAt;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.getTime() > receivedAt.getTime() + 60_000) {
    return receivedAt;
  }
  return parsed;
}

export type WhatsAppCaptureService = ReturnType<typeof createWhatsAppCaptureService>;
