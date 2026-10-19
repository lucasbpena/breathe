import { createProductNameKey } from "./products";
import { createStoreNameKey } from "./stores";
import type { PaymentMethod } from "./transactions";

/** Captured messages land in the inbox under this source, next to the Companion notifications. */
export const whatsappCaptureSourceApp = "whatsapp";
export const whatsappCaptureSourceAppName = "WhatsApp";

export const whatsappMessageKinds = ["image", "text", "unsupported"] as const;
export type WhatsAppMessageKind = (typeof whatsappMessageKinds)[number];

export const whatsappMessageStatuses = ["pending", "processed", "failed", "ignored"] as const;
export type WhatsAppMessageStatus = (typeof whatsappMessageStatuses)[number];

export const whatsappCaptureMaximumMediaBytes = 10 * 1024 * 1024;
export const whatsappCaptureMaximumAttempts = 3;
export const whatsappCaptureMaximumTextLength = 4000;
export const receiptMaximumLines = 100;

export const receiptMatchSources = ["name", "suggestion", "none"] as const;
export type ReceiptMatchSource = (typeof receiptMatchSources)[number];

export type WhatsAppMessageKey = {
  remoteJid?: string | null;
  remoteJidAlt?: string | null;
  senderPn?: string | null;
  fromMe?: boolean | null;
};

export function normalizeWhatsAppNumber(value: string) {
  return value.replace(/\D/g, "");
}

/**
 * Brazilian mobiles gained a ninth digit after many WhatsApp accounts were created, so the same
 * phone can show up as 55 DD 9XXXX-XXXX or as 55 DD XXXX-XXXX.
 */
export function listWhatsAppNumberVariants(value: string) {
  const number = normalizeWhatsAppNumber(value);
  if (!number.startsWith("55")) return [number];
  if (number.length === 13 && number[4] === "9")
    return [number, number.slice(0, 4) + number.slice(5)];
  if (number.length === 12) return [number, `${number.slice(0, 4)}9${number.slice(4)}`];
  return [number];
}

function phoneFromJid(jid: string | null | undefined) {
  if (!jid) return null;
  const [user, server] = jid.split("@");
  if (server !== "s.whatsapp.net" || !user) return null;
  return normalizeWhatsAppNumber(user.split(":")[0] ?? "");
}

/**
 * The number that sent a message received in a direct chat, when it is the configured one.
 * Messages sent by the instance itself and group messages never match.
 */
export function findSelfSender(key: WhatsAppMessageKey, selfNumber: string) {
  if (key.fromMe !== false || key.remoteJid?.endsWith("@g.us")) return null;
  const accepted = new Set(listWhatsAppNumberVariants(selfNumber));
  for (const jid of [key.remoteJid, key.remoteJidAlt, key.senderPn]) {
    const phone = phoneFromJid(jid);
    if (phone && accepted.has(phone)) return phone;
  }
  return null;
}

export type ExtractedReceiptLine = {
  extractedName: string;
  packageCount: number | null;
  totalContent: number | null;
  paidAmount: number;
  discountAmount: number;
  productId: string | null;
};

export type ExtractedReceipt = {
  storeName: string | null;
  storeBranch: string | null;
  storeNeighborhood: string | null;
  storeAddress: string | null;
  storeId: string | null;
  purchasedAt: string | null;
  paymentMethod: PaymentMethod | null;
  totalAmount: number | null;
  items: ExtractedReceiptLine[];
  warnings: string[];
};

export type CaptureCatalog = {
  products: { id: string; name: string; aliases: string[] }[];
  stores: { id: string; name: string; branch: string | null }[];
};

export type ReconciledReceiptLine = ExtractedReceiptLine & { productMatch: ReceiptMatchSource };

export type ReconciledReceipt = Omit<ExtractedReceipt, "items"> & {
  storeMatch: ReceiptMatchSource;
  items: ReconciledReceiptLine[];
  itemsAmount: number;
  /** Total of the receipt, or the sum of its items when the total could not be read. */
  amount: number | null;
  /** True when the receipt total was read and the items add up to something else. */
  totalMismatch: boolean;
};

/**
 * Applies the user's own catalog to what Claude read. An exact name or alias wins over Claude's
 * guess, and a guessed id only survives when it belongs to the catalog, so nothing outside the
 * user's data can reach a draft.
 */
export function reconcileReceipt(
  receipt: ExtractedReceipt,
  catalog: CaptureCatalog,
): ReconciledReceipt {
  const productIdsByKey = new Map<string, string>();
  for (const product of catalog.products) {
    productIdsByKey.set(createProductNameKey(product.name), product.id);
    for (const alias of product.aliases)
      productIdsByKey.set(createProductNameKey(alias), product.id);
  }
  const productIds = new Set(catalog.products.map((product) => product.id));
  const storeIds = new Set(catalog.stores.map((store) => store.id));

  const items = receipt.items.map((item): ReconciledReceiptLine => {
    const byName = productIdsByKey.get(createProductNameKey(item.extractedName));
    if (byName) return { ...item, productId: byName, productMatch: "name" };
    if (item.productId && productIds.has(item.productId)) {
      return { ...item, productMatch: "suggestion" };
    }
    return { ...item, productId: null, productMatch: "none" };
  });

  const storeByName = receipt.storeName
    ? catalog.stores.find(
        (store) =>
          createStoreNameKey(store.name, store.branch) ===
          createStoreNameKey(receipt.storeName ?? "", receipt.storeBranch),
      )
    : undefined;
  const suggestedStore = receipt.storeId && storeIds.has(receipt.storeId) ? receipt.storeId : null;

  const itemsCents = items.reduce((sum, item) => sum + toCents(item.paidAmount), 0);
  const totalCents = receipt.totalAmount === null ? null : toCents(receipt.totalAmount);
  const amountCents = totalCents ?? (itemsCents > 0 ? itemsCents : null);

  return {
    ...receipt,
    storeId: storeByName?.id ?? suggestedStore,
    storeMatch: storeByName ? "name" : suggestedStore ? "suggestion" : "none",
    items,
    itemsAmount: itemsCents / 100,
    amount: amountCents === null ? null : amountCents / 100,
    totalMismatch: totalCents !== null && items.length > 0 && totalCents !== itemsCents,
  };
}

function toCents(value: number) {
  return Math.round(value * 100);
}
