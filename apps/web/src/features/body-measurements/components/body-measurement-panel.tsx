import type { BodyMeasurementTrendOutput } from "@openmonetis/validators/body-measurements";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { useDeleteBodyMeasurementMutation } from "../body-measurements.mutations";
import {
  bodyMeasurementGuides,
  bodyMeasurementLabels,
  bodyMeasurementMuscles,
  buildMeasurementTicks,
  formatMeasuredOn,
  formatMeasurement,
  formatMeasurementChange,
  formatMeasurementChartDate,
  getBodyMeasurementErrorMessage,
} from "../body-measurements.presentation";

const chartConfig = { value: { label: "Medida", color: "var(--chart-2)" } } satisfies ChartConfig;
const visibleHistory = 8;

type MeasurementPoint = BodyMeasurementTrendOutput["history"][number];

export function BodyMeasurementPanel({
  trend,
  onRecord,
}: {
  trend: BodyMeasurementTrendOutput;
  onRecord: () => void;
}) {
  const deleteMutation = useDeleteBodyMeasurementMutation();
  const [removing, setRemoving] = useState<MeasurementPoint | null>(null);
  const label = bodyMeasurementLabels[trend.kind];
  const recent = trend.history.slice(-visibleHistory).reverse();
  const ticks = buildMeasurementTicks(trend.history.map((point) => point.value));

  async function remove(point: MeasurementPoint) {
    try {
      await deleteMutation.mutateAsync(point.id);
      toast.success("Medida excluída");
    } catch (error) {
      toast.error(getBodyMeasurementErrorMessage(error, "Não foi possível excluir a medida."));
    } finally {
      setRemoving(null);
    }
  }

  return (
    <Card className="min-w-0 border">
      <CardHeader>
        <CardTitle>{label}</CardTitle>
        <CardDescription>
          {bodyMeasurementMuscles[trend.kind]}. {bodyMeasurementGuides[trend.kind]}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          {trend.latest ? (
            <div>
              <p className="font-semibold text-3xl">
                {formatMeasurement(trend.latest.value, trend.unit)}
              </p>
              <p className="text-muted-foreground text-sm">
                Medido em {formatMeasuredOn(trend.latest.measuredOn)}
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Nenhuma medida registrada.</p>
          )}
          <Button onClick={onRecord} size="sm" type="button" variant="outline">
            <Plus aria-hidden="true" /> Registrar
          </Button>
        </div>

        {trend.change !== null || trend.totalChange !== null ? (
          <dl className="grid grid-cols-2 gap-3">
            {[
              { label: "Desde a anterior", value: trend.change },
              { label: "Desde a primeira", value: trend.totalChange },
            ].map((item) => (
              <div className="rounded-lg border p-3" key={item.label}>
                <dt className="text-muted-foreground text-xs">{item.label}</dt>
                <dd className="font-medium">
                  {item.value === null ? "—" : formatMeasurementChange(item.value, trend.unit)}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}

        {trend.history.length > 1 ? (
          <ChartContainer
            aria-label={`${label} por data de medição`}
            className="h-48 w-full"
            config={chartConfig}
          >
            <LineChart
              accessibilityLayer
              data={trend.history}
              margin={{ left: 4, right: 12, top: 12 }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                axisLine={false}
                dataKey="measuredOn"
                minTickGap={24}
                tickFormatter={(value) => formatMeasurementChartDate(String(value))}
                tickLine={false}
                tickMargin={8}
              />
              <YAxis
                axisLine={false}
                domain={[ticks[0] ?? 0, ticks.at(-1) ?? 0]}
                tickLine={false}
                ticks={ticks}
                width={40}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    hideIndicator
                    labelFormatter={(value) => formatMeasuredOn(String(value))}
                    formatter={(value) => (
                      <span className="font-medium">
                        {formatMeasurement(Number(value), trend.unit)}
                      </span>
                    )}
                  />
                }
                cursor={false}
              />
              <Line
                activeDot={{ r: 6 }}
                dataKey="value"
                dot={{ r: 4, fill: "var(--color-value)", strokeWidth: 0 }}
                stroke="var(--color-value)"
                strokeWidth={2}
                type="monotone"
              />
            </LineChart>
          </ChartContainer>
        ) : null}

        {recent.length > 0 ? (
          <div>
            <p className="mb-1 font-medium text-sm">Histórico</p>
            <ul className="divide-y">
              {recent.map((point) => (
                <li className="flex items-center justify-between gap-3 py-1.5" key={point.id}>
                  <span className="text-muted-foreground text-sm">
                    {formatMeasuredOn(point.measuredOn)}
                  </span>
                  <span className="ml-auto font-medium text-sm tabular-nums">
                    {formatMeasurement(point.value, trend.unit)}
                  </span>
                  <Button
                    aria-label={`Excluir medida de ${formatMeasuredOn(point.measuredOn)}`}
                    disabled={deleteMutation.isPending}
                    onClick={() => setRemoving(point)}
                    size="icon"
                    variant="ghost"
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
            {trend.history.length > visibleHistory ? (
              <p className="text-muted-foreground text-xs">
                Mostrando as {visibleHistory} mais recentes de {trend.history.length}.
              </p>
            ) : null}
          </div>
        ) : null}
      </CardContent>
      <AlertDialog
        onOpenChange={(open) => {
          if (!open) setRemoving(null);
        }}
        open={removing !== null}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir medida?</AlertDialogTitle>
            <AlertDialogDescription>
              {removing
                ? `${label}: ${formatMeasurement(removing.value, trend.unit)} em ${formatMeasuredOn(removing.measuredOn)} será excluída.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => removing && void remove(removing)}
              variant="destructive"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
