import { calculateNutritionIntake } from "@openmonetis/domain/nutrition-intake";
import type { ProductContentUnit } from "@openmonetis/domain/products";
import type {
  NutritionIntakeOutput,
  NutritionIntakeQuery,
} from "@openmonetis/validators/nutrition-intake";

export type NutritionIntakeLineRecord = {
  purchaseDate: Date;
  productId: string;
  productName: string;
  contentUnit: ProductContentUnit;
  totalContent: string;
  energyKcal: string | null;
  proteinGrams: string | null;
  carbohydrateGrams: string | null;
  addedSugarGrams: string | null;
  fatGrams: string | null;
};

export type NutritionIntakeRepository = {
  /** Receipt lines of expenses whose purchase date falls in the period, both ends included. */
  listLinesForUser(userId: string, from: string, to: string): Promise<NutritionIntakeLineRecord[]>;
};

export function createNutritionIntakeService(repository: NutritionIntakeRepository) {
  return {
    async get(userId: string, query: NutritionIntakeQuery): Promise<NutritionIntakeOutput> {
      const records = await repository.listLinesForUser(userId, query.from, query.to);
      return calculateNutritionIntake({
        from: query.from,
        to: query.to,
        lines: records.map((record) => ({
          purchaseDate: record.purchaseDate.toISOString().slice(0, 10),
          productId: record.productId,
          productName: record.productName,
          contentUnit: record.contentUnit,
          totalContent: record.totalContent,
          nutrition: {
            energyKcal: record.energyKcal,
            proteinGrams: record.proteinGrams,
            carbohydrateGrams: record.carbohydrateGrams,
            addedSugarGrams: record.addedSugarGrams,
            fatGrams: record.fatGrams,
          },
        })),
      });
    },
  };
}

export type NutritionIntakeService = ReturnType<typeof createNutritionIntakeService>;
