import type { ProductPriceHistoryOutput } from "@openmonetis/validators/products";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { MoneyValue } from "@/components/money-value";
import { usePrivacyMode } from "@/components/privacy-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import {
  buildPriceTimeline,
  formatChartDate,
  formatPurchaseDate,
  normalizedPriceSuffixes,
} from "../products.presentation";

const compactCurrency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

export function ProductPriceTimelineChart({ history }: { history: ProductPriceHistoryOutput }) {
  const { isPrivacyModeEnabled } = usePrivacyMode();
  const { rows, series } = buildPriceTimeline(history);
  const suffix = normalizedPriceSuffixes[history.contentUnit];
  const chartConfig = Object.fromEntries(
    series.map((item) => [item.key, { label: item.label, color: item.color }]),
  ) satisfies ChartConfig;

  return (
    <Card className="pt-0">
      <CardHeader className="border-b py-5">
        <CardTitle>Preço ao longo do tempo</CardTitle>
        <CardDescription>
          Preço pago em R${suffix} em cada compra, com uma linha por loja.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6">
        <ChartContainer
          aria-label={`Preço em reais${suffix} por data de compra e loja`}
          className={cn(
            "h-72 w-full transition-[filter]",
            isPrivacyModeEnabled && "pointer-events-none blur-sm select-none",
          )}
          config={chartConfig}
        >
          <LineChart accessibilityLayer data={rows} margin={{ left: 4, right: 12, top: 12 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              axisLine={false}
              dataKey="purchaseDate"
              minTickGap={24}
              tickFormatter={(value) => formatChartDate(String(value))}
              tickLine={false}
              tickMargin={8}
            />
            <YAxis
              allowDecimals={false}
              axisLine={false}
              domain={[
                (dataMin: number) => Math.max(0, Math.floor(dataMin * 0.9)),
                (dataMax: number) => Math.ceil(dataMax * 1.05),
              ]}
              tickFormatter={(value) => compactCurrency.format(Number(value))}
              tickLine={false}
              width={56}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => formatPurchaseDate(String(value))}
                  formatter={(value, name) => (
                    <div className="flex min-w-44 items-center justify-between gap-5">
                      <span className="truncate text-muted-foreground">
                        {chartConfig[String(name)]?.label}
                      </span>
                      <span className="font-medium">
                        <MoneyValue amount={Number(value)} />
                        {suffix}
                      </span>
                    </div>
                  )}
                />
              }
              cursor={false}
            />
            {series.map((item) => (
              <Line
                connectNulls
                dataKey={item.key}
                activeDot={{ r: 6 }}
                dot={{ r: 4, fill: `var(--color-${item.key})`, strokeWidth: 0 }}
                key={item.key}
                stroke={`var(--color-${item.key})`}
                strokeWidth={2}
                type="monotone"
              />
            ))}
            <ChartLegend content={<ChartLegendContent />} />
          </LineChart>
        </ChartContainer>
        {isPrivacyModeEnabled ? (
          <span className="sr-only">Gráfico oculto pelo modo privacidade.</span>
        ) : null}
      </CardContent>
    </Card>
  );
}
