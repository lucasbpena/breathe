import type { NutritionIntakeOutput } from "@openmonetis/validators/nutrition-intake";
import { Bar, BarChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  formatIntakeChartDate,
  formatIntakeDate,
  formatKcal,
  formatKcalTick,
} from "../nutrition-intake.presentation";

const chartConfig = {
  energyKcal: { label: "Calorias", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function NutritionIntakeChart({ intake }: { intake: NutritionIntakeOutput }) {
  return (
    <Card className="pt-0">
      <CardHeader className="border-b py-5">
        <CardTitle>Calorias por dia de compra</CardTitle>
        <CardDescription>
          Calorias dos itens comprados em cada dia. A linha marca a média diária do período (
          {formatKcal(intake.dailyAverage.energyKcal)}).
        </CardDescription>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6">
        <ChartContainer
          aria-label="Calorias compradas por dia"
          className="h-64 w-full"
          config={chartConfig}
        >
          <BarChart accessibilityLayer data={intake.days} margin={{ left: 4, right: 12, top: 16 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              axisLine={false}
              dataKey="date"
              minTickGap={16}
              tickFormatter={(value) => formatIntakeChartDate(String(value))}
              tickLine={false}
              tickMargin={8}
            />
            <YAxis
              allowDecimals={false}
              axisLine={false}
              tickFormatter={(value) => formatKcalTick(Number(value))}
              tickLine={false}
              width={48}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  hideIndicator
                  labelFormatter={(value) => formatIntakeDate(String(value))}
                  formatter={(value) => (
                    <span className="font-medium">{formatKcal(Number(value))}</span>
                  )}
                />
              }
              cursor={{ fill: "var(--muted)", opacity: 0.6 }}
            />
            {intake.dailyAverage.energyKcal > 0 ? (
              <ReferenceLine
                ifOverflow="extendDomain"
                stroke="var(--muted-foreground)"
                strokeOpacity={0.6}
                y={intake.dailyAverage.energyKcal}
              />
            ) : null}
            <Bar
              dataKey="energyKcal"
              fill="var(--color-energyKcal)"
              maxBarSize={24}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
