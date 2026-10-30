import assert from "node:assert/strict";
import test from "node:test";
import type { AssistantExtractionInput } from "@openmonetis/validators/assistant";
import { type AssistantRepository, createAssistantService } from "./assistant.service";
import type { InboxReceiptDraft } from "./whatsapp-capture.service";

const userId = "00000000-0000-4000-8000-000000000001";
const productId = "00000000-0000-4000-8000-000000000010";

function createFakes() {
  const messages = new Map<string, string>();
  const drafts = new Map<string, InboxReceiptDraft>();
  const measurementDrafts = new Map<string, unknown>();
  const repository: AssistantRepository = {
    loadCatalog: async () => ({
      products: [
        {
          id: productId,
          name: "Monster 473 mL",
          aliases: ["ENERG MONSTER"],
          contentUnit: "milliliter",
        },
      ],
      stores: [],
    }),
    ensureProcessedMessage: async (_userId, message) => {
      const id = messages.get(message.externalId) ?? `message-${messages.size + 1}`;
      messages.set(message.externalId, id);
      return id;
    },
    // Same keys as the real tables: the client id and the message id.
    createDrafts: async (_userId, _messageId, created) => {
      for (const draft of created) {
        if (!drafts.has(draft.item.clientId)) drafts.set(draft.item.clientId, draft);
      }
    },
    createMeasurementDraft: async (_userId, messageId, draft) => {
      if (!measurementDrafts.has(messageId)) measurementDrafts.set(messageId, draft);
    },
    listLatestMeasurements: async () => [],
  };
  const service = createAssistantService(repository, {
    loadExtractionPrompt: async () => "Leia a mensagem.",
  });
  return { service, messages, drafts, measurementDrafts };
}

function input(overrides: Partial<AssistantExtractionInput["extraction"]> = {}) {
  return {
    externalId: "wamid-1",
    senderNumber: "5531999998888",
    kind: "image",
    text: "nf mercado",
    receivedAt: "2026-10-30T12:00:00.000Z",
    extraction: {
      receipts: [],
      measurements: null,
      question: null,
      warnings: [],
      notice: null,
      ...overrides,
    },
  } satisfies AssistantExtractionInput;
}

const receipt = {
  storeName: "DMA",
  storeBranch: null,
  storeNeighborhood: null,
  storeAddress: null,
  storeSuggestionId: null,
  purchasedAt: "2026-10-29T18:30:00-03:00",
  paymentMethod: null,
  amount: 9.5,
  items: [
    {
      extractedName: "ENERG MONSTER",
      packageCount: 1,
      totalContent: null,
      paidAmount: 9.5,
      discountAmount: 0,
      productSuggestionId: null,
    },
  ],
  warnings: [],
} as unknown as AssistantExtractionInput["extraction"]["receipts"][number];

test("exposes only what Claude needs from the catalog", async () => {
  const { service } = createFakes();
  assert.deepEqual(await service.catalog(userId), {
    products: [
      { id: productId, name: "Monster 473 mL", aliases: ["ENERG MONSTER"], unit: "milliliter" },
    ],
    stores: [],
  });
});

test("hands out the prompt and the format of the extraction", async () => {
  const { service } = createFakes();
  const template = await service.extractionTemplate();
  assert.equal(template.prompt, "Leia a mensagem.");
  assert.equal(template.outputSchema.type, "object");
  assert.ok("receipts" in (template.outputSchema.properties as object));
});

test("turns an extraction into drafts and matches products by name", async () => {
  const { service, drafts } = createFakes();
  const { reply } = await service.recordExtraction(userId, input({ receipts: [receipt] }));
  const [draft] = [...drafts.values()];
  assert.equal(draft?.item.clientId, "wpp_wamid-1_0");
  assert.equal(draft?.lines[0]?.productId, productId);
  assert.match(reply, /DMA/);
});

test("delivering the same message twice creates nothing new", async () => {
  const { service, drafts, measurementDrafts, messages } = createFakes();
  const repeated = input({
    receipts: [receipt],
    measurements: {
      measuredOn: "2026-10-30",
      entries: [{ kind: "weight", value: 82.4 }],
    } as unknown as AssistantExtractionInput["extraction"]["measurements"],
  });
  await service.recordExtraction(userId, repeated);
  await service.recordExtraction(userId, repeated);
  assert.equal(messages.size, 1);
  assert.equal(drafts.size, 1);
  assert.equal(measurementDrafts.size, 1);
});

test("says a question was not answered instead of ignoring it", async () => {
  const { service } = createFakes();
  const { reply } = await service.recordExtraction(userId, input({ question: "Quanto gastei?" }));
  assert.match(reply, /Não consegui responder/);
});
