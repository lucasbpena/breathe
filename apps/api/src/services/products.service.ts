import {
  calculateProductPriceHistory,
  createProductNameKey,
  type ProductContentUnit,
  type ProductPurchasePrice,
  resolvePackageContent,
  summarizeProductPrices,
} from "@openmonetis/domain/products";
import type {
  CreateProductAliasInput,
  CreateProductInput,
  MergeProductsInput,
  ProductAliasOutput,
  ProductOutput,
  ProductPriceHistoryOutput,
  UpdateProductInput,
} from "@openmonetis/validators/products";
import { badRequest, conflict, notFound } from "../utils/errors";

export type ProductRecord = {
  id: string;
  userId: string;
  name: string;
  nameKey: string;
  categoryId: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
  categoryTracksNutrition: boolean | null;
  contentUnit: ProductContentUnit;
  packageContent: string | null;
  energyKcal: string | null;
  proteinGrams: string | null;
  carbohydrateGrams: string | null;
  addedSugarGrams: string | null;
  fatGrams: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ProductAliasRecord = { id: string; productId: string; name: string };

export type ProductPurchasePriceRecord = Omit<ProductPurchasePrice, "purchaseDate"> & {
  productId: string;
  purchaseDate: Date;
};

type ProductData = {
  name: string;
  nameKey: string;
  categoryId: string;
  contentUnit: ProductContentUnit;
  packageContent: string | null;
  energyKcal: string | null;
  proteinGrams: string | null;
  carbohydrateGrams: string | null;
  addedSugarGrams: string | null;
  fatGrams: string | null;
};

export type ProductsRepository = {
  listByUser(userId: string): Promise<ProductRecord[]>;
  findByIdForUser(id: string, userId: string): Promise<ProductRecord | null>;
  findIdByNameKeyForUser(nameKey: string, userId: string): Promise<string | null>;
  findCategoryForUser(
    id: string,
    userId: string,
  ): Promise<{ type: "income" | "expense"; isSystem: boolean; tracksNutrition: boolean } | null>;
  listAliasesForUser(userId: string, productId?: string): Promise<ProductAliasRecord[]>;
  findAliasByNameKeyForUser(nameKey: string, userId: string): Promise<ProductAliasRecord | null>;
  insertAlias(data: {
    userId: string;
    productId: string;
    name: string;
    nameKey: string;
  }): Promise<ProductAliasRecord>;
  deleteAliasForUser(
    aliasId: string,
    productId: string,
    userId: string,
  ): Promise<{ id: string } | null>;
  listPurchasePricesForUser(
    userId: string,
    productId?: string,
  ): Promise<ProductPurchasePriceRecord[]>;
  listStoresByIdsForUser(
    ids: string[],
    userId: string,
  ): Promise<{ id: string; name: string; branch: string | null; neighborhood: string | null }[]>;
  insert(data: ProductData & { userId: string }): Promise<ProductRecord>;
  updateForUser(id: string, userId: string, data: ProductData): Promise<ProductRecord | null>;
  hasPurchasesForUser(id: string, userId: string): Promise<boolean>;
  deleteForUser(id: string, userId: string): Promise<{ id: string } | null>;
  /** Moves purchases and aliases to the target, keeps the source name as an alias and deletes it. */
  mergeForUser(input: {
    userId: string;
    sourceId: string;
    targetId: string;
    sourceAlias: { name: string; nameKey: string };
  }): Promise<void>;
};

export function createProductsService(repository: ProductsRepository) {
  async function findProduct(id: string, userId: string) {
    const product = await repository.findByIdForUser(id, userId);
    if (!product) throw notFound("Product not found", "product_not_found");
    return product;
  }

  async function output(product: ProductRecord, userId: string) {
    const [aliases, purchases] = await Promise.all([
      repository.listAliasesForUser(userId, product.id),
      repository.listPurchasePricesForUser(userId, product.id),
    ]);
    return toOutput(product, aliases, purchases);
  }

  /** Product names and aliases share one namespace so a receipt name resolves to one product. */
  async function assertNameAvailable(nameKey: string, userId: string, productId?: string) {
    const [existingId, alias] = await Promise.all([
      repository.findIdByNameKeyForUser(nameKey, userId),
      repository.findAliasByNameKeyForUser(nameKey, userId),
    ]);
    if ((existingId && existingId !== productId) || (alias && alias.productId !== productId)) {
      throw conflict("Product name already used", "product_already_exists");
    }
  }

  async function assertExpenseCategory(categoryId: string, userId: string) {
    const category = await repository.findCategoryForUser(categoryId, userId);
    if (category?.type !== "expense" || category.isSystem) {
      throw notFound("Category not found", "category_not_found");
    }
    return category;
  }

  return {
    async list(userId: string) {
      const [products, aliases, purchases] = await Promise.all([
        repository.listByUser(userId),
        repository.listAliasesForUser(userId),
        repository.listPurchasePricesForUser(userId),
      ]);
      const aliasesByProduct = groupByProduct(aliases);
      const purchasesByProduct = groupByProduct(purchases);
      return products.map((product) =>
        toOutput(
          product,
          aliasesByProduct.get(product.id) ?? [],
          purchasesByProduct.get(product.id) ?? [],
        ),
      );
    },
    async get(id: string, userId: string) {
      return output(await findProduct(id, userId), userId);
    },
    async resolve(name: string, userId: string) {
      const nameKey = createProductNameKey(name);
      const alias = await repository.findAliasByNameKeyForUser(nameKey, userId);
      return {
        productId: alias?.productId ?? (await repository.findIdByNameKeyForUser(nameKey, userId)),
      };
    },
    async create(input: CreateProductInput, userId: string) {
      const category = await assertExpenseCategory(input.categoryId, userId);
      const data = toProductData(input, category.tracksNutrition);
      await assertNameAvailable(data.nameKey, userId);
      return output(await repository.insert({ ...data, userId }), userId);
    },
    async update(id: string, userId: string, input: UpdateProductInput) {
      const current = await findProduct(id, userId);
      // Products saved before the category became required get one on their next edit.
      const categoryId = input.categoryId ?? current.categoryId;
      if (!categoryId) {
        throw badRequest("Choose a category for the product", "product_category_required");
      }
      const category = await assertExpenseCategory(categoryId, userId);
      const data = toProductData(
        { ...fromRecord(current), ...input, categoryId },
        category.tracksNutrition,
      );
      if (
        data.contentUnit !== current.contentUnit &&
        (await repository.hasPurchasesForUser(id, userId))
      ) {
        throw badRequest("Purchases keep the current content unit", "product_unit_in_use");
      }
      await assertNameAvailable(data.nameKey, userId, id);
      const product = await repository.updateForUser(id, userId, data);
      if (!product) throw notFound("Product not found", "product_not_found");
      return output(product, userId);
    },
    async remove(id: string, userId: string) {
      if (await repository.hasPurchasesForUser(id, userId)) {
        throw conflict("Product has registered purchases", "product_in_use");
      }
      const product = await repository.deleteForUser(id, userId);
      if (!product) throw notFound("Product not found", "product_not_found");
      return product;
    },
    async addAlias(productId: string, input: CreateProductAliasInput, userId: string) {
      const product = await findProduct(productId, userId);
      const nameKey = createProductNameKey(input.name);
      const [alias, owner] = await Promise.all([
        repository.findAliasByNameKeyForUser(nameKey, userId),
        repository.findIdByNameKeyForUser(nameKey, userId),
      ]);
      if (alias?.productId === product.id) return toAliasOutput(alias);
      if (alias || owner) throw conflict("Alias already used", "alias_conflict");
      return toAliasOutput(
        await repository.insertAlias({ userId, productId, name: input.name, nameKey }),
      );
    },
    async removeAlias(productId: string, aliasId: string, userId: string) {
      const alias = await repository.deleteAliasForUser(aliasId, productId, userId);
      if (!alias) throw notFound("Alias not found", "alias_not_found");
      return alias;
    },
    async merge(targetId: string, input: MergeProductsInput, userId: string) {
      if (input.sourceProductId === targetId) {
        throw badRequest("A product cannot be merged into itself", "product_merge_same");
      }
      const [target, source] = await Promise.all([
        findProduct(targetId, userId),
        findProduct(input.sourceProductId, userId),
      ]);
      if (target.contentUnit !== source.contentUnit) {
        throw badRequest("Products use different content units", "product_merge_unit_mismatch");
      }
      await repository.mergeForUser({
        userId,
        sourceId: source.id,
        targetId: target.id,
        sourceAlias: { name: source.name, nameKey: source.nameKey },
      });
      return output(await findProduct(targetId, userId), userId);
    },
    async getPriceHistory(id: string, userId: string): Promise<ProductPriceHistoryOutput> {
      const product = await findProduct(id, userId);
      const purchases = await repository.listPurchasePricesForUser(userId, product.id);
      const history = calculateProductPriceHistory(product.contentUnit, purchases.map(toPrice));
      const stores = new Map(
        (
          await repository.listStoresByIdsForUser(
            history.stores.map((store) => store.storeId),
            userId,
          )
        ).map((store) => [store.id, store]),
      );
      return {
        contentUnit: product.contentUnit,
        summary: history.summary,
        points: history.points,
        stores: history.stores.map((summary) => {
          const store = stores.get(summary.storeId);
          return {
            ...summary,
            storeName: store?.name ?? "",
            storeBranch: store?.branch ?? null,
            storeNeighborhood: store?.neighborhood ?? null,
          };
        }),
        weekdays: history.weekdays,
      };
    },
  };
}

/** Nutrition is kept only for products whose category tracks it. */
function toProductData(input: CreateProductInput, tracksNutrition: boolean): ProductData {
  const nutrient = (value: number | null | undefined) =>
    tracksNutrition ? toDecimal(value, 2) : null;
  return {
    name: input.name,
    nameKey: createProductNameKey(input.name),
    categoryId: input.categoryId,
    contentUnit: input.contentUnit,
    packageContent: toDecimal(
      resolvePackageContent(input.contentUnit, input.packageContent ?? null),
      3,
    ),
    energyKcal: nutrient(input.energyKcal),
    proteinGrams: nutrient(input.proteinGrams),
    carbohydrateGrams: nutrient(input.carbohydrateGrams),
    addedSugarGrams: nutrient(input.addedSugarGrams),
    fatGrams: nutrient(input.fatGrams),
  };
}

function fromRecord(product: ProductRecord): Omit<CreateProductInput, "categoryId"> {
  return {
    name: product.name,
    contentUnit: product.contentUnit,
    packageContent: toNumber(product.packageContent),
    energyKcal: toNumber(product.energyKcal),
    proteinGrams: toNumber(product.proteinGrams),
    carbohydrateGrams: toNumber(product.carbohydrateGrams),
    addedSugarGrams: toNumber(product.addedSugarGrams),
    fatGrams: toNumber(product.fatGrams),
  };
}

function toOutput(
  product: ProductRecord,
  aliases: readonly ProductAliasRecord[],
  purchases: readonly ProductPurchasePriceRecord[],
): ProductOutput {
  return {
    id: product.id,
    name: product.name,
    categoryId: product.categoryId,
    categoryName: product.categoryName,
    categoryIcon: product.categoryIcon,
    categoryTracksNutrition: product.categoryTracksNutrition ?? false,
    contentUnit: product.contentUnit,
    packageContent: toNumber(product.packageContent),
    energyKcal: toNumber(product.energyKcal),
    proteinGrams: toNumber(product.proteinGrams),
    carbohydrateGrams: toNumber(product.carbohydrateGrams),
    addedSugarGrams: toNumber(product.addedSugarGrams),
    fatGrams: toNumber(product.fatGrams),
    aliases: aliases.map(toAliasOutput),
    priceSummary: summarizeProductPrices(product.contentUnit, purchases.map(toPrice)),
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}

function toAliasOutput(alias: ProductAliasRecord): ProductAliasOutput {
  return { id: alias.id, name: alias.name };
}

function toPrice(purchase: ProductPurchasePriceRecord): ProductPurchasePrice {
  return { ...purchase, purchaseDate: purchase.purchaseDate.toISOString().slice(0, 10) };
}

function groupByProduct<T extends { productId: string }>(items: readonly T[]) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const group = groups.get(item.productId);
    if (group) group.push(item);
    else groups.set(item.productId, [item]);
  }
  return groups;
}

function toDecimal(value: number | null | undefined, scale: number) {
  return value == null ? null : value.toFixed(scale);
}

function toNumber(value: string | null) {
  return value === null ? null : Number(value);
}

export type ProductsService = ReturnType<typeof createProductsService>;
