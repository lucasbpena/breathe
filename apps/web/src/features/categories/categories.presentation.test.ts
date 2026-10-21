import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCategoryTree,
  filterCategoryTree,
  formatCategoryPath,
  getCategoryErrorMessage,
} from "./categories.presentation";

const categories = [
  { id: "transport", name: "Transporte", parentId: null },
  { id: "groceries", name: "Mercado", parentId: "food" },
  { id: "food", name: "Alimentação", parentId: null },
  { id: "delivery", name: "Delivery", parentId: "food" },
  { id: "fuel", name: "Combustível", parentId: "transport" },
];

test("subcategories follow their parent in alphabetical order", () => {
  assert.deepEqual(
    buildCategoryTree(categories).map((category) => formatCategoryPath(category)),
    [
      "Alimentação",
      "Alimentação › Delivery",
      "Alimentação › Mercado",
      "Transporte",
      "Transporte › Combustível",
    ],
  );
});

test("a subcategory whose parent is not listed is shown as top-level", () => {
  assert.deepEqual(
    buildCategoryTree(categories.filter((category) => category.id !== "food")).map((category) => [
      category.id,
      category.parentName,
    ]),
    [
      ["delivery", null],
      ["groceries", null],
      ["transport", null],
      ["fuel", "Transporte"],
    ],
  );
});

test("search keeps the parent of a matching subcategory and the children of a matching parent", () => {
  assert.deepEqual(
    filterCategoryTree(categories, "merc").map((category) => category.id),
    ["food", "groceries"],
  );
  assert.deepEqual(
    filterCategoryTree(categories, "transp").map((category) => category.id),
    ["transport", "fuel"],
  );
  assert.equal(filterCategoryTree(categories, " ").length, categories.length);
});

test("category errors are shown in Portuguese with a fallback", () => {
  assert.match(getCategoryErrorMessage("category_has_subcategories", "x"), /subcategorias/);
  assert.equal(
    getCategoryErrorMessage("unknown", "Não foi possível salvar."),
    "Não foi possível salvar.",
  );
  assert.equal(getCategoryErrorMessage(undefined, "Falhou."), "Falhou.");
});
