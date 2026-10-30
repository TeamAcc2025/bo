import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { recallEvidence, gbrainSmokeOptions, marker } from "./gbrain-smoke-config.mjs";

const completedRecall = () => ({
  type: "item.completed",
  item: {
    id: "synthetic-call", type: "mcp_tool_call",
    server: "codex_apps", tool: "gbrain_bo_recall",
    arguments: { entity: "projects/bo", limit: 1 },
    status: "completed", error: null,
    result: { content: [], structured_content: null },
  },
});
const raw = (event) => ({ type: "raw", iteration: 1, line: JSON.stringify(event) });

test("GBrain smoke is a separate bounded native run with private configuration", () => {
  const evidence = recallEvidence();
  const options = gbrainSmokeOptions("test-model", "/private/synthetic-gitconfig", evidence);
  assert.equal(options.agent.name, "codex");
  assert.equal(options.agent.captureSessions, false);
  assert.equal(options.maxIterations, 1);
  assert.deepEqual(options.branchStrategy, { type: "head" });
  assert.equal(options.sandbox.env.GIT_CONFIG_GLOBAL, "/private/synthetic-gitconfig");
  assert.equal(options.completionSignal, marker);
  assert.equal(options.logging.type, "file");
  assert.equal(options.logging.verbose, undefined);
  options.logging.onAgentStreamEvent(raw(completedRecall()));
  assert.equal(evidence.passed(), true);
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url)));
  assert.equal(pkg.scripts["sandcastle:smoke:gbrain"], "timeout --signal=TERM --kill-after=5s 120s node .sandcastle/gbrain-smoke.mjs");
});

test("GBrain errors abort the run instead of allowing model retries", () => {
  const options = gbrainSmokeOptions("test-model", "/private/synthetic-gitconfig", recallEvidence());
  options.logging.onAgentStreamEvent(raw({ type: "error", message: "synthetic failure" }));
  assert.equal(options.signal.aborted, true);
});

test("a completed successful native recall provides evidence without exposing facts", () => {
  const evidence = recallEvidence();
  evidence.observe(raw(completedRecall()));
  assert.equal(evidence.passed(), true);
});

test("missing calls, marker text and installed-tool metadata never prove recall", () => {
  const evidence = recallEvidence();
  assert.equal(evidence.passed(), false);
  for (const event of [
    { type: "text", message: "GBRAIN_SMOKE_OK", iteration: 1 },
    raw({ type: "item.completed", item: { type: "agent_message", text: JSON.stringify(completedRecall()) } }),
    raw({ type: "installed_tools", tools: ["gbrain_bo_recall"] }),
    { ...raw(completedRecall()), type: "toolCall" },
    { type: "raw", iteration: 1, line: "malformed synthetic line" },
  ]) evidence.observe(event);
  assert.equal(evidence.passed(), false);
});

for (const [name, change] of [
  ["wrong entity", (e) => { e.item.arguments.entity = "projects/example"; }],
  ["wrong limit", (e) => { e.item.arguments.limit = 2; }],
  ["string limit", (e) => { e.item.arguments.limit = "1"; }],
  ["unrelated tool", (e) => { e.item.tool = "other_recall"; }],
  ["unrelated server", (e) => { e.item.server = "other"; }],
  ["started call", (e) => { e.type = "item.started"; }],
  ["unfinished call", (e) => { e.item.status = "in_progress"; }],
  ["failed call", (e) => { e.item.status = "failed"; }],
  ["transport error", (e) => { e.item.error = { message: "synthetic failure" }; }],
  ["missing result", (e) => { e.item.result = null; }],
  ["malformed result", (e) => { e.item.result = {}; }],
  ["MCP error result", (e) => { e.item.result.isError = true; }],
  ["structured error", (e) => { e.item.result.structured_content = { isError: true }; }],
]) {
  test(`${name} cannot pass recall evidence`, () => {
    const evidence = recallEvidence();
    const event = completedRecall();
    change(event);
    evidence.observe(raw(event));
    assert.equal(evidence.passed(), false);
  });
}

test("a marker emitted before the completed recall cannot pass", () => {
  const evidence = recallEvidence();
  evidence.observe(raw({ type: "item.completed", item: { type: "agent_message", text: marker } }));
  evidence.observe(raw(completedRecall()));
  assert.equal(evidence.passed(), false);
});

test("a marker emitted after the completed recall preserves the evidence", () => {
  const evidence = recallEvidence();
  evidence.observe(raw(completedRecall()));
  evidence.observe(raw({ type: "item.completed", item: { type: "agent_message", text: marker } }));
  assert.equal(evidence.passed(), true);
});

test("a successful retry cannot hide an earlier recall error", () => {
  const evidence = recallEvidence();
  const failed = completedRecall();
  failed.item.status = "failed";
  evidence.observe(raw(failed));
  evidence.observe(raw(completedRecall()));
  assert.equal(evidence.passed(), false);
});

for (const event of [
  { type: "error", message: "synthetic failure" },
  { type: "turn.failed", error: { message: "synthetic failure" } },
  { type: "item.completed", item: { type: "error", message: "synthetic failure" } },
]) {
  test(`${event.type} prevents passing after a successful recall`, () => {
    const evidence = recallEvidence();
    evidence.observe(raw(completedRecall()));
    evidence.observe(raw(event));
    assert.equal(evidence.passed(), false);
  });
}
