import { createStoreNameKey } from "@openmonetis/domain/stores";
import type {
  CreateStoreInput,
  StoreOutput,
  UpdateStoreInput,
} from "@openmonetis/validators/stores";
import { conflict, notFound } from "../utils/errors";

export type StoreRecord = {
  id: string;
  userId: string;
  name: string;
  branch: string | null;
  neighborhood: string | null;
  address: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type StoreData = {
  name: string;
  branch: string | null;
  neighborhood: string | null;
  address: string | null;
  nameKey: string;
};

export type StoresRepository = {
  listByUser(userId: string): Promise<StoreRecord[]>;
  findByIdForUser(id: string, userId: string): Promise<StoreRecord | null>;
  findIdByNameKeyForUser(nameKey: string, userId: string): Promise<string | null>;
  insert(data: StoreData & { userId: string }): Promise<StoreRecord>;
  updateForUser(id: string, userId: string, data: StoreData): Promise<StoreRecord | null>;
  hasPurchasesForUser(id: string, userId: string): Promise<boolean>;
  deleteForUser(id: string, userId: string): Promise<{ id: string } | null>;
};

export function createStoresService(repository: StoresRepository) {
  async function assertNameAvailable(nameKey: string, userId: string, currentId?: string) {
    const existingId = await repository.findIdByNameKeyForUser(nameKey, userId);
    if (existingId && existingId !== currentId) {
      throw conflict("Store already exists", "store_already_exists");
    }
  }

  return {
    async list(userId: string) {
      return (await repository.listByUser(userId)).map(toOutput);
    },
    async create(input: CreateStoreInput, userId: string) {
      const data = toStoreData(input);
      await assertNameAvailable(data.nameKey, userId);
      return toOutput(await repository.insert({ ...data, userId }));
    },
    async update(id: string, userId: string, input: UpdateStoreInput) {
      const current = await repository.findByIdForUser(id, userId);
      if (!current) throw notFound("Store not found", "store_not_found");
      const data = toStoreData({
        name: input.name ?? current.name,
        branch: input.branch === undefined ? current.branch : input.branch,
        neighborhood: input.neighborhood === undefined ? current.neighborhood : input.neighborhood,
        address: input.address === undefined ? current.address : input.address,
      });
      await assertNameAvailable(data.nameKey, userId, id);
      const store = await repository.updateForUser(id, userId, data);
      if (!store) throw notFound("Store not found", "store_not_found");
      return toOutput(store);
    },
    async remove(id: string, userId: string) {
      if (await repository.hasPurchasesForUser(id, userId)) {
        throw conflict("Store has registered purchases", "store_in_use");
      }
      const store = await repository.deleteForUser(id, userId);
      if (!store) throw notFound("Store not found", "store_not_found");
      return store;
    },
  };
}

function toStoreData(input: CreateStoreInput): StoreData {
  const branch = input.branch ?? null;
  return {
    name: input.name,
    branch,
    neighborhood: input.neighborhood ?? null,
    address: input.address ?? null,
    nameKey: createStoreNameKey(input.name, branch),
  };
}

function toOutput(store: StoreRecord): StoreOutput {
  return {
    id: store.id,
    name: store.name,
    branch: store.branch,
    neighborhood: store.neighborhood,
    address: store.address,
    createdAt: store.createdAt.toISOString(),
    updatedAt: store.updatedAt.toISOString(),
  };
}

export type StoresService = ReturnType<typeof createStoresService>;
