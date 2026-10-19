import assert from "node:assert/strict";
import test from "node:test";
import type { ProductPriceHistoryOutput } from "@openmonetis/validators/products";
import {
  buildPriceTimeline,
  formatContent,
  formatDecimalInput,
  getProductErrorMessage,
  parseDecimalInput,
} from "./products.presentation";

test("decimal inputs accept a comma and reject text", () => {
  assert.equal(parseDecimalInput(" 1430,5 "), 1430.5);
  assert.equal(parseDecimalInput(""), null);
  assert.ok(Number.isNaN(parseDecimalInput("abc")));
  assert.equal(formatDecimalInput(1.43), "1,43");
});

test("metragem switches to kg and L from one thousand; units are counted", () => {
  assert.equal(formatContent(473, "milliliter"), "473 mL");
  assert.equal(formatContent(1430, "gram"), "1,43 kg");
  assert.equal(formatContent(1, "package"), "1 unidade");
  assert.equal(formatContent(6, "package"), "6 unidades");
});

test("API error codes become PT-BR messages", () => {
  assert.equal(
    getProductErrorMessage({ code: "product_in_use" }, "Erro"),
    "Este produto tem compras registradas e não pode ser excluído.",
  );
  assert.equal(getProductErrorMessage(new Error("Request failed"), "Erro"), "Erro");
});

test("price timeline draws one series per busy store and groups the rest", () => {
  const store = (storeId: string, storeName: string) => ({
    storeId,
    storeName,
    storeBranch: null,
    storeNeighborhood: null,
    purchaseCount: 1,
    lastPrice: 1,
    lastPurchaseDate: "2026-10-01",
    averagePrice: 1,
    minPrice: 1,
    maxPrice: 1,
  });
  const history: ProductPriceHistoryOutput = {
    contentUnit: "package",
    summary: {
      purchaseCount: 2,
      lastPrice: 2,
      lastPurchaseDate: "2026-10-02",
      averagePrice: 1.5,
      minPrice: 1,
      maxPrice: 2,
    },
    points: [
      { purchaseId: "p1", purchaseDate: "2026-10-01", storeId: "a", normalizedPrice: 1 },
      { purchaseId: "p2", purchaseDate: "2026-10-02", storeId: "b", normalizedPrice: 2 },
    ],
    stores: [store("a", "DMA"), store("b", "Brasa e Malte")],
    weekdays: [],
  };

  const timeline = buildPriceTimeline(history, 1);
  assert.deepEqual(
    timeline.series.map((series) => series.label),
    ["DMA", "Outras lojas"],
  );
  assert.deepEqual(timeline.rows, [
    { purchaseId: "p1", purchaseDate: "2026-10-01", store0: 1 },
    { purchaseId: "p2", purchaseDate: "2026-10-02", other: 2 },
  ]);
});
