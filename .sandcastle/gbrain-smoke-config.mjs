import { smokeOptions } from "./smoke-config.mjs";

export const marker = "GBRAIN_SMOKE_OK";

export function gbrainSmokeOptions(model, gitConfig, evidence) {
  const controller = new AbortController();
  return {
    ...smokeOptions(model, gitConfig),
    prompt: `Read-only native GBrain connectivity test. Your first action must be the native GBrain BO recall tool (codex_apps gbrain_bo.recall, also exposed as gbrain_bo_recall), with exactly {"entity":"projects/bo","limit":1}. Make this actual recall once. Do not use shell commands, nested agents, CLI/model batches, or change files, Git state, authentication or configuration. Do not print returned facts, credentials, endpoints, or other private data. Stop on any authentication or tool failure; do not retry or log in. Only after the recall completes successfully, reply with exactly ${marker}. A claimed success without a real completed recall is a failure.`,
    completionSignal: marker,
    signal: controller.signal,
    logging: {
      type: "file", path: ".sandcastle/logs/gbrain-smoke.log",
      onAgentStreamEvent(event) {
        evidence.observe(event);
        if (evidence.failed()) controller.abort();
      },
    },
  };
}

export function recallEvidence() {
  let success = false;
  let failure = false;
  return {
    observe(event) {
      if (event.type !== "raw" || event.iteration !== 1) return;
      let native;
      try { native = JSON.parse(event.line); } catch { return; }
      const item = native?.item;
      if (native?.type === "error" || native?.type === "turn.failed" || item?.type === "error") failure = true;
      if (native?.type === "item.completed" && item?.type === "agent_message" && item.text?.includes(marker) && !success) failure = true;
      if (native?.type !== "item.completed" || item?.type !== "mcp_tool_call") return;
      if (item.server !== "codex_apps" || !["gbrain_bo.recall", "gbrain_bo_recall"].includes(item.tool)) return;
      const valid = item.status === "completed" && item.error == null && Array.isArray(item.result?.content)
        && !hasError(item.result) && !hasError(item.result.structured_content)
        && item.arguments?.entity === "projects/bo" && item.arguments?.limit === 1;
      if (!valid || success) failure = true;
      success ||= valid;
    },
    passed: () => success && !failure,
    failed: () => failure,
  };
}

const hasError = (value) => value?.isError === true || value?.is_error === true || value?.error != null;
