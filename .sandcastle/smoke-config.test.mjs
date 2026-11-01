import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { marker, smokeOptions } from "./smoke-config.mjs";

test("smoke uses the approved native Codex mode with one nonmutating iteration", () => {
  const options = smokeOptions("test-model", "/private/synthetic-gitconfig");
  const command = options.agent.buildPrintCommand({
    prompt: options.prompt,
    dangerouslySkipPermissions: true,
  });
  assert.ok(command.command.includes("--dangerously-bypass-approvals-and-sandbox"));
  assert.equal(command.stdin, options.prompt);
  assert.ok(!command.command.includes(options.prompt));
  assert.ok(options.prompt.includes("Do not use tools, run commands, or change files"));
  assert.equal(options.agent.captureSessions, false);
  assert.equal(options.sandbox.env.GIT_CONFIG_GLOBAL, "/private/synthetic-gitconfig");
  assert.equal(options.maxIterations, 1);
  assert.equal(options.completionSignal, marker);
  assert.deepEqual(options.branchStrategy, { type: "head" });
});

test("the entire smoke process has a hard timeout", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url)));
  assert.equal(pkg.scripts["sandcastle:smoke"], "timeout --signal=TERM --kill-after=5s 120s node .sandcastle/smoke.mjs");
});

test("a missing model fails before any agent starts", () => {
  assert.throws(() => smokeOptions(undefined), /Set SANDCASTLE_MODEL/);
  assert.throws(() => smokeOptions("  "), /Set SANDCASTLE_MODEL/);
});
