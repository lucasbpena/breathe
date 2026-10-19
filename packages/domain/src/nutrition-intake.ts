import {
  nutritionBasisContent,
  type ProductContentUnit,
  type ProductNutrient,
  productNutrients,
} from "./products";

export type NutrientAmounts = Record<ProductNutrient, number>;

/** One receipt line with the nutrition its product declares; null means not filled in. */
export type NutritionIntakeLine = {
  purchaseDate: string;
  productId: string;
  productName: string;
  contentUnit: ProductContentUnit;
  totalContent: number | string;
  nutrition: Record<ProductNutrient, number | string | null>;
};

export type NutritionIntakeProduct = {
  productId: string;
  productName: string;
  contentUnit: ProductContentUnit;
  lineCount: number;
  totalContent: number;
  hasCalories: boolean;
  nutrients: NutrientAmounts;
};

/** Percent of the macro energy coming from each macronutrient. */
export type MacroEnergyShare = {
  protein: number;
  carbohydrate: number;
  fat: number;
};

export type NutritionIntake = {
  from: string;
  to: string;
  dayCount: number;
  totals: NutrientAmounts;
  dailyAverage: NutrientAmounts;
  energyShare: MacroEnergyShare | null;
  days: (NutrientAmounts & { date: string })[];
  products: NutritionIntakeProduct[];
  lineCount: number;
  linesWithoutCalories: number;
};

/** Atwater factors, in kcal per gram. */
const macroEnergyFactors = { protein: 4, carbohydrate: 4, fat: 9 } as const;

const millisecondsPerDay = 86_400_000;

/**
 * Estimates intake from what was bought: every receipt line counts as eaten on its purchase
 * date. The daily average spreads the period total over every day in it, including days without
 * purchases, since food bought on one day is eaten over the following ones.
 */
export function calculateNutritionIntake(input: {
  from: string;
  to: string;
  lines: readonly NutritionIntakeLine[];
}): NutritionIntake {
  const dates = listDates(input.from, input.to);
  const byDate = new Map(dates.map((date) => [date, emptyAmounts()]));
  const byProduct = new Map<string, NutritionIntakeProduct>();
  const totals = emptyAmounts();
  let lineCount = 0;
  let linesWithoutCalories = 0;

  for (const line of input.lines) {
    const day = byDate.get(line.purchaseDate);
    if (!day) continue;
    lineCount += 1;
    const nutrients = calculateLineNutrients(line);
    const hasCalories = line.nutrition.energyKcal !== null;
    if (!hasCalories) linesWithoutCalories += 1;
    addAmounts(day, nutrients);
    addAmounts(totals, nutrients);

    const product = byProduct.get(line.productId);
    if (product) {
      product.lineCount += 1;
      product.totalContent += Number(line.totalContent);
      addAmounts(product.nutrients, nutrients);
    } else {
      byProduct.set(line.productId, {
        productId: line.productId,
        productName: line.productName,
        contentUnit: line.contentUnit,
        lineCount: 1,
        totalContent: Number(line.totalContent),
        hasCalories,
        nutrients: { ...nutrients },
      });
    }
  }

  return {
    from: input.from,
    to: input.to,
    dayCount: dates.length,
    totals: roundAmounts(totals),
    dailyAverage: roundAmounts(divideAmounts(totals, dates.length)),
    energyShare: calculateMacroEnergyShare(totals),
    days: [...byDate].map(([date, amounts]) => ({ date, ...roundAmounts(amounts) })),
    products: [...byProduct.values()]
      .map((product) => ({
        ...product,
        totalContent: Math.round(product.totalContent * 1000) / 1000,
        nutrients: roundAmounts(product.nutrients),
      }))
      .sort(
        (left, right) =>
          right.nutrients.energyKcal - left.nutrients.energyKcal ||
          left.productName.localeCompare(right.productName, "pt-BR"),
      ),
    lineCount,
    linesWithoutCalories,
  };
}

/** Scales the declared nutrition to the content bought; missing nutrients count as zero. */
export function calculateLineNutrients(
  line: Pick<NutritionIntakeLine, "contentUnit" | "totalContent" | "nutrition">,
): NutrientAmounts {
  const servings = Number(line.totalContent) / nutritionBasisContent[line.contentUnit];
  const amounts = emptyAmounts();
  for (const nutrient of productNutrients) {
    const declared = line.nutrition[nutrient];
    amounts[nutrient] = declared === null ? 0 : Number(declared) * servings;
  }
  return amounts;
}

export function calculateMacroEnergyShare(
  amounts: Pick<NutrientAmounts, "proteinGrams" | "carbohydrateGrams" | "fatGrams">,
): MacroEnergyShare | null {
  const energy = {
    protein: amounts.proteinGrams * macroEnergyFactors.protein,
    carbohydrate: amounts.carbohydrateGrams * macroEnergyFactors.carbohydrate,
    fat: amounts.fatGrams * macroEnergyFactors.fat,
  };
  const total = energy.protein + energy.carbohydrate + energy.fat;
  if (total === 0) return null;
  return {
    protein: roundPercent(energy.protein / total),
    carbohydrate: roundPercent(energy.carbohydrate / total),
    fat: roundPercent(energy.fat / total),
  };
}

/** Every calendar date from `from` to `to`, both included. */
export function listDates(from: string, to: string) {
  const start = Date.parse(`${from}T00:00:00.000Z`);
  const end = Date.parse(`${to}T00:00:00.000Z`);
  const dates: string[] = [];
  for (let time = start; time <= end; time += millisecondsPerDay) {
    dates.push(new Date(time).toISOString().slice(0, 10));
  }
  return dates;
}

function emptyAmounts(): NutrientAmounts {
  return {
    energyKcal: 0,
    proteinGrams: 0,
    carbohydrateGrams: 0,
    addedSugarGrams: 0,
    fatGrams: 0,
  };
}

function addAmounts(target: NutrientAmounts, amounts: NutrientAmounts) {
  for (const nutrient of productNutrients) target[nutrient] += amounts[nutrient];
}

function divideAmounts(amounts: NutrientAmounts, divisor: number): NutrientAmounts {
  const result = emptyAmounts();
  for (const nutrient of productNutrients) result[nutrient] = amounts[nutrient] / divisor;
  return result;
}

function roundAmounts(amounts: NutrientAmounts): NutrientAmounts {
  const result = emptyAmounts();
  for (const nutrient of productNutrients) {
    result[nutrient] = Math.round(amounts[nutrient] * 100) / 100;
  }
  return result;
}

function roundPercent(value: number) {
  return Math.round(value * 1000) / 10;
}
