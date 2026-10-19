import type { BodyMeasurementKind } from "@openmonetis/domain/body-measurements";
import { useQuery } from "@tanstack/react-query";
import { PersonStanding, Plus, RefreshCw, Scale } from "lucide-react";
import { useState } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Navbar } from "@/components/navigation/navbar";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  bodyMeasurementGroups,
  bodyMeasurementLabels,
  formatMeasuredOn,
  formatMeasurement,
  formatMeasurementChange,
} from "../body-measurements.presentation";
import {
  bodyMeasurementDraftsQueryOptions,
  bodyMeasurementsQueryOptions,
} from "../body-measurements.queries";
import { BodyMap, type BodyView } from "./body-map";
import { BodyMeasurementDrafts } from "./body-measurement-drafts";
import { BodyMeasurementPanel } from "./body-measurement-panel";
import { BodyMeasurementsDialog } from "./body-measurements-dialog";

const legend = [
  { label: "Com medida", className: "bg-brand/35" },
  { label: "Sem medida", className: "bg-foreground/10" },
  { label: "Selecionada", className: "bg-brand" },
];

export function BodyMeasurementsPage() {
  const overviewQuery = useQuery(bodyMeasurementsQueryOptions());
  const draftsQuery = useQuery(bodyMeasurementDraftsQueryOptions());
  const drafts = draftsQuery.data ?? [];
  const [view, setView] = useState<BodyView>("front");
  const [selectedKind, setSelectedKind] = useState<BodyMeasurementKind>("weight");
  const [dialogOpen, setDialogOpen] = useState(false);
  const overview = overviewQuery.data;
  const trends = overview?.trends ?? [];
  const selectedTrend = trends.find((trend) => trend.kind === selectedKind);
  const weight = trends.find((trend) => trend.kind === "weight");
  const measuredKinds = new Set(trends.filter((trend) => trend.latest).map((trend) => trend.kind));
  const latestValues = Object.fromEntries(
    trends.flatMap((trend) => (trend.latest ? [[trend.kind, trend.latest.value]] : [])),
  ) as Partial<Record<BodyMeasurementKind, number>>;

  return (
    <ProtectedRoute>
      <main className="min-h-svh bg-background">
        <Navbar />
        <section className="app-page project-container">
          <PageHeader
            actions={
              <Button onClick={() => setDialogOpen(true)} type="button">
                <Plus aria-hidden="true" className="size-4" /> Registrar medidas
              </Button>
            }
            breadcrumbs={[
              { label: "Visão geral", href: "/dashboard" },
              { label: "Físico" },
              { label: "Corpo" },
            ]}
            description={
              overview?.lastMeasuredOn
                ? `Peso e medidas com fita métrica. Última medição em ${formatMeasuredOn(overview.lastMeasuredOn)}.`
                : "Peso e medidas com fita métrica. Escolha uma parte do corpo para ver o histórico."
            }
            icon={<PersonStanding aria-hidden="true" className="size-5" />}
            title="Corpo"
          />

          {drafts.length ? (
            <div className="mb-4">
              <BodyMeasurementDrafts drafts={drafts} latestValues={latestValues} />
            </div>
          ) : null}

          {overviewQuery.isLoading ? (
            <div
              aria-label="Carregando medidas"
              className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]"
              role="status"
            >
              <Skeleton className="h-[28rem]" />
              <Skeleton className="h-[28rem]" />
            </div>
          ) : null}
          {overviewQuery.isError ? (
            <Card className="grid min-h-52 place-items-center border p-6 text-center">
              <div>
                <p className="font-medium">Não foi possível carregar as medidas</p>
                <Button
                  className="mt-4"
                  onClick={() => void overviewQuery.refetch()}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <RefreshCw aria-hidden="true" /> Tentar novamente
                </Button>
              </div>
            </Card>
          ) : null}

          {overview && selectedTrend ? (
            <>
              <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
                <Card className="min-w-0 gap-4 border p-4">
                  <button
                    aria-pressed={selectedKind === "weight"}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
                      selectedKind === "weight" && "border-brand bg-brand/10 hover:bg-brand/15",
                    )}
                    onClick={() => setSelectedKind("weight")}
                    type="button"
                  >
                    <span className="grid size-9 place-items-center rounded-full bg-muted text-muted-foreground">
                      <Scale aria-hidden="true" className="size-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-muted-foreground text-xs">Peso</span>
                      <span className="block font-semibold">
                        {weight?.latest ? formatMeasurement(weight.latest.value, weight.unit) : "—"}
                      </span>
                    </span>
                    {weight?.change != null ? (
                      <span className="ml-auto text-muted-foreground text-sm">
                        {formatMeasurementChange(weight.change, weight.unit)}
                      </span>
                    ) : null}
                  </button>
                  <Tabs
                    className="items-center"
                    onValueChange={(value) => setView(value as BodyView)}
                    value={view}
                  >
                    <TabsList>
                      <TabsTrigger value="front">Frente</TabsTrigger>
                      <TabsTrigger value="back">Costas</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <BodyMap
                    measuredKinds={measuredKinds}
                    onSelect={setSelectedKind}
                    selectedKind={selectedKind}
                    view={view}
                  />
                  <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-muted-foreground text-xs">
                    {legend.map((item) => (
                      <li className="flex items-center gap-1.5" key={item.label}>
                        <span
                          aria-hidden="true"
                          className={cn("size-2.5 rounded-sm", item.className)}
                        />
                        {item.label}
                      </li>
                    ))}
                  </ul>
                </Card>
                <BodyMeasurementPanel onRecord={() => setDialogOpen(true)} trend={selectedTrend} />
              </div>

              <Card className="border p-2 sm:p-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Parte</TableHead>
                      <TableHead className="text-right">Última</TableHead>
                      <TableHead className="hidden text-right sm:table-cell">Variação</TableHead>
                      <TableHead className="hidden text-right sm:table-cell">Medida em</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bodyMeasurementGroups.flatMap((group) =>
                      group.kinds.map((kind) => {
                        const trend = trends.find((item) => item.kind === kind);
                        if (!trend) return null;
                        return (
                          <TableRow
                            className={cn(selectedKind === kind && "bg-brand/10")}
                            key={kind}
                          >
                            <TableCell>
                              <button
                                className="font-medium hover:text-brand-strong focus-visible:underline focus-visible:outline-none"
                                onClick={() => setSelectedKind(kind)}
                                type="button"
                              >
                                {bodyMeasurementLabels[kind]}
                              </button>
                              {group.kinds.length > 1 ? (
                                <p className="text-muted-foreground text-xs">{group.label}</p>
                              ) : null}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {trend.latest
                                ? formatMeasurement(trend.latest.value, trend.unit)
                                : "—"}
                            </TableCell>
                            <TableCell className="hidden text-right text-muted-foreground tabular-nums sm:table-cell">
                              {trend.change === null
                                ? "—"
                                : formatMeasurementChange(trend.change, trend.unit)}
                            </TableCell>
                            <TableCell className="hidden text-right text-muted-foreground sm:table-cell">
                              {trend.latest ? formatMeasuredOn(trend.latest.measuredOn) : "—"}
                            </TableCell>
                          </TableRow>
                        );
                      }),
                    )}
                  </TableBody>
                </Table>
              </Card>
            </>
          ) : null}
        </section>
        <BodyMeasurementsDialog
          focusKind={selectedKind}
          key={dialogOpen ? "open" : "closed"}
          latestValues={latestValues}
          onOpenChange={setDialogOpen}
          open={dialogOpen}
        />
      </main>
    </ProtectedRoute>
  );
}
