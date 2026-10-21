import { categories, db, productPurchases, products, transactions } from "@openmonetis/db";
import { and, eq, gte, lte } from "drizzle-orm";
import type { NutritionIntakeRepository } from "../services/nutrition-intake.service";

export const nutritionIntakeRepository = {
  listLinesForUser(userId, from, to) {
    return (
      db
        .select({
          purchaseDate: transactions.purchaseDate,
          productId: products.id,
          productName: products.name,
          contentUnit: products.contentUnit,
          totalContent: productPurchases.totalContent,
          energyKcal: products.energyKcal,
          proteinGrams: products.proteinGrams,
          carbohydrateGrams: products.carbohydrateGrams,
          addedSugarGrams: products.addedSugarGrams,
          fatGrams: products.fatGrams,
        })
        .from(productPurchases)
        .innerJoin(
          transactions,
          and(eq(productPurchases.transactionId, transactions.id), eq(transactions.userId, userId)),
        )
        .innerJoin(
          products,
          and(eq(productPurchases.productId, products.id), eq(products.userId, userId)),
        )
        // Only products whose category tracks nutrition count, so non-food items stay out.
        .innerJoin(
          categories,
          and(
            eq(products.categoryId, categories.id),
            eq(categories.userId, userId),
            eq(categories.tracksNutrition, true),
          ),
        )
        .where(
          and(
            eq(productPurchases.userId, userId),
            gte(transactions.purchaseDate, new Date(`${from}T00:00:00.000Z`)),
            lte(transactions.purchaseDate, new Date(`${to}T00:00:00.000Z`)),
          ),
        )
    );
  },
} satisfies NutritionIntakeRepository;
