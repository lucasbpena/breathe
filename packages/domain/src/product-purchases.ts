import { calculateNormalizedPrice, type ProductContentUnit } from "./products";

export type PurchaseQuantity = {
  packageCount: number | null;
  totalContent: number;
};

export type PurchasePrices = {
  paidAmount: number;
  listAmount: number;
  pricePerPackage: number | null;
  normalizedPrice: number;
};

export type TransactionPurchasesSummary = {
  transactionAmount: number;
  itemsAmount: number;
  remainingAmount: number;
};

/**
 * Resolves how much content a purchase line holds. Products without metragem are counted by
 * packages. With grams or milliliters, the total metragem wins when given (bulk items such as
 * 1430 g of potatoes); otherwise it is the package count times the package metragem. Returns
 * null when the quantity cannot be derived.
 */
export function resolvePurchaseQuantity(input: {
  contentUnit: ProductContentUnit;
  packageContent: number | string | null;
  packageCount: number | null;
  totalContent: number | null;
}): PurchaseQuantity | null {
  if (input.contentUnit === "package") {
    return input.packageCount === null
      ? null
      : { packageCount: input.packageCount, totalContent: input.packageCount };
  }
  if (input.totalContent !== null) {
    return { packageCount: input.packageCount, totalContent: roundContent(input.totalContent) };
  }
  if (input.packageCount === null || input.packageContent === null) return null;

  return {
    packageCount: input.packageCount,
    totalContent: roundContent(input.packageCount * Number(input.packageContent)),
  };
}

/** The paid amount already has the line discount applied; the list amount adds it back. */
export function calculatePurchasePrices(input: {
  contentUnit: ProductContentUnit;
  paidAmount: number | string;
  discountAmount: number | string;
  packageCount: number | string | null;
  totalContent: number | string;
}): PurchasePrices {
  const paidCents = toCents(input.paidAmount);
  const packageCount = input.packageCount === null ? null : Number(input.packageCount);

  return {
    paidAmount: paidCents / 100,
    listAmount: (paidCents + toCents(input.discountAmount)) / 100,
    pricePerPackage: packageCount ? Math.round(paidCents / packageCount) / 100 : null,
    normalizedPrice: calculateNormalizedPrice(
      input.paidAmount,
      input.totalContent,
      input.contentUnit,
    ),
  };
}

/** Compares the receipt lines with the expense amount; the remainder may be negative. */
export function summarizeTransactionPurchases(
  transactionAmount: number | string,
  purchases: readonly { paidAmount: number | string }[],
): TransactionPurchasesSummary {
  const transactionCents = Math.abs(toCents(transactionAmount));
  const itemsCents = purchases.reduce((total, purchase) => total + toCents(purchase.paidAmount), 0);

  return {
    transactionAmount: transactionCents / 100,
    itemsAmount: itemsCents / 100,
    remainingAmount: (transactionCents - itemsCents) / 100,
  };
}

function roundContent(value: number) {
  return Math.round(value * 1000) / 1000;
}

function toCents(value: number | string) {
  return Math.round(Number(value) * 100);
}
