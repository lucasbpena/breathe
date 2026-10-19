import { getInboxSourceNameMatchScore } from "@openmonetis/domain/inbox";
import {
  dateOnlyToSafeInstant,
  differenceInCalendarDaysFromTodayInBrazil,
  formatDateInBrazil,
  getBrazilDateParts,
  getCurrentDateInBrazil,
} from "@openmonetis/shared/date-time";
import type { AccountOutput } from "@openmonetis/validators/accounts";
import type { CardOutput } from "@openmonetis/validators/cards";
import type { InboxItemSummaryOutput } from "@openmonetis/validators/inbox";

export type InboxSourceMatch = {
  id: string;
  kind: "account" | "card";
  logo: string | null;
  name: string;
};

type InboxDateGroup = {
  dateKey: string;
  items: InboxItemSummaryOutput[];
  label: string;
};

export const inboxStatusLabels = {
  pending: "Pendentes",
  processed: "Confirmados",
  discarded: "Descartados",
} as const;

export function formatInboxAmount(value: number | null) {
  if (value === null) return null;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function formatInboxTimestamp(value: string) {
  return formatDateInBrazil(new Date(value), {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatInboxTime(value: string) {
  return formatDateInBrazil(new Date(value), {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getInboxPurchaseDate(value: string) {
  return getCurrentDateInBrazil(new Date(value));
}

export function formatInboxFilterDate(value: string, now = new Date()) {
  return getInboxDateGroupLabel(value, now);
}

export function groupInboxItemsByDate(
  items: InboxItemSummaryOutput[],
  now = new Date(),
): InboxDateGroup[] {
  const groups = new Map<string, InboxItemSummaryOutput[]>();
  for (const item of items) {
    const key = getInboxDateKey(item.notificationTimestamp);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([dateKey, groupItems]) => ({
      dateKey,
      items: groupItems,
      label: getInboxDateGroupLabel(dateKey, now),
    }));
}

export function getInboxItemTitle(item: InboxItemSummaryOutput) {
  return item.parsedName ?? "Notificação financeira";
}

export function getInboxSourceInitials(value: string | null) {
  if (!value) return "APP";
  return value
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase("pt-BR");
}

export function getInboxSourceMatch(
  sourceAppName: string | null,
  accounts: AccountOutput[],
  cards: CardOutput[],
): InboxSourceMatch | null {
  if (!sourceAppName) return null;

  const cardMatch = getBestSourceMatch(
    sourceAppName,
    cards.filter((card) => card.status === "active"),
  );
  const accountMatch = getBestSourceMatch(
    sourceAppName,
    accounts.filter((account) => !account.isArchived),
  );

  if (cardMatch.score === 0 && accountMatch.score === 0) return null;
  if (cardMatch.score >= accountMatch.score && cardMatch.entity) {
    const matchedCard = cardMatch.entity;
    return {
      id: matchedCard.id,
      kind: "card",
      logo: matchedCard.logo,
      name: matchedCard.name,
    };
  }

  const matchedAccount = accountMatch.entity;
  if (!matchedAccount) return null;
  return {
    id: matchedAccount.id,
    kind: "account",
    logo: matchedAccount.logo,
    name: matchedAccount.name,
  };
}

function getBestSourceMatch<T extends { name: string }>(sourceName: string, entities: T[]) {
  return entities.reduce<{ entity: T | null; score: number }>(
    (best, entity) => {
      const score = getInboxSourceNameMatchScore(sourceName, entity.name);
      return score > best.score ? { entity, score } : best;
    },
    { entity: null, score: 0 },
  );
}

function getInboxDateKey(value: string) {
  const { day, month, year } = getBrazilDateParts(new Date(value));
  return `${year}-${month}-${day}`;
}

function getInboxDateGroupLabel(dateKey: string, now: Date) {
  const difference = differenceInCalendarDaysFromTodayInBrazil(dateKey, now);
  if (difference === 0) return "Hoje";
  if (difference === -1) return "Ontem";

  const currentYear = getCurrentDateInBrazil(now).slice(0, 4);
  return formatDateInBrazil(dateOnlyToSafeInstant(dateKey), {
    day: "numeric",
    month: "long",
    year: dateKey.startsWith(currentYear) ? undefined : "numeric",
  });
}

type InboxReceipt = NonNullable<InboxItemSummaryOutput["receipt"]>;

/** Counts behind the receipt badges: what is ready to save and what still needs a product. */
export function summarizeInboxReceipt(receipt: InboxReceipt) {
  const matched = receipt.lines.filter((line) => line.productId !== null).length;
  return {
    lineCount: receipt.lines.length,
    matched,
    unmatched: receipt.lines.length - matched,
    newStore: receipt.storeId === null,
  };
}

export function formatInboxReceiptLines(receipt: InboxReceipt) {
  const { lineCount, matched } = summarizeInboxReceipt(receipt);
  if (lineCount === 0) return "Sem itens";
  const items = lineCount === 1 ? "1 item" : `${lineCount} itens`;
  if (matched === lineCount) return `${items}, todos reconhecidos`;
  if (matched === 0) return `${items}, nenhum reconhecido`;
  return `${items}, ${matched} reconhecido${matched === 1 ? "" : "s"}`;
}

export function formatInboxReceiptStore(receipt: InboxReceipt) {
  const name = [receipt.storeName, receipt.storeBranch].filter(Boolean).join(" ");
  if (!name) return null;
  return receipt.storeNeighborhood ? `${name} · ${receipt.storeNeighborhood}` : name;
}

/** Warnings shown with the capture, including the total check done by the API. */
export function getInboxReceiptWarnings(receipt: InboxReceipt, amount: number | null) {
  return [
    receipt.totalMismatch && amount !== null
      ? `Os itens somam ${formatInboxAmount(receipt.itemsAmount)}, mas o total da nota é ${formatInboxAmount(amount)}.`
      : null,
    ...receipt.warnings,
  ].filter((warning): warning is string => Boolean(warning));
}
