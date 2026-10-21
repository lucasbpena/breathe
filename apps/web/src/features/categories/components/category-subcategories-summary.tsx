import type { CategoryOutput } from "@openmonetis/validators/categories";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { MoneyValue } from "@/components/money-value";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import { categoryTrendsQueryOptions } from "@/features/category-trends/category-trends.queries";
import { CategoryIcon } from "../category-icons";

export function CategorySubcategoriesSummary({
  category,
  period,
  personScope,
  subcategories,
}: {
  category: CategoryOutput;
  period: string;
  personScope: string;
  subcategories: CategoryOutput[];
}) {
  const trendsQuery = useQuery({
    ...categoryTrendsQueryOptions({
      categoryIds: [category.id, ...subcategories.map((subcategory) => subcategory.id)],
      endPeriod: period,
      startPeriod: period,
      personScope,
      subcategoryMode: "separate",
    }),
    placeholderData: undefined,
  });
  const amountOf = (categoryId: string) =>
    trendsQuery.data?.categories
      .find((item) => item.categoryId === categoryId)
      ?.values.find((value) => value.period === period)?.totalAmount ?? 0;
  const rows = subcategories
    .map((subcategory) => ({ category: subcategory, amount: amountOf(subcategory.id) }))
    .sort(
      (left, right) =>
        right.amount - left.amount ||
        left.category.name.localeCompare(right.category.name, "pt-BR"),
    );
  const directAmount = amountOf(category.id);
  const totalAmount = rows.reduce((total, row) => total + row.amount, directAmount);
  const share = (amount: number) =>
    totalAmount > 0 ? `${Math.round((amount / totalAmount) * 100)}%` : "—";

  return (
    <Accordion>
      <AccordionItem className="border-0" value="subcategories">
        <AccordionTrigger className="items-center px-5 py-4 hover:no-underline sm:px-6">
          <div className="flex min-w-0 flex-1 items-center justify-between gap-4 pr-2">
            <div className="min-w-0">
              <span className="block font-medium text-sm">Por subcategoria</span>
              <span className="mt-0.5 block truncate font-normal text-current/70 text-xs">
                Quanto cada subcategoria somou no mês
              </span>
            </div>
            <span className="shrink-0 font-normal text-current/70 text-xs tabular-nums">
              {subcategories.length} {subcategories.length === 1 ? "subcategoria" : "subcategorias"}
            </span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="border-current/15 border-t px-5 pt-4 pb-5 sm:px-6 [&_p:not(:last-child)]:mb-0">
          <section
            aria-label={`Valores de ${category.name} por subcategoria`}
            className="max-h-72 overflow-y-auto rounded-lg border border-current/10 bg-current/5"
            tabIndex={rows.length > 4 ? 0 : undefined}
          >
            <ul className="divide-y divide-current/10">
              {trendsQuery.isLoading
                ? ["first", "second"].map((key) => (
                    <li className="flex items-center gap-3 p-3" key={key}>
                      <Skeleton className="size-9 shrink-0 rounded-full bg-current/15 before:via-current/20" />
                      <Skeleton className="h-4 flex-1 bg-current/15 before:via-current/20" />
                      <Skeleton className="h-5 w-24 bg-current/15 before:via-current/20" />
                    </li>
                  ))
                : null}
              {trendsQuery.isError ? (
                <li className="p-4 text-current/70 text-sm">
                  Não foi possível carregar o detalhamento.
                </li>
              ) : null}
              {trendsQuery.data ? (
                <>
                  {rows.map((row) => (
                    <li className="flex items-center gap-3 p-3" key={row.category.id}>
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-current/10">
                        <CategoryIcon className="size-4" name={row.category.icon} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <Link
                          className="block truncate font-medium text-sm hover:underline"
                          params={{ categoryId: row.category.id }}
                          search={{
                            period,
                            personScope: personScope === "admin" ? undefined : personScope,
                          }}
                          to="/categories/$categoryId"
                        >
                          {row.category.name}
                        </Link>
                        <p className="text-current/70 text-xs tabular-nums">
                          {share(row.amount)} do total
                        </p>
                      </div>
                      <MoneyValue amount={row.amount} className="shrink-0 font-medium text-sm" />
                    </li>
                  ))}
                  {directAmount !== 0 ? (
                    <li className="flex items-center gap-3 p-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-current/10">
                        <CategoryIcon className="size-4" name={category.icon} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-sm">Sem subcategoria</p>
                        <p className="text-current/70 text-xs tabular-nums">
                          {share(directAmount)} do total · lançado direto em {category.name}
                        </p>
                      </div>
                      <MoneyValue amount={directAmount} className="shrink-0 font-medium text-sm" />
                    </li>
                  ) : null}
                </>
              ) : null}
            </ul>
          </section>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
