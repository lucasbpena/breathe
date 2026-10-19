import assert from "node:assert/strict";
import test from "node:test";
import { createEvolutionGateway } from "./evolution";

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
}

test("messages are read from every page, oldest first, with their type and text", async () => {
  const calls: { url: string; body: unknown; apikey: string | null }[] = [];
  const pages = [
    [
      {
        key: { id: "b", fromMe: false, remoteJid: "553198765432@s.whatsapp.net" },
        messageType: "imageMessage",
        message: { imageMessage: { caption: "mercado", mimetype: "image/jpeg" } },
        messageTimestamp: 1_760_900_000,
      },
      { key: { id: "broken" }, messageTimestamp: "not a number" },
    ],
    [
      {
        key: {
          id: "a",
          fromMe: false,
          remoteJid: "123@lid",
          remoteJidAlt: "553198765432@s.whatsapp.net",
        },
        messageType: "conversation",
        message: { conversation: "pão 8,50" },
        messageTimestamp: "1760899000",
      },
      {
        key: { id: "c", fromMe: false, remoteJid: "553198765432@s.whatsapp.net" },
        messageType: "audioMessage",
        message: { audioMessage: {} },
        messageTimestamp: 1_760_900_100,
      },
    ],
  ];
  const gateway = createEvolutionGateway({
    baseUrl: "https://evolution.example/base/",
    apiKey: "secret",
    instance: "breathe bot",
    request: async (input, init) => {
      const body = JSON.parse(String(init?.body)) as { page: number };
      calls.push({
        url: String(input),
        body,
        apikey: new Headers(init?.headers).get("apikey"),
      });
      return jsonResponse({ messages: { pages: 2, records: pages[body.page - 1] } });
    },
  });

  const messages = await gateway.listMessages(
    new Date("2026-10-19T14:00:00.000Z"),
    new Date("2026-10-19T15:00:00.000Z"),
  );

  assert.equal(calls.length, 2);
  assert.equal(calls[0]?.url, "https://evolution.example/base/chat/findMessages/breathe%20bot");
  assert.equal(calls[0]?.apikey, "secret");
  assert.deepEqual(calls[0]?.body, {
    where: {
      messageTimestamp: { gte: "2026-10-19T14:00:00.000Z", lte: "2026-10-19T15:00:00.000Z" },
    },
    page: 1,
    offset: 50,
  });
  assert.deepEqual(
    messages.map((message) => [message.id, message.type, message.text]),
    [
      ["a", "text", "pão 8,50"],
      ["b", "image", "mercado"],
      ["c", "unsupported", null],
    ],
  );
  assert.equal(messages[0]?.key.remoteJidAlt, "553198765432@s.whatsapp.net");
});

test("media and replies use the instance endpoints", async () => {
  const paths: string[] = [];
  const gateway = createEvolutionGateway({
    baseUrl: "http://evolution.example:7777",
    apiKey: "secret",
    instance: "bot",
    request: async (input) => {
      const url = new URL(String(input));
      paths.push(url.pathname);
      return url.pathname.startsWith("/chat")
        ? jsonResponse({ mimetype: "image/jpeg; charset=binary", base64: "AAAA" })
        : jsonResponse({ key: { id: "sent-1" } });
    },
  });

  assert.deepEqual(await gateway.downloadMedia("wamid"), {
    mimeType: "image/jpeg",
    base64: "AAAA",
  });
  assert.equal(await gateway.sendText("553198765432", "ok"), "sent-1");
  assert.deepEqual(paths, ["/chat/getBase64FromMediaMessage/bot", "/message/sendText/bot"]);
});

test("a failed request throws", async () => {
  const gateway = createEvolutionGateway({
    baseUrl: "http://evolution.example",
    apiKey: "wrong",
    instance: "bot",
    request: async () => new Response("unauthorized", { status: 401 }),
  });
  await assert.rejects(gateway.sendText("553198765432", "ok"), /failed with 401/);
});
