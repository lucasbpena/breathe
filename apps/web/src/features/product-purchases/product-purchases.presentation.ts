import type { ProductContentUnit } from "@openmonetis/domain/products";
import type {
  ProductPurchaseOutput,
  ReplaceProductPurchaseInput,
  TransactionProductPurchasesOutput,
} from "@openmonetis/validators/product-purchases";
import { formatContent, formatPackageCount } from "../products/products.presentation";
import { getErrorCodeMessage } from "../stores/stores.presentation";

const purchaseErrorMessages: Record<string, string> = {
  purchase_quantity_required:
    "Informe a metragem total; este produto não tem metragem por unidade cadastrada.",
  transaction_not_expense: "Só é possível detalhar produtos em despesas.",
  transaction_not_found: "Lançamento não encontrado.",
  product_not_found: "Produto não encontrado.",
  store_not_found: "Loja não encontrada.",
  product_purchase_not_found: "Item não encontrado.",
};

export function getPurchaseErrorMessage(error: unknown, fallback: string) {
  return getErrorCodeMessage(error, purchaseErrorMessages) ?? fallback;
}

export function formatPurchaseQuantity(
  purchase: Pick<ProductPurchaseOutput, "packageCount" | "totalContent" | "contentUnit">,
) {
  if (purchase.contentUnit === "package") return formatPackageCount(purchase.totalContent);
  const metragem = formatContent(purchase.totalContent, purchase.contentUnit);
  return purchase.packageCount === null
    ? metragem
    : `${formatPackageCount(purchase.packageCount)} · ${metragem}`;
}

/** Draft lines only hold what was typed; the API derives the missing metragem when saving. */
export function formatDraftQuantity(
  line: Pick<ReplaceProductPurchaseInput, "packageCount" | "totalContent">,
  contentUnit: ProductContentUnit,
) {
  const parts: string[] = [];
  if (line.packageCount != null) parts.push(formatPackageCount(line.packageCount));
  if (contentUnit !== "package" && line.totalContent != null)
    parts.push(formatContent(line.totalContent, contentUnit));
  return parts.join(" · ");
}

/** A saved line back in the form: metragem derived from packages is left for the API. */
export function toPurchaseLine(purchase: ProductPurchaseOutput): ReplaceProductPurchaseInput {
  return {
    productId: purchase.productId,
    storeId: purchase.storeId,
    extractedName: purchase.extractedName,
    packageCount: purchase.packageCount,
    totalContent:
      purchase.contentUnit === "package" || purchase.packageCount !== null
        ? null
        : purchase.totalContent,
    paidAmount: purchase.paidAmount,
    discountAmount: purchase.discountAmount,
  };
}

/** New lines usually come from the same receipt, so they default to its store. */
export function getDefaultStoreId(items: readonly Pick<ProductPurchaseOutput, "storeId">[]) {
  return items.at(-1)?.storeId ?? "";
}

export function describeReceiptBalance(summary: TransactionProductPurchasesOutput["summary"]) {
  if (summary.remainingAmount === 0) return "complete" as const;
  return summary.remainingAmount > 0 ? ("missing" as const) : ("exceeding" as const);
}

/** A line read from a receipt that still has no product or store chosen by the user. */
export function isUnresolvedPurchase(
  line: Pick<ReplaceProductPurchaseInput, "productId" | "storeId">,
) {
  return !line.productId || !line.storeId;
}

export function hasUnresolvedPurchase(
  lines: readonly Pick<ReplaceProductPurchaseInput, "productId" | "storeId">[],
) {
  return lines.some(isUnresolvedPurchase);
}
