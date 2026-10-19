import assert from "node:assert/strict";
import test from "node:test";
import { ApiError } from "../utils/errors";
import {
  type BodyMeasurementDraftRecord,
  type BodyMeasurementRecord,
  type BodyMeasurementsRepository,
  createBodyMeasurementsService,
} from "./body-measurements.service";

const userId = "00000000-0000-4000-8000-000000000001";
const otherUserId = "00000000-0000-4000-8000-000000000009";

function setup() {
  const rows: (BodyMeasurementRecord & { userId: string })[] = [];
  const drafts: (BodyMeasurementDraftRecord & { userId: string })[] = [];
  const repository: BodyMeasurementsRepository = {
    async listByUser(owner) {
      return rows.filter((row) => row.userId === owner);
    },
    async upsertMany(owner, measuredOn, entries) {
      return entries.map((entry) => {
        const existing = rows.find(
          (row) => row.userId === owner && row.kind === entry.kind && row.measuredOn === measuredOn,
        );
        if (existing) {
          existing.value = entry.value;
          return existing;
        }
        const row = {
          id: `00000000-0000-4000-8000-00000000010${rows.length}`,
          userId: owner,
          measuredOn,
          ...entry,
        };
        rows.push(row);
        return row;
      });
    },
    async deleteForUser(id, owner) {
      const index = rows.findIndex((row) => row.id === id && row.userId === owner);
      if (index < 0) return null;
      rows.splice(index, 1);
      return { id };
    },
    async listDraftsByUser(owner) {
      return drafts.filter((draft) => draft.userId === owner);
    },
    async confirmDraft(id, owner, measuredOn, entries) {
      const index = drafts.findIndex((draft) => draft.id === id && draft.userId === owner);
      if (index < 0) return null;
      drafts.splice(index, 1);
      return repository.upsertMany(owner, measuredOn, entries);
    },
    async deleteDraftForUser(id, owner) {
      const index = drafts.findIndex((draft) => draft.id === id && draft.userId === owner);
      if (index < 0) return null;
      drafts.splice(index, 1);
      return { id };
    },
  };
  return { service: createBodyMeasurementsService(repository), rows, drafts };
}

test("a tape session records several kinds and replaces a kind measured again that day", async () => {
  const { service, rows } = setup();
  const saved = await service.record(
    {
      measuredOn: "2026-10-19",
      entries: [
        { kind: "weight", value: 78.4 },
        { kind: "waist", value: 86.5 },
      ],
    },
    userId,
  );
  assert.deepEqual(
    saved.map((item) => [item.kind, item.unit, item.value]),
    [
      ["weight", "kilogram", 78.4],
      ["waist", "centimeter", 86.5],
    ],
  );

  await service.record(
    { measuredOn: "2026-10-19", entries: [{ kind: "waist", value: 86 }] },
    userId,
  );
  assert.equal(rows.length, 2);
  assert.equal(rows.find((row) => row.kind === "waist")?.value, "86.00");
});

test("the overview has one trend per kind and only the user's measurements", async () => {
  const { service } = setup();
  await service.record(
    { measuredOn: "2026-10-10", entries: [{ kind: "weight", value: 79 }] },
    userId,
  );
  await service.record(
    { measuredOn: "2026-10-19", entries: [{ kind: "weight", value: 78.4 }] },
    userId,
  );
  await service.record(
    { measuredOn: "2026-10-20", entries: [{ kind: "weight", value: 60 }] },
    otherUserId,
  );

  const overview = await service.overview(userId);
  const weight = overview.trends.find((trend) => trend.kind === "weight");
  assert.equal(overview.lastMeasuredOn, "2026-10-19");
  assert.equal(weight?.latest?.value, 78.4);
  assert.equal(weight?.change, -0.6);
  assert.equal(overview.trends.length, 15);
});

test("deleting another user's measurement is not found", async () => {
  const { service } = setup();
  const [saved] = await service.record(
    { measuredOn: "2026-10-19", entries: [{ kind: "neck", value: 38 }] },
    userId,
  );
  assert.ok(saved);
  await assert.rejects(
    service.remove(saved.id, otherUserId),
    (error) => error instanceof ApiError && error.code === "body_measurement_not_found",
  );
  assert.deepEqual(await service.remove(saved.id, userId), { id: saved.id });
});

test("a WhatsApp draft shows what it replaces and is saved with the reviewed values", async () => {
  const { service, rows, drafts } = setup();
  await service.record(
    { measuredOn: "2026-10-19", entries: [{ kind: "weight", value: 83 }] },
    userId,
  );
  const draftId = "00000000-0000-4000-8000-000000000201";
  drafts.push({
    id: draftId,
    userId,
    measuredOn: "2026-10-19",
    createdAt: new Date("2026-10-19T12:00:00.000Z"),
    warnings: ["Informe o lado do braço."],
    entries: [
      { kind: "weight", value: "82.40" },
      { kind: "waist", value: "84.00" },
    ],
  });

  const [draft] = await service.drafts(userId);
  assert.deepEqual(draft?.entries, [
    { kind: "weight", unit: "kilogram", value: 82.4, currentValue: 83 },
    { kind: "waist", unit: "centimeter", value: 84, currentValue: null },
  ]);
  assert.deepEqual(await service.drafts(otherUserId), []);

  await assert.rejects(
    service.confirmDraft(
      draftId,
      { measuredOn: "2026-10-19", entries: [{ kind: "weight", value: 82.5 }] },
      otherUserId,
    ),
    (error) => error instanceof ApiError && error.code === "body_measurement_draft_not_found",
  );
  await service.confirmDraft(
    draftId,
    { measuredOn: "2026-10-19", entries: [{ kind: "weight", value: 82.5 }] },
    userId,
  );
  assert.equal(drafts.length, 0);
  assert.deepEqual(
    rows.map((row) => [row.kind, row.value]),
    [["weight", "82.50"]],
  );
  await assert.rejects(
    service.discardDraft(draftId, userId),
    (error) => error instanceof ApiError && error.code === "body_measurement_draft_not_found",
  );
});
