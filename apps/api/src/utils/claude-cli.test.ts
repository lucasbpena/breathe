import assert from "node:assert/strict";
import type { ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import test from "node:test";
import { CaptureError } from "../services/whatsapp-capture.service";
import { createClaudeExtractionRunner } from "./claude-cli";

type FakeRun = { args: string[]; cwd: string; env: NodeJS.ProcessEnv; input: string };

function fakeSpawn(output: string[], exitCode = 0) {
  const runs: FakeRun[] = [];
  const spawn = (
    _command: string,
    args: string[],
    options: { cwd: string; env: NodeJS.ProcessEnv },
  ) => {
    const child = new EventEmitter() as ChildProcess;
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const run: FakeRun = { args, cwd: options.cwd, env: options.env, input: "" };
    runs.push(run);
    stdin.on("data", (chunk: Buffer) => {
      run.input += chunk.toString("utf8");
    });
    stdin.on("finish", () => {
      stdout.end(output.join("\n"));
      setImmediate(() => child.emit("close", exitCode));
    });
    Object.assign(child, { stdin, stdout, stderr: new PassThrough(), kill: () => true });
    return child;
  };
  return { spawn, runs };
}

test("claude runs without tools or .env variables and returns the structured output", async () => {
  const previous = process.env.EVOLUTION_API_KEY;
  process.env.EVOLUTION_API_KEY = "must-not-leak";
  try {
    const { spawn, runs } = fakeSpawn([
      JSON.stringify({ type: "system", subtype: "init" }),
      JSON.stringify({ type: "result", is_error: false, structured_output: { receipts: [] } }),
    ]);
    const runner = createClaudeExtractionRunner({
      bin: "claude",
      model: "sonnet",
      systemPrompt: "prompt",
      jsonSchema: { $schema: "https://json-schema.org/draft/2020-12/schema", type: "object" },
      timeoutMs: 5_000,
      spawn,
    });

    const output = await runner({
      text: "<mensagem>oi</mensagem>",
      image: { mimeType: "image/jpeg", base64: "AAAA" },
    });

    assert.deepEqual(output, { receipts: [] });
    const run = runs[0];
    assert.ok(run);
    for (const flag of ["--safe-mode", "--strict-mcp-config", "--no-session-persistence"]) {
      assert.ok(run.args.includes(flag), flag);
    }
    assert.equal(run.args[run.args.indexOf("--tools") + 1], "");
    assert.equal(run.args[run.args.indexOf("--model") + 1], "sonnet");
    assert.equal(run.args[run.args.indexOf("--json-schema") + 1], '{"type":"object"}');
    assert.equal(run.env.EVOLUTION_API_KEY, undefined);
    assert.match(run.cwd, /breathe-capture-/);
    const message = JSON.parse(run.input) as {
      message: { content: { type: string; source?: { data: string } }[] };
    };
    assert.deepEqual(
      message.message.content.map((block) => block.type),
      ["image", "text"],
    );
    assert.equal(message.message.content[0]?.source?.data, "AAAA");
  } finally {
    if (previous === undefined) delete process.env.EVOLUTION_API_KEY;
    else process.env.EVOLUTION_API_KEY = previous;
  }
});

test("an error result or a failed exit becomes a transient capture error", async () => {
  for (const [output, exitCode] of [
    [[JSON.stringify({ type: "result", is_error: true })], 0],
    [[JSON.stringify({ type: "result", is_error: false, structured_output: {} })], 1],
  ] as const) {
    const { spawn } = fakeSpawn([...output], exitCode);
    const runner = createClaudeExtractionRunner({
      bin: "claude",
      systemPrompt: "prompt",
      jsonSchema: {},
      timeoutMs: 5_000,
      spawn,
    });
    await assert.rejects(
      runner({ text: "oi", image: null }),
      (error) => error instanceof CaptureError && error.code === "claude_failed" && error.transient,
    );
  }
});
