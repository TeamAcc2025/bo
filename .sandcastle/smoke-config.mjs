import assert from "node:assert/strict";
import { codex } from "@ai-hero/sandcastle";
import { noSandbox } from "@ai-hero/sandcastle/sandboxes/no-sandbox";

export const marker = "SANDCASTLE_SMOKE_OK";

export function smokeOptions(model) {
  assert.ok(typeof model === "string" && model.trim(), "Set SANDCASTLE_MODEL to an available Codex model");
  return {
    agent: codex(model, { captureSessions: false, effort: "low" }),
    sandbox: noSandbox(),
    branchStrategy: { type: "head" },
    prompt: `Connectivity test only. Do not use tools, run commands, or change files. Reply with exactly ${marker}.`,
    completionSignal: marker,
    maxIterations: 1,
    idleTimeoutSeconds: 30,
    completionTimeoutSeconds: 5,
    logging: { type: "file", path: ".sandcastle/logs/smoke.log" },
  };
}
