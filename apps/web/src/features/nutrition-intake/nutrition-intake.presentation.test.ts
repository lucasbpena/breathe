import assert from "node:assert/strict";
import test from "node:test";
import { formatGrams, formatKcal, getIntakePeriod } from "./nutrition-intake.presentation";

test("the intake period ends today and counts today as its last day", () => {
  assert.deepEqual(getIntakePeriod(7, "2026-10-19"), { from: "2026-10-13", to: "2026-10-19" });
  assert.deepEqual(getIntakePeriod(30, "2026-03-01"), { from: "2026-01-31", to: "2026-03-01" });
});

test("calories have no decimals and grams have one", () => {
  assert.equal(formatKcal(2134.56), "2.135 kcal");
  assert.equal(formatGrams(52.98), "53 g");
  assert.equal(formatGrams(11.24), "11,2 g");
});
