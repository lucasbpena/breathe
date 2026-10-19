import { queryOptions } from "@tanstack/react-query";
import { getProduct, getProductPriceHistory, getProducts, resolveProduct } from "./products.api";

export function productsQueryOptions() {
  return queryOptions({ queryKey: ["products"], queryFn: getProducts });
}

export function productQueryOptions(id: string) {
  return queryOptions({ queryKey: ["products", id], queryFn: () => getProduct(id) });
}

export function productPriceHistoryQueryOptions(id: string) {
  return queryOptions({
    queryKey: ["products", id, "price-history"],
    queryFn: () => getProductPriceHistory(id),
  });
}

export function productResolutionQueryOptions(name: string) {
  return queryOptions({
    queryKey: ["products", "resolve", name],
    queryFn: () => resolveProduct(name),
  });
}
