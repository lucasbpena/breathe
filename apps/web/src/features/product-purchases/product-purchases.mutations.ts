import type { ReplaceProductPurchaseInput } from "@openmonetis/validators/product-purchases";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { refreshFinancialQueries } from "@/lib/financial-query-invalidation";
import {
  createProductPurchase,
  deleteProductPurchase,
  replaceProductPurchase,
} from "./product-purchases.api";

export function useCreateProductPurchaseMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: createProductPurchase,
    onSuccess: () => refreshFinancialQueries(client),
  });
}

export function useReplaceProductPurchaseMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ReplaceProductPurchaseInput }) =>
      replaceProductPurchase(id, input),
    onSuccess: () => refreshFinancialQueries(client),
  });
}

export function useDeleteProductPurchaseMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: deleteProductPurchase,
    onSuccess: () => refreshFinancialQueries(client),
  });
}
