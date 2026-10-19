import { queryOptions } from "@tanstack/react-query";
import { getProductPurchases, getTransactionProductPurchases } from "./product-purchases.api";

export function transactionProductPurchasesQueryOptions(transactionId: string) {
  return queryOptions({
    queryKey: ["product-purchases", "transaction", transactionId],
    queryFn: () => getTransactionProductPurchases(transactionId),
  });
}

export function productPurchasesQueryOptions(productId: string) {
  return queryOptions({
    queryKey: ["product-purchases", "product", productId],
    queryFn: () => getProductPurchases(productId),
  });
}
