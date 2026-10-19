import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMeasurementTicks,
  formatMeasurement,
  formatMeasurementChange,
} from "./body-measurements.presentation";

test("measurements show their unit and changes keep the sign", () => {
  assert.equal(formatMeasurement(78.4, "kilogram"), "78,4 kg");
  assert.equal(formatMeasurementChange(0.5, "centimeter"), "+0,5 cm");
  assert.equal(formatMeasurementChange(-0.6, "kilogram"), "-0,6 kg");
  assert.equal(formatMeasurementChange(0, "centimeter"), "sem variação");
});

test("chart ticks are whole numbers with an even step around the values", () => {
  assert.deepEqual(buildMeasurementTicks([33.8, 34, 34.5]), [32, 33, 34, 35, 36]);
  assert.deepEqual(buildMeasurementTicks([80.1, 79, 78.4]), [76, 78, 80, 82, 84]);
});
