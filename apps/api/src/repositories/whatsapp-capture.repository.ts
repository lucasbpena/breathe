import {
  bodyMeasurementDraftEntries,
  bodyMeasurementDrafts,
  bodyMeasurements,
  db,
  inboxItems,
  inboxReceiptLines,
  inboxReceipts,
  productAliases,
  products,
  stores,
  whatsappMessages,
} from "@openmonetis/db";
import { and, asc, desc, eq, lt, sql } from "drizzle-orm";
import type { WhatsAppCaptureRepository } from "../services/whatsapp-capture.service";

export const whatsappCaptureRepository: WhatsAppCaptureRepository = {
  async findLatestReceivedAt(userId) {
    const [latest] = await db
      .select({ receivedAt: whatsappMessages.receivedAt })
      .from(whatsappMessages)
      .where(eq(whatsappMessages.userId, userId))
      .orderBy(desc(whatsappMessages.receivedAt))
      .limit(1);
    return latest?.receivedAt ?? null;
  },

  async insertMessage(userId, message) {
    const inserted = await db
      .insert(whatsappMessages)
      .values({ userId, ...message })
      .onConflictDoNothing({ target: [whatsappMessages.userId, whatsappMessages.externalId] })
      .returning({ id: whatsappMessages.id });
    return inserted.length > 0;
  },

  async listPending(userId, maximumAttempts, limit) {
    return db
      .select({
        id: whatsappMessages.id,
        externalId: whatsappMessages.externalId,
        senderNumber: whatsappMessages.senderNumber,
        kind: whatsappMessages.kind,
        text: whatsappMessages.text,
        mediaMimeType: whatsappMessages.mediaMimeType,
        media: whatsappMessages.media,
        receivedAt: whatsappMessages.receivedAt,
        attempts: whatsappMessages.attempts,
      })
      .from(whatsappMessages)
      .where(
        and(
          eq(whatsappMessages.userId, userId),
          eq(whatsappMessages.status, "pending"),
          lt(whatsappMessages.attempts, maximumAttempts),
        ),
      )
      .orderBy(asc(whatsappMessages.receivedAt), asc(whatsappMessages.id))
      .limit(limit);
  },

  async startAttempt(id, userId) {
    await db
      .update(whatsappMessages)
      .set({ attempts: sql`${whatsappMessages.attempts} + 1` })
      .where(and(eq(whatsappMessages.id, id), eq(whatsappMessages.userId, userId)));
  },

  async saveMedia(id, userId, media) {
    await db
      .update(whatsappMessages)
      .set({ mediaMimeType: media.mimeType, media: media.data })
      .where(and(eq(whatsappMessages.id, id), eq(whatsappMessages.userId, userId)));
  },

  async finish(id, userId, result) {
    await db
      .update(whatsappMessages)
      .set(result)
      .where(and(eq(whatsappMessages.id, id), eq(whatsappMessages.userId, userId)));
  },

  async loadCatalog(userId) {
    const [productRows, aliasRows, storeRows] = await Promise.all([
      db
        .select({ id: products.id, name: products.name, contentUnit: products.contentUnit })
        .from(products)
        .where(eq(products.userId, userId))
        .orderBy(asc(products.name)),
      db
        .select({ productId: productAliases.productId, name: productAliases.name })
        .from(productAliases)
        .where(eq(productAliases.userId, userId)),
      db
        .select({
          id: stores.id,
          name: stores.name,
          branch: stores.branch,
          neighborhood: stores.neighborhood,
        })
        .from(stores)
        .where(eq(stores.userId, userId))
        .orderBy(asc(stores.name)),
    ]);
    const aliases = new Map<string, string[]>();
    for (const alias of aliasRows) {
      aliases.set(alias.productId, [...(aliases.get(alias.productId) ?? []), alias.name]);
    }
    return {
      products: productRows.map((product) => ({
        ...product,
        aliases: aliases.get(product.id) ?? [],
      })),
      stores: storeRows,
    };
  },

  async createDrafts(userId, whatsappMessageId, drafts) {
    await db.transaction(async (transaction) => {
      for (const draft of drafts) {
        const [item] = await transaction
          .insert(inboxItems)
          .values({ userId, deviceTokenId: null, ...draft.item })
          .onConflictDoNothing({ target: [inboxItems.userId, inboxItems.clientId] })
          .returning({ id: inboxItems.id });
        // A retried message keeps the drafts it already created.
        if (!item) continue;
        await transaction
          .insert(inboxReceipts)
          .values({ inboxItemId: item.id, userId, whatsappMessageId, ...draft.receipt });
        if (draft.lines.length) {
          await transaction
            .insert(inboxReceiptLines)
            .values(draft.lines.map((line) => ({ ...line, userId, inboxItemId: item.id })));
        }
      }
    });
  },
  async createMeasurementDraft(userId, whatsappMessageId, draft) {
    await db.transaction(async (transaction) => {
      const [created] = await transaction
        .insert(bodyMeasurementDrafts)
        .values({
          userId,
          whatsappMessageId,
          measuredOn: draft.measuredOn,
          warnings: draft.warnings,
        })
        .onConflictDoNothing({ target: bodyMeasurementDrafts.whatsappMessageId })
        .returning({ id: bodyMeasurementDrafts.id });
      if (!created) return;
      await transaction
        .insert(bodyMeasurementDraftEntries)
        .values(draft.entries.map((entry) => ({ ...entry, userId, draftId: created.id })));
    });
  },

  listLatestMeasurements(userId) {
    return db
      .selectDistinctOn([bodyMeasurements.kind], {
        kind: bodyMeasurements.kind,
        value: bodyMeasurements.value,
        measuredOn: bodyMeasurements.measuredOn,
      })
      .from(bodyMeasurements)
      .where(eq(bodyMeasurements.userId, userId))
      .orderBy(bodyMeasurements.kind, desc(bodyMeasurements.measuredOn));
  },
};
