import type {
  CreateProductPurchaseInput,
  CreateProductPurchasesInput,
  ProductPurchaseOutput,
  ReplaceProductPurchaseInput,
  TransactionProductPurchasesOutput,
} from "@openmonetis/validators/product-purchases";
import { requestApi as request } from "@/lib/api-client";

export function getTransactionProductPurchases(transactionId: string) {
  return request<TransactionProductPurchasesOutput>(
    `/product-purchases/transaction/${transactionId}`,
  );
}

export function getProductPurchases(productId: string) {
  return request<ProductPurchaseOutput[]>(`/product-purchases/product/${productId}`);
}

export function createProductPurchase(input: CreateProductPurchaseInput) {
  return request<ProductPurchaseOutput>("/product-purchases", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** Saves every line of a receipt at once; none is saved if one is invalid. */
export function createProductPurchases(input: CreateProductPurchasesInput) {
  return request<TransactionProductPurchasesOutput>("/product-purchases/batch", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function replaceProductPurchase(id: string, input: ReplaceProductPurchaseInput) {
  return request<ProductPurchaseOutput>(`/product-purchases/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function deleteProductPurchase(id: string) {
  return request<{ id: string }>(`/product-purchases/${id}`, { method: "DELETE" });
}
