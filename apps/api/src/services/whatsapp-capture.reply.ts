import {
  type BodyMeasurementKind,
  getBodyMeasurementUnit,
} from "@openmonetis/domain/body-measurements";
import type { ProductContentUnit } from "@openmonetis/domain/products";
import type { ReconciledReceipt } from "@openmonetis/domain/receipt-capture";
import type { PaymentMethod } from "@openmonetis/domain/transactions";
import { dateOnlyToSafeInstant, formatDateInBrazil } from "@openmonetis/shared/date-time";
import type { WhatsAppCaptureCatalog } from "./whatsapp-capture.service";

const paymentMethodLabels: Record<PaymentMethod, string> = {
  credit_card: "Cartão de crédito",
  debit_card: "Cartão de débito",
  pix: "Pix",
  cash: "Dinheiro",
  boleto: "Boleto",
  benefits: "Benefícios",
  bank_transfer: "Transferência bancária",
};

const contentSymbols: Record<ProductContentUnit, string> = {
  gram: "g",
  milliliter: "mL",
  package: "un",
};

const measurementLabels: Record<BodyMeasurementKind, string> = {
  weight: "Peso",
  neck: "Pescoço",
  shoulders: "Ombros",
  chest: "Peitoral",
  waist: "Cintura",
  abdomen: "Abdômen",
  hips: "Quadril",
  leftArm: "Braço esquerdo",
  rightArm: "Braço direito",
  leftForearm: "Antebraço esquerdo",
  rightForearm: "Antebraço direito",
  leftThigh: "Coxa esquerda",
  rightThigh: "Coxa direita",
  leftCalf: "Panturrilha esquerda",
  rightCalf: "Panturrilha direita",
};

const failureMessages: Record<string, string> = {
  media_unsupported: "Esse tipo de imagem não é aceito. Mande uma foto em JPG ou PNG.",
  media_too_large: "A imagem passa de 10 MB. Mande uma foto menor.",
  media_unavailable: "Não consegui baixar a imagem do WhatsApp.",
  invalid_extraction: "A leitura voltou num formato inválido.",
  claude_timeout: "A leitura demorou demais.",
};

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const quantity = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 });

export const unsupportedMessageReply =
  "Por enquanto só leio fotos e mensagens de texto: notas fiscais, gastos, peso, medidas e perguntas.";

export type MeasurementReply = {
  measuredOn: string;
  entries: { kind: BodyMeasurementKind; value: number }[];
  implausible: { kind: BodyMeasurementKind; value: number }[];
  warnings: string[];
  /** Latest saved value per kind, shown next to the new one. */
  latest: Map<BodyMeasurementKind, { value: number; measuredOn: string }>;
};

/**
 * One WhatsApp reply for everything a message carried: the answer to a question, the receipts
 * sent to the inbox and the measurements waiting in Físico → Corpo.
 */
export function formatMessageReply(input: {
  answer: string | null;
  answerFailed: boolean;
  receipts: ReconciledReceipt[];
  catalog: WhatsAppCaptureCatalog;
  measurements: MeasurementReply | null;
  warnings: string[];
  notice: string | null;
}) {
  const sections: string[] = [];
  if (input.answer) sections.push(input.answer);
  if (input.answerFailed) sections.push("Não consegui responder à pergunta agora. Tente de novo.");
  if (input.receipts.length) sections.push(formatCaptureReply(input.receipts, input.catalog));
  if (input.measurements) sections.push(formatMeasurementReply(input.measurements));
  const warnings = input.measurements ? [] : input.warnings;
  if (warnings.length) sections.push(warnings.map((warning) => `⚠️ ${warning}`).join("\n"));
  if (!sections.length) return formatNothingFoundReply(input.notice);
  return sections.join("\n\n");
}

export function formatNothingFoundReply(notice: string | null) {
  return [
    "Não encontrei gasto, medida nem pergunta nessa mensagem.",
    notice ? `Motivo: ${notice}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export function formatMeasurementReply(measurements: MeasurementReply) {
  const lines = measurements.entries.map((entry) => {
    const latest = measurements.latest.get(entry.kind);
    const previous = latest
      ? ` (última: ${formatMeasurementValue(entry.kind, latest.value)} em ${formatShortDate(latest.measuredOn)})`
      : "";
    return `• ${measurementLabels[entry.kind]}: ${formatMeasurementValue(entry.kind, entry.value)}${previous}`;
  });
  const warnings = [
    ...measurements.implausible.map(
      (entry) =>
        `${measurementLabels[entry.kind]} ${formatMeasurementValue(entry.kind, entry.value)} parece errado e ficou de fora.`,
    ),
    ...measurements.warnings,
  ].map((warning) => `⚠️ ${warning}`);
  return [
    `📏 *Medidas lidas* · ${formatShortDate(measurements.measuredOn, true)}`,
    ...lines,
    ...warnings,
    measurements.entries.length
      ? "Confirme em *Físico → Corpo* no Breathe."
      : "Nenhuma medida ficou pendente.",
  ].join("\n");
}

function formatMeasurementValue(kind: BodyMeasurementKind, value: number) {
  return `${quantity.format(value)} ${getBodyMeasurementUnit(kind) === "kilogram" ? "kg" : "cm"}`;
}

function formatShortDate(value: string, withYear = false) {
  return formatDateInBrazil(dateOnlyToSafeInstant(value), {
    day: "2-digit",
    month: "2-digit",
    ...(withYear ? { year: "numeric" as const } : {}),
  });
}

export function formatFailureReply(code: string) {
  return [
    "Não consegui ler essa mensagem.",
    failureMessages[code] ?? "Algo deu errado do lado do Breathe.",
    "Tente mandar de novo.",
  ].join(" ");
}

/** WhatsApp text listing what was read from each receipt, matched against the user's catalog. */
export function formatCaptureReply(receipts: ReconciledReceipt[], catalog: WhatsAppCaptureCatalog) {
  const products = new Map(catalog.products.map((product) => [product.id, product]));
  const blocks = receipts.map((receipt, index) => {
    const header = [
      receipts.length > 1 ? `🧾 *Nota ${index + 1} de ${receipts.length}*` : "🧾 *Nota lida*",
      formatStore(receipt),
    ].join(" · ");
    const summary = [
      formatPurchasedAt(receipt.purchasedAt),
      receipt.paymentMethod ? paymentMethodLabels[receipt.paymentMethod] : "Pagamento não lido",
      receipt.amount === null ? "Total não lido" : `*${money.format(receipt.amount)}*`,
    ].join(" · ");
    const lines = receipt.items.map((item) => {
      const product = item.productId ? products.get(item.productId) : undefined;
      const amount = [formatQuantity(item, product?.contentUnit), money.format(item.paidAmount)]
        .filter(Boolean)
        .join(" · ");
      const match = product ? `→ ${product.name} ✓` : "→ produto novo";
      return `• ${item.extractedName} — ${amount} ${match}`;
    });
    const warnings = [
      receipt.totalMismatch
        ? `Os itens somam ${money.format(receipt.itemsAmount)}, mas o total da nota é ${money.format(receipt.amount ?? 0)}.`
        : null,
      receipt.storeName && receipt.storeMatch === "none" ? "Loja nova: cadastre na revisão." : null,
      ...receipt.warnings,
    ]
      .filter((warning): warning is string => Boolean(warning))
      .map((warning) => `⚠️ ${warning}`);
    return [header, summary, ...lines, ...warnings].join("\n");
  });

  return [...blocks, "Despesas pendentes de revisão na *Caixa de entrada* do Breathe."].join(
    "\n\n",
  );
}

function formatStore(receipt: ReconciledReceipt) {
  const name = [receipt.storeName, receipt.storeBranch].filter(Boolean).join(" ");
  if (!name) return "Loja não lida";
  return receipt.storeNeighborhood ? `${name} (${receipt.storeNeighborhood})` : name;
}

function formatPurchasedAt(value: string | null) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "Data não lida";
  return formatDateInBrazil(date, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatQuantity(
  item: { packageCount: number | null; totalContent: number | null },
  unit: ProductContentUnit | undefined,
) {
  if (item.totalContent !== null && item.packageCount === null) {
    return `${quantity.format(item.totalContent)} ${unit && unit !== "package" ? contentSymbols[unit] : "g/mL"}`;
  }
  return item.packageCount === null ? null : `${quantity.format(item.packageCount)} un`;
}
