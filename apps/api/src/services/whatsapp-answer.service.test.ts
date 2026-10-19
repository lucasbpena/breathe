import assert from "node:assert/strict";
import test from "node:test";
import type { NutritionIntakeOutput } from "@openmonetis/validators/nutrition-intake";
import {
  createWhatsAppAnswerService,
  shiftDate,
  type WhatsAppAnswerRepository,
} from "./whatsapp-answer.service";
import { CaptureError } from "./whatsapp-capture.service";

const userId = "00000000-0000-4000-8000-000000000001";
const receivedAt = new Date("2026-10-19T15:00:00.000Z");

const nutrition: NutritionIntakeOutput = {
  from: "2026-09-20",
  to: "2026-10-19",
  dayCount: 30,
  totals: {
    energyKcal: 3000,
    proteinGrams: 100,
    carbohydrateGrams: 400,
    addedSugarGrams: 50,
    fatGrams: 90,
  },
  dailyAverage: {
    energyKcal: 100,
    proteinGrams: 3.33,
    carbohydrateGrams: 13.33,
    addedSugarGrams: 1.67,
    fatGrams: 3,
  },
  energyShare: { proteinGrams: 13.6, carbohydrateGrams: 54.4, fatGrams: 27.6 },
  days: [],
  products: [],
  lineCount: 4,
  linesWithoutCalories: 1,
} as unknown as NutritionIntakeOutput;

function setup(answer: unknown = { answer: "Você gastou *R$ 29,46*." }) {
  const calls: { method: string; from?: string; userId: string }[] = [];
  const requests: string[] = [];
  const repository: WhatsAppAnswerRepository = {
    async listTransactions(owner, from) {
      calls.push({ method: "transactions", from, userId: owner });
      return [
        {
          date: "2026-10-11",
          name: "DMA Distribuidora",
          amount: "-53.34",
          type: "expense",
          category: "Mercado",
          paymentMethod: "credit_card",
        },
      ];
    },
    async listPurchases(owner, from) {
      calls.push({ method: "purchases", from, userId: owner });
      return [
        {
          date: "2026-10-11",
          product: "Monster Tradicional 473 mL",
          contentUnit: "milliliter",
          store: "DMA Distribuidora",
          storeBranch: "Loja 014",
          packageCount: "1.000",
          totalContent: "473.000",
          paidAmount: "9.48",
        },
      ];
    },
    async listProducts(owner) {
      calls.push({ method: "products", userId: owner });
      return [];
    },
  };
  const service = createWhatsAppAnswerService(repository, {
    userId,
    runAnswer: async ({ text, image }) => {
      assert.equal(image, null);
      requests.push(text);
      return answer;
    },
    listMeasurements: async () => [
      { id: "a", kind: "weight", value: "83.00", measuredOn: "2026-10-12" },
      { id: "b", kind: "weight", value: "82.40", measuredOn: "2026-10-19" },
    ],
    getNutritionIntake: async (owner, period) => {
      calls.push({ method: "nutrition", from: period.from, userId: owner });
      assert.equal(period.to, "2026-10-19");
      return nutrition;
    },
  });
  return { service, calls, requests };
}

test("questions are answered from the user's recent data, read only", async () => {
  const { service, calls, requests } = setup();

  assert.equal(
    await service.answer("Quanto gastei com Monster em outubro?", receivedAt),
    "Você gastou *R$ 29,46*.",
  );
  assert.ok(calls.every((call) => call.userId === userId));
  assert.deepEqual(
    calls.filter((call) => call.from).map((call) => [call.method, call.from]),
    [
      ["transactions", "2026-06-21"],
      ["purchases", "2026-04-22"],
      ["nutrition", "2026-09-20"],
    ],
  );
  const request = requests[0] ?? "";
  assert.match(request, /^<hoje>2026-10-19 \(segunda-feira\)<\/hoje>/);
  assert.match(request, /<pergunta>\nQuanto gastei com Monster em outubro\?\n<\/pergunta>$/);
  const data = JSON.parse(request.split("\n")[2] ?? "{}");
  assert.equal(data.transactions[0].amount, -53.34);
  assert.deepEqual(data.purchases[0], {
    date: "2026-10-11",
    product: "Monster Tradicional 473 mL",
    store: "DMA Distribuidora Loja 014",
    units: 1,
    content: 473,
    contentUnit: "mL",
    paid: 9.48,
  });
  assert.deepEqual(data.bodyMeasurements, [
    {
      kind: "weight",
      unit: "kg",
      latest: { measuredOn: "2026-10-19", value: 82.4 },
      change: -0.6,
      totalChange: -0.6,
      history: [
        { measuredOn: "2026-10-12", value: 83 },
        { measuredOn: "2026-10-19", value: 82.4 },
      ],
    },
  ]);
  assert.equal(data.nutritionLast30Days.dailyAverage.energyKcal, 100);
});

test("records from the same message are handed to the answer", async () => {
  const { service, requests } = setup();
  await service.answer("Quanto perdi desde o dia 12?", receivedAt, {
    measurements: { measuredOn: "2026-10-18", entries: [{ kind: "weight", value: 81.9 }] },
    receipts: [],
  });
  assert.match(
    requests[0] ?? "",
    /<registrado_nesta_mensagem>\n\{"measurements":\{"measuredOn":"2026-10-18","entries":\[\{"kind":"weight","value":81\.9\}\]\},"receipts":\[\]\}\n<\/registrado_nesta_mensagem>/,
  );
});

test("an answer outside the schema is a transient failure", async () => {
  const { service } = setup({ answer: "" });
  await assert.rejects(
    service.answer("Qual meu peso?", receivedAt),
    (error) => error instanceof CaptureError && error.code === "invalid_answer" && error.transient,
  );
});

test("dates shift by calendar day across months and years", () => {
  assert.equal(shiftDate("2026-03-01", -1), "2026-02-28");
  assert.equal(shiftDate("2026-12-31", 1), "2027-01-01");
});
