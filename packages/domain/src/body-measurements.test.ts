import assert from "node:assert/strict";
import test from "node:test";
import {
  bodyMeasurementKinds,
  findLastMeasuredOn,
  getBodyMeasurementUnit,
  reconcileCapturedMeasurements,
  summarizeBodyMeasurements,
} from "./body-measurements";

test("weight is in kilograms and every tape measurement in centimeters", () => {
  assert.equal(getBodyMeasurementUnit("weight"), "kilogram");
  assert.equal(getBodyMeasurementUnit("leftCalf"), "centimeter");
});

test("each kind keeps its history in date order with the latest change", () => {
  const trends = summarizeBodyMeasurements([
    { id: "c", kind: "weight", value: "78.40", measuredOn: "2026-10-19" },
    { id: "a", kind: "weight", value: "80.10", measuredOn: "2026-10-01" },
    { id: "b", kind: "weight", value: "79.00", measuredOn: "2026-10-10" },
    { id: "d", kind: "waist", value: "86.5", measuredOn: "2026-10-10" },
  ]);
  const weight = trends.find((trend) => trend.kind === "weight");

  assert.deepEqual(
    weight?.history.map((point) => point.measuredOn),
    ["2026-10-01", "2026-10-10", "2026-10-19"],
  );
  assert.deepEqual(weight?.latest, { id: "c", value: 78.4, measuredOn: "2026-10-19" });
  assert.equal(weight?.change, -0.6);
  assert.equal(weight?.totalChange, -1.7);
});

test("a single measurement has no change and unmeasured kinds are still listed", () => {
  const trends = summarizeBodyMeasurements([
    { id: "d", kind: "waist", value: 86.5, measuredOn: "2026-10-10" },
  ]);

  assert.deepEqual(
    trends.map((trend) => trend.kind),
    [...bodyMeasurementKinds],
  );
  const waist = trends.find((trend) => trend.kind === "waist");
  assert.equal(waist?.change, null);
  assert.equal(waist?.totalChange, null);
  assert.equal(trends.find((trend) => trend.kind === "neck")?.latest, null);
});

test("the last measured date is the most recent of any kind", () => {
  assert.equal(
    findLastMeasuredOn([{ measuredOn: "2026-10-10" }, { measuredOn: "2026-10-19" }]),
    "2026-10-19",
  );
  assert.equal(findLastMeasuredOn([]), null);
});

test("captured measurements keep one plausible value per kind and a date up to the message day", () => {
  const result = reconcileCapturedMeasurements(
    {
      measuredOn: "2026-10-18",
      entries: [
        { kind: "weight", value: 83 },
        { kind: "waist", value: 84.456 },
        { kind: "weight", value: 82.4 },
        { kind: "rightArm", value: 360 },
      ],
    },
    "2026-10-19",
  );
  assert.equal(result.measuredOn, "2026-10-18");
  assert.deepEqual(result.entries, [
    { kind: "weight", value: 82.4 },
    { kind: "waist", value: 84.46 },
  ]);
  assert.deepEqual(result.implausible, [{ kind: "rightArm", value: 360 }]);

  for (const measuredOn of [null, "2026-10-20", "19/10/2026", "2026-02-31x"]) {
    assert.equal(
      reconcileCapturedMeasurements({ measuredOn, entries: [] }, "2026-10-19").measuredOn,
      "2026-10-19",
    );
  }
});
