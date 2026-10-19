import type {
  WhatsAppGateway,
  WhatsAppIncomingMessage,
} from "../services/whatsapp-capture.service";

type EvolutionRecord = {
  key?: {
    id?: unknown;
    fromMe?: unknown;
    remoteJid?: unknown;
    remoteJidAlt?: unknown;
    senderPn?: unknown;
  };
  messageType?: unknown;
  message?: Record<string, unknown> | null;
  messageTimestamp?: unknown;
};

const requestTimeoutMs = 15_000;
const mediaTimeoutMs = 60_000;
const pageSize = 50;
const maximumPages = 10;

/** Client for the user's own Evolution API instance. Every call goes out; nothing listens. */
export function createEvolutionGateway(options: {
  baseUrl: string;
  apiKey: string;
  instance: string;
  request?: typeof fetch;
}): WhatsAppGateway {
  const baseUrl = new URL(options.baseUrl);
  if (baseUrl.protocol !== "http:" && baseUrl.protocol !== "https:") {
    throw new Error("EVOLUTION_API_URL must use HTTP or HTTPS");
  }
  const request = options.request ?? fetch;
  const instance = encodeURIComponent(options.instance);

  async function post(path: string, body: unknown, timeoutMs = requestTimeoutMs) {
    const url = new URL(`${baseUrl.pathname.replace(/\/+$/, "")}/${path}/${instance}`, baseUrl);
    const response = await request(url, {
      method: "POST",
      headers: { apikey: options.apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      redirect: "error",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) throw new Error(`Evolution API ${path} failed with ${response.status}`);
    return (await response.json()) as unknown;
  }

  return {
    async listMessages(from, to) {
      const messages: WhatsAppIncomingMessage[] = [];
      for (let page = 1; page <= maximumPages; page += 1) {
        const payload = (await post("chat/findMessages", {
          where: { messageTimestamp: { gte: from.toISOString(), lte: to.toISOString() } },
          page,
          offset: pageSize,
        })) as { messages?: { pages?: unknown; records?: unknown } };
        const records = Array.isArray(payload.messages?.records)
          ? (payload.messages.records as EvolutionRecord[])
          : [];
        for (const record of records) {
          const message = toIncomingMessage(record);
          if (message) messages.push(message);
        }
        const pages = Number(payload.messages?.pages ?? 1);
        if (!Number.isFinite(pages) || page >= pages) break;
      }
      return messages.sort((left, right) => left.receivedAt.getTime() - right.receivedAt.getTime());
    },

    async downloadMedia(messageId) {
      const payload = (await post(
        "chat/getBase64FromMediaMessage",
        { message: { key: { id: messageId } }, convertToMp4: false },
        mediaTimeoutMs,
      )) as { base64?: unknown; mimetype?: unknown };
      if (typeof payload.base64 !== "string" || typeof payload.mimetype !== "string") {
        throw new Error("Evolution API returned no media");
      }
      return { mimeType: payload.mimetype.split(";")[0]?.trim() ?? "", base64: payload.base64 };
    },

    async sendText(number, text) {
      const payload = (await post("message/sendText", { number, text })) as {
        key?: { id?: unknown };
      };
      return typeof payload.key?.id === "string" ? payload.key.id : null;
    },
  };
}

function toIncomingMessage(record: EvolutionRecord): WhatsAppIncomingMessage | null {
  const key = record.key;
  if (!key || typeof key.id !== "string") return null;
  const seconds = Number(record.messageTimestamp);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  const content = record.message ?? {};
  const image = content.imageMessage as { caption?: unknown; mimetype?: unknown } | undefined;
  const extended = content.extendedTextMessage as { text?: unknown } | undefined;
  const text =
    stringOrNull(content.conversation) ??
    stringOrNull(extended?.text) ??
    stringOrNull(image?.caption);

  return {
    id: key.id,
    key: {
      fromMe: typeof key.fromMe === "boolean" ? key.fromMe : null,
      remoteJid: stringOrNull(key.remoteJid),
      remoteJidAlt: stringOrNull(key.remoteJidAlt),
      senderPn: stringOrNull(key.senderPn),
    },
    type: image ? "image" : text ? "text" : "unsupported",
    text,
    receivedAt: new Date(seconds * 1000),
  };
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
