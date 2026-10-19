import type { NutritionIntakeQuery } from "@openmonetis/validators/nutrition-intake";
import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { getNutritionIntake } from "./nutrition-intake.api";

export function nutritionIntakeQueryOptions(query: NutritionIntakeQuery) {
  return queryOptions({
    queryKey: ["nutrition-intake", query.from, query.to],
    queryFn: () => getNutritionIntake(query),
    placeholderData: keepPreviousData,
  });
}
