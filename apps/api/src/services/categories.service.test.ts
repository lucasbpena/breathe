import assert from "node:assert/strict";
import test from "node:test";
import {
  type CategoriesRepository,
  type CategoryRecord,
  createCategoriesService,
} from "./categories.service";

test("category removal checks ownership and rejects financial references before deleting", async () => {
  const userId = "10000000-0000-4000-8000-000000000001";
  const category: CategoryRecord = {
    id: "20000000-0000-4000-8000-000000000002",
    userId,
    name: "Moradia",
    type: "expense",
    icon: null,
    parentId: null,
    isSystem: false,
    tracksNutrition: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  let referenced = true;
  let deletions = 0;
  const repository = new Proxy(
    {
      findByIdForUser: async (id: string, owner: string) =>
        id === category.id && owner === userId ? category : null,
      hasSubcategoriesForUser: async () => false,
      hasProductsForUser: async () => false,
      hasFinancialReferencesForUser: async (id: string, owner: string) => {
        assert.equal(id, category.id);
        assert.equal(owner, userId);
        return referenced;
      },
      deleteForUser: async (id: string, owner: string) => {
        assert.equal(id, category.id);
        assert.equal(owner, userId);
        deletions++;
        return category;
      },
    },
    {
      get(target, property) {
        if (property in target) return target[property as keyof typeof target];
        return async () => {
          throw new Error(`Unexpected dependency call: ${String(property)}`);
        };
      },
    },
  ) as unknown as CategoriesRepository;
  const service = createCategoriesService(repository);
  await assert.rejects(service.remove(category.id, userId), { code: "category_in_use" });
  await assert.rejects(service.remove(category.id, "another-user"), { code: "category_not_found" });
  assert.equal(deletions, 0);
  referenced = false;
  assert.deepEqual(await service.remove(category.id, userId), { id: category.id });
  assert.equal(deletions, 1);
});

function memoryRepository(
  seed: CategoryRecord[],
  options: { budgetedIds?: string[]; productCategoryIds?: string[] } = {},
) {
  const records = new Map(seed.map((category) => [category.id, { ...category }]));
  const writes: Array<{ id?: string; values: Partial<CategoryRecord> }> = [];
  const repository: CategoriesRepository = {
    insertDefaults: async () => undefined,
    insert: async (data) => {
      writes.push({ values: data });
      const category = {
        ...data,
        id: `30000000-0000-4000-8000-00000000000${records.size}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      records.set(category.id, category);
      return category;
    },
    listByUser: async (owner) => [...records.values()].filter((item) => item.userId === owner),
    findByIdForUser: async (id, owner) => {
      const category = records.get(id);
      return category?.userId === owner ? category : null;
    },
    findSystemByNameForUser: async () => null,
    updateForUser: async (id, owner, values) => {
      const category = records.get(id);
      if (category?.userId !== owner || category.isSystem) return null;
      writes.push({ id, values });
      Object.assign(category, values);
      return category;
    },
    deleteForUser: async (id) => {
      const category = records.get(id) ?? null;
      records.delete(id);
      return category;
    },
    hasFinancialReferencesForUser: async () => false,
    hasProductsForUser: async (id) => options.productCategoryIds?.includes(id) ?? false,
    hasSubcategoriesForUser: async (id, owner) =>
      [...records.values()].some((item) => item.parentId === id && item.userId === owner),
    hasBudgetsForUser: async (id) => options.budgetedIds?.includes(id) ?? false,
    isNameTakenForUser: async ({ name, type, exceptId }, owner) =>
      [...records.values()].some(
        (item) =>
          item.userId === owner && item.name === name && item.type === type && item.id !== exceptId,
      ),
  };
  return { repository, writes };
}

const ownerId = "10000000-0000-4000-8000-000000000001";
const food: CategoryRecord = {
  id: "20000000-0000-4000-8000-000000000001",
  userId: ownerId,
  name: "Alimentação",
  type: "expense",
  icon: "utensils",
  parentId: null,
  isSystem: false,
  tracksNutrition: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};
const groceries: CategoryRecord = {
  ...food,
  id: "20000000-0000-4000-8000-000000000002",
  name: "Mercado",
  icon: "shopping-basket",
  parentId: food.id,
};
const transport: CategoryRecord = {
  ...food,
  id: "20000000-0000-4000-8000-000000000003",
  name: "Transporte",
  icon: "bus",
  tracksNutrition: false,
};
const salary: CategoryRecord = {
  ...food,
  id: "20000000-0000-4000-8000-000000000004",
  name: "Salário",
  type: "income",
  tracksNutrition: false,
};
const invoicePayments: CategoryRecord = {
  ...food,
  id: "20000000-0000-4000-8000-000000000005",
  name: "Pagamentos",
  isSystem: true,
  tracksNutrition: false,
};

test("subcategories are created under a user-defined top-level parent of the same type", async () => {
  const { repository, writes } = memoryRepository([food, groceries, salary, invoicePayments]);
  const service = createCategoriesService(repository);

  const created = await service.create(
    { name: " Hortifruti ", type: "expense", icon: "carrot", parentId: food.id },
    ownerId,
  );
  assert.equal(created.parentId, food.id);
  assert.equal(created.name, "Hortifruti");
  assert.equal(writes[0]?.values.isSystem, false);

  await assert.rejects(
    service.create({ name: "Feira", type: "expense", parentId: groceries.id }, ownerId),
    { code: "category_parent_invalid" },
  );
  await assert.rejects(
    service.create({ name: "Boleto", type: "expense", parentId: invoicePayments.id }, ownerId),
    { code: "category_parent_invalid" },
  );
  await assert.rejects(
    service.create({ name: "Bônus", type: "income", parentId: food.id }, ownerId),
    { code: "category_parent_type_mismatch" },
  );
  await assert.rejects(
    service.create({ name: "Feira", type: "expense", parentId: food.id }, "another-user"),
    { code: "category_parent_not_found" },
  );
  await assert.rejects(
    service.create({ name: "Mercado", type: "expense", parentId: food.id }, ownerId),
    { code: "category_name_taken", status: 409 },
  );
  assert.equal(writes.length, 1);
});

test("a category with subcategories or budgets cannot become a subcategory", async () => {
  const { repository, writes } = memoryRepository([food, groceries, transport], {
    budgetedIds: [transport.id],
  });
  const service = createCategoriesService(repository);

  await assert.rejects(
    service.replace(food.id, ownerId, {
      name: food.name,
      type: "expense",
      icon: food.icon,
      parentId: transport.id,
    }),
    { code: "category_has_subcategories" },
  );
  await assert.rejects(service.update(transport.id, ownerId, { parentId: food.id }), {
    code: "category_has_budgets",
  });
  await assert.rejects(service.update(food.id, ownerId, { parentId: food.id }), {
    code: "category_parent_invalid",
  });
  assert.equal(writes.length, 0);
});

test("a parent keeps its type and existence while it has subcategories", async () => {
  const { repository } = memoryRepository([food, groceries]);
  const service = createCategoriesService(repository);

  await assert.rejects(service.update(food.id, ownerId, { type: "income" }), {
    code: "category_has_subcategories",
  });
  await assert.rejects(service.remove(food.id, ownerId), { code: "category_has_subcategories" });
  await assert.rejects(service.update(groceries.id, ownerId, { type: "income" }), {
    code: "category_parent_type_mismatch",
  });
});

test("subcategories can move to another parent or become top-level", async () => {
  const { repository, writes } = memoryRepository([food, groceries, transport]);
  const service = createCategoriesService(repository);

  assert.equal(
    (await service.update(groceries.id, ownerId, { parentId: transport.id })).parentId,
    transport.id,
  );
  assert.equal((await service.update(groceries.id, ownerId, { parentId: null })).parentId, null);
  assert.equal(
    (await service.replace(groceries.id, ownerId, { name: "Mercado", type: "expense" })).parentId,
    null,
  );
  assert.deepEqual(
    writes.map((write) => write.values.parentId),
    [transport.id, null, null],
  );
  assert.deepEqual(await service.remove(food.id, ownerId), { id: food.id });
});

test("a category used by products keeps its type and cannot be removed", async () => {
  const { repository } = memoryRepository([transport], { productCategoryIds: [transport.id] });
  const service = createCategoriesService(repository);

  await assert.rejects(service.update(transport.id, ownerId, { type: "income" }), {
    code: "category_type_in_use",
  });
  await assert.rejects(service.remove(transport.id, ownerId), { code: "category_has_products" });
  assert.equal(
    (await service.update(transport.id, ownerId, { name: "Mobilidade" })).name,
    "Mobilidade",
  );
});

test("a new subcategory follows its parent's nutrition choice unless told otherwise", async () => {
  const { repository } = memoryRepository([food, transport]);
  const service = createCategoriesService(repository);
  const create = (input: Parameters<typeof service.create>[0]) => service.create(input, ownerId);

  assert.equal(
    (await create({ name: "Hortifruti", type: "expense", parentId: food.id })).tracksNutrition,
    true,
  );
  assert.equal(
    (
      await create({
        name: "Utensílios",
        type: "expense",
        parentId: food.id,
        tracksNutrition: false,
      })
    ).tracksNutrition,
    false,
  );
  assert.equal(
    (await create({ name: "Pedágio", type: "expense", parentId: transport.id })).tracksNutrition,
    false,
  );
  assert.equal(
    (await create({ name: "Bônus", type: "income", tracksNutrition: true })).tracksNutrition,
    false,
  );

  const snacks = await create({ name: "Lanches", type: "expense", tracksNutrition: true });
  assert.equal(
    (await service.replace(snacks.id, ownerId, { name: "Lanches", type: "expense" }))
      .tracksNutrition,
    true,
  );
  assert.equal(
    (await service.update(snacks.id, ownerId, { type: "income" })).tracksNutrition,
    false,
  );
});
