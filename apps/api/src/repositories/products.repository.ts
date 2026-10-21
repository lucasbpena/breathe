import {
  categories,
  db,
  productAliases,
  productPurchases,
  products,
  stores,
  transactions,
} from "@openmonetis/db";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { ProductsRepository } from "../services/products.service";

const productColumns = {
  id: products.id,
  userId: products.userId,
  name: products.name,
  nameKey: products.nameKey,
  categoryId: products.categoryId,
  categoryName: categories.name,
  categoryIcon: categories.icon,
  categoryTracksNutrition: categories.tracksNutrition,
  contentUnit: products.contentUnit,
  packageContent: products.packageContent,
  energyKcal: products.energyKcal,
  proteinGrams: products.proteinGrams,
  carbohydrateGrams: products.carbohydrateGrams,
  addedSugarGrams: products.addedSugarGrams,
  fatGrams: products.fatGrams,
  createdAt: products.createdAt,
  updatedAt: products.updatedAt,
};

const aliasColumns = {
  id: productAliases.id,
  productId: productAliases.productId,
  name: productAliases.name,
};

function selectProducts(userId: string) {
  return db
    .select(productColumns)
    .from(products)
    .leftJoin(
      categories,
      and(eq(products.categoryId, categories.id), eq(categories.userId, userId)),
    );
}

async function findByIdForUser(id: string, userId: string) {
  const [product] = await selectProducts(userId)
    .where(and(eq(products.id, id), eq(products.userId, userId)))
    .limit(1);
  return product ?? null;
}

export const productsRepository = {
  listByUser(userId) {
    return selectProducts(userId).where(eq(products.userId, userId)).orderBy(asc(products.name));
  },
  findByIdForUser,
  async findIdByNameKeyForUser(nameKey, userId) {
    const [product] = await db
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.nameKey, nameKey), eq(products.userId, userId)))
      .limit(1);
    return product?.id ?? null;
  },
  async findCategoryForUser(id, userId) {
    const [category] = await db
      .select({
        type: categories.type,
        isSystem: categories.isSystem,
        tracksNutrition: categories.tracksNutrition,
      })
      .from(categories)
      .where(and(eq(categories.id, id), eq(categories.userId, userId)))
      .limit(1);
    return category ?? null;
  },
  listAliasesForUser(userId, productId) {
    return db
      .select(aliasColumns)
      .from(productAliases)
      .where(
        and(
          eq(productAliases.userId, userId),
          productId ? eq(productAliases.productId, productId) : undefined,
        ),
      )
      .orderBy(asc(productAliases.name));
  },
  async findAliasByNameKeyForUser(nameKey, userId) {
    const [alias] = await db
      .select(aliasColumns)
      .from(productAliases)
      .where(and(eq(productAliases.nameKey, nameKey), eq(productAliases.userId, userId)))
      .limit(1);
    return alias ?? null;
  },
  async insertAlias(data) {
    const [alias] = await db.insert(productAliases).values(data).returning(aliasColumns);
    if (!alias) throw new Error("Product alias insert returned no row");
    return alias;
  },
  async deleteAliasForUser(aliasId, productId, userId) {
    const [alias] = await db
      .delete(productAliases)
      .where(
        and(
          eq(productAliases.id, aliasId),
          eq(productAliases.productId, productId),
          eq(productAliases.userId, userId),
        ),
      )
      .returning({ id: productAliases.id });
    return alias ?? null;
  },
  listPurchasePricesForUser(userId, productId) {
    return db
      .select({
        purchaseId: productPurchases.id,
        productId: productPurchases.productId,
        purchaseDate: transactions.purchaseDate,
        storeId: productPurchases.storeId,
        paidAmount: productPurchases.paidAmount,
        totalContent: productPurchases.totalContent,
      })
      .from(productPurchases)
      .innerJoin(
        transactions,
        and(eq(productPurchases.transactionId, transactions.id), eq(transactions.userId, userId)),
      )
      .where(
        and(
          eq(productPurchases.userId, userId),
          productId ? eq(productPurchases.productId, productId) : undefined,
        ),
      );
  },
  async listStoresByIdsForUser(ids, userId) {
    if (!ids.length) return [];
    return db
      .select({
        id: stores.id,
        name: stores.name,
        branch: stores.branch,
        neighborhood: stores.neighborhood,
      })
      .from(stores)
      .where(and(eq(stores.userId, userId), inArray(stores.id, ids)));
  },
  async insert(data) {
    const [product] = await db.insert(products).values(data).returning({ id: products.id });
    if (!product) throw new Error("Product insert returned no row");
    const inserted = await findByIdForUser(product.id, data.userId);
    if (!inserted) throw new Error("Inserted product could not be read");
    return inserted;
  },
  async updateForUser(id, userId, data) {
    const [product] = await db
      .update(products)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(products.id, id), eq(products.userId, userId)))
      .returning({ id: products.id });
    return product ? findByIdForUser(product.id, userId) : null;
  },
  async hasPurchasesForUser(id, userId) {
    const [purchase] = await db
      .select({ id: productPurchases.id })
      .from(productPurchases)
      .where(and(eq(productPurchases.productId, id), eq(productPurchases.userId, userId)))
      .limit(1);
    return Boolean(purchase);
  },
  async deleteForUser(id, userId) {
    const [product] = await db
      .delete(products)
      .where(and(eq(products.id, id), eq(products.userId, userId)))
      .returning({ id: products.id });
    return product ?? null;
  },
  async mergeForUser({ userId, sourceId, targetId, sourceAlias }) {
    await db.transaction(async (transaction) => {
      await transaction
        .update(productPurchases)
        .set({ productId: targetId, updatedAt: new Date() })
        .where(and(eq(productPurchases.productId, sourceId), eq(productPurchases.userId, userId)));
      await transaction
        .update(productAliases)
        .set({ productId: targetId })
        .where(and(eq(productAliases.productId, sourceId), eq(productAliases.userId, userId)));
      await transaction
        .delete(products)
        .where(and(eq(products.id, sourceId), eq(products.userId, userId)));
      await transaction
        .insert(productAliases)
        .values({ userId, productId: targetId, ...sourceAlias })
        .onConflictDoNothing({ target: [productAliases.userId, productAliases.nameKey] });
    });
  },
} satisfies ProductsRepository;
