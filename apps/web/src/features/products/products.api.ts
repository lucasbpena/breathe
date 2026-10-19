import type {
  CreateProductAliasInput,
  CreateProductInput,
  MergeProductsInput,
  ProductAliasOutput,
  ProductOutput,
  ProductPriceHistoryOutput,
  ResolvedProductOutput,
  UpdateProductInput,
} from "@openmonetis/validators/products";
import { requestApi as request } from "@/lib/api-client";

export function getProducts() {
  return request<ProductOutput[]>("/products");
}

export function getProduct(id: string) {
  return request<ProductOutput>(`/products/${id}`);
}

export function getProductPriceHistory(id: string) {
  return request<ProductPriceHistoryOutput>(`/products/${id}/price-history`);
}

export function resolveProduct(name: string) {
  return request<ResolvedProductOutput>(
    `/products/resolve?${new URLSearchParams({ name }).toString()}`,
  );
}

export function createProduct(input: CreateProductInput) {
  return request<ProductOutput>("/products", { method: "POST", body: JSON.stringify(input) });
}

export function updateProduct(id: string, input: UpdateProductInput) {
  return request<ProductOutput>(`/products/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteProduct(id: string) {
  return request<{ id: string }>(`/products/${id}`, { method: "DELETE" });
}

export function addProductAlias(id: string, input: CreateProductAliasInput) {
  return request<ProductAliasOutput>(`/products/${id}/aliases`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function removeProductAlias(id: string, aliasId: string) {
  return request<{ id: string }>(`/products/${id}/aliases/${aliasId}`, { method: "DELETE" });
}

export function mergeProducts(id: string, input: MergeProductsInput) {
  return request<ProductOutput>(`/products/${id}/merge`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}
