import assert from "node:assert/strict";
import test from "node:test";
import {
  type CaptureCatalog,
  type ExtractedReceipt,
  findSelfSender,
  listWhatsAppNumberVariants,
  reconcileReceipt,
} from "./receipt-capture";

const self = "+55 (31) 99876-5432";

test("Brazilian mobiles match with and without the ninth digit", () => {
  assert.deepEqual(listWhatsAppNumberVariants(self), ["5531998765432", "553198765432"]);
  assert.deepEqual(listWhatsAppNumberVariants("553198765432"), ["553198765432", "5531998765432"]);
  assert.deepEqual(listWhatsAppNumberVariants("14155550100"), ["14155550100"]);
});

test("only messages received from the configured number are accepted", () => {
  assert.equal(
    findSelfSender({ remoteJid: "553198765432@s.whatsapp.net", fromMe: false }, self),
    "553198765432",
  );
  assert.equal(
    findSelfSender(
      { remoteJid: "123456789@lid", remoteJidAlt: "5531998765432@s.whatsapp.net", fromMe: false },
      self,
    ),
    "5531998765432",
  );
  assert.equal(
    findSelfSender({ remoteJid: "5531998765432@s.whatsapp.net", fromMe: true }, self),
    null,
  );
  assert.equal(
    findSelfSender({ remoteJid: "5531911112222@s.whatsapp.net", fromMe: false }, self),
    null,
  );
  assert.equal(findSelfSender({ remoteJid: "120363000000000000@g.us", fromMe: false }, self), null);
  assert.equal(findSelfSender({ remoteJid: "123456789@lid", fromMe: false }, self), null);
});

const catalog: CaptureCatalog = {
  products: [
    { id: "product-monster", name: "Monster Tradicional 473 mL", aliases: ["ENERG MONSTER 473ML"] },
    { id: "product-brahma", name: "Cerveja Brahma 473 mL", aliases: [] },
  ],
  stores: [{ id: "store-dma-14", name: "DMA Distribuidora", branch: "Loja 014" }],
};

function receipt(overrides: Partial<ExtractedReceipt> = {}): ExtractedReceipt {
  return {
    storeName: "DMA Distribuidora",
    storeBranch: "Loja 014",
    storeNeighborhood: "Vila Paris",
    storeAddress: null,
    storeId: null,
    purchasedAt: "2026-10-11T14:03:00-03:00",
    paymentMethod: "credit_card",
    totalAmount: 29.4,
    items: [
      {
        extractedName: "ENERG MONSTER 473ML",
        packageCount: 1,
        totalContent: null,
        paidAmount: 9.48,
        discountAmount: 0,
        productId: "product-brahma",
      },
      {
        extractedName: "CERV BRAHMA LT 473ML",
        packageCount: 4,
        totalContent: null,
        paidAmount: 19.92,
        discountAmount: 0,
        productId: "product-brahma",
      },
    ],
    warnings: [],
    ...overrides,
  };
}

test("an exact alias wins over Claude's suggestion, and valid suggestions are kept", () => {
  const result = reconcileReceipt(receipt(), catalog);
  assert.deepEqual(
    result.items.map((item) => [item.productId, item.productMatch]),
    [
      ["product-monster", "name"],
      ["product-brahma", "suggestion"],
    ],
  );
  assert.equal(result.storeId, "store-dma-14");
  assert.equal(result.storeMatch, "name");
  assert.equal(result.totalMismatch, false);
  assert.equal(result.amount, 29.4);
});

test("ids outside the user's catalog are dropped", () => {
  const result = reconcileReceipt(
    receipt({
      storeName: "Padaria Nova",
      storeBranch: null,
      storeId: "someone-else-store",
      items: [
        {
          extractedName: "PAO FRANCES KG",
          packageCount: null,
          totalContent: 350,
          paidAmount: 6.3,
          discountAmount: 0,
          productId: "someone-else-product",
        },
      ],
      totalAmount: 6.3,
    }),
    catalog,
  );
  assert.equal(result.items[0]?.productId, null);
  assert.equal(result.items[0]?.productMatch, "none");
  assert.equal(result.storeId, null);
  assert.equal(result.storeMatch, "none");
});

test("items are compared with the total in cents", () => {
  const sums = reconcileReceipt(
    receipt({
      totalAmount: 0.3,
      items: [0.1, 0.2].map((paidAmount) => ({
        extractedName: "BALA",
        packageCount: 1,
        totalContent: null,
        paidAmount,
        discountAmount: 0,
        productId: null,
      })),
    }),
    catalog,
  );
  assert.equal(sums.totalMismatch, false);
  assert.equal(sums.itemsAmount, 0.3);

  const mismatch = reconcileReceipt(receipt({ totalAmount: 30 }), catalog);
  assert.equal(mismatch.totalMismatch, true);
  assert.equal(mismatch.amount, 30);

  const unreadTotal = reconcileReceipt(receipt({ totalAmount: null }), catalog);
  assert.equal(unreadTotal.totalMismatch, false);
  assert.equal(unreadTotal.amount, 29.4);
});
