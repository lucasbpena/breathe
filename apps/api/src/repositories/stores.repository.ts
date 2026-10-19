import { db, productPurchases, stores } from "@openmonetis/db";
import { and, asc, eq } from "drizzle-orm";
import type { StoresRepository } from "../services/stores.service";

const storeColumns = {
  id: stores.id,
  userId: stores.userId,
  name: stores.name,
  branch: stores.branch,
  neighborhood: stores.neighborhood,
  address: stores.address,
  createdAt: stores.createdAt,
  updatedAt: stores.updatedAt,
};

export const storesRepository = {
  listByUser(userId) {
    return db
      .select(storeColumns)
      .from(stores)
      .where(eq(stores.userId, userId))
      .orderBy(asc(stores.name), asc(stores.branch));
  },
  async findByIdForUser(id, userId) {
    const [store] = await db
      .select(storeColumns)
      .from(stores)
      .where(and(eq(stores.id, id), eq(stores.userId, userId)))
      .limit(1);
    return store ?? null;
  },
  async findIdByNameKeyForUser(nameKey, userId) {
    const [store] = await db
      .select({ id: stores.id })
      .from(stores)
      .where(and(eq(stores.nameKey, nameKey), eq(stores.userId, userId)))
      .limit(1);
    return store?.id ?? null;
  },
  async insert(data) {
    const [store] = await db.insert(stores).values(data).returning(storeColumns);
    if (!store) throw new Error("Store insert returned no row");
    return store;
  },
  async updateForUser(id, userId, data) {
    const [store] = await db
      .update(stores)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(stores.id, id), eq(stores.userId, userId)))
      .returning(storeColumns);
    return store ?? null;
  },
  async hasPurchasesForUser(id, userId) {
    const [purchase] = await db
      .select({ id: productPurchases.id })
      .from(productPurchases)
      .where(and(eq(productPurchases.storeId, id), eq(productPurchases.userId, userId)))
      .limit(1);
    return Boolean(purchase);
  },
  async deleteForUser(id, userId) {
    const [store] = await db
      .delete(stores)
      .where(and(eq(stores.id, id), eq(stores.userId, userId)))
      .returning({ id: stores.id });
    return store ?? null;
  },
} satisfies StoresRepository;
