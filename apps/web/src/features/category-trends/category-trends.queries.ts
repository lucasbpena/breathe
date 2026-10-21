import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { type CategoryTrendsRequest, getCategoryTrends } from "./category-trends.api";

const categoryTrendsKeys = {
  all: ["category-trends"] as const,
  report: (query: CategoryTrendsRequest) =>
    [
      ...categoryTrendsKeys.all,
      query.startPeriod,
      query.endPeriod,
      [...query.categoryIds].sort().join(","),
      query.personScope ?? "admin",
      query.subcategoryMode ?? "rollUp",
    ] as const,
};

export function categoryTrendsQueryOptions(query: CategoryTrendsRequest) {
  return queryOptions({
    queryKey: categoryTrendsKeys.report(query),
    queryFn: () => getCategoryTrends(query),
    placeholderData: keepPreviousData,
  });
}
