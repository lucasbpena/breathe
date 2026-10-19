import assert from "node:assert/strict";
import test from "node:test";
import {
  calculatePurchasePrices,
  resolvePurchaseQuantity,
  summarizeTransactionPurchases,
} from "./product-purchases";

test("package count multiplies the product package content", () => {
  assert.deepEqual(
    resolvePurchaseQuantity({
      contentUnit: "milliliter",
      packageContent: "473",
      packageCount: 4,
      totalContent: null,
    }),
    { packageCount: 4, totalContent: 1892 },
  );
});

test("bulk purchases keep the weighed content without packages", () => {
  assert.deepEqual(
    resolvePurchaseQuantity({
      contentUnit: "gram",
      packageContent: null,
      packageCount: null,
      totalContent: 1430,
    }),
    { packageCount: null, totalContent: 1430 },
  );
});

test("products without metragem are counted by packages only", () => {
  assert.deepEqual(
    resolvePurchaseQuantity({
      contentUnit: "package",
      packageContent: null,
      packageCount: 2,
      totalContent: 999,
    }),
    { packageCount: 2, totalContent: 2 },
  );
});

test("weight cannot be derived from packages of unknown content", () => {
  assert.equal(
    resolvePurchaseQuantity({
      contentUnit: "gram",
      packageContent: null,
      packageCount: 1,
      totalContent: null,
    }),
    null,
  );
  assert.equal(
    resolvePurchaseQuantity({
      contentUnit: "package",
      packageContent: null,
      packageCount: null,
      totalContent: 3,
    }),
    null,
  );
});

test("discounts are added back to the list amount and prices use the paid amount", () => {
  assert.deepEqual(
    calculatePurchasePrices({
      contentUnit: "milliliter",
      paidAmount: "9.89",
      discountAmount: "1.10",
      packageCount: "1",
      totalContent: "473",
    }),
    { paidAmount: 9.89, listAmount: 10.99, pricePerPackage: 9.89, normalizedPrice: 20.91 },
  );
  assert.equal(
    calculatePurchasePrices({
      contentUnit: "gram",
      paidAmount: 8.55,
      discountAmount: 0,
      packageCount: null,
      totalContent: 1430,
    }).pricePerPackage,
    null,
  );
});

test("receipt summary compares the lines with the absolute expense amount", () => {
  assert.deepEqual(
    summarizeTransactionPurchases("-53.34", [
      { paidAmount: "11.96" },
      { paidAmount: "11.98" },
      { paidAmount: "19.92" },
    ]),
    { transactionAmount: 53.34, itemsAmount: 43.86, remainingAmount: 9.48 },
  );
  assert.equal(
    summarizeTransactionPurchases(10, [{ paidAmount: 6 }, { paidAmount: 6 }]).remainingAmount,
    -2,
  );
});
