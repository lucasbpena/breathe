import { createFileRoute } from "@tanstack/react-router";
import { NutritionIntakePage } from "@/features/nutrition-intake/components/nutrition-intake-page";

export const Route = createFileRoute("/nutrition-intake")({
  head: () => ({ meta: [{ title: "Nutrição · OpenMonetis" }] }),
  component: NutritionIntakePage,
});
