import { queryOptions } from "@tanstack/react-query";
import { getStores } from "./stores.api";

export function storesQueryOptions() {
  return queryOptions({ queryKey: ["stores"], queryFn: getStores });
}
