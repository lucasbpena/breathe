import type {
  CreateStoreInput,
  StoreOutput,
  UpdateStoreInput,
} from "@openmonetis/validators/stores";
import { requestApi as request } from "@/lib/api-client";

export function getStores() {
  return request<StoreOutput[]>("/stores");
}

export function createStore(input: CreateStoreInput) {
  return request<StoreOutput>("/stores", { method: "POST", body: JSON.stringify(input) });
}

export function updateStore(id: string, input: UpdateStoreInput) {
  return request<StoreOutput>(`/stores/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function deleteStore(id: string) {
  return request<{ id: string }>(`/stores/${id}`, { method: "DELETE" });
}
