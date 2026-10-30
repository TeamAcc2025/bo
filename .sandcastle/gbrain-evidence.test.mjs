import assert from "node:assert/strict";
import test from "node:test";
import { recallEvidence } from "./gbrain-evidence.mjs";

const completed = () => ({ type: "item.completed", item: { id: "native-call-1", type: "mcp_tool_call",
  server: "codex_apps", tool: "gbrain_bo.recall", arguments: { entity: "projects/bo", limit: 1 },
  status: "completed", error: null, result: { content: [{ type: "text", text: "PRIVATE_FACT" }], isError: false } } });
const raw = (value) => ({ type: "raw", iteration: 1, line: JSON.stringify(value) });

test("native completed recalls produce only allowlisted call metadata for either spelling", () => {
  for (const tool of ["gbrain_bo.recall", "gbrain_bo_recall"]) {
    const evidence = recallEvidence();
    const event = completed();
    event.item.tool = tool;
    event.item.arguments.query = "PRIVATE_QUERY";
    evidence.observe(raw(event));
    assert.equal(evidence.report().passed, true);
    assert.deepEqual(evidence.report().events, [{ source: "codex-exec", type: "item.completed",
      itemType: "mcp_tool_call", itemId: "native-call-1", server: "codex_apps", tool, entity: "projects/bo", success: true }]);
    assert.ok(!JSON.stringify(evidence.report()).includes("PRIVATE"));
  }
});

for (const [name, change] of [
  ["started call", (e) => { e.type = "item.started"; }],
  ["wrong server", (e) => { e.item.server = "other"; }],
  ["wrong tool", (e) => { e.item.tool = "other.recall"; }],
  ["wrong entity", (e) => { e.item.arguments.entity = "projects/other"; }],
  ["failed call", (e) => { e.item.status = "failed"; }],
  ["missing id", (e) => { delete e.item.id; }],
  ["transport error", (e) => { e.item.error = { message: "PRIVATE_ERROR" }; }],
  ["missing result", (e) => { e.item.result = null; }],
  ["MCP error", (e) => { e.item.result.isError = true; }],
  ["snake-case error", (e) => { e.item.result.is_error = true; }],
  ["result error", (e) => { e.item.result.error = { message: "PRIVATE_ERROR" }; }],
  ["structured error", (e) => { e.item.result.structured_content = { isError: true }; }],
  ["camel-case structured error", (e) => { e.item.result.structuredContent = { error: "PRIVATE_ERROR" }; }],
]) {
  test(`${name} cannot establish native GBrain success`, () => {
    const evidence = recallEvidence();
    const event = completed();
    change(event);
    evidence.observe(raw(event));
    assert.equal(evidence.report().passed, false);
    assert.ok(!JSON.stringify(evidence.report()).includes("PRIVATE"));
  });
}

test("missing calls, model claims, installed tools and shell output do not count", () => {
  const evidence = recallEvidence();
  for (const value of [
    { type: "item.completed", item: { type: "agent_message", text: JSON.stringify(completed()) } },
    { type: "item.completed", item: { type: "command_execution", aggregated_output: JSON.stringify(completed()) } },
    { type: "installed_tools", tools: ["gbrain_bo.recall"] },
  ]) evidence.observe(raw(value));
  evidence.observe({ type: "text", message: "GBrain succeeded" });
  evidence.observe({ type: "raw", iteration: 1, line: "not JSON" });
  evidence.observe({ ...raw(completed()), iteration: 2 });
  assert.deepEqual(evidence.report(), { passed: false, events: [] });
});

test("a later success cannot hide a failed recall or native error", () => {
  for (const failure of [
    { ...completed(), item: { ...completed().item, status: "failed" } },
    { type: "turn.failed" }, { type: "error" },
  ]) {
    const evidence = recallEvidence();
    evidence.observe(raw(failure));
    evidence.observe(raw(completed()));
    assert.equal(evidence.report().passed, false);
  }
});
