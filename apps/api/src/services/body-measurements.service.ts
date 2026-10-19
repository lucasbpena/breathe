import {
  type BodyMeasurementKind,
  findLastMeasuredOn,
  getBodyMeasurementUnit,
  summarizeBodyMeasurements,
} from "@openmonetis/domain/body-measurements";
import type {
  BodyMeasurementDraftOutput,
  BodyMeasurementOutput,
  BodyMeasurementsOverviewOutput,
  RecordBodyMeasurementsInput,
} from "@openmonetis/validators/body-measurements";
import { notFound } from "../utils/errors";

export type BodyMeasurementRecord = {
  id: string;
  kind: BodyMeasurementKind;
  value: string;
  measuredOn: string;
};

export type BodyMeasurementDraftRecord = {
  id: string;
  measuredOn: string;
  createdAt: Date;
  warnings: string[];
  entries: { kind: BodyMeasurementKind; value: string }[];
};

type MeasurementEntry = { kind: BodyMeasurementKind; value: string };

export type BodyMeasurementsRepository = {
  listByUser(userId: string): Promise<BodyMeasurementRecord[]>;
  /** Replaces the value of a kind already measured on that date, in one statement. */
  upsertMany(
    userId: string,
    measuredOn: string,
    entries: { kind: BodyMeasurementKind; value: string }[],
  ): Promise<BodyMeasurementRecord[]>;
  deleteForUser(id: string, userId: string): Promise<{ id: string } | null>;
  listDraftsByUser(userId: string): Promise<BodyMeasurementDraftRecord[]>;
  /** Saves the measurements and removes the draft together; null when the draft is gone. */
  confirmDraft(
    id: string,
    userId: string,
    measuredOn: string,
    entries: MeasurementEntry[],
  ): Promise<BodyMeasurementRecord[] | null>;
  deleteDraftForUser(id: string, userId: string): Promise<{ id: string } | null>;
};

export function createBodyMeasurementsService(repository: BodyMeasurementsRepository) {
  return {
    async overview(userId: string): Promise<BodyMeasurementsOverviewOutput> {
      const records = await repository.listByUser(userId);
      return {
        lastMeasuredOn: findLastMeasuredOn(records),
        trends: summarizeBodyMeasurements(records),
      };
    },
    async record(input: RecordBodyMeasurementsInput, userId: string) {
      const records = await repository.upsertMany(userId, input.measuredOn, toEntries(input));
      return records.map(toOutput);
    },
    async drafts(userId: string): Promise<BodyMeasurementDraftOutput[]> {
      const [drafts, records] = await Promise.all([
        repository.listDraftsByUser(userId),
        repository.listByUser(userId),
      ]);
      const saved = new Map(
        records.map((record) => [`${record.kind}:${record.measuredOn}`, Number(record.value)]),
      );
      return drafts.map((draft) => ({
        id: draft.id,
        measuredOn: draft.measuredOn,
        createdAt: draft.createdAt.toISOString(),
        warnings: draft.warnings,
        entries: draft.entries.map((entry) => ({
          kind: entry.kind,
          unit: getBodyMeasurementUnit(entry.kind),
          value: Number(entry.value),
          currentValue: saved.get(`${entry.kind}:${draft.measuredOn}`) ?? null,
        })),
      }));
    },
    /** Confirms a draft with the values the user reviewed, which may differ from the ones read. */
    async confirmDraft(id: string, input: RecordBodyMeasurementsInput, userId: string) {
      const records = await repository.confirmDraft(id, userId, input.measuredOn, toEntries(input));
      if (!records) {
        throw notFound("Body measurement draft not found", "body_measurement_draft_not_found");
      }
      return records.map(toOutput);
    },
    async discardDraft(id: string, userId: string) {
      const draft = await repository.deleteDraftForUser(id, userId);
      if (!draft) {
        throw notFound("Body measurement draft not found", "body_measurement_draft_not_found");
      }
      return draft;
    },
    async remove(id: string, userId: string) {
      const measurement = await repository.deleteForUser(id, userId);
      if (!measurement) {
        throw notFound("Body measurement not found", "body_measurement_not_found");
      }
      return measurement;
    },
  };
}

function toEntries(input: RecordBodyMeasurementsInput): MeasurementEntry[] {
  return input.entries.map((entry) => ({ kind: entry.kind, value: entry.value.toFixed(2) }));
}

function toOutput(record: BodyMeasurementRecord): BodyMeasurementOutput {
  return {
    id: record.id,
    kind: record.kind,
    unit: getBodyMeasurementUnit(record.kind),
    value: Number(record.value),
    measuredOn: record.measuredOn,
  };
}

export type BodyMeasurementsService = ReturnType<typeof createBodyMeasurementsService>;
