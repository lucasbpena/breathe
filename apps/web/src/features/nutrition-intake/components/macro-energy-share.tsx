import type { NutritionIntakeOutput } from "@openmonetis/validators/nutrition-intake";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatGrams, formatPercent, macroSeries } from "../nutrition-intake.presentation";

/** One stacked bar of the macro energy, with every value also written in the legend. */
export function MacroEnergyShare({ intake }: { intake: NutritionIntakeOutput }) {
  const share = intake.energyShare;
  return (
    <Card className="border">
      <CardHeader>
        <CardTitle>Divisão dos macros</CardTitle>
        <CardDescription>
          Parte das calorias de proteínas, carboidratos e gorduras (4, 4 e 9 kcal por grama).
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {share ? (
          <>
            <div
              aria-hidden="true"
              className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-muted"
            >
              {macroSeries.map((macro) =>
                share[macro.key] > 0 ? (
                  <span
                    className="h-full first:rounded-l-full last:rounded-r-full"
                    key={macro.key}
                    style={{ width: `${share[macro.key]}%`, backgroundColor: macro.color }}
                  />
                ) : null,
              )}
            </div>
            <dl className="grid gap-2 sm:grid-cols-3">
              {macroSeries.map((macro) => (
                <div className="flex items-start gap-2" key={macro.key}>
                  <span
                    aria-hidden="true"
                    className="mt-1 size-2.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: macro.color }}
                  />
                  <div>
                    <dt className="text-muted-foreground text-xs">{macro.label}</dt>
                    <dd className="font-medium">{formatPercent(share[macro.key])}</dd>
                    <dd className="whitespace-nowrap text-muted-foreground text-xs">
                      {formatGrams(intake.dailyAverage[macro.grams])} por dia
                    </dd>
                  </div>
                </div>
              ))}
            </dl>
          </>
        ) : (
          <p className="text-muted-foreground text-sm">
            Nenhum produto do período tem proteínas, carboidratos ou gorduras cadastrados.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
