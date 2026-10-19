import type { AccountOutput } from "@openmonetis/validators/accounts";
import type { CardOutput } from "@openmonetis/validators/cards";
import type { InboxItemSummaryOutput } from "@openmonetis/validators/inbox";
import type { InboxRuleSuggestionOutput } from "@openmonetis/validators/inbox-rules";

import type { TransactionCreateDefaults } from "@/features/transactions/components/transaction-form.validation";

import { getInboxPurchaseDate, getInboxSourceMatch } from "../inbox.presentation";

export function getProcessDefaults(
  item: InboxItemSummaryOutput,
  accounts: AccountOutput[],
  cards: CardOutput[],
  suggestion: InboxRuleSuggestionOutput | null,
): TransactionCreateDefaults {
  const sourceMatch = getInboxSourceMatch(item.sourceAppName, accounts, cards);
  const matchedCardId = sourceMatch?.kind === "card" ? sourceMatch.id : undefined;
  const matchedAccountId = sourceMatch?.kind === "account" ? sourceMatch.id : undefined;
  const fallbackAccountId = accounts.find((candidate) => !candidate.isArchived)?.id;
  const receipt = item.receipt;
  // A receipt read from WhatsApp knows how it was paid; a notification only knows its app.
  const paymentMethod = receipt?.paymentMethod ?? (matchedCardId ? "credit_card" : "pix");
  const usesCard = paymentMethod === "credit_card";

  return {
    name: item.parsedName ?? "",
    amount: item.parsedAmount === null ? "" : String(item.parsedAmount),
    purchaseDate: getInboxPurchaseDate(item.notificationTimestamp),
    paymentMethod,
    cardId: usesCard ? matchedCardId : undefined,
    accountId: usesCard ? undefined : (matchedAccountId ?? fallbackAccountId),
    categoryId: suggestion?.categoryId ?? undefined,
    personId: suggestion?.personId ?? undefined,
    purchases: receipt?.lines.map((line) => ({
      productId: line.productId ?? "",
      storeId: receipt.storeId ?? "",
      extractedName: line.extractedName,
      packageCount: line.packageCount,
      totalContent: line.totalContent,
      paidAmount: line.paidAmount,
      discountAmount: line.discountAmount,
    })),
  };
}
