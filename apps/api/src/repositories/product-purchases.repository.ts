import {
  db,
  productAliases,
  productPurchases,
  products,
  stores,
  transactions,
} from "@openmonetis/db";
import { and, asc, desc, eq } from "drizzle-orm";
import type { ProductPurchasesRepository } from "../services/product-purchases.service";

const purchaseColumns = {
  id: productPurchases.id,
  transactionId: productPurchases.transactionId,
  transactionName: transactions.name,
  transactionPeriod: transactions.period,
  purchaseDate: transactions.purchaseDate,
  productId: productPurchases.productId,
  productName: products.name,
  contentUnit: products.contentUnit,
  storeId: productPurchases.storeId,
  storeName: stores.name,
  storeBranch: stores.branch,
  storeNeighborhood: stores.neighborhood,
  extractedName: productPurchases.extractedName,
  packageCount: productPurchases.packageCount,
  totalContent: productPurchases.totalContent,
  paidAmount: productPurchases.paidAmount,
  discountAmount: productPurchases.discountAmount,
  createdAt: productPurchases.createdAt,
  updatedAt: productPurchases.updatedAt,
};

function selectPurchases(userId: string) {
  return db
    .select(purchaseColumns)
    .from(productPurchases)
    .innerJoin(
      transactions,
      and(eq(productPurchases.transactionId, transactions.id), eq(transactions.userId, userId)),
    )
    .innerJoin(
      products,
      and(eq(productPurchases.productId, products.id), eq(products.userId, userId)),
    )
    .innerJoin(stores, and(eq(productPurchases.storeId, stores.id), eq(stores.userId, userId)));
}

async function findByIdForUser(id: string, userId: string) {
  const [purchase] = await selectPurchases(userId)
    .where(and(eq(productPurchases.id, id), eq(productPurchases.userId, userId)))
    .limit(1);
  return purchase ?? null;
}

export const productPurchasesRepository = {
  async findTransactionForUser(id, userId) {
    const [transaction] = await db
      .select({ id: transactions.id, type: transactions.type, amount: transactions.amount })
      .from(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
      .limit(1);
    return transaction ?? null;
  },
  async findProductForUser(id, userId) {
    const [product] = await db
      .select({
        id: products.id,
        nameKey: products.nameKey,
        contentUnit: products.contentUnit,
        packageContent: products.packageContent,
      })
      .from(products)
      .where(and(eq(products.id, id), eq(products.userId, userId)))
      .limit(1);
    return product ?? null;
  },
  async storeExistsForUser(id, userId) {
    const [store] = await db
      .select({ id: stores.id })
      .from(stores)
      .where(and(eq(stores.id, id), eq(stores.userId, userId)))
      .limit(1);
    return Boolean(store);
  },
  listByTransactionForUser(transactionId, userId) {
    return selectPurchases(userId)
      .where(
        and(eq(productPurchases.transactionId, transactionId), eq(productPurchases.userId, userId)),
      )
      .orderBy(asc(productPurchases.createdAt), asc(productPurchases.id));
  },
  listByProductForUser(productId, userId) {
    return selectPurchases(userId)
      .where(and(eq(productPurchases.productId, productId), eq(productPurchases.userId, userId)))
      .orderBy(desc(transactions.purchaseDate), desc(productPurchases.createdAt));
  },
  async insert(data) {
    const [purchase] = await db
      .insert(productPurchases)
      .values(data)
      .returning({ id: productPurchases.id });
    if (!purchase) throw new Error("Product purchase insert returned no row");
    const inserted = await findByIdForUser(purchase.id, data.userId);
    if (!inserted) throw new Error("Inserted product purchase could not be read");
    return inserted;
  },
  async insertMany(rows) {
    if (rows.length) await db.insert(productPurchases).values(rows);
  },
  async replaceForUser(id, userId, data) {
    const [purchase] = await db
      .update(productPurchases)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(productPurchases.id, id), eq(productPurchases.userId, userId)))
      .returning({ id: productPurchases.id });
    return purchase ? findByIdForUser(purchase.id, userId) : null;
  },
  async deleteForUser(id, userId) {
    const [purchase] = await db
      .delete(productPurchases)
      .where(and(eq(productPurchases.id, id), eq(productPurchases.userId, userId)))
      .returning({ id: productPurchases.id });
    return purchase ?? null;
  },
  async productNameKeyExistsForUser(nameKey, userId) {
    const [product] = await db
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.nameKey, nameKey), eq(products.userId, userId)))
      .limit(1);
    return Boolean(product);
  },
  async insertAliasIfAbsent(data) {
    await db
      .insert(productAliases)
      .values(data)
      .onConflictDoNothing({ target: [productAliases.userId, productAliases.nameKey] });
  },
} satisfies ProductPurchasesRepository;
