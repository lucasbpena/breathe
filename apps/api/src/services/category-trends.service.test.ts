import assert from "node:assert/strict";
import test from "node:test";
import { ListCategoryTrendsQuerySchema } from "@openmonetis/validators/category-trends";
import { createCategoryTrendsService } from "./category-trends.service";

for (const scope of [undefined, "admin", "all", "80000000-0000-4000-8000-000000000008"] as const) {
  test(`category summary forwards ${scope ?? "default"} scope to actual and recurring queries`, async () => {
    const calls: unknown[][] = [];
    const service = createCategoryTrendsService({
      async listCategoriesForUser(userId) {
        assert.equal(userId, "owner");
        return [];
      },
      async listActualEntriesForUser(...args) {
        calls.push(args);
        return [];
      },
      async listRecurringRulesForUser(...args) {
        calls.push(args);
        return [];
      },
    });
    await service.list(
      "owner",
      ListCategoryTrendsQuerySchema.parse({
        startPeriod: "2026-09",
        endPeriod: "2026-09",
        personScope: scope,
      }),
    );
    assert.equal(calls.length, 2);
    for (const args of calls) {
      assert.equal(args[0], "owner");
      assert.equal(args.at(-1), scope ?? "admin");
    }
  });
}

test("category scope rejects unexpected values", () => {
  assert.equal(
    ListCategoryTrendsQuerySchema.safeParse({
      startPeriod: "2026-09",
      endPeriod: "2026-09",
      personScope: "external",
    }).success,
    false,
  );
});

test("invoice reductions lower expense trends without becoming income", async () => {
  const purchaseCategoryId = "10000000-0000-4000-8000-000000000001";
  const adjustmentCategoryId = "20000000-0000-4000-8000-000000000002";
  const service = createCategoryTrendsService({
    async listCategoriesForUser() {
      return [
        {
          categoryId: purchaseCategoryId,
          parentId: null,
          name: "Compras",
          icon: null,
          type: "expense",
        },
        {
          categoryId: adjustmentCategoryId,
          parentId: null,
          name: "Ajustes de fatura",
          icon: null,
          type: "expense",
        },
      ];
    },
    async listActualEntriesForUser() {
      return [
        {
          categoryId: purchaseCategoryId,
          origin: "regular" as const,
          transactionType: "expense" as const,
          type: "expense" as const,
          period: "2026-09",
          amount: "-100.00",
        },
        {
          categoryId: adjustmentCategoryId,
          origin: "invoiceAdjustment" as const,
          transactionType: "expense" as const,
          type: "expense" as const,
          period: "2026-09",
          amount: "20.00",
        },
      ];
    },
    async listRecurringRulesForUser() {
      return [];
    },
  });

  const report = await service.list(
    "owner",
    ListCategoryTrendsQuerySchema.parse({ startPeriod: "2026-09", endPeriod: "2026-09" }),
  );

  assert.equal(report.summary.incomeAmount, 0);
  assert.equal(report.summary.expenseAmount, 80);
  assert.equal(
    report.categories.find((category) => category.categoryId === adjustmentCategoryId)?.totalAmount,
    -20,
  );
});

test("trends roll subcategories into the parent or keep them separate on request", async () => {
  const foodId = "10000000-0000-4000-8000-000000000011";
  const groceriesId = "10000000-0000-4000-8000-000000000012";
  const requestedCategoryIds: Array<readonly string[]> = [];
  const service = createCategoryTrendsService({
    async listCategoriesForUser() {
      return [
        { categoryId: foodId, parentId: null, name: "Alimentação", icon: null, type: "expense" },
        { categoryId: groceriesId, parentId: foodId, name: "Mercado", icon: null, type: "expense" },
      ];
    },
    async listActualEntriesForUser(_userId, _start, _end, categoryIds) {
      requestedCategoryIds.push(categoryIds);
      return [
        {
          categoryId: foodId,
          origin: "regular" as const,
          transactionType: "expense" as const,
          type: "expense" as const,
          period: "2026-09",
          amount: "-30.00",
        },
        {
          categoryId: groceriesId,
          origin: "regular" as const,
          transactionType: "expense" as const,
          type: "expense" as const,
          period: "2026-09",
          amount: "-50.00",
        },
      ];
    },
    async listRecurringRulesForUser() {
      return [];
    },
  });

  const rolledUp = await service.list(
    "owner",
    ListCategoryTrendsQuerySchema.parse({
      startPeriod: "2026-09",
      endPeriod: "2026-09",
      categoryIds: foodId,
    }),
  );
  const separate = await service.list(
    "owner",
    ListCategoryTrendsQuerySchema.parse({
      startPeriod: "2026-09",
      endPeriod: "2026-09",
      subcategoryMode: "separate",
    }),
  );

  assert.deepEqual([...(requestedCategoryIds[0] ?? [])].sort(), [foodId, groceriesId].sort());
  assert.deepEqual(
    rolledUp.categories.map((category) => [category.categoryId, category.totalAmount]),
    [[foodId, 80]],
  );
  assert.deepEqual(
    rolledUp.availableCategories.map((category) => category.categoryId),
    [foodId],
  );
  assert.deepEqual(
    separate.categories.map((category) => [category.categoryId, category.totalAmount]),
    [
      [groceriesId, 50],
      [foodId, 30],
    ],
  );
  assert.equal(separate.summary.expenseAmount, 80);
});
