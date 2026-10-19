import type { ProductPriceHistoryOutput } from "@openmonetis/validators/products";
import { Bar, BarChart, CartesianGrid, LabelList, XAxis } from "recharts";
import { MoneyValue } from "@/components/money-value";
import { usePrivacyMode } from "@/components/privacy-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { formatCurrency } from "@/lib/money-presentation";
import { cn } from "@/lib/utils";
import { normalizedPriceSuffixes, weekdayLabels } from "../products.presentation";

const chartConfig = {
  averagePrice: { label: "Preço médio", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function ProductPriceByWeekdayChart({ history }: { history: ProductPriceHistoryOutput }) {
  const { isPrivacyModeEnabled } = usePrivacyMode();
  const suffix = normalizedPriceSuffixes[history.contentUnit];
  const rows = history.weekdays.map((weekday) => ({
    ...weekday,
    label: weekdayLabels[weekday.weekday],
  }));

  return (
    <Card className="pt-0">
      <CardHeader className="border-b py-5">
        <CardTitle>Por dia da semana</CardTitle>
        <CardDescription>Preço médio ponderado em R${suffix} pelo dia da compra.</CardDescription>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6">
        <ChartContainer
          aria-label={`Preço médio em reais${suffix} por dia da semana`}
          className={cn(
            "h-56 w-full transition-[filter]",
            isPrivacyModeEnabled && "pointer-events-none blur-sm select-none",
          )}
          config={chartConfig}
        >
          <BarChart accessibilityLayer data={rows} margin={{ left: 4, right: 4, top: 24 }}>
            <CartesianGrid vertical={false} />
            <XAxis axisLine={false} dataKey="label" tickLine={false} tickMargin={8} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(_value, _name, item) => {
                    const weekday = item.payload as (typeof rows)[number];
                    return weekday.averagePrice === null ? (
                      <span className="text-muted-foreground">Sem compras</span>
                    ) : (
                      <div className="grid min-w-40 gap-1">
                        <span className="flex justify-between gap-4">
                          Médio
                          <span>
                            <MoneyValue amount={weekday.averagePrice} />
                            {suffix}
                          </span>
                        </span>
                        <span className="text-muted-foreground">
                          {weekday.purchaseCount}{" "}
                          {weekday.purchaseCount === 1 ? "compra" : "compras"}
                        </span>
                      </div>
                    );
                  }}
                />
              }
              cursor={{ fill: "var(--muted)", opacity: 0.35 }}
            />
            <Bar dataKey="averagePrice" fill="var(--color-averagePrice)" radius={[4, 4, 0, 0]}>
              <LabelList
                className="fill-foreground"
                dataKey="averagePrice"
                fontSize={11}
                formatter={(value) => (value == null ? "" : formatCurrency(Number(value)))}
                position="top"
              />
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
