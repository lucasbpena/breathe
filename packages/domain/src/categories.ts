export const categoryTypes = ["income", "expense"] as const;
export type CategoryType = (typeof categoryTypes)[number];
export const internalTransferCategoryName = "Transferência interna";
export const invoicePaymentCategoryName = "Pagamentos";
export const balanceAdjustmentCategoryName = "Ajuste de saldo";
export const invoiceAdjustmentCategoryName = "Ajustes de fatura";
export const yieldCategoryName = "Rendimentos";
export const personSettlementCategoryName = "Repasses";
export const otherExpenseCategoryName = "Outras despesas";
export const otherIncomeCategoryName = "Outras receitas";

export type CategoryCreateDraft = {
  userId: string;
  name: string;
  type: CategoryType;
  icon: string | null;
  parentId: string | null;
  isSystem: boolean;
  tracksNutrition: boolean;
};

export function createCategoryDraft(
  input: Omit<CategoryCreateDraft, "isSystem">,
): CategoryCreateDraft {
  return {
    ...input,
    name: input.name.trim(),
    icon: input.icon?.trim() || null,
    isSystem: false,
    tracksNutrition: resolveCategoryTracksNutrition({
      type: input.type,
      requested: input.tracksNutrition,
      fallback: false,
    }),
  };
}

/**
 * Only expense categories carry nutrition. An omitted choice keeps the fallback: the parent's
 * choice for a new subcategory, or the current one when editing.
 */
export function resolveCategoryTracksNutrition(input: {
  type: CategoryType;
  requested: boolean | undefined;
  fallback: boolean;
}) {
  return input.type === "expense" && (input.requested ?? input.fallback);
}

export function canChangeCategoryType(input: {
  currentType: CategoryType;
  nextType: CategoryType;
  hasFinancialReferences: boolean;
  hasProducts: boolean;
  hasSubcategories: boolean;
}) {
  return (
    input.currentType === input.nextType ||
    (!input.hasFinancialReferences && !input.hasProducts && !input.hasSubcategories)
  );
}

export type CategoryHierarchyNode = { id: string; parentId: string | null };

/** Subcategories roll up into their parent; a top-level category is its own root. */
export function createRootCategoryResolver(categories: readonly CategoryHierarchyNode[]) {
  const parentIdById = new Map(categories.map((category) => [category.id, category.parentId]));
  return (categoryId: string) => parentIdById.get(categoryId) ?? categoryId;
}

export function expandCategoryIdsWithSubcategories(
  categoryIds: readonly string[],
  categories: readonly CategoryHierarchyNode[],
) {
  const selected = new Set(categoryIds);
  for (const category of categories) {
    if (category.parentId && selected.has(category.parentId)) selected.add(category.id);
  }
  return [...selected];
}

export type CategoryParentError =
  | "category_parent_invalid"
  | "category_parent_type_mismatch"
  | "category_has_subcategories"
  | "category_has_budgets";

/** Subcategories are one level deep and share the type of a user-defined parent. */
export function validateCategoryParent(input: {
  categoryId: string | null;
  type: CategoryType;
  parent: { id: string; type: CategoryType; parentId: string | null; isSystem: boolean };
  hasSubcategories: boolean;
  hasBudgets: boolean;
}): CategoryParentError | null {
  if (
    input.parent.id === input.categoryId ||
    input.parent.parentId !== null ||
    input.parent.isSystem
  ) {
    return "category_parent_invalid";
  }
  if (input.parent.type !== input.type) return "category_parent_type_mismatch";
  if (input.hasSubcategories) return "category_has_subcategories";
  if (input.hasBudgets) return "category_has_budgets";
  return null;
}

const defaultCategoryDefinitions: Array<{
  name: string;
  type: CategoryType;
  icon: string;
  isSystem?: boolean;
  tracksNutrition?: boolean;
}> = [
  {
    name: balanceAdjustmentCategoryName,
    type: "expense",
    icon: "circle-dollar-sign",
    isSystem: true,
  },
  { name: "Alimentação", type: "expense", icon: "utensils", tracksNutrition: true },
  { name: "Transporte", type: "expense", icon: "bus" },
  { name: "Moradia", type: "expense", icon: "home" },
  { name: "Saúde", type: "expense", icon: "heart-pulse" },
  { name: "Educação", type: "expense", icon: "book-open" },
  { name: "Lazer", type: "expense", icon: "gamepad" },
  { name: "Compras", type: "expense", icon: "shopping-bag" },
  { name: "Assinaturas", type: "expense", icon: "repeat" },
  { name: "Pets", type: "expense", icon: "paw-print" },
  { name: "Mercado", type: "expense", icon: "shopping-basket", tracksNutrition: true },
  { name: "Restaurantes", type: "expense", icon: "restaurant", tracksNutrition: true },
  { name: "Delivery", type: "expense", icon: "bike", tracksNutrition: true },
  { name: "Energia e água", type: "expense", icon: "zap" },
  { name: "Internet", type: "expense", icon: "wifi" },
  { name: "Vestuário", type: "expense", icon: "shirt" },
  { name: "Viagem", type: "expense", icon: "plane" },
  { name: "Presentes", type: "expense", icon: "gift" },
  { name: invoicePaymentCategoryName, type: "expense", icon: "receipt", isSystem: true },
  {
    name: invoiceAdjustmentCategoryName,
    type: "expense",
    icon: "receipt-text",
    isSystem: true,
  },
  { name: otherExpenseCategoryName, type: "expense", icon: "more-horizontal" },
  { name: "Salário", type: "income", icon: "wallet" },
  { name: "Freelance", type: "income", icon: "briefcase" },
  { name: yieldCategoryName, type: "income", icon: "trending-up" },
  { name: personSettlementCategoryName, type: "income", icon: "hand-coins", isSystem: true },
  { name: "Investimentos", type: "income", icon: "chart" },
  { name: "Vendas", type: "income", icon: "store" },
  { name: "Prêmios", type: "income", icon: "medal" },
  { name: "Reembolso", type: "income", icon: "refresh-cw" },
  { name: "Aluguel recebido", type: "income", icon: "building" },
  { name: otherIncomeCategoryName, type: "income", icon: "more-horizontal" },
  {
    name: balanceAdjustmentCategoryName,
    type: "income",
    icon: "circle-dollar-sign",
    isSystem: true,
  },
  {
    name: internalTransferCategoryName,
    type: "income",
    icon: "arrow-left-right",
    isSystem: true,
  },
];

export function createDefaultCategoryDrafts(userId: string): CategoryCreateDraft[] {
  return defaultCategoryDefinitions.map((category) => ({
    ...category,
    userId,
    parentId: null,
    isSystem: category.isSystem ?? false,
    tracksNutrition: category.tracksNutrition ?? false,
  }));
}
