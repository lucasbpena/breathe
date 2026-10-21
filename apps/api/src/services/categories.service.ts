import {
  type CategoryCreateDraft,
  type CategoryParentError,
  type CategoryType,
  canChangeCategoryType,
  createCategoryDraft,
  createDefaultCategoryDrafts,
  resolveCategoryTracksNutrition,
  validateCategoryParent,
} from "@openmonetis/domain/categories";
import type {
  CategoryOutput,
  CreateCategoryInput,
  ReplaceCategoryInput,
  UpdateCategoryInput,
} from "@openmonetis/validators/categories";
import { badRequest, conflict, notFound } from "../utils/errors";

export type CategoryRecord = {
  id: string;
  userId: string;
  name: string;
  type: CategoryType;
  icon: string | null;
  parentId: string | null;
  isSystem: boolean;
  tracksNutrition: boolean;
  createdAt: Date;
  updatedAt: Date;
};
type CategoryCreateRecord = Omit<CategoryRecord, "id" | "createdAt" | "updatedAt">;
type CategoryUpdateRecord = Partial<
  Pick<CategoryRecord, "name" | "type" | "icon" | "parentId" | "tracksNutrition">
>;
export type CategoriesRepository = {
  insertDefaults(data: CategoryCreateDraft[]): Promise<void>;
  insert(data: CategoryCreateRecord): Promise<CategoryRecord>;
  listByUser(userId: string): Promise<CategoryRecord[]>;
  findByIdForUser(id: string, userId: string): Promise<CategoryRecord | null>;
  findSystemByNameForUser(name: string, userId: string): Promise<CategoryRecord | null>;
  updateForUser(
    id: string,
    userId: string,
    data: CategoryUpdateRecord,
  ): Promise<CategoryRecord | null>;
  deleteForUser(id: string, userId: string): Promise<CategoryRecord | null>;
  hasFinancialReferencesForUser(id: string, userId: string): Promise<boolean>;
  hasProductsForUser(id: string, userId: string): Promise<boolean>;
  hasSubcategoriesForUser(id: string, userId: string): Promise<boolean>;
  hasBudgetsForUser(id: string, userId: string): Promise<boolean>;
  isNameTakenForUser(
    category: { name: string; type: CategoryType; exceptId?: string },
    userId: string,
  ): Promise<boolean>;
};

const parentErrorMessages: Record<CategoryParentError, string> = {
  category_parent_invalid: "A subcategory needs a user-defined top-level parent",
  category_parent_type_mismatch: "A subcategory must have the same type as its parent",
  category_has_subcategories: "A category with subcategories cannot become a subcategory",
  category_has_budgets: "A category with budgets cannot become a subcategory",
};

function toOutput(category: CategoryRecord): CategoryOutput {
  return {
    id: category.id,
    name: category.name,
    type: category.type,
    icon: category.icon,
    parentId: category.parentId,
    isSystem: category.isSystem,
    tracksNutrition: category.tracksNutrition,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  };
}

export function createCategoriesService(repository: CategoriesRepository) {
  async function editableCategory(id: string, userId: string) {
    const category = await repository.findByIdForUser(id, userId);
    if (!category || category.isSystem) throw notFound("Category not found", "category_not_found");
    return category;
  }
  async function assertTypeChange(
    category: CategoryRecord,
    nextType: CategoryType,
    userId: string,
  ) {
    if (category.type === nextType) return;
    const [hasFinancialReferences, hasProducts, hasSubcategories] = await Promise.all([
      repository.hasFinancialReferencesForUser(category.id, userId),
      repository.hasProductsForUser(category.id, userId),
      repository.hasSubcategoriesForUser(category.id, userId),
    ]);
    if (
      !canChangeCategoryType({
        currentType: category.type,
        nextType,
        hasFinancialReferences,
        hasProducts,
        hasSubcategories,
      })
    ) {
      throw hasSubcategories
        ? badRequest(
            "The type of a category with subcategories cannot be changed",
            "category_has_subcategories",
          )
        : badRequest("The type of a category in use cannot be changed", "category_type_in_use");
    }
  }
  async function assertParent(
    category: CategoryRecord | null,
    type: CategoryType,
    parentId: string | null,
    userId: string,
  ) {
    if (!parentId) return null;
    const parent = await repository.findByIdForUser(parentId, userId);
    if (!parent) throw notFound("Parent category not found", "category_parent_not_found");
    const [hasSubcategories, hasBudgets] = category
      ? await Promise.all([
          repository.hasSubcategoriesForUser(category.id, userId),
          repository.hasBudgetsForUser(category.id, userId),
        ])
      : [false, false];
    const error = validateCategoryParent({
      categoryId: category?.id ?? null,
      type,
      parent,
      hasSubcategories,
      hasBudgets,
    });
    if (error) throw badRequest(parentErrorMessages[error], error);
    return parent;
  }
  async function assertNameAvailable(
    name: string,
    type: CategoryType,
    userId: string,
    exceptId?: string,
  ) {
    if (await repository.isNameTakenForUser({ name, type, exceptId }, userId)) {
      throw conflict("A category with this name already exists", "category_name_taken");
    }
  }
  return {
    async seedDefaults(userId: string) {
      await repository.insertDefaults(createDefaultCategoryDrafts(userId));
    },
    async create(input: CreateCategoryInput, userId: string) {
      const parentId = input.parentId ?? null;
      const parent = await assertParent(null, input.type, parentId, userId);
      const draft = createCategoryDraft({
        userId,
        name: input.name,
        type: input.type,
        icon: input.icon ?? null,
        parentId,
        tracksNutrition: resolveCategoryTracksNutrition({
          type: input.type,
          requested: input.tracksNutrition,
          fallback: parent?.tracksNutrition ?? false,
        }),
      });
      await assertNameAvailable(draft.name, draft.type, userId);
      return toOutput(await repository.insert(draft));
    },
    async list(userId: string) {
      return (await repository.listByUser(userId)).map(toOutput);
    },
    async get(id: string, userId: string) {
      const category = await repository.findByIdForUser(id, userId);
      if (!category) throw notFound("Category not found", "category_not_found");
      return toOutput(category);
    },
    async replace(id: string, userId: string, input: ReplaceCategoryInput) {
      const current = await editableCategory(id, userId);
      const values = {
        name: input.name.trim(),
        type: input.type,
        icon: input.icon?.trim() || null,
        parentId: input.parentId ?? null,
        tracksNutrition: resolveCategoryTracksNutrition({
          type: input.type,
          requested: input.tracksNutrition,
          fallback: current.tracksNutrition,
        }),
      };
      await assertTypeChange(current, values.type, userId);
      await assertParent(current, values.type, values.parentId, userId);
      await assertNameAvailable(values.name, values.type, userId, id);
      const category = await repository.updateForUser(id, userId, values);
      if (!category) throw notFound("Category not found", "category_not_found");
      return toOutput(category);
    },
    async update(id: string, userId: string, input: UpdateCategoryInput) {
      const current = await editableCategory(id, userId);
      const values: CategoryUpdateRecord = {};
      if (input.name !== undefined) values.name = input.name.trim();
      if (input.type !== undefined) values.type = input.type;
      if (input.icon !== undefined) values.icon = input.icon?.trim() || null;
      if (input.parentId !== undefined) values.parentId = input.parentId;
      const nextType = values.type ?? current.type;
      if (input.tracksNutrition !== undefined || values.type !== undefined) {
        values.tracksNutrition = resolveCategoryTracksNutrition({
          type: nextType,
          requested: input.tracksNutrition,
          fallback: current.tracksNutrition,
        });
      }
      const nextParentId = values.parentId !== undefined ? values.parentId : current.parentId;
      if (values.type !== undefined) await assertTypeChange(current, values.type, userId);
      if (values.type !== undefined || values.parentId !== undefined) {
        await assertParent(current, nextType, nextParentId, userId);
      }
      if (values.name !== undefined || values.type !== undefined) {
        await assertNameAvailable(values.name ?? current.name, nextType, userId, id);
      }
      const category = await repository.updateForUser(id, userId, values);
      if (!category) throw notFound("Category not found", "category_not_found");
      return toOutput(category);
    },
    async remove(id: string, userId: string) {
      await editableCategory(id, userId);
      if (await repository.hasSubcategoriesForUser(id, userId))
        throw badRequest("Category has subcategories", "category_has_subcategories");
      if (await repository.hasFinancialReferencesForUser(id, userId))
        throw badRequest("Category has financial references", "category_in_use");
      if (await repository.hasProductsForUser(id, userId))
        throw badRequest("Category is used by products", "category_has_products");
      const category = await repository.deleteForUser(id, userId);
      if (!category) throw notFound("Category not found", "category_not_found");
      return { id: category.id };
    },
  };
}
export type CategoriesService = ReturnType<typeof createCategoriesService>;
