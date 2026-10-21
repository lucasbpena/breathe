import type { CategoryOutput } from "@openmonetis/validators/categories";

import { CategoryIcon } from "@/features/categories/category-icons";
import { CategoryPathLabel } from "@/features/categories/components/category-path-label";

export function CategoryOption({
  category,
}: {
  category?: CategoryOutput & { parentName?: string | null };
}) {
  if (!category) return <span>Selecione</span>;
  return (
    <span className="flex items-center gap-2">
      <CategoryIcon className="size-4" name={category.icon} />
      <span>
        <CategoryPathLabel category={category} />
      </span>
    </span>
  );
}
