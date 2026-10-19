import assert from "node:assert/strict";
import test from "node:test";
import { ApiError } from "../utils/errors";
import {
  createProductsService,
  type ProductAliasRecord,
  type ProductPurchasePriceRecord,
  type ProductRecord,
  type ProductsRepository,
} from "./products.service";

const userId = "00000000-0000-4000-8000-000000000001";
const otherUserId = "00000000-0000-4000-8000-000000000009";
const expenseCategoryId = "00000000-0000-4000-8000-000000000002";
const incomeCategoryId = "00000000-0000-4000-8000-000000000003";
const storeId = "00000000-0000-4000-8000-000000000004";

function setup() {
  const products: ProductRecord[] = [];
  const aliases: (ProductAliasRecord & { userId: string; nameKey: string })[] = [];
  const purchases: (ProductPurchasePriceRecord & { userId: string })[] = [];
  let sequence = 0;
  const nextId = () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`;
  const owned = <T extends { userId: string }>(items: T[], owner: string) =>
    items.filter((item) => item.userId === owner);

  const repository: ProductsRepository = {
    async listByUser(owner) {
      return owned(products, owner);
    },
    async findByIdForUser(id, owner) {
      return owned(products, owner).find((product) => product.id === id) ?? null;
    },
    async findIdByNameKeyForUser(nameKey, owner) {
      return owned(products, owner).find((product) => product.nameKey === nameKey)?.id ?? null;
    },
    async findCategoryForUser(id, owner) {
      if (owner !== userId) return null;
      if (id === expenseCategoryId) return { type: "expense", isSystem: false };
      if (id === incomeCategoryId) return { type: "income", isSystem: false };
      return null;
    },
    async listAliasesForUser(owner, productId) {
      return owned(aliases, owner).filter((alias) => !productId || alias.productId === productId);
    },
    async findAliasByNameKeyForUser(nameKey, owner) {
      return owned(aliases, owner).find((alias) => alias.nameKey === nameKey) ?? null;
    },
    async insertAlias(data) {
      const alias = { ...data, id: nextId() };
      aliases.push(alias);
      return alias;
    },
    async deleteAliasForUser(aliasId, productId, owner) {
      const index = aliases.findIndex(
        (alias) => alias.id === aliasId && alias.productId === productId && alias.userId === owner,
      );
      if (index < 0) return null;
      aliases.splice(index, 1);
      return { id: aliasId };
    },
    async listPurchasePricesForUser(owner, productId) {
      return owned(purchases, owner).filter(
        (purchase) => !productId || purchase.productId === productId,
      );
    },
    async listStoresByIdsForUser(ids) {
      return ids.map((id) => ({ id, name: "DMA", branch: "Loja 003", neighborhood: null }));
    },
    async insert(data) {
      const product = {
        ...data,
        id: nextId(),
        categoryName: data.categoryId ? "Mercado" : null,
        categoryIcon: null,
        createdAt: new Date("2026-10-18T12:00:00Z"),
        updatedAt: new Date("2026-10-18T12:00:00Z"),
      };
      products.push(product);
      return product;
    },
    async updateForUser(id, owner, data) {
      const product = owned(products, owner).find((item) => item.id === id);
      if (!product) return null;
      Object.assign(product, data);
      return product;
    },
    async hasPurchasesForUser(id, owner) {
      return owned(purchases, owner).some((purchase) => purchase.productId === id);
    },
    async deleteForUser(id, owner) {
      const index = products.findIndex((product) => product.id === id && product.userId === owner);
      if (index < 0) return null;
      products.splice(index, 1);
      return { id };
    },
    async mergeForUser({ userId: owner, sourceId, targetId, sourceAlias }) {
      for (const purchase of owned(purchases, owner)) {
        if (purchase.productId === sourceId) purchase.productId = targetId;
      }
      for (const alias of owned(aliases, owner)) {
        if (alias.productId === sourceId) alias.productId = targetId;
      }
      await repository.deleteForUser(sourceId, owner);
      aliases.push({ ...sourceAlias, id: nextId(), userId: owner, productId: targetId });
    },
  };

  function addPurchase(productId: string, purchaseDate: string, paidAmount: string) {
    purchases.push({
      purchaseId: nextId(),
      productId,
      purchaseDate: new Date(`${purchaseDate}T00:00:00Z`),
      storeId,
      paidAmount,
      totalContent: "473",
      userId,
    });
  }

  return { service: createProductsService(repository), addPurchase };
}

function hasCode(code: string) {
  return (error: unknown) => error instanceof ApiError && error.code === code;
}

const monster = {
  name: "Energético Monster",
  contentUnit: "milliliter",
  packageContent: 473,
} as const;

test("products accept only the user's non-system expense categories", async () => {
  const { service } = setup();
  const product = await service.create({ ...monster, categoryId: expenseCategoryId }, userId);
  assert.equal(product.categoryName, "Mercado");
  assert.equal(product.packageContent, 473);
  await assert.rejects(
    () =>
      service.create(
        { name: "Salário", contentUnit: "package", categoryId: incomeCategoryId },
        userId,
      ),
    hasCode("category_not_found"),
  );
  await assert.rejects(
    () => service.create({ ...monster, categoryId: expenseCategoryId }, otherUserId),
    hasCode("category_not_found"),
  );
});

test("products without metragem drop the package metragem", async () => {
  const { service } = setup();
  const bread = await service.create(
    { name: "Pão de hambúrguer", contentUnit: "package", packageContent: 6 },
    userId,
  );
  assert.equal(bread.packageContent, null);
});

test("names and aliases share one namespace per user", async () => {
  const { service } = setup();
  const product = await service.create(monster, userId);
  await service.addAlias(product.id, { name: "Monster Tradicional 473 ml" }, userId);
  await assert.rejects(
    () => service.create({ name: "monster tradicional 473 ML", contentUnit: "package" }, userId),
    hasCode("product_already_exists"),
  );
  const other = await service.create({ name: "Brahma 473 ml", contentUnit: "milliliter" }, userId);
  await assert.rejects(
    () => service.addAlias(other.id, { name: "MONSTER TRADICIONAL 473 ML" }, userId),
    hasCode("alias_conflict"),
  );
  await service.create(monster, otherUserId);
});

test("receipt names resolve through aliases first and product names next", async () => {
  const { service } = setup();
  const product = await service.create(monster, userId);
  await service.addAlias(product.id, { name: "MONSTER TRAD 473ML" }, userId);
  assert.deepEqual(await service.resolve("Monster Trad 473ml", userId), { productId: product.id });
  assert.deepEqual(await service.resolve("energetico monster", userId), { productId: product.id });
  assert.deepEqual(await service.resolve("Itubaína", userId), { productId: null });
  assert.deepEqual(await service.resolve("MONSTER TRAD 473ML", otherUserId), { productId: null });
});

test("products with purchases cannot be deleted and carry their price summary", async () => {
  const { service, addPurchase } = setup();
  const product = await service.create(monster, userId);
  addPurchase(product.id, "2026-10-11", "9.48");
  addPurchase(product.id, "2026-10-07", "10.99");
  const [listed] = await service.list(userId);
  assert.equal(listed?.priceSummary.purchaseCount, 2);
  assert.equal(listed?.priceSummary.lastPrice, 20.04);
  await assert.rejects(() => service.remove(product.id, userId), hasCode("product_in_use"));
  await assert.rejects(
    () => service.update(product.id, userId, { contentUnit: "package" }),
    hasCode("product_unit_in_use"),
  );
  assert.equal(
    (await service.update(product.id, userId, { packageContent: 350 })).packageContent,
    350,
  );
});

test("merging moves purchases and keeps the source name as an alias", async () => {
  const { service, addPurchase } = setup();
  const target = await service.create(monster, userId);
  const source = await service.create(
    { name: "Monster 473ml", contentUnit: "milliliter", packageContent: 473 },
    userId,
  );
  addPurchase(source.id, "2026-10-11", "9.48");
  await assert.rejects(
    () => service.merge(target.id, { sourceProductId: target.id }, userId),
    hasCode("product_merge_same"),
  );
  const bulk = await service.create({ name: "Batata inglesa", contentUnit: "gram" }, userId);
  await assert.rejects(
    () => service.merge(target.id, { sourceProductId: bulk.id }, userId),
    hasCode("product_merge_unit_mismatch"),
  );
  await assert.rejects(
    () => service.merge(target.id, { sourceProductId: source.id }, otherUserId),
    hasCode("product_not_found"),
  );

  const merged = await service.merge(target.id, { sourceProductId: source.id }, userId);
  assert.equal(merged.priceSummary.purchaseCount, 1);
  assert.deepEqual(
    merged.aliases.map((alias) => alias.name),
    ["Monster 473ml"],
  );
  assert.deepEqual(await service.resolve("monster 473ML", userId), { productId: target.id });
  await assert.rejects(() => service.get(source.id, userId), hasCode("product_not_found"));
});

test("price history names the stores of each point", async () => {
  const { service, addPurchase } = setup();
  const product = await service.create(monster, userId);
  addPurchase(product.id, "2026-10-11", "9.48");
  const history = await service.getPriceHistory(product.id, userId);
  assert.equal(history.contentUnit, "milliliter");
  assert.equal(history.points.length, 1);
  assert.deepEqual(
    history.stores.map((store) => [store.storeName, store.storeBranch, store.averagePrice]),
    [["DMA", "Loja 003", 20.04]],
  );
});
