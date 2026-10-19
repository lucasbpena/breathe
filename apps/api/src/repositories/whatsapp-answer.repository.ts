import { categories, db, productPurchases, products, stores, transactions } from "@openmonetis/db";
import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import type { WhatsAppAnswerRepository } from "../services/whatsapp-answer.service";

const purchaseDate = sql<string>`${transactions.purchaseDate}::text`;

export const whatsappAnswerRepository = {
  listTransactions(userId, from, limit) {
    return db
      .select({
        date: purchaseDate,
        name: transactions.name,
        amount: transactions.amount,
        type: transactions.type,
        category: categories.name,
        paymentMethod: transactions.paymentMethod,
      })
      .from(transactions)
      .leftJoin(
        categories,
        and(eq(categories.id, transactions.categoryId), eq(categories.userId, userId)),
      )
      .where(
        and(
          eq(transactions.userId, userId),
          gte(transactions.purchaseDate, new Date(`${from}T00:00:00.000Z`)),
        ),
      )
      .orderBy(desc(transactions.purchaseDate), desc(transactions.createdAt))
      .limit(limit);
  },

  listPurchases(userId, from, limit) {
    return db
      .select({
        date: purchaseDate,
        product: products.name,
        contentUnit: products.contentUnit,
        store: stores.name,
        storeBranch: stores.branch,
        packageCount: productPurchases.packageCount,
        totalContent: productPurchases.totalContent,
        paidAmount: productPurchases.paidAmount,
      })
      .from(productPurchases)
      .innerJoin(
        transactions,
        and(eq(transactions.id, productPurchases.transactionId), eq(transactions.userId, userId)),
      )
      .innerJoin(
        products,
        and(eq(products.id, productPurchases.productId), eq(products.userId, userId)),
      )
      .innerJoin(stores, and(eq(stores.id, productPurchases.storeId), eq(stores.userId, userId)))
      .where(
        and(
          eq(productPurchases.userId, userId),
          gte(transactions.purchaseDate, new Date(`${from}T00:00:00.000Z`)),
        ),
      )
      .orderBy(desc(transactions.purchaseDate), asc(products.name))
      .limit(limit);
  },

  listProducts(userId) {
    return db
      .select({
        name: products.name,
        contentUnit: products.contentUnit,
        packageContent: products.packageContent,
        energyKcal: products.energyKcal,
        proteinGrams: products.proteinGrams,
        carbohydrateGrams: products.carbohydrateGrams,
        addedSugarGrams: products.addedSugarGrams,
        fatGrams: products.fatGrams,
      })
      .from(products)
      .where(eq(products.userId, userId))
      .orderBy(asc(products.name));
  },
} satisfies WhatsAppAnswerRepository;
