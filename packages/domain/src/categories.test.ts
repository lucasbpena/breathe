import assert from "node:assert/strict";
import test from "node:test";
import {
  createDefaultCategoryDrafts,
  createRootCategoryResolver,
  expandCategoryIdsWithSubcategories,
  resolveCategoryTracksNutrition,
  validateCategoryParent,
} from "./categories";

const hierarchy = [
  { id: "food", parentId: null },
  { id: "groceries", parentId: "food" },
  { id: "delivery", parentId: "food" },
  { id: "transport", parentId: null },
  { id: "fuel", parentId: "transport" },
];

test("subcategories resolve to their parent and top-level categories to themselves", () => {
  const rootCategoryId = createRootCategoryResolver(hierarchy);
  assert.equal(rootCategoryId("groceries"), "food");
  assert.equal(rootCategoryId("food"), "food");
  assert.equal(rootCategoryId("unknown"), "unknown");
});

test("a selected parent brings its subcategories into scope", () => {
  assert.deepEqual(expandCategoryIdsWithSubcategories(["food"], hierarchy).sort(), [
    "delivery",
    "food",
    "groceries",
  ]);
  assert.deepEqual(expandCategoryIdsWithSubcategories(["fuel"], hierarchy), ["fuel"]);
  assert.deepEqual(expandCategoryIdsWithSubcategories([], hierarchy), []);
});

test("subcategories are one level deep under a user-defined parent of the same type", () => {
  const parent = { id: "food", type: "expense" as const, parentId: null, isSystem: false };
  const valid = {
    categoryId: "groceries",
    type: "expense" as const,
    parent,
    hasSubcategories: false,
    hasBudgets: false,
  };

  assert.equal(validateCategoryParent(valid), null);
  assert.equal(validateCategoryParent({ ...valid, categoryId: null }), null);
  assert.equal(validateCategoryParent({ ...valid, categoryId: "food" }), "category_parent_invalid");
  assert.equal(
    validateCategoryParent({ ...valid, parent: { ...parent, parentId: "transport" } }),
    "category_parent_invalid",
  );
  assert.equal(
    validateCategoryParent({ ...valid, parent: { ...parent, isSystem: true } }),
    "category_parent_invalid",
  );
  assert.equal(
    validateCategoryParent({ ...valid, type: "income" }),
    "category_parent_type_mismatch",
  );
  assert.equal(
    validateCategoryParent({ ...valid, hasSubcategories: true }),
    "category_has_subcategories",
  );
  assert.equal(validateCategoryParent({ ...valid, hasBudgets: true }), "category_has_budgets");
});

test("only expense categories carry nutrition, and an omitted choice keeps the fallback", () => {
  const resolve = (type: "income" | "expense", requested: boolean | undefined, fallback: boolean) =>
    resolveCategoryTracksNutrition({ type, requested, fallback });
  assert.equal(resolve("expense", undefined, true), true);
  assert.equal(resolve("expense", false, true), false);
  assert.equal(resolve("expense", true, false), true);
  assert.equal(resolve("income", true, true), false);
  assert.deepEqual(
    createDefaultCategoryDrafts("user")
      .filter((category) => category.tracksNutrition)
      .map((category) => category.name),
    ["Alimentação", "Mercado", "Restaurantes", "Delivery"],
  );
});
