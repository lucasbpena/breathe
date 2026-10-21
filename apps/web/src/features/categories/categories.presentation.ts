import type { CategoryOutput } from "@openmonetis/validators/categories";
export const categoryTypeLabels: Record<CategoryOutput["type"], string> = {
  income: "Receita",
  expense: "Despesa",
};

const categoryErrorMessages: Record<string, string> = {
  category_name_taken: "Já existe uma categoria desse tipo com esse nome.",
  category_parent_not_found: "Categoria pai não encontrada.",
  category_parent_invalid: "Escolha uma categoria principal criada por você.",
  category_parent_type_mismatch: "A subcategoria precisa ter o mesmo tipo da categoria pai.",
  category_has_subcategories:
    "Esta categoria tem subcategorias. Mova ou remova as subcategorias antes.",
  category_has_budgets: "Remova os orçamentos desta categoria antes de torná-la subcategoria.",
  category_type_in_use: "Categoria em uso. O tipo não pode ser alterado.",
  category_in_use:
    "Categoria em uso. Altere os lançamentos e remova os orçamentos vinculados antes de excluir.",
  category_has_products: "Categoria usada por produtos. Troque a categoria deles antes de excluir.",
};

export function getCategoryErrorMessage(code: string | undefined, fallback: string) {
  return (code && categoryErrorMessages[code]) || fallback;
}

type CategoryTreeSource = Pick<CategoryOutput, "id" | "name" | "parentId">;
export type CategoryTreeItem<T extends CategoryTreeSource = CategoryOutput> = T & {
  parentName: string | null;
};

/** Orders each top-level category before its subcategories and labels them with the parent. */
export function buildCategoryTree<T extends CategoryTreeSource>(
  categories: readonly T[],
): CategoryTreeItem<T>[] {
  const ids = new Set(categories.map((category) => category.id));
  const isTopLevel = (category: T) => !category.parentId || !ids.has(category.parentId);

  return categories
    .filter(isTopLevel)
    .sort(compareCategoryNames)
    .flatMap((parent) => [
      { ...parent, parentName: null },
      ...categories
        .filter((category) => category.parentId === parent.id)
        .sort(compareCategoryNames)
        .map((category) => ({ ...category, parentName: parent.name })),
    ]);
}

/** Keeps matching categories, the parents of matching subcategories and the children of matching parents. */
export function filterCategoryTree<T extends CategoryTreeSource>(
  categories: readonly T[],
  search: string,
): CategoryTreeItem<T>[] {
  const term = search.trim().toLocaleLowerCase("pt-BR");
  if (!term) return buildCategoryTree(categories);
  const matchedIds = new Set(
    categories
      .filter((category) => category.name.toLocaleLowerCase("pt-BR").includes(term))
      .map((category) => category.id),
  );

  return buildCategoryTree(
    categories.filter(
      (category) =>
        matchedIds.has(category.id) ||
        (category.parentId !== null && matchedIds.has(category.parentId)) ||
        categories.some((child) => child.parentId === category.id && matchedIds.has(child.id)),
    ),
  );
}

export function formatCategoryPath(category: { name: string; parentName?: string | null }) {
  return category.parentName ? `${category.parentName} › ${category.name}` : category.name;
}

function compareCategoryNames(left: { name: string }, right: { name: string }) {
  return left.name.localeCompare(right.name, "pt-BR", { sensitivity: "base" });
}
