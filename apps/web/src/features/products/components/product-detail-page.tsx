import { useQuery } from "@tanstack/react-query";
import { Combine, Package, Pencil, RefreshCw } from "lucide-react";
import { useState } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Navbar } from "@/components/navigation/navbar";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductPurchaseHistory } from "@/features/product-purchases/components/product-purchase-history";
import {
  formatPackageContent,
  formatPurchaseDate,
  nutritionBasisLabels,
  nutritionFields,
} from "../products.presentation";
import {
  productPriceHistoryQueryOptions,
  productQueryOptions,
  productsQueryOptions,
} from "../products.queries";
import { NormalizedPrice } from "./normalized-price";
import { ProductAliases } from "./product-aliases";
import { ProductDialog } from "./product-dialog";
import { ProductMergeDialog } from "./product-merge-dialog";
import { ProductPriceByStoreChart } from "./product-price-by-store-chart";
import { ProductPriceByWeekdayChart } from "./product-price-by-weekday-chart";
import { ProductPriceTimelineChart } from "./product-price-timeline-chart";

const nutrientFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

export function ProductDetailPage({ productId }: { productId: string }) {
  const productQuery = useQuery(productQueryOptions(productId));
  const historyQuery = useQuery(productPriceHistoryQueryOptions(productId));
  const productsQuery = useQuery(productsQueryOptions());
  const [dialog, setDialog] = useState<"edit" | "merge" | null>(null);
  const product = productQuery.data;
  const history = historyQuery.data;
  const nutrients = product
    ? nutritionFields.filter((nutrient) => product[nutrient.name] !== null)
    : [];

  return (
    <ProtectedRoute>
      <main className="min-h-svh bg-background">
        <Navbar />
        <section className="app-page project-container">
          <PageHeader
            actions={
              product ? (
                <div className="flex gap-2">
                  <Button onClick={() => setDialog("merge")} type="button" variant="outline">
                    <Combine aria-hidden="true" className="size-4" /> Mesclar
                  </Button>
                  <Button onClick={() => setDialog("edit")} type="button">
                    <Pencil aria-hidden="true" className="size-4" /> Editar
                  </Button>
                </div>
              ) : null
            }
            breadcrumbs={[
              { label: "Visão geral", href: "/dashboard" },
              { label: "Consumo" },
              { label: "Produtos", href: "/products" },
              { label: product?.name ?? "Produto" },
            ]}
            description={
              product
                ? [product.categoryName, formatPackageContent(product)].filter(Boolean).join(" · ")
                : undefined
            }
            icon={<Package aria-hidden="true" className="size-5" />}
            title={product?.name ?? "Produto"}
          />

          {productQuery.isLoading ? <Skeleton className="h-64 w-full" /> : null}
          {productQuery.isError ? (
            <Card className="grid min-h-52 place-items-center border p-6 text-center">
              <div>
                <p className="font-medium">Não foi possível carregar o produto</p>
                <Button
                  className="mt-4"
                  onClick={() => void productQuery.refetch()}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <RefreshCw aria-hidden="true" /> Tentar novamente
                </Button>
              </div>
            </Card>
          ) : null}

          {product ? (
            <>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {[
                  {
                    label: "Último preço",
                    amount: product.priceSummary.lastPrice,
                    hint: product.priceSummary.lastPurchaseDate
                      ? formatPurchaseDate(product.priceSummary.lastPurchaseDate)
                      : "Sem compras",
                  },
                  {
                    label: "Preço médio",
                    amount: product.priceSummary.averagePrice,
                    hint: `${product.priceSummary.purchaseCount} ${product.priceSummary.purchaseCount === 1 ? "compra" : "compras"}`,
                  },
                  { label: "Mínimo", amount: product.priceSummary.minPrice, hint: null },
                  { label: "Máximo", amount: product.priceSummary.maxPrice, hint: null },
                ].map((stat) => (
                  <Card className="gap-1 border p-5" key={stat.label}>
                    <p className="text-muted-foreground text-sm">{stat.label}</p>
                    <NormalizedPrice
                      amount={stat.amount}
                      className="font-semibold text-2xl"
                      contentUnit={product.contentUnit}
                    />
                    {stat.hint ? (
                      <p className="text-muted-foreground text-xs">{stat.hint}</p>
                    ) : null}
                  </Card>
                ))}
              </div>

              {historyQuery.isLoading ? <Skeleton className="h-72 w-full" /> : null}
              {historyQuery.isError ? (
                <Card className="grid min-h-40 place-items-center border p-6 text-center">
                  <div>
                    <p className="text-muted-foreground text-sm">
                      Não foi possível carregar o histórico de preços.
                    </p>
                    <Button
                      className="mt-3"
                      onClick={() => void historyQuery.refetch()}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      <RefreshCw aria-hidden="true" /> Tentar novamente
                    </Button>
                  </div>
                </Card>
              ) : null}
              {history && history.points.length > 0 ? (
                <>
                  <ProductPriceTimelineChart history={history} />
                  <div className="grid gap-4 lg:grid-cols-2">
                    <ProductPriceByStoreChart history={history} />
                    <ProductPriceByWeekdayChart history={history} />
                  </div>
                </>
              ) : null}

              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="border">
                  <CardHeader>
                    <CardTitle>Nomes da nota fiscal</CardTitle>
                    <CardDescription>
                      Formas como as notas escrevem este produto. Um nome reconhecido seleciona o
                      produto automaticamente ao registrar um item.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ProductAliases product={product} />
                  </CardContent>
                </Card>
                <Card className="border">
                  <CardHeader>
                    <CardTitle>Informação nutricional</CardTitle>
                    <CardDescription>{nutritionBasisLabels[product.contentUnit]}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {nutrients.length > 0 ? (
                      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {nutrients.map((nutrient) => (
                          <div key={nutrient.name}>
                            <dt className="text-muted-foreground text-xs">{nutrient.label}</dt>
                            <dd className="font-medium tabular-nums">
                              {nutrientFormatter.format(product[nutrient.name] ?? 0)}{" "}
                              {nutrient.unit}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    ) : (
                      <p className="text-muted-foreground text-sm">
                        Sem informação nutricional. Preencha em Editar.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card className="border">
                <CardHeader>
                  <CardTitle>Compras</CardTitle>
                  <CardDescription>
                    Cada item registrado nas despesas, do mais recente.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ProductPurchaseHistory productId={product.id} />
                </CardContent>
              </Card>

              {dialog === "edit" ? (
                <ProductDialog
                  onOpenChange={(open) => !open && setDialog(null)}
                  open
                  product={product}
                />
              ) : null}
              {dialog === "merge" ? (
                <ProductMergeDialog
                  onOpenChange={(open) => !open && setDialog(null)}
                  open
                  products={productsQuery.data ?? []}
                  target={product}
                />
              ) : null}
            </>
          ) : null}
        </section>
      </main>
    </ProtectedRoute>
  );
}
