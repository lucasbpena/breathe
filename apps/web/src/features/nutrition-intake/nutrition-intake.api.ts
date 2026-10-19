import type {
  NutritionIntakeOutput,
  NutritionIntakeQuery,
} from "@openmonetis/validators/nutrition-intake";
import { requestApi as request } from "@/lib/api-client";

export function getNutritionIntake(query: NutritionIntakeQuery) {
  return request<NutritionIntakeOutput>(
    `/nutrition-intake?${new URLSearchParams(query).toString()}`,
  );
}
