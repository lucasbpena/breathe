import { type ChildProcess, spawn as spawnProcess } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CaptureError, type ClaudeExtractionRunner } from "../services/whatsapp-capture.service";

const maximumOutputBytes = 5 * 1024 * 1024;

type Spawn = (
  command: string,
  args: string[],
  options: { cwd: string; env: NodeJS.ProcessEnv },
) => ChildProcess;

/**
 * Runs `claude -p` as a pure reader: no tools, no MCP servers, no CLAUDE.md, hooks or saved
 * session, inside an empty temporary folder and without the variables from `.env`. The image goes
 * in as a base64 block and the answer comes back as the schema's structured output.
 */
export function createClaudeExtractionRunner(options: {
  bin: string;
  model?: string;
  systemPrompt: string;
  jsonSchema: object;
  timeoutMs: number;
  spawn?: Spawn;
}): ClaudeExtractionRunner {
  const spawn: Spawn =
    options.spawn ??
    ((command, args, spawnOptions) =>
      spawnProcess(command, args, { ...spawnOptions, stdio: ["pipe", "pipe", "pipe"] }));
  const args = [
    "-p",
    "--safe-mode",
    "--strict-mcp-config",
    "--tools",
    "",
    "--permission-mode",
    "dontAsk",
    "--no-session-persistence",
    "--input-format",
    "stream-json",
    "--output-format",
    "stream-json",
    "--verbose",
    "--system-prompt",
    options.systemPrompt,
    "--json-schema",
    JSON.stringify(withoutDialect(options.jsonSchema)),
    ...(options.model ? ["--model", options.model] : []),
  ];

  return async ({ text, image }) => {
    const content = [
      ...(image
        ? [
            {
              type: "image",
              source: { type: "base64", media_type: image.mimeType, data: image.base64 },
            },
          ]
        : []),
      { type: "text", text },
    ];
    const input = `${JSON.stringify({ type: "user", message: { role: "user", content } })}\n`;
    const workingDirectory = await mkdtemp(join(tmpdir(), "breathe-capture-"));
    try {
      const stdout = await run(
        spawn,
        options.bin,
        args,
        input,
        workingDirectory,
        options.timeoutMs,
      );
      return readStructuredOutput(stdout);
    } finally {
      await rm(workingDirectory, { recursive: true, force: true });
    }
  };
}

/** The CLI validator rejects the `$schema` dialect URI that Zod adds, so it is left out. */
function withoutDialect(schema: object) {
  const { $schema: _dialect, ...rest } = schema as Record<string, unknown>;
  return rest;
}

function run(
  spawn: Spawn,
  bin: string,
  args: string[],
  input: string,
  cwd: string,
  timeoutMs: number,
) {
  return new Promise<string>((resolve, reject) => {
    const env: NodeJS.ProcessEnv = { PATH: process.env.PATH, HOME: process.env.HOME };
    if (process.env.LANG) env.LANG = process.env.LANG;
    const child = spawn(bin, args, { cwd, env });
    const chunks: Buffer[] = [];
    let size = 0;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGINT");
      setTimeout(() => child.kill("SIGKILL"), 5_000).unref();
    }, timeoutMs);

    child.stdout?.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size <= maximumOutputBytes) chunks.push(chunk);
    });
    child.stderr?.resume();
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(new CaptureError("claude_unavailable", true, { cause: error }));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) return reject(new CaptureError("claude_timeout", true));
      if (code !== 0) return reject(new CaptureError("claude_failed", true));
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
    child.stdin?.end(input);
  });
}

function readStructuredOutput(stdout: string) {
  for (const line of stdout.split("\n").reverse()) {
    if (!line.trim()) continue;
    let event: { type?: unknown; is_error?: unknown; structured_output?: unknown };
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    if (event.type !== "result") continue;
    if (event.is_error === true || event.structured_output === undefined) {
      throw new CaptureError("claude_failed", true);
    }
    return event.structured_output;
  }
  throw new CaptureError("claude_failed", true);
}
