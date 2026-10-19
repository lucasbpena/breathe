import type { UpdateProductInput } from "@openmonetis/validators/products";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { refreshFinancialQueries } from "@/lib/financial-query-invalidation";
import {
  addProductAlias,
  createProduct,
  deleteProduct,
  mergeProducts,
  removeProductAlias,
  updateProduct,
} from "./products.api";

export function useCreateProductMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: createProduct,
    onSuccess: () => refreshFinancialQueries(client),
  });
}

export function useUpdateProductMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateProductInput }) =>
      updateProduct(id, input),
    onSuccess: () => refreshFinancialQueries(client),
  });
}

export function useDeleteProductMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => refreshFinancialQueries(client),
  });
}

export function useAddProductAliasMutation(productId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => addProductAlias(productId, { name }),
    onSuccess: () => refreshFinancialQueries(client),
  });
}

export function useRemoveProductAliasMutation(productId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (aliasId: string) => removeProductAlias(productId, aliasId),
    onSuccess: () => refreshFinancialQueries(client),
  });
}

export function useMergeProductsMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ targetId, sourceProductId }: { targetId: string; sourceProductId: string }) =>
      mergeProducts(targetId, { sourceProductId }),
    onSuccess: () => refreshFinancialQueries(client),
  });
}
