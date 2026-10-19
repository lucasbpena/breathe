import { createHash } from "node:crypto";
import {
  assertInboxItemTransition,
  type InboxClearableStatus,
  type InboxItemStatus,
  InboxTransitionError,
  isInboxNotificationTimestampAllowed,
  normalizeInboxSingleLine,
  summarizePendingInboxBySource,
} from "@openmonetis/domain/inbox";
import { resolveInboxRules } from "@openmonetis/domain/inbox-rules";
import type { ReceiptMatchSource } from "@openmonetis/domain/receipt-capture";
import type { PaymentMethod } from "@openmonetis/domain/transactions";
import type {
  CompanionInboxItemInput,
  InboxItemOutput,
  InboxItemSummaryOutput,
  InboxPageOutput,
  InboxSnapshotOutput,
  ListInboxItemsQuery,
} from "@openmonetis/validators/inbox";
import type { InboxReceiptOutput } from "@openmonetis/validators/receipt-capture";
import type { TransactionInput, TransactionOutput } from "@openmonetis/validators/transactions";
import { ApiError, badRequest, conflict, notFound } from "../utils/errors";
import { availableInboxRuleCandidates, type InboxRulesRepository } from "./inbox-rules.service";

export type InboxItemRecord = {
  id: string;
  userId: string;
  deviceTokenId: string | null;
  sourceApp: string;
  sourceAppName: string | null;
  originalTitle: string | null;
  originalText: string;
  notificationTimestamp: Date;
  parsedName: string | null;
  parsedAmount: string | null;
  clientId: string;
  payloadFingerprint: string;
  status: InboxItemStatus;
  transactionId: string | null;
  processedAt: Date | null;
  discardedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type InboxReceiptRecord = {
  inboxItemId: string;
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
  hasMedia: boolean;
  lines: {
    id: string;
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

type InboxItemDraft = Omit<
  InboxItemRecord,
  "id" | "status" | "transactionId" | "processedAt" | "discardedAt" | "createdAt" | "updatedAt"
>;

export type InboxRepository = {
  insertOrFind(draft: InboxItemDraft): Promise<{
    record: InboxItemRecord;
    duplicate: boolean;
  }>;
  listForUser(
    userId: string,
    query: ListInboxItemsQuery,
    matchingItemIds?: string[],
  ): Promise<{
    items: InboxItemRecord[];
    sourceApps: string[];
    notificationDates: string[];
    total: number;
    counts: Record<InboxItemStatus, number>;
    pendingAmountItems: Array<{ sourceAppName: string | null; amount: string | null }>;
    activeCards: Array<{ id: string; name: string; logo: string | null }>;
    activeAccounts: Array<{ id: string; name: string; logo: string | null }>;
  }>;
  listRuleCandidatesForUser(userId: string, query: ListInboxItemsQuery): Promise<InboxItemRecord[]>;
  snapshotForUser(
    userId: string,
    limit: number,
  ): Promise<{
    items: InboxItemRecord[];
    pendingCount: number;
  }>;
  findByIdForUser(id: string, userId: string): Promise<InboxItemRecord | null>;
  transactionExistsForUser(transactionId: string, userId: string): Promise<boolean>;
  transitionForUser(input: {
    id: string;
    userId: string;
    expectedStatus: InboxItemStatus;
    targetStatus: InboxItemStatus;
    transactionId?: string | null;
    changedAt: Date;
  }): Promise<InboxItemRecord | null>;
  deleteForUser(id: string, userId: string): Promise<boolean>;
  deleteByStatusForUser(status: InboxClearableStatus, userId: string): Promise<number>;
  listReceiptsForUser(userId: string, inboxItemIds: string[]): Promise<InboxReceiptRecord[]>;
  findMediaForUser(id: string, userId: string): Promise<{ mimeType: string; data: Buffer } | null>;
};

type InboxIngestionContext = {
  deviceTokenId: string;
  userId: string;
};

type InboxTransactionCreator = {
  createTransactionFromInbox(
    input: TransactionInput,
    userId: string,
    inboxItemId: string,
    confirmedAt: Date,
  ): Promise<TransactionOutput>;
};

type InboxBatchResult = {
  clientId: string | null;
  serverId: string | null;
  success: boolean;
  error: string | null;
};

export function createInboxService(
  repository: InboxRepository,
  options: {
    now?: () => Date;
    transactionCreator?: InboxTransactionCreator;
    rulesRepository?: Pick<InboxRulesRepository, "listActiveByUser">;
  } = {},
) {
  const now = options.now ?? (() => new Date());

  async function ingest(input: CompanionInboxItemInput, context: InboxIngestionContext) {
    const draft = buildDraft(input, context, now());
    const result = await repository.insertOrFind(draft);

    if (result.record.payloadFingerprint !== draft.payloadFingerprint) {
      throw conflict(
        "The notification identifier was already used with different content",
        "inbox_idempotency_conflict",
      );
    }

    return {
      clientId: input.clientId ?? null,
      id: result.record.id,
      duplicate: result.duplicate,
    };
  }

  return {
    ingest,

    async ingestBatch(inputs: CompanionInboxItemInput[], context: InboxIngestionContext) {
      const seen = new Map<string, string>();
      const results: InboxBatchResult[] = [];

      for (const input of inputs) {
        try {
          const draft = buildDraft(input, context, now());
          const previousFingerprint = seen.get(draft.clientId);
          if (previousFingerprint && previousFingerprint !== draft.payloadFingerprint) {
            throw conflict(
              "The notification identifier is duplicated with different content",
              "inbox_idempotency_conflict",
            );
          }
          seen.set(draft.clientId, draft.payloadFingerprint);

          const result = await repository.insertOrFind(draft);
          if (result.record.payloadFingerprint !== draft.payloadFingerprint) {
            throw conflict(
              "The notification identifier was already used with different content",
              "inbox_idempotency_conflict",
            );
          }

          results.push({
            clientId: input.clientId ?? null,
            serverId: result.record.id,
            success: true,
            error: null,
          });
        } catch (error) {
          if (!(error instanceof ApiError)) throw error;

          results.push({
            clientId: input.clientId ?? null,
            serverId: null,
            success: false,
            error: error.code,
          });
        }
      }

      return results;
    },

    async list(query: ListInboxItemsQuery, userId: string): Promise<InboxPageOutput> {
      let matchingItemIds: string[] | undefined;
      if (query.ruleId) {
        if (!options.rulesRepository) throw new Error("Inbox rules repository is not configured");
        const rules = availableInboxRuleCandidates(
          await options.rulesRepository.listActiveByUser(userId),
        );
        if (rules.some((rule) => rule.id === query.ruleId)) {
          const candidates = await repository.listRuleCandidatesForUser(userId, query);
          matchingItemIds = candidates
            .filter((item) =>
              resolveInboxRules(
                {
                  sourceApp: item.sourceApp,
                  sourceAppName: item.sourceAppName,
                  originalTitle: item.originalTitle,
                  originalText: item.originalText,
                  parsedName: item.parsedName,
                  parsedAmount: item.parsedAmount === null ? null : Number(item.parsedAmount),
                },
                rules,
              ).appliedRules.some((rule) => rule.id === query.ruleId),
            )
            .map((item) => item.id);
        } else {
          matchingItemIds = [];
        }
      }
      const result = await repository.listForUser(userId, query, matchingItemIds);
      const pendingSummary = summarizePendingInboxBySource(
        result.pendingAmountItems.map((item) => ({
          sourceAppName: item.sourceAppName,
          amount: item.amount === null ? null : Number(item.amount),
        })),
        result.activeCards,
        result.activeAccounts,
      );
      const receipts = await loadReceipts(result.items, userId);
      return {
        items: result.items.map((item) => toSummaryOutput(item, receipts.get(item.id))),
        sourceApps: result.sourceApps,
        notificationDates: result.notificationDates,
        counts: result.counts,
        page: query.page,
        pageSize: query.pageSize,
        total: result.total,
        totalPages: Math.max(1, Math.ceil(result.total / query.pageSize)),
        pendingSummary,
      };
    },

    async snapshot(userId: string, limit: number): Promise<InboxSnapshotOutput> {
      const result = await repository.snapshotForUser(userId, limit);
      return {
        pendingCount: result.pendingCount,
        recentItems: result.items.map((item) => ({
          id: item.id,
          sourceAppName: item.sourceAppName,
          parsedName: item.parsedName,
          parsedAmount: item.parsedAmount === null ? null : Number(item.parsedAmount),
          notificationTimestamp: item.notificationTimestamp.toISOString(),
        })),
      };
    },

    async get(id: string, userId: string): Promise<InboxItemOutput> {
      const item = await findItem(id, userId, repository);
      const receipts = await loadReceipts([item], userId);
      return toOutput(item, receipts.get(item.id));
    },

    /** The photo a WhatsApp capture was read from. */
    async media(id: string, userId: string) {
      const media = await repository.findMediaForUser(id, userId);
      if (!media) throw notFound("Inbox media not found", "inbox_media_not_found");
      return media;
    },

    async discard(id: string, userId: string) {
      return transition(id, userId, "discarded");
    },

    async restore(id: string, userId: string) {
      return transition(id, userId, "pending");
    },

    async process(id: string, transactionId: string, userId: string) {
      const ownedTransaction = await repository.transactionExistsForUser(transactionId, userId);
      if (!ownedTransaction) {
        throw notFound("Transaction not found", "transaction_not_found");
      }
      return transition(id, userId, "processed", transactionId);
    },

    async confirm(id: string, input: TransactionInput, userId: string) {
      const current = await findItem(id, userId, repository);
      assertAllowedTransition(current.status, "processed");
      if (!options.transactionCreator) {
        throw new Error("Inbox transaction creator is not configured");
      }
      return options.transactionCreator.createTransactionFromInbox(input, userId, id, now());
    },

    async remove(id: string, userId: string) {
      const item = await findItem(id, userId, repository);
      if (item.status === "pending") {
        throw badRequest("Pending inbox items cannot be deleted", "pending_inbox_item_read_only");
      }
      const deleted = await repository.deleteForUser(id, userId);
      if (!deleted) throw notFound("Inbox item not found", "inbox_item_not_found");
      return { id };
    },

    async clear(status: InboxClearableStatus, userId: string) {
      const deletedCount = await repository.deleteByStatusForUser(status, userId);
      return { status, deletedCount };
    },
  };

  async function transition(
    id: string,
    userId: string,
    targetStatus: InboxItemStatus,
    transactionId: string | null = null,
  ): Promise<InboxItemSummaryOutput> {
    const current = await findItem(id, userId, repository);
    assertAllowedTransition(current.status, targetStatus);

    const updated = await repository.transitionForUser({
      id,
      userId,
      expectedStatus: current.status,
      targetStatus,
      transactionId,
      changedAt: now(),
    });
    if (!updated) {
      throw conflict("The inbox item changed. Reload and try again", "inbox_item_state_conflict");
    }
    const receipts = await loadReceipts([updated], userId);
    return toSummaryOutput(updated, receipts.get(updated.id));
  }

  async function loadReceipts(items: InboxItemRecord[], userId: string) {
    const receipts = items.length
      ? await repository.listReceiptsForUser(
          userId,
          items.map((item) => item.id),
        )
      : [];
    return new Map(receipts.map((receipt) => [receipt.inboxItemId, receipt]));
  }
}

function assertAllowedTransition(currentStatus: InboxItemStatus, targetStatus: InboxItemStatus) {
  try {
    assertInboxItemTransition(currentStatus, targetStatus);
  } catch (error) {
    if (!(error instanceof InboxTransitionError)) throw error;
    throw conflict(error.message, error.code);
  }
}

function buildDraft(
  input: CompanionInboxItemInput,
  context: InboxIngestionContext,
  now: Date,
): InboxItemDraft {
  const notificationTimestamp = parseCompanionNotificationTimestamp(input);
  if (!isInboxNotificationTimestampAllowed(notificationTimestamp, now)) {
    throw badRequest(
      "Notification timestamp is outside the accepted range",
      "inbox_notification_timestamp_invalid",
    );
  }

  const normalized = {
    sourceApp: input.sourceApp.trim(),
    sourceAppName: input.sourceAppName ? normalizeInboxSingleLine(input.sourceAppName) : null,
    originalTitle: input.originalTitle ? normalizeInboxSingleLine(input.originalTitle) : null,
    originalText: normalizeInboxSingleLine(input.originalText),
    notificationTimestamp: notificationTimestamp.toISOString(),
    parsedName: input.parsedName ? normalizeInboxSingleLine(input.parsedName) : null,
    parsedAmount: input.parsedAmount ?? null,
  };
  const payloadFingerprint = createHash("sha256")
    .update(JSON.stringify(normalized), "utf8")
    .digest("hex");

  return {
    userId: context.userId,
    deviceTokenId: context.deviceTokenId,
    sourceApp: normalized.sourceApp,
    sourceAppName: normalized.sourceAppName,
    originalTitle: normalized.originalTitle,
    originalText: normalized.originalText,
    notificationTimestamp,
    parsedName: normalized.parsedName,
    parsedAmount: normalized.parsedAmount === null ? null : normalized.parsedAmount.toFixed(2),
    clientId: input.clientId ?? `legacy_${payloadFingerprint}`,
    payloadFingerprint,
  };
}

function parseCompanionNotificationTimestamp(input: CompanionInboxItemInput) {
  if (input.timestampFormatVersion === 2) {
    return new Date(input.notificationTimestamp);
  }

  // Companion <= 1.5.2 formatted the device's local wall clock and appended a literal `Z`,
  // incorrectly labelling Brazil time as UTC. Preserve compatibility until legacy clients retire.
  return new Date(input.notificationTimestamp.replace(/Z$/i, "-03:00"));
}

async function findItem(id: string, userId: string, repository: InboxRepository) {
  const item = await repository.findByIdForUser(id, userId);
  if (!item) throw notFound("Inbox item not found", "inbox_item_not_found");
  return item;
}

function toOutput(record: InboxItemRecord, receipt?: InboxReceiptRecord): InboxItemOutput {
  return {
    ...toSummaryOutput(record, receipt),
    sourceApp: record.sourceApp,
    originalTitle: record.originalTitle,
    originalText: record.originalText,
  };
}

function toSummaryOutput(
  record: InboxItemRecord,
  receipt?: InboxReceiptRecord,
): InboxItemSummaryOutput {
  return {
    id: record.id,
    sourceAppName: record.sourceAppName,
    originalText: record.originalText,
    notificationTimestamp: record.notificationTimestamp.toISOString(),
    parsedName: record.parsedName,
    parsedAmount: record.parsedAmount === null ? null : Number(record.parsedAmount),
    status: record.status,
    transactionId: record.transactionId,
    processedAt: record.processedAt?.toISOString() ?? null,
    discardedAt: record.discardedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    receipt: receipt ? toReceiptOutput(receipt) : null,
  };
}

function toReceiptOutput(receipt: InboxReceiptRecord): InboxReceiptOutput {
  return {
    storeId: receipt.storeId,
    // A deleted store or product leaves the id empty, so the match no longer holds.
    storeMatch: receipt.storeId ? receipt.storeMatch : "none",
    storeName: receipt.storeName,
    storeBranch: receipt.storeBranch,
    storeNeighborhood: receipt.storeNeighborhood,
    storeAddress: receipt.storeAddress,
    paymentMethod: receipt.paymentMethod,
    itemsAmount: Number(receipt.itemsAmount),
    totalMismatch: receipt.totalMismatch,
    warnings: receipt.warnings,
    hasMedia: receipt.hasMedia,
    lines: receipt.lines.map((line) => ({
      id: line.id,
      position: line.position,
      extractedName: line.extractedName,
      productId: line.productId,
      productMatch: line.productId ? line.productMatch : "none",
      packageCount: line.packageCount === null ? null : Number(line.packageCount),
      totalContent: line.totalContent === null ? null : Number(line.totalContent),
      paidAmount: Number(line.paidAmount),
      discountAmount: Number(line.discountAmount),
    })),
  };
}

export type InboxService = ReturnType<typeof createInboxService>;
