import type { ProductPriceHistoryOutput } from "@openmonetis/validators/products";
import { Bar, BarChart, LabelList, XAxis, YAxis } from "recharts";
import { MoneyValue } from "@/components/money-value";
import { usePrivacyMode } from "@/components/privacy-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { formatStoreName } from "@/features/stores/stores.presentation";
import { formatCurrency } from "@/lib/money-presentation";
import { cn } from "@/lib/utils";
import { normalizedPriceSuffixes } from "../products.presentation";

const chartConfig = {
  averagePrice: { label: "Preço médio", color: "var(--chart-2)" },
} satisfies ChartConfig;

export function ProductPriceByStoreChart({ history }: { history: ProductPriceHistoryOutput }) {
  const { isPrivacyModeEnabled } = usePrivacyMode();
  const suffix = normalizedPriceSuffixes[history.contentUnit];
  const rows = history.stores.map((store) => ({
    ...store,
    label: formatStoreName({ name: store.storeName, branch: store.storeBranch }),
  }));

  return (
    <Card className="pt-0">
      <CardHeader className="border-b py-5">
        <CardTitle>Por loja</CardTitle>
        <CardDescription>Preço médio ponderado em R${suffix} em cada loja.</CardDescription>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6">
        <ChartContainer
          aria-label={`Preço médio em reais${suffix} por loja`}
          className={cn(
            "w-full transition-[filter]",
            isPrivacyModeEnabled && "pointer-events-none blur-sm select-none",
          )}
          config={chartConfig}
          style={{ height: Math.max(160, rows.length * 44) }}
        >
          <BarChart
            accessibilityLayer
            data={rows}
            layout="vertical"
            margin={{ left: 4, right: 72 }}
          >
            <XAxis dataKey="averagePrice" hide type="number" />
            <YAxis axisLine={false} dataKey="label" tickLine={false} type="category" width={128} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  hideLabel
                  formatter={(_value, _name, item) => {
                    const store = item.payload as (typeof rows)[number];
                    return (
                      <div className="grid min-w-48 gap-1">
                        <span className="font-medium">{store.label}</span>
                        {store.storeNeighborhood ? (
                          <span className="text-muted-foreground">{store.storeNeighborhood}</span>
                        ) : null}
                        <span className="flex justify-between gap-4">
                          Médio
                          <span>
                            <MoneyValue amount={store.averagePrice ?? 0} />
                            {suffix}
                          </span>
                        </span>
                        <span className="flex justify-between gap-4 text-muted-foreground">
                          Mín – máx
                          <span>
                            <MoneyValue amount={store.minPrice ?? 0} /> –{" "}
                            <MoneyValue amount={store.maxPrice ?? 0} />
                          </span>
                        </span>
                        <span className="text-muted-foreground">
                          {store.purchaseCount} {store.purchaseCount === 1 ? "compra" : "compras"}
                        </span>
                      </div>
                    );
                  }}
                />
              }
              cursor={{ fill: "var(--muted)", opacity: 0.35 }}
            />
            <Bar dataKey="averagePrice" fill="var(--color-averagePrice)" radius={4}>
              <LabelList
                className="fill-foreground"
                dataKey="averagePrice"
                fontSize={12}
                formatter={(value) => formatCurrency(Number(value))}
                position="right"
              />
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
