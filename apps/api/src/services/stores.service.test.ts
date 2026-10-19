import assert from "node:assert/strict";
import test from "node:test";
import { ApiError } from "../utils/errors";
import { createStoresService, type StoreRecord, type StoresRepository } from "./stores.service";

const userId = "00000000-0000-4000-8000-000000000001";
const otherUserId = "00000000-0000-4000-8000-000000000009";

function setup() {
  const stores: (StoreRecord & { nameKey: string })[] = [];
  const purchasedStoreIds = new Set<string>();
  const repository: StoresRepository = {
    async listByUser(owner) {
      return stores.filter((store) => store.userId === owner);
    },
    async findByIdForUser(id, owner) {
      return stores.find((store) => store.id === id && store.userId === owner) ?? null;
    },
    async findIdByNameKeyForUser(nameKey, owner) {
      return (
        stores.find((store) => store.nameKey === nameKey && store.userId === owner)?.id ?? null
      );
    },
    async insert(data) {
      const store = {
        ...data,
        id: `00000000-0000-4000-8000-00000000010${stores.length}`,
        createdAt: new Date("2026-10-18T12:00:00Z"),
        updatedAt: new Date("2026-10-18T12:00:00Z"),
      };
      stores.push(store);
      return store;
    },
    async updateForUser(id, owner, data) {
      const store = stores.find((item) => item.id === id && item.userId === owner);
      if (!store) return null;
      Object.assign(store, data);
      return store;
    },
    async hasPurchasesForUser(id, owner) {
      return owner === userId && purchasedStoreIds.has(id);
    },
    async deleteForUser(id, owner) {
      const index = stores.findIndex((store) => store.id === id && store.userId === owner);
      if (index < 0) return null;
      stores.splice(index, 1);
      return { id };
    },
  };
  return { service: createStoresService(repository), purchasedStoreIds };
}

function hasCode(code: string) {
  return (error: unknown) => error instanceof ApiError && error.code === code;
}

test("branches of the same chain are separate stores, but a unit is unique", async () => {
  const { service } = setup();
  await service.create({ name: "DMA Distribuidora", branch: "Loja 014" }, userId);
  const sagrada = await service.create(
    { name: "DMA Distribuidora", branch: "Loja 003", neighborhood: "Sagrada Família" },
    userId,
  );
  assert.equal(sagrada.neighborhood, "Sagrada Família");
  await assert.rejects(
    () => service.create({ name: "dma distribuidora", branch: "LOJA 003" }, userId),
    hasCode("store_already_exists"),
  );
  await service.create({ name: "DMA Distribuidora", branch: "Loja 003" }, otherUserId);
});

test("updating keeps omitted fields and rejects a name taken by another unit", async () => {
  const { service } = setup();
  const villaParis = await service.create(
    { name: "DMA", branch: "Loja 014", address: "R. Iraí, 235" },
    userId,
  );
  await service.create({ name: "DMA", branch: "Loja 003" }, userId);
  const updated = await service.update(villaParis.id, userId, { neighborhood: "Vila Paris" });
  assert.equal(updated.address, "R. Iraí, 235");
  assert.equal(updated.neighborhood, "Vila Paris");
  await assert.rejects(
    () => service.update(villaParis.id, userId, { branch: "Loja 003" }),
    hasCode("store_already_exists"),
  );
  await assert.rejects(
    () => service.update(villaParis.id, otherUserId, { name: "Outra" }),
    hasCode("store_not_found"),
  );
});

test("stores with purchases cannot be deleted", async () => {
  const { service, purchasedStoreIds } = setup();
  const store = await service.create({ name: "Brasa e Malte" }, userId);
  purchasedStoreIds.add(store.id);
  await assert.rejects(() => service.remove(store.id, userId), hasCode("store_in_use"));
  purchasedStoreIds.clear();
  assert.deepEqual(await service.remove(store.id, userId), { id: store.id });
});
