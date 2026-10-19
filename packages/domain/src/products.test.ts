import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateNormalizedPrice,
  calculateProductPriceHistory,
  createProductNameKey,
  resolvePackageContent,
  summarizeProductPrices,
} from "./products";
import { createStoreNameKey } from "./stores";

const villaParis = "00000000-0000-4000-8000-000000000001";
const sagradaFamilia = "00000000-0000-4000-8000-000000000002";

test("receipt names collapse accents, case and spacing into one key", () => {
  assert.equal(
    createProductNameKey("Energético  Monster"),
    createProductNameKey("energetico monster"),
  );
  assert.equal(createProductNameKey(" MONSTER 473ML "), "monster-473ml");
});

test("store keys keep branches of the same chain apart", () => {
  assert.notEqual(createStoreNameKey("DMA", "Loja 014"), createStoreNameKey("DMA", "Loja 003"));
  assert.equal(createStoreNameKey("DMA", null), "dma");
});

test("normalized prices are quoted per kilogram, liter or package", () => {
  assert.equal(calculateNormalizedPrice(8.55, 1430, "gram"), 5.98);
  assert.equal(calculateNormalizedPrice(9.48, 473, "milliliter"), 20.04);
  assert.equal(calculateNormalizedPrice(19.8, 2, "package"), 9.9);
});

test("only products with metragem keep a package metragem", () => {
  assert.equal(resolvePackageContent("package", 6), null);
  assert.equal(resolvePackageContent("gram", 450), 450);
});

test("price summary weights the average by content and keeps the latest purchase", () => {
  const summary = summarizeProductPrices("milliliter", [
    {
      purchaseId: "b",
      purchaseDate: "2026-10-11",
      storeId: villaParis,
      paidAmount: "9.48",
      totalContent: "473",
    },
    {
      purchaseId: "a",
      purchaseDate: "2026-10-07",
      storeId: sagradaFamilia,
      paidAmount: "21.98",
      totalContent: "946",
    },
  ]);

  assert.deepEqual(summary, {
    purchaseCount: 2,
    lastPrice: 20.04,
    lastPurchaseDate: "2026-10-11",
    averagePrice: 22.17,
    minPrice: 20.04,
    maxPrice: 23.23,
  });
});

test("empty history has no prices", () => {
  assert.deepEqual(summarizeProductPrices("package", []), {
    purchaseCount: 0,
    lastPrice: null,
    lastPurchaseDate: null,
    averagePrice: null,
    minPrice: null,
    maxPrice: null,
  });
});

test("price history orders points and groups them by store and weekday", () => {
  const history = calculateProductPriceHistory("package", [
    {
      purchaseId: "3",
      purchaseDate: "2026-10-12",
      storeId: sagradaFamilia,
      paidAmount: 10.99,
      totalContent: 1,
    },
    {
      purchaseId: "1",
      purchaseDate: "2026-10-07",
      storeId: sagradaFamilia,
      paidAmount: 10.99,
      totalContent: 1,
    },
    {
      purchaseId: "2",
      purchaseDate: "2026-10-11",
      storeId: villaParis,
      paidAmount: 9.48,
      totalContent: 1,
    },
  ]);

  assert.deepEqual(
    history.points.map((point) => point.purchaseId),
    ["1", "2", "3"],
  );
  assert.deepEqual(
    history.stores.map((store) => [store.storeId, store.purchaseCount, store.averagePrice]),
    [
      [sagradaFamilia, 2, 10.99],
      [villaParis, 1, 9.48],
    ],
  );
  assert.equal(history.weekdays.length, 7);
  assert.deepEqual(history.weekdays[0], { weekday: 0, purchaseCount: 1, averagePrice: 9.48 });
  assert.deepEqual(history.weekdays[1], { weekday: 1, purchaseCount: 1, averagePrice: 10.99 });
  assert.deepEqual(history.weekdays[2], { weekday: 2, purchaseCount: 0, averagePrice: null });
  assert.equal(history.summary.minPrice, 9.48);
});
