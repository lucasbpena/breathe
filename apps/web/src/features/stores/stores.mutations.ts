import type { UpdateStoreInput } from "@openmonetis/validators/stores";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { refreshFinancialQueries } from "@/lib/financial-query-invalidation";
import { createStore, deleteStore, updateStore } from "./stores.api";

export function useCreateStoreMutation() {
  const client = useQueryClient();
  return useMutation({ mutationFn: createStore, onSuccess: () => refreshFinancialQueries(client) });
}

export function useUpdateStoreMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateStoreInput }) => updateStore(id, input),
    onSuccess: () => refreshFinancialQueries(client),
  });
}

export function useDeleteStoreMutation() {
  const client = useQueryClient();
  return useMutation({ mutationFn: deleteStore, onSuccess: () => refreshFinancialQueries(client) });
}
