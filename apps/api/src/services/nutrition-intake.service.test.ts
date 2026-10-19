import assert from "node:assert/strict";
import test from "node:test";
import {
  createNutritionIntakeService,
  type NutritionIntakeLineRecord,
  type NutritionIntakeRepository,
} from "./nutrition-intake.service";

const userId = "00000000-0000-4000-8000-000000000001";
const monsterId = "00000000-0000-4000-8000-000000000101";

test("intake comes from the receipt lines of the period with their product nutrition", async () => {
  const calls: [string, string, string][] = [];
  const lines: NutritionIntakeLineRecord[] = [
    {
      purchaseDate: new Date("2026-10-11T00:00:00.000Z"),
      productId: monsterId,
      productName: "Energético Monster",
      contentUnit: "milliliter",
      totalContent: "946.000",
      energyKcal: "47.00",
      proteinGrams: null,
      carbohydrateGrams: "11.20",
      addedSugarGrams: "11.00",
      fatGrams: null,
    },
  ];
  const repository: NutritionIntakeRepository = {
    async listLinesForUser(owner, from, to) {
      calls.push([owner, from, to]);
      return lines;
    },
  };

  const intake = await createNutritionIntakeService(repository).get(userId, {
    from: "2026-10-11",
    to: "2026-10-12",
  });

  assert.deepEqual(calls, [[userId, "2026-10-11", "2026-10-12"]]);
  assert.equal(intake.totals.energyKcal, 444.62);
  assert.equal(intake.dailyAverage.energyKcal, 222.31);
  assert.equal(intake.days[0]?.date, "2026-10-11");
  assert.deepEqual(intake.energyShare, { protein: 0, carbohydrate: 100, fat: 0 });
  assert.equal(intake.products[0]?.totalContent, 946);
});
