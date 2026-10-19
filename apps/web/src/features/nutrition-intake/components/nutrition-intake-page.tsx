import { getCurrentDateInBrazil } from "@openmonetis/shared/date-time";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { RefreshCw, Salad, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Navbar } from "@/components/navigation/navbar";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  formatGrams,
  formatIntakePeriod,
  formatKcal,
  getIntakePeriod,
  type IntakePeriodDays,
  intakePeriodOptions,
} from "../nutrition-intake.presentation";
import { nutritionIntakeQueryOptions } from "../nutrition-intake.queries";
import { MacroEnergyShare } from "./macro-energy-share";
import { NutritionIntakeChart } from "./nutrition-intake-chart";
import { NutritionIntakeProducts } from "./nutrition-intake-products";

export function NutritionIntakePage() {
  const [days, setDays] = useState<IntakePeriodDays>(7);
  const period = getIntakePeriod(days, getCurrentDateInBrazil());
  const intakeQuery = useQuery(nutritionIntakeQueryOptions(period));
  const intake = intakeQuery.data;

  return (
    <ProtectedRoute>
      <main className="min-h-svh bg-background">
        <Navbar />
        <section className="app-page project-container">
          <PageHeader
            actions={
              <Tabs
                onValueChange={(value) => setDays(Number(value) as IntakePeriodDays)}
                value={String(days)}
              >
                <TabsList aria-label="Período">
                  {intakePeriodOptions.map((option) => (
                    <TabsTrigger key={option.days} value={String(option.days)}>
                      {option.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            }
            breadcrumbs={[
              { label: "Visão geral", href: "/dashboard" },
              { label: "Físico" },
              { label: "Nutrição" },
            ]}
            description="Calorias e macros estimados pelos itens das compras. Cada item conta no dia em que foi comprado."
            icon={<Salad aria-hidden="true" className="size-5" />}
            title="Nutrição"
          />

          {intakeQuery.isLoading ? (
            <div aria-label="Carregando ingestão" className="grid gap-4" role="status">
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
              </div>
              <Skeleton className="h-72" />
            </div>
          ) : null}
          {intakeQuery.isError ? (
            <Card className="grid min-h-52 place-items-center border p-6 text-center">
              <div>
                <p className="font-medium">Não foi possível carregar a ingestão</p>
                <Button
                  className="mt-4"
                  onClick={() => void intakeQuery.refetch()}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <RefreshCw aria-hidden="true" /> Tentar novamente
                </Button>
              </div>
            </Card>
          ) : null}

          {intake && intake.lineCount === 0 ? (
            <Card className="grid min-h-60 place-items-center border p-6 text-center">
              <div className="max-w-md">
                <span className="mx-auto grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
                  <Salad aria-hidden="true" className="size-5" />
                </span>
                <p className="mt-4 font-medium">Nenhum item de compra no período</p>
                <p className="mt-1 text-muted-foreground text-sm">
                  A estimativa vem dos itens das despesas. Detalhe as notas fiscais em itens e
                  cadastre a informação nutricional dos produtos.
                </p>
              </div>
            </Card>
          ) : null}

          {intake && intake.lineCount > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {[
                  {
                    label: "Calorias por dia",
                    value: formatKcal(intake.dailyAverage.energyKcal),
                    hint: `${formatKcal(intake.totals.energyKcal)} de ${formatIntakePeriod(period)}`,
                  },
                  {
                    label: "Proteínas por dia",
                    value: formatGrams(intake.dailyAverage.proteinGrams),
                    hint: `${formatGrams(intake.totals.proteinGrams)} no período`,
                  },
                  {
                    label: "Carboidratos por dia",
                    value: formatGrams(intake.dailyAverage.carbohydrateGrams),
                    hint: `${formatGrams(intake.dailyAverage.addedSugarGrams)} de açúcar adicionado`,
                  },
                  {
                    label: "Gorduras por dia",
                    value: formatGrams(intake.dailyAverage.fatGrams),
                    hint: `${formatGrams(intake.totals.fatGrams)} no período`,
                  },
                ].map((stat) => (
                  <Card className="gap-1 border p-5" key={stat.label}>
                    <p className="text-muted-foreground text-sm">{stat.label}</p>
                    <p className="font-semibold text-2xl">{stat.value}</p>
                    <p className="text-muted-foreground text-xs">{stat.hint}</p>
                  </Card>
                ))}
              </div>

              {intake.linesWithoutCalories > 0 ? (
                <Card className="flex-row items-start gap-3 border p-4">
                  <TriangleAlert
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0 text-warning"
                  />
                  <p className="text-sm">
                    {intake.linesWithoutCalories === 1
                      ? `1 item de ${intake.lineCount} não tem calorias cadastradas e fica fora da estimativa.`
                      : `${intake.linesWithoutCalories} itens de ${intake.lineCount} não têm calorias cadastradas e ficam fora da estimativa.`}{" "}
                    <Link className="font-medium text-brand-strong hover:underline" to="/products">
                      Ver produtos
                    </Link>
                  </p>
                </Card>
              ) : null}

              <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <NutritionIntakeChart intake={intake} />
                <MacroEnergyShare intake={intake} />
              </div>
              <NutritionIntakeProducts intake={intake} />
            </>
          ) : null}
        </section>
      </main>
    </ProtectedRoute>
  );
}
