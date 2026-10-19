import {
  bodyMeasurementDraftEntries,
  bodyMeasurementDrafts,
  bodyMeasurements,
  db,
} from "@openmonetis/db";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { BodyMeasurementsRepository } from "../services/body-measurements.service";

const measurementColumns = {
  id: bodyMeasurements.id,
  kind: bodyMeasurements.kind,
  value: bodyMeasurements.value,
  measuredOn: bodyMeasurements.measuredOn,
};

export const bodyMeasurementsRepository = {
  listByUser(userId) {
    return db
      .select(measurementColumns)
      .from(bodyMeasurements)
      .where(eq(bodyMeasurements.userId, userId))
      .orderBy(asc(bodyMeasurements.measuredOn), asc(bodyMeasurements.id));
  },
  upsertMany(userId, measuredOn, entries) {
    return db
      .insert(bodyMeasurements)
      .values(entries.map((entry) => ({ ...entry, userId, measuredOn })))
      .onConflictDoUpdate({
        target: [bodyMeasurements.userId, bodyMeasurements.kind, bodyMeasurements.measuredOn],
        set: { value: sql`excluded.value`, updatedAt: new Date() },
      })
      .returning(measurementColumns);
  },
  async deleteForUser(id, userId) {
    const [measurement] = await db
      .delete(bodyMeasurements)
      .where(and(eq(bodyMeasurements.id, id), eq(bodyMeasurements.userId, userId)))
      .returning({ id: bodyMeasurements.id });
    return measurement ?? null;
  },
  async listDraftsByUser(userId) {
    const drafts = await db
      .select({
        id: bodyMeasurementDrafts.id,
        measuredOn: bodyMeasurementDrafts.measuredOn,
        createdAt: bodyMeasurementDrafts.createdAt,
        warnings: bodyMeasurementDrafts.warnings,
      })
      .from(bodyMeasurementDrafts)
      .where(eq(bodyMeasurementDrafts.userId, userId))
      .orderBy(desc(bodyMeasurementDrafts.createdAt), desc(bodyMeasurementDrafts.id));
    if (!drafts.length) return [];
    const entries = await db
      .select({
        draftId: bodyMeasurementDraftEntries.draftId,
        kind: bodyMeasurementDraftEntries.kind,
        value: bodyMeasurementDraftEntries.value,
      })
      .from(bodyMeasurementDraftEntries)
      .where(
        and(
          eq(bodyMeasurementDraftEntries.userId, userId),
          inArray(
            bodyMeasurementDraftEntries.draftId,
            drafts.map((draft) => draft.id),
          ),
        ),
      );
    return drafts.map((draft) => ({
      ...draft,
      entries: entries
        .filter((entry) => entry.draftId === draft.id)
        .map(({ kind, value }) => ({ kind, value })),
    }));
  },
  confirmDraft(id, userId, measuredOn, entries) {
    return db.transaction(async (transaction) => {
      const [draft] = await transaction
        .delete(bodyMeasurementDrafts)
        .where(and(eq(bodyMeasurementDrafts.id, id), eq(bodyMeasurementDrafts.userId, userId)))
        .returning({ id: bodyMeasurementDrafts.id });
      if (!draft) return null;
      return transaction
        .insert(bodyMeasurements)
        .values(entries.map((entry) => ({ ...entry, userId, measuredOn })))
        .onConflictDoUpdate({
          target: [bodyMeasurements.userId, bodyMeasurements.kind, bodyMeasurements.measuredOn],
          set: { value: sql`excluded.value`, updatedAt: new Date() },
        })
        .returning(measurementColumns);
    });
  },
  async deleteDraftForUser(id, userId) {
    const [draft] = await db
      .delete(bodyMeasurementDrafts)
      .where(and(eq(bodyMeasurementDrafts.id, id), eq(bodyMeasurementDrafts.userId, userId)))
      .returning({ id: bodyMeasurementDrafts.id });
    return draft ?? null;
  },
} satisfies BodyMeasurementsRepository;
