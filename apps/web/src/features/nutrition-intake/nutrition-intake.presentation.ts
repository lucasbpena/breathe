import { dateOnlyToSafeInstant, formatDateInBrazil } from "@openmonetis/shared/date-time";
import type { NutritionIntakeQuery } from "@openmonetis/validators/nutrition-intake";

export const intakePeriodOptions = [
  { days: 7, label: "7 dias" },
  { days: 30, label: "30 dias" },
  { days: 90, label: "90 dias" },
] as const;

export type IntakePeriodDays = (typeof intakePeriodOptions)[number]["days"];

/** Macro order and colors are fixed, so each macro keeps its color in every chart. */
export const macroSeries = [
  { key: "protein", grams: "proteinGrams", label: "Proteínas", color: "var(--chart-2)" },
  {
    key: "carbohydrate",
    grams: "carbohydrateGrams",
    label: "Carboidratos",
    color: "var(--chart-3)",
  },
  { key: "fat", grams: "fatGrams", label: "Gorduras", color: "var(--chart-1)" },
] as const;

const millisecondsPerDay = 86_400_000;
const kcalFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const gramsFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

/** The period ends today, so "7 dias" is today and the six days before it. */
export function getIntakePeriod(days: number, today: string): NutritionIntakeQuery {
  const end = Date.parse(`${today}T00:00:00.000Z`);
  const from = new Date(end - (days - 1) * millisecondsPerDay).toISOString().slice(0, 10);
  return { from, to: today };
}

export function formatKcal(value: number) {
  return `${kcalFormatter.format(value)} kcal`;
}

export function formatGrams(value: number) {
  return `${gramsFormatter.format(value)} g`;
}

export function formatKcalTick(value: number) {
  return kcalFormatter.format(value);
}

export function formatPercent(value: number) {
  return `${gramsFormatter.format(value)}%`;
}

export function formatIntakeDate(value: string) {
  return formatDateInBrazil(dateOnlyToSafeInstant(value), {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

export function formatIntakeChartDate(value: string) {
  return formatDateInBrazil(dateOnlyToSafeInstant(value), { day: "2-digit", month: "2-digit" });
}

export function formatIntakePeriod(query: NutritionIntakeQuery) {
  return `${formatIntakeChartDate(query.from)} a ${formatIntakeChartDate(query.to)}`;
}
