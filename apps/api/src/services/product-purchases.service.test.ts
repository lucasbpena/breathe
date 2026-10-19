import assert from "node:assert/strict";
import test from "node:test";
import { ApiError } from "../utils/errors";
import {
  createProductPurchasesService,
  type ProductPurchaseRecord,
  type ProductPurchasesRepository,
} from "./product-purchases.service";

const userId = "00000000-0000-4000-8000-000000000001";
const otherUserId = "00000000-0000-4000-8000-000000000009";
const expenseId = "00000000-0000-4000-8000-000000000002";
const incomeId = "00000000-0000-4000-8000-000000000003";
const monsterId = "00000000-0000-4000-8000-000000000004";
const potatoId = "00000000-0000-4000-8000-000000000005";
const brahmaId = "00000000-0000-4000-8000-000000000006";
const storeId = "00000000-0000-4000-8000-000000000007";

const products = [
  {
    id: monsterId,
    nameKey: "energetico-monster",
    contentUnit: "milliliter",
    packageContent: "473",
  },
  { id: potatoId, nameKey: "batata-inglesa", contentUnit: "gram", packageContent: null },
  { id: brahmaId, nameKey: "cerveja-brahma", contentUnit: "milliliter", packageContent: "473" },
] as const;

function setup() {
  const purchases: (ProductPurchaseRecord & { userId: string })[] = [];
  const aliases: { userId: string; productId: string; name: string; nameKey: string }[] = [];

  const repository: ProductPurchasesRepository = {
    async findTransactionForUser(id, owner) {
      if (owner !== userId) return null;
      if (id === expenseId) return { id, type: "expense", amount: "-53.34" };
      if (id === incomeId) return { id, type: "income", amount: "100.00" };
      return null;
    },
    async findProductForUser(id, owner) {
      return owner === userId ? (products.find((product) => product.id === id) ?? null) : null;
    },
    async storeExistsForUser(id, owner) {
      return owner === userId && id === storeId;
    },
    async listByTransactionForUser(transactionId, owner) {
      return purchases.filter(
        (purchase) => purchase.transactionId === transactionId && purchase.userId === owner,
      );
    },
    async listByProductForUser(productId, owner) {
      return purchases.filter(
        (purchase) => purchase.productId === productId && purchase.userId === owner,
      );
    },
    async insert(data) {
      const product = products.find((item) => item.id === data.productId);
      if (!product) throw new Error("Unknown product");
      const purchase = {
        ...data,
        id: `00000000-0000-4000-8000-00000000010${purchases.length}`,
        transactionName: "DMA Distribuidora",
        transactionPeriod: "2026-10",
        purchaseDate: new Date("2026-10-11T00:00:00Z"),
        productName: product.nameKey,
        contentUnit: product.contentUnit,
        storeName: "DMA Distribuidora",
        storeBranch: "Loja 014",
        storeNeighborhood: "Vila Paris",
        createdAt: new Date("2026-10-18T12:00:00Z"),
        updatedAt: new Date("2026-10-18T12:00:00Z"),
      };
      purchases.push(purchase);
      return purchase;
    },
    async insertMany(rows) {
      for (const row of rows) await repository.insert(row);
    },
    async replaceForUser(id, owner, data) {
      const purchase = purchases.find((item) => item.id === id && item.userId === owner);
      if (!purchase) return null;
      Object.assign(purchase, data);
      return purchase;
    },
    async deleteForUser(id, owner) {
      const index = purchases.findIndex((item) => item.id === id && item.userId === owner);
      if (index < 0) return null;
      purchases.splice(index, 1);
      return { id };
    },
    async productNameKeyExistsForUser(nameKey, owner) {
      return owner === userId && products.some((product) => product.nameKey === nameKey);
    },
    async insertAliasIfAbsent(data) {
      if (!aliases.some((alias) => alias.userId === data.userId && alias.nameKey === data.nameKey))
        aliases.push(data);
    },
  };
  return { service: createProductPurchasesService(repository), aliases };
}

function hasCode(code: string) {
  return (error: unknown) => error instanceof ApiError && error.code === code;
}

const line = { storeId, paidAmount: 19.92, discountAmount: 0 };

test("receipt lines resolve content from packages or weight and summarize the expense", async () => {
  const { service } = setup();
  const beer = await service.create(
    { ...line, transactionId: expenseId, productId: brahmaId, packageCount: 4 },
    userId,
  );
  assert.equal(beer.totalContent, 1892);
  assert.equal(beer.pricePerPackage, 4.98);
  assert.equal(beer.normalizedPrice, 10.53);
  const potato = await service.create(
    {
      ...line,
      transactionId: expenseId,
      productId: potatoId,
      totalContent: 1430,
      paidAmount: 8.55,
    },
    userId,
  );
  assert.equal(potato.packageCount, null);
  assert.equal(potato.normalizedPrice, 5.98);

  const receipt = await service.listForTransaction(expenseId, userId);
  assert.equal(receipt.items.length, 2);
  assert.deepEqual(receipt.summary, {
    transactionAmount: 53.34,
    itemsAmount: 28.47,
    remainingAmount: 24.87,
  });
});

test("a receipt is saved whole or not at all", async () => {
  const { service } = setup();
  const lines = [
    { ...line, productId: brahmaId, packageCount: 4 },
    { ...line, productId: potatoId, totalContent: 1430, paidAmount: 8.55 },
  ];
  await assert.rejects(
    () =>
      service.createMany(
        {
          transactionId: expenseId,
          items: [...lines, { ...line, productId: potatoId, packageCount: 1 }],
        },
        userId,
      ),
    hasCode("purchase_quantity_required"),
  );
  assert.equal((await service.listForTransaction(expenseId, userId)).items.length, 0);

  const receipt = await service.createMany({ transactionId: expenseId, items: lines }, userId);
  assert.equal(receipt.items.length, 2);
  assert.equal(receipt.summary.itemsAmount, 28.47);
  await assert.rejects(
    () => service.createMany({ transactionId: incomeId, items: lines }, userId),
    hasCode("transaction_not_expense"),
  );
});

test("weight cannot be guessed from packages of a bulk product", async () => {
  const { service } = setup();
  await assert.rejects(
    () =>
      service.create(
        { ...line, transactionId: expenseId, productId: potatoId, packageCount: 1 },
        userId,
      ),
    hasCode("purchase_quantity_required"),
  );
});

test("lines require an owned expense, product and store", async () => {
  const { service } = setup();
  const input = { ...line, transactionId: expenseId, productId: brahmaId, packageCount: 4 };
  await assert.rejects(() => service.create(input, otherUserId), hasCode("transaction_not_found"));
  await assert.rejects(
    () => service.create({ ...input, transactionId: incomeId }, userId),
    hasCode("transaction_not_expense"),
  );
  await assert.rejects(
    () => service.create({ ...input, storeId: expenseId }, userId),
    hasCode("store_not_found"),
  );
  await assert.rejects(
    () => service.listForTransaction(expenseId, otherUserId),
    hasCode("transaction_not_found"),
  );
});

test("receipt names become aliases only while they are free", async () => {
  const { service, aliases } = setup();
  const base = { ...line, transactionId: expenseId, packageCount: 1 };
  await service.create(
    { ...base, productId: monsterId, extractedName: "Monster Tradicional 473 ml" },
    userId,
  );
  await service.create(
    { ...base, productId: brahmaId, extractedName: "MONSTER TRADICIONAL 473 ML" },
    userId,
  );
  await service.create(
    { ...base, productId: brahmaId, extractedName: "Energético Monster" },
    userId,
  );
  await service.create(
    { ...base, productId: monsterId, extractedName: "energetico monster" },
    userId,
  );
  assert.deepEqual(
    aliases.map((alias) => [alias.productId, alias.nameKey]),
    [[monsterId, "monster-tradicional-473-ml"]],
  );
});

test("replacing a line recalculates its content", async () => {
  const { service } = setup();
  const created = await service.create(
    { ...line, transactionId: expenseId, productId: brahmaId, packageCount: 4 },
    userId,
  );
  const replaced = await service.replace(created.id, userId, {
    ...line,
    productId: brahmaId,
    packageCount: 2,
    paidAmount: 9.96,
    discountAmount: 1,
  });
  assert.equal(replaced.totalContent, 946);
  assert.equal(replaced.listAmount, 10.96);
  await assert.rejects(
    () =>
      service.replace(created.id, otherUserId, { ...line, productId: brahmaId, packageCount: 1 }),
    hasCode("product_not_found"),
  );
  await assert.rejects(
    () => service.remove(created.id, otherUserId),
    hasCode("product_purchase_not_found"),
  );
});
