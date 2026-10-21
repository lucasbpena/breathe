import {
  type BodyMeasurementEntry,
  summarizeBodyMeasurements,
} from "@openmonetis/domain/body-measurements";
import type { ProductContentUnit } from "@openmonetis/domain/products";
import { formatDateInBrazil, getCurrentDateInBrazil } from "@openmonetis/shared/date-time";
import type { NutritionIntakeOutput } from "@openmonetis/validators/nutrition-intake";
import { MessageAnswerSchema } from "@openmonetis/validators/receipt-capture";
import {
  type CapturedInMessage,
  CaptureError,
  type ClaudeExtractionRunner,
} from "./whatsapp-capture.service";

export type WhatsAppAnswerRepository = {
  listTransactions(
    userId: string,
    from: string,
    limit: number,
  ): Promise<
    {
      date: string;
      name: string;
      amount: string;
      type: string;
      category: string | null;
      parentCategory: string | null;
      paymentMethod: string | null;
    }[]
  >;
  listPurchases(
    userId: string,
    from: string,
    limit: number,
  ): Promise<
    {
      date: string;
      product: string;
      contentUnit: ProductContentUnit;
      store: string;
      storeBranch: string | null;
      packageCount: string | null;
      totalContent: string;
      paidAmount: string;
    }[]
  >;
  listProducts(userId: string): Promise<
    {
      name: string;
      contentUnit: ProductContentUnit;
      packageContent: string | null;
      energyKcal: string | null;
      proteinGrams: string | null;
      carbohydrateGrams: string | null;
      addedSugarGrams: string | null;
      fatGrams: string | null;
    }[]
  >;
};

const transactionDays = 120;
const purchaseDays = 180;
const nutritionDays = 30;
const rowLimit = 500;

/**
 * Answers questions sent on WhatsApp from a read-only snapshot of the user's data. Claude gets no
 * tools, so the answer can only describe the data, never change it.
 */
export function createWhatsAppAnswerService(
  repository: WhatsAppAnswerRepository,
  options: {
    userId: string;
    runAnswer: ClaudeExtractionRunner;
    listMeasurements: (userId: string) => Promise<BodyMeasurementEntry[]>;
    getNutritionIntake: (
      userId: string,
      period: { from: string; to: string },
    ) => Promise<NutritionIntakeOutput>;
  },
) {
  const { userId } = options;

  async function buildContext(today: string) {
    const [transactions, purchases, products, measurements, nutrition] = await Promise.all([
      repository.listTransactions(userId, shiftDate(today, -transactionDays), rowLimit),
      repository.listPurchases(userId, shiftDate(today, -purchaseDays), rowLimit),
      repository.listProducts(userId),
      options.listMeasurements(userId),
      options.getNutritionIntake(userId, {
        from: shiftDate(today, -(nutritionDays - 1)),
        to: today,
      }),
    ]);
    return {
      notes: {
        amounts: "BRL; transactions with a negative amount are money going out",
        transactionsSince: shiftDate(today, -transactionDays),
        purchasesSince: shiftDate(today, -purchaseDays),
        nutrition: "estimated from purchased items, each counted on its purchase day",
      },
      transactions: transactions.map(({ parentCategory, ...row }) => ({
        ...row,
        category: parentCategory ? `${parentCategory} › ${row.category}` : row.category,
        amount: Number(row.amount),
      })),
      purchases: purchases.map((row) => ({
        date: row.date,
        product: row.product,
        store: [row.store, row.storeBranch].filter(Boolean).join(" "),
        units: row.packageCount === null ? null : Number(row.packageCount),
        content: row.contentUnit === "package" ? null : Number(row.totalContent),
        contentUnit:
          row.contentUnit === "gram" ? "g" : row.contentUnit === "milliliter" ? "mL" : null,
        paid: Number(row.paidAmount),
      })),
      products: products.map((product) => ({
        name: product.name,
        unit: product.contentUnit,
        packageContent: toNumber(product.packageContent),
        nutritionPer: product.contentUnit === "package" ? "unit" : "100 g/mL",
        energyKcal: toNumber(product.energyKcal),
        proteinGrams: toNumber(product.proteinGrams),
        carbohydrateGrams: toNumber(product.carbohydrateGrams),
        addedSugarGrams: toNumber(product.addedSugarGrams),
        fatGrams: toNumber(product.fatGrams),
      })),
      bodyMeasurements: summarizeBodyMeasurements(measurements)
        .filter((trend) => trend.history.length > 0)
        .map((trend) => ({
          kind: trend.kind,
          unit: trend.unit === "kilogram" ? "kg" : "cm",
          latest: trend.latest
            ? { measuredOn: trend.latest.measuredOn, value: trend.latest.value }
            : null,
          change: trend.change,
          totalChange: trend.totalChange,
          history: trend.history.slice(-12).map(({ measuredOn, value }) => ({ measuredOn, value })),
        })),
      nutritionLast30Days: {
        from: nutrition.from,
        to: nutrition.to,
        totals: nutrition.totals,
        dailyAverage: nutrition.dailyAverage,
        energyShare: nutrition.energyShare,
        linesWithoutCalories: nutrition.linesWithoutCalories,
        topProducts: nutrition.products.slice(0, 10),
      },
    };
  }

  return {
    async answer(question: string, receivedAt: Date, captured?: CapturedInMessage) {
      const today = getCurrentDateInBrazil(receivedAt);
      const context = await buildContext(today);
      const weekday = formatDateInBrazil(receivedAt, { weekday: "long" });
      const raw = await options.runAnswer({
        image: null,
        text: [
          `<hoje>${today} (${weekday})</hoje>`,
          "<dados>",
          JSON.stringify(context),
          "</dados>",
          ...(captured && (captured.measurements || captured.receipts.length)
            ? [
                "<registrado_nesta_mensagem>",
                JSON.stringify(captured),
                "</registrado_nesta_mensagem>",
              ]
            : []),
          "<pergunta>",
          question,
          "</pergunta>",
        ].join("\n"),
      });
      const parsed = MessageAnswerSchema.safeParse(raw);
      if (!parsed.success) throw new CaptureError("invalid_answer", true);
      return parsed.data.answer;
    },
  };
}

function toNumber(value: string | null) {
  return value === null ? null : Number(value);
}

/** Calendar arithmetic on YYYY-MM-DD dates, independent of the host time zone. */
export function shiftDate(date: string, days: number) {
  const shifted = new Date(`${date}T12:00:00.000Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

export type WhatsAppAnswerService = ReturnType<typeof createWhatsAppAnswerService>;
