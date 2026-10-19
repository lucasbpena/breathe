import assert from "node:assert/strict";
import test from "node:test";
import type { InboxItemSummaryOutput } from "@openmonetis/validators/inbox";
import {
  formatInboxReceiptLines,
  formatInboxReceiptStore,
  formatInboxTimestamp,
  getInboxPurchaseDate,
  getInboxReceiptWarnings,
  groupInboxItemsByDate,
  summarizeInboxReceipt,
} from "./inbox.presentation";

const baseItem = {
  id: "00000000-0000-4000-8000-000000000001",
  sourceAppName: "Banco Example",
  originalText: "Compra aprovada",
  parsedName: "Compra",
  parsedAmount: 10,
  status: "pending" as const,
  transactionId: null,
  processedAt: null,
  discardedAt: null,
  createdAt: "2026-08-18T03:05:00.000Z",
  updatedAt: "2026-08-18T03:05:00.000Z",
  receipt: null,
};

test("inbox purchases use the Sao Paulo calendar date around the UTC day boundary", () => {
  const simulations = [
    { timestamp: "2026-08-17T23:30:00.000Z", expectedDate: "2026-08-17" },
    { timestamp: "2026-08-18T00:30:00.000Z", expectedDate: "2026-08-17" },
    { timestamp: "2026-08-18T02:59:00.000Z", expectedDate: "2026-08-17" },
    { timestamp: "2026-08-18T03:01:00.000Z", expectedDate: "2026-08-18" },
  ];

  for (const simulation of simulations) {
    assert.equal(getInboxPurchaseDate(simulation.timestamp), simulation.expectedDate);
  }
});

test("inbox grouping and purchase defaults agree on the local purchase date", () => {
  const notificationTimestamp = "2026-08-18T00:30:00.000Z";
  const [group] = groupInboxItemsByDate(
    [{ ...baseItem, notificationTimestamp }],
    new Date("2026-08-18T12:00:00.000Z"),
  );

  assert.equal(group?.dateKey, "2026-08-17");
  assert.equal(getInboxPurchaseDate(notificationTimestamp), group?.dateKey);
});

test("inbox widget formats timestamps in Sao Paulo time", () => {
  const formatted = formatInboxTimestamp("2026-08-18T00:30:00.000Z");

  assert.match(formatted, /17/);
  assert.match(formatted, /21:30/);
  assert.doesNotMatch(formatted, /18/);
});

const receipt: NonNullable<InboxItemSummaryOutput["receipt"]> = {
  storeId: null,
  storeMatch: "none",
  storeName: "DMA Distribuidora",
  storeBranch: "Loja 014",
  storeNeighborhood: "Vila Paris",
  storeAddress: null,
  paymentMethod: "credit_card",
  itemsAmount: 21.46,
  totalMismatch: true,
  warnings: ["Pagamento parcialmente legível"],
  hasMedia: true,
  lines: [
    {
      id: "00000000-0000-4000-8000-000000000011",
      position: 0,
      extractedName: "ENERG MONSTER 473ML",
      productId: "00000000-0000-4000-8000-000000000012",
      productMatch: "name",
      packageCount: 1,
      totalContent: null,
      paidAmount: 9.48,
      discountAmount: 0,
    },
    {
      id: "00000000-0000-4000-8000-000000000013",
      position: 1,
      extractedName: "BATATA PRINGLES 104G",
      productId: null,
      productMatch: "none",
      packageCount: 1,
      totalContent: null,
      paidAmount: 11.98,
      discountAmount: 0,
    },
  ],
};

test("a receipt summary tells what still needs a product or a store", () => {
  assert.deepEqual(summarizeInboxReceipt(receipt), {
    lineCount: 2,
    matched: 1,
    unmatched: 1,
    newStore: true,
  });
  assert.equal(formatInboxReceiptLines(receipt), "2 itens, 1 reconhecido");
  assert.equal(
    formatInboxReceiptLines({ ...receipt, lines: receipt.lines.slice(0, 1) }),
    "1 item, todos reconhecidos",
  );
  assert.equal(formatInboxReceiptStore(receipt), "DMA Distribuidora Loja 014 · Vila Paris");
  assert.deepEqual(getInboxReceiptWarnings(receipt, 53.34), [
    "Os itens somam R$\u00a021,46, mas o total da nota é R$\u00a053,34.",
    "Pagamento parcialmente legível",
  ]);
});
