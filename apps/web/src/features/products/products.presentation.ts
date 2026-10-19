import type { ProductContentUnit } from "@openmonetis/domain/products";
import { dateOnlyToSafeInstant, formatDateInBrazil } from "@openmonetis/shared/date-time";
import type { ProductOutput, ProductPriceHistoryOutput } from "@openmonetis/validators/products";
import { formatStoreName, getErrorCodeMessage } from "../stores/stores.presentation";

export const contentUnitLabels: Record<ProductContentUnit, string> = {
  gram: "Gramas (g)",
  milliliter: "Mililitros (mL)",
  package: "Sem metragem (por unidade)",
};

/** Metragem symbols; products without metragem have none. */
export const contentUnitSymbols: Record<ProductContentUnit, string | null> = {
  gram: "g",
  milliliter: "mL",
  package: null,
};

export const normalizedPriceSuffixes: Record<ProductContentUnit, string> = {
  gram: "/kg",
  milliliter: "/L",
  package: "/un",
};

export const nutritionBasisLabels: Record<ProductContentUnit, string> = {
  gram: "por 100 g",
  milliliter: "por 100 mL",
  package: "por unidade",
};

export const nutritionFields = [
  { name: "energyKcal", label: "Calorias", unit: "kcal" },
  { name: "proteinGrams", label: "Proteínas", unit: "g" },
  { name: "carbohydrateGrams", label: "Carboidratos", unit: "g" },
  { name: "addedSugarGrams", label: "Açúcar adicionado", unit: "g" },
  { name: "fatGrams", label: "Gorduras", unit: "g" },
] as const;

export type NutritionFieldName = (typeof nutritionFields)[number]["name"];

export const weekdayLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;

const productErrorMessages: Record<string, string> = {
  product_already_exists: "Já existe um produto ou nome da nota com esse nome.",
  category_not_found: "Escolha uma categoria de despesa válida.",
  product_in_use: "Este produto tem compras registradas e não pode ser excluído.",
  alias_conflict: "Esse nome da nota já pertence a outro produto.",
  product_merge_unit_mismatch: "Só é possível mesclar produtos com a mesma metragem.",
  product_unit_in_use: "A metragem não pode mudar depois que o produto tem compras.",
  product_merge_same: "Escolha outro produto para mesclar.",
  product_not_found: "Produto não encontrado.",
};

const decimalFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 });

export function getProductErrorMessage(error: unknown, fallback: string) {
  return getErrorCodeMessage(error, productErrorMessages) ?? fallback;
}

export function parseDecimalInput(value: string) {
  const normalized = value.trim().replace(/\s/g, "").replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function formatDecimalInput(value: number | null | undefined) {
  return value == null ? "" : String(value).replace(".", ",");
}

export function formatPackageCount(count: number) {
  return `${decimalFormatter.format(count)} ${count === 1 ? "unidade" : "unidades"}`;
}

export function formatContent(value: number, contentUnit: ProductContentUnit) {
  if (contentUnit === "package") return formatPackageCount(value);
  const [small, large] = contentUnit === "gram" ? ["g", "kg"] : ["mL", "L"];
  return value >= 1000
    ? `${decimalFormatter.format(value / 1000)} ${large}`
    : `${decimalFormatter.format(value)} ${small}`;
}

export function formatPackageContent(
  product: Pick<ProductOutput, "contentUnit" | "packageContent">,
) {
  if (product.packageContent !== null)
    return formatContent(product.packageContent, product.contentUnit);
  return product.contentUnit === "package" ? "Por unidade" : "A granel";
}

export function describeProductMetragem(
  product: Pick<ProductOutput, "contentUnit" | "packageContent">,
) {
  if (product.contentUnit === "package") return "Sem metragem: contado por unidades";
  if (product.packageContent === null) return "A granel: informe a metragem total";
  return `${formatContent(product.packageContent, product.contentUnit)} por unidade`;
}

export function formatPurchaseDate(value: string) {
  return formatDateInBrazil(dateOnlyToSafeInstant(value), {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatChartDate(value: string) {
  return formatDateInBrazil(dateOnlyToSafeInstant(value), { day: "2-digit", month: "2-digit" });
}

export function matchesProductSearch(product: ProductOutput, query: string) {
  const normalizedQuery = normalizeSearch(query.trim());
  if (!normalizedQuery) return true;
  return [product.name, product.categoryName ?? "", ...product.aliases.map((alias) => alias.name)]
    .map(normalizeSearch)
    .some((value) => value.includes(normalizedQuery));
}

export type PriceTimelineSeries = { key: string; label: string; color: string };

/**
 * Pivots the price points into one row per purchase with one column per store, so the chart
 * draws a line per store. Stores beyond the busiest ones share the "Outras lojas" series.
 */
export function buildPriceTimeline(history: ProductPriceHistoryOutput, maxStores = 4) {
  const shown = history.stores.slice(0, maxStores);
  const seriesByStore = new Map<string, PriceTimelineSeries>(
    shown.map((store, index) => [
      store.storeId,
      {
        key: `store${index}`,
        label: formatStoreName({ name: store.storeName, branch: store.storeBranch }),
        color: `var(--chart-${index + 1})`,
      },
    ]),
  );
  const other: PriceTimelineSeries = {
    key: "other",
    label: "Outras lojas",
    color: "var(--chart-5)",
  };
  const rows = history.points.map((point) => ({
    purchaseId: point.purchaseId,
    purchaseDate: point.purchaseDate,
    [(seriesByStore.get(point.storeId) ?? other).key]: point.normalizedPrice,
  }));
  const series = [...seriesByStore.values()];
  if (history.stores.length > maxStores) series.push(other);
  return { rows, series };
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR");
}
