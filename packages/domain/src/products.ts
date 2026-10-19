import { createEstablishmentNameKey } from "./establishments";

/** Grams and milliliters are the metragem; "package" products are counted by packages only. */
export const productContentUnits = ["gram", "milliliter", "package"] as const;
export type ProductContentUnit = (typeof productContentUnits)[number];

export const productNutrients = [
  "energyKcal",
  "proteinGrams",
  "carbohydrateGrams",
  "addedSugarGrams",
  "fatGrams",
] as const;
export type ProductNutrient = (typeof productNutrients)[number];

/** Like a nutrition label: per 100 g or 100 mL, and per unit for products without metragem. */
export const nutritionBasisContent: Record<ProductContentUnit, number> = {
  gram: 100,
  milliliter: 100,
  package: 1,
};

export const productWeekdays = [0, 1, 2, 3, 4, 5, 6] as const;
export type ProductWeekday = (typeof productWeekdays)[number];

/** Normalized prices are quoted per kilogram, per liter or per package. */
const normalizedContentFactors: Record<ProductContentUnit, number> = {
  gram: 1000,
  milliliter: 1000,
  package: 1,
};

export type ProductPurchasePrice = {
  purchaseId: string;
  purchaseDate: string;
  storeId: string;
  paidAmount: number | string;
  totalContent: number | string;
};

export type ProductPriceSummary = {
  purchaseCount: number;
  lastPrice: number | null;
  lastPurchaseDate: string | null;
  averagePrice: number | null;
  minPrice: number | null;
  maxPrice: number | null;
};

export type ProductPricePoint = {
  purchaseId: string;
  purchaseDate: string;
  storeId: string;
  normalizedPrice: number;
};

export type ProductStorePriceSummary = ProductPriceSummary & { storeId: string };

export type ProductWeekdayPrice = {
  weekday: ProductWeekday;
  purchaseCount: number;
  averagePrice: number | null;
};

export type ProductPriceHistory = {
  summary: ProductPriceSummary;
  points: ProductPricePoint[];
  stores: ProductStorePriceSummary[];
  weekdays: ProductWeekdayPrice[];
};

type NormalizedPurchase = ProductPricePoint & { paidCents: number; content: number };

export function createProductNameKey(name: string) {
  return createEstablishmentNameKey(name);
}

/** Only products with metragem have a package metragem; a package is its own unit. */
export function resolvePackageContent(
  contentUnit: ProductContentUnit,
  packageContent: number | null,
) {
  return contentUnit === "package" ? null : packageContent;
}

export function calculateNormalizedPrice(
  paidAmount: number | string,
  totalContent: number | string,
  contentUnit: ProductContentUnit,
) {
  return normalizeCents(toCents(paidAmount), Number(totalContent), contentUnit);
}

/** The average is weighted by content: total paid divided by total content bought. */
export function summarizeProductPrices(
  contentUnit: ProductContentUnit,
  purchases: readonly ProductPurchasePrice[],
): ProductPriceSummary {
  return summarizeNormalized(contentUnit, normalizePurchases(contentUnit, purchases));
}

export function calculateProductPriceHistory(
  contentUnit: ProductContentUnit,
  purchases: readonly ProductPurchasePrice[],
): ProductPriceHistory {
  const normalized = normalizePurchases(contentUnit, purchases);
  const byStore = groupBy(normalized, (purchase) => purchase.storeId);
  const byWeekday = groupBy(normalized, (purchase) => getWeekday(purchase.purchaseDate));

  return {
    summary: summarizeNormalized(contentUnit, normalized),
    points: normalized.map(({ purchaseId, purchaseDate, storeId, normalizedPrice }) => ({
      purchaseId,
      purchaseDate,
      storeId,
      normalizedPrice,
    })),
    stores: [...byStore]
      .map(([storeId, items]) => ({ storeId, ...summarizeNormalized(contentUnit, items) }))
      .sort(
        (left, right) =>
          right.purchaseCount - left.purchaseCount || left.storeId.localeCompare(right.storeId),
      ),
    weekdays: productWeekdays.map((weekday) => {
      const items = byWeekday.get(weekday) ?? [];
      return {
        weekday,
        purchaseCount: items.length,
        averagePrice: weightedAverage(contentUnit, items),
      };
    }),
  };
}

function normalizePurchases(
  contentUnit: ProductContentUnit,
  purchases: readonly ProductPurchasePrice[],
): NormalizedPurchase[] {
  return purchases
    .map((purchase) => {
      const paidCents = toCents(purchase.paidAmount);
      const content = Number(purchase.totalContent);
      return {
        purchaseId: purchase.purchaseId,
        purchaseDate: purchase.purchaseDate,
        storeId: purchase.storeId,
        paidCents,
        content,
        normalizedPrice: normalizeCents(paidCents, content, contentUnit),
      };
    })
    .sort(
      (left, right) =>
        left.purchaseDate.localeCompare(right.purchaseDate) ||
        left.purchaseId.localeCompare(right.purchaseId),
    );
}

function summarizeNormalized(
  contentUnit: ProductContentUnit,
  purchases: readonly NormalizedPurchase[],
): ProductPriceSummary {
  const last = purchases.at(-1);
  if (!last) {
    return {
      purchaseCount: 0,
      lastPrice: null,
      lastPurchaseDate: null,
      averagePrice: null,
      minPrice: null,
      maxPrice: null,
    };
  }

  const prices = purchases.map((purchase) => purchase.normalizedPrice);
  return {
    purchaseCount: purchases.length,
    lastPrice: last.normalizedPrice,
    lastPurchaseDate: last.purchaseDate,
    averagePrice: weightedAverage(contentUnit, purchases),
    minPrice: Math.min(...prices),
    maxPrice: Math.max(...prices),
  };
}

function weightedAverage(
  contentUnit: ProductContentUnit,
  purchases: readonly NormalizedPurchase[],
) {
  if (!purchases.length) return null;
  const paidCents = purchases.reduce((total, purchase) => total + purchase.paidCents, 0);
  const content = purchases.reduce((total, purchase) => total + purchase.content, 0);
  return normalizeCents(paidCents, content, contentUnit);
}

function normalizeCents(paidCents: number, content: number, contentUnit: ProductContentUnit) {
  return Math.round((paidCents * normalizedContentFactors[contentUnit]) / content) / 100;
}

function getWeekday(date: string) {
  return new Date(`${date}T12:00:00Z`).getUTCDay() as ProductWeekday;
}

function groupBy<T, K>(items: readonly T[], key: (item: T) => K) {
  const groups = new Map<K, T[]>();
  for (const item of items) {
    const group = groups.get(key(item));
    if (group) group.push(item);
    else groups.set(key(item), [item]);
  }
  return groups;
}

function toCents(value: number | string) {
  return Math.round(Number(value) * 100);
}
