import type {
  CategoryTrendsOutput,
  ListCategoryTrendsQuery,
} from "@openmonetis/validators/category-trends";
import { requestApi } from "@/lib/api-client";

async function request<T>(path: string): Promise<T> {
  return requestApi<T>(path, undefined, { useResponseMessage: true });
}

export type CategoryTrendsRequest = Omit<ListCategoryTrendsQuery, "subcategoryMode"> &
  Partial<Pick<ListCategoryTrendsQuery, "subcategoryMode">>;

export function getCategoryTrends(query: CategoryTrendsRequest) {
  const params = new URLSearchParams({
    startPeriod: query.startPeriod,
    endPeriod: query.endPeriod,
  });
  if (query.categoryIds.length) params.set("categoryIds", query.categoryIds.join(","));
  if (query.personScope) params.set("personScope", query.personScope);
  if (query.subcategoryMode) params.set("subcategoryMode", query.subcategoryMode);

  return request<CategoryTrendsOutput>(`/reports/category-trends?${params.toString()}`);
}
