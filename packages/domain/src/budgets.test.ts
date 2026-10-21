import assert from "node:assert/strict";
import test from "node:test";
import { calculateBudgetOverview, calculateBudgetSpending } from "./budgets";

test("keeps category excess separate from remaining limits", () => {
  const result = calculateBudgetOverview(
    [
      { categoryId: "food", amount: 100 },
      { categoryId: "transport", amount: 300 },
    ],
    {
      actualByCategory: new Map([
        ["food", 150],
        ["transport", 100],
      ]),
      projectedByCategory: new Map([["food", 50]]),
      uncategorizedActualAmount: 0,
      uncategorizedProjectedAmount: 0,
    },
  );
  assert.equal(result.availableAmount, 200);
  assert.equal(result.exceededAmount, 100);
  assert.equal(result.committedAmount, 300);
});

test("breaks down unbudgeted expenses including recurrence-only and uncategorized entries", () => {
  const result = calculateBudgetOverview([{ categoryId: "food", amount: 100 }], {
    actualByCategory: new Map([
      ["food", 20],
      ["health", 40],
      ["refunded", -10],
    ]),
    projectedByCategory: new Map([
      ["health", 10],
      ["rent", 200],
    ]),
    uncategorizedActualAmount: 30,
    uncategorizedProjectedAmount: 5,
  });
  assert.deepEqual(result.unbudgetedItems, [
    { categoryId: "rent", committedAmount: 200 },
    { categoryId: "health", committedAmount: 50 },
    { categoryId: null, committedAmount: 35 },
  ]);
  assert.equal(result.unbudgetedCommittedAmount, 285);
});

test("returns no unbudgeted expenses for an empty month", () => {
  const result = calculateBudgetOverview([], {
    actualByCategory: new Map(),
    projectedByCategory: new Map(),
    uncategorizedActualAmount: 0,
    uncategorizedProjectedAmount: 0,
  });
  assert.deepEqual(result.unbudgetedItems, []);
  assert.equal(result.unbudgetedCommittedAmount, 0);
});

test("subcategory spending counts toward the parent budget", () => {
  const spending = calculateBudgetSpending(
    [
      { categoryId: "food", origin: "regular", type: "expense", amount: "-30.00" },
      { categoryId: "groceries", origin: "regular", type: "expense", amount: "-50.00" },
      { categoryId: "fuel", origin: "regular", type: "expense", amount: "-20.00" },
    ],
    [],
    "2026-10",
    [
      { id: "food", parentId: null },
      { id: "groceries", parentId: "food" },
      { id: "transport", parentId: null },
      { id: "fuel", parentId: "transport" },
    ],
  );
  const overview = calculateBudgetOverview([{ categoryId: "food", amount: 100 }], spending);

  assert.equal(spending.actualByCategory.get("food"), 80);
  assert.equal(spending.actualByCategory.has("groceries"), false);
  assert.equal(overview.progressByCategory.get("food")?.actualSpentAmount, 80);
  assert.deepEqual(
    overview.unbudgetedItems.map((item) => [item.categoryId, item.committedAmount]),
    [["transport", 20]],
  );
});
