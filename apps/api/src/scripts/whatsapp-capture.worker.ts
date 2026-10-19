#!/usr/bin/env tsx

import { readFile } from "node:fs/promises";
import { z } from "@hono/zod-openapi";
import { db, pool, user } from "@openmonetis/db";
import { normalizeWhatsAppNumber } from "@openmonetis/domain/receipt-capture";
import {
  MessageAnswerSchema,
  MessageExtractionSchema,
} from "@openmonetis/validators/receipt-capture";
import { eq } from "drizzle-orm";
import { bodyMeasurementsRepository } from "../repositories/body-measurements.repository";
import { nutritionIntakeRepository } from "../repositories/nutrition-intake.repository";
import { whatsappAnswerRepository } from "../repositories/whatsapp-answer.repository";
import { whatsappCaptureRepository } from "../repositories/whatsapp-capture.repository";
import { createNutritionIntakeService } from "../services/nutrition-intake.service";
import { createWhatsAppAnswerService } from "../services/whatsapp-answer.service";
import { createWhatsAppCaptureService } from "../services/whatsapp-capture.service";
import { createClaudeExtractionRunner } from "../utils/claude-cli";
import { parsePositiveIntegerEnv } from "../utils/env";
import { createEvolutionGateway } from "../utils/evolution";

const lockName = "breathe:whatsapp-capture";
const requiredVariables = [
  "SELF_WPP",
  "EVOLUTION_API_URL",
  "EVOLUTION_API_KEY",
  "EVOLUTION_INSTANCE",
  "WHATSAPP_CAPTURE_USER_EMAIL",
] as const;

let stopping = false;

function readConfiguration() {
  const missing = requiredVariables.filter((name) => !process.env[name]?.trim());
  if (missing.length) {
    console.error(`whatsapp_capture_not_configured: defina ${missing.join(", ")} no .env`);
    process.exit(1);
  }
  const selfNumber = normalizeWhatsAppNumber(process.env.SELF_WPP ?? "");
  if (selfNumber.length < 10) {
    console.error("whatsapp_capture_not_configured: SELF_WPP precisa ter DDI, DDD e número");
    process.exit(1);
  }
  return {
    selfNumber,
    evolutionUrl: process.env.EVOLUTION_API_URL?.trim() ?? "",
    evolutionKey: process.env.EVOLUTION_API_KEY?.trim() ?? "",
    evolutionInstance: process.env.EVOLUTION_INSTANCE?.trim() ?? "",
    userEmail: process.env.WHATSAPP_CAPTURE_USER_EMAIL?.trim().toLowerCase() ?? "",
    claudeBin: process.env.WHATSAPP_CAPTURE_CLAUDE_BIN?.trim() || "claude",
    claudeModel: process.env.WHATSAPP_CAPTURE_CLAUDE_MODEL?.trim() || undefined,
    pollIntervalMs: parsePositiveIntegerEnv("WHATSAPP_CAPTURE_POLL_SECONDS", 20) * 1000,
    timeoutMs: parsePositiveIntegerEnv("WHATSAPP_CAPTURE_TIMEOUT_SECONDS", 180) * 1000,
  };
}

async function main() {
  const configuration = readConfiguration();
  const [owner] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, configuration.userEmail))
    .limit(1);
  if (!owner) {
    console.error("whatsapp_capture_not_configured: WHATSAPP_CAPTURE_USER_EMAIL não tem conta");
    process.exit(1);
  }

  const [systemPrompt, answerPrompt] = await Promise.all(
    ["whatsapp-capture.md", "whatsapp-answer.md"].map((name) =>
      readFile(new URL(`../../prompts/${name}`, import.meta.url), "utf8"),
    ),
  );
  const nutritionIntake = createNutritionIntakeService(nutritionIntakeRepository);
  const answers = createWhatsAppAnswerService(whatsappAnswerRepository, {
    userId: owner.id,
    runAnswer: createClaudeExtractionRunner({
      bin: configuration.claudeBin,
      model: configuration.claudeModel,
      systemPrompt: answerPrompt as string,
      jsonSchema: z.toJSONSchema(MessageAnswerSchema),
      timeoutMs: configuration.timeoutMs,
    }),
    listMeasurements: (userId) => bodyMeasurementsRepository.listByUser(userId),
    getNutritionIntake: (userId, period) => nutritionIntake.get(userId, period),
  });
  const service = createWhatsAppCaptureService(whatsappCaptureRepository, {
    userId: owner.id,
    selfNumber: configuration.selfNumber,
    gateway: createEvolutionGateway({
      baseUrl: configuration.evolutionUrl,
      apiKey: configuration.evolutionKey,
      instance: configuration.evolutionInstance,
    }),
    runExtraction: createClaudeExtractionRunner({
      bin: configuration.claudeBin,
      model: configuration.claudeModel,
      systemPrompt: systemPrompt as string,
      jsonSchema: z.toJSONSchema(MessageExtractionSchema),
      timeoutMs: configuration.timeoutMs,
    }),
    answerQuestion: (question, receivedAt, captured) =>
      answers.answer(question, receivedAt, captured),
  });

  const client = await pool.connect();
  try {
    const lock = await client.query<{ acquired: boolean }>(
      "select pg_try_advisory_lock(hashtext($1)) as acquired",
      [lockName],
    );
    if (lock.rows[0]?.acquired !== true) {
      console.error("whatsapp_capture_already_running");
      return;
    }
    console.log(JSON.stringify({ event: "whatsapp_capture_started" }));
    while (!stopping) {
      try {
        const result = await service.poll();
        if (Object.values(result).some(Boolean)) {
          console.log(JSON.stringify({ event: "whatsapp_capture_cycle", ...result }));
        }
      } catch (error) {
        // Logged without message content; the cause is usually the Evolution API being offline.
        console.error(
          JSON.stringify({
            event: "whatsapp_capture_cycle_failed",
            error: error instanceof Error ? error.message : "unknown",
          }),
        );
      }
      await new Promise((resolve) => setTimeout(resolve, configuration.pollIntervalMs));
    }
  } finally {
    await client
      .query("select pg_advisory_unlock(hashtext($1))", [lockName])
      .catch(() => undefined);
    client.release();
  }
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    stopping = true;
  });
}

await main();
await pool.end();
