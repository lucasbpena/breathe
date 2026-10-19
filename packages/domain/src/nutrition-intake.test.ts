import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateLineNutrients,
  calculateMacroEnergyShare,
  calculateNutritionIntake,
  listDates,
  type NutritionIntakeLine,
} from "./nutrition-intake";

const noNutrition = {
  energyKcal: null,
  proteinGrams: null,
  carbohydrateGrams: null,
  addedSugarGrams: null,
  fatGrams: null,
};

function line(overrides: Partial<NutritionIntakeLine>): NutritionIntakeLine {
  return {
    purchaseDate: "2026-10-11",
    productId: "monster",
    productName: "Energético Monster",
    contentUnit: "milliliter",
    totalContent: "473",
    nutrition: { ...noNutrition, energyKcal: "47", carbohydrateGrams: "11.2" },
    ...overrides,
  };
}

test("nutrition per 100 g or mL scales with the content bought", () => {
  const nutrients = calculateLineNutrients(line({}));
  assert.equal(Math.round(nutrients.energyKcal * 100) / 100, 222.31);
  assert.equal(Math.round(nutrients.carbohydrateGrams * 100) / 100, 52.98);
  assert.equal(nutrients.proteinGrams, 0);
});

test("products without metragem declare nutrition per unit", () => {
  const nutrients = calculateLineNutrients(
    line({
      contentUnit: "package",
      totalContent: "2",
      nutrition: { ...noNutrition, energyKcal: "250", proteinGrams: "8" },
    }),
  );
  assert.equal(nutrients.energyKcal, 500);
  assert.equal(nutrients.proteinGrams, 16);
});

test("macro energy share uses 4, 4 and 9 kcal per gram", () => {
  assert.deepEqual(
    calculateMacroEnergyShare({ proteinGrams: 25, carbohydrateGrams: 50, fatGrams: 100 / 9 }),
    { protein: 25, carbohydrate: 50, fat: 25 },
  );
  assert.equal(
    calculateMacroEnergyShare({ proteinGrams: 0, carbohydrateGrams: 0, fatGrams: 0 }),
    null,
  );
});

test("dates cover the whole period, both ends included", () => {
  assert.deepEqual(listDates("2026-10-30", "2026-11-02"), [
    "2026-10-30",
    "2026-10-31",
    "2026-11-01",
    "2026-11-02",
  ]);
});

test("intake spreads the period total over every day and flags lines without calories", () => {
  const intake = calculateNutritionIntake({
    from: "2026-10-11",
    to: "2026-10-12",
    lines: [
      line({ totalContent: "100", nutrition: { ...noNutrition, energyKcal: "300" } }),
      line({
        purchaseDate: "2026-10-12",
        productId: "bread",
        productName: "Pão",
        contentUnit: "package",
        totalContent: "1",
        nutrition: { ...noNutrition, energyKcal: "500", proteinGrams: "10" },
      }),
      line({
        purchaseDate: "2026-10-12",
        productId: "beer",
        productName: "Cerveja",
        nutrition: noNutrition,
      }),
      line({ purchaseDate: "2026-10-13" }),
    ],
  });

  assert.equal(intake.dayCount, 2);
  assert.equal(intake.lineCount, 3);
  assert.equal(intake.linesWithoutCalories, 1);
  assert.equal(intake.totals.energyKcal, 800);
  assert.equal(intake.dailyAverage.energyKcal, 400);
  assert.deepEqual(
    intake.days.map((day) => [day.date, day.energyKcal]),
    [
      ["2026-10-11", 300],
      ["2026-10-12", 500],
    ],
  );
  assert.deepEqual(
    intake.products.map((product) => [product.productName, product.hasCalories]),
    [
      ["Pão", true],
      ["Energético Monster", true],
      ["Cerveja", false],
    ],
  );
});
