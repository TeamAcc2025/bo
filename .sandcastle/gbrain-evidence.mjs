const hasError = (value) => value?.isError === true || value?.is_error === true || value?.error != null;

export function recallEvidence() {
  const events = [];
  let failed = false;
  return {
    observe(event) {
      if (event.type !== "raw" || event.iteration !== 1) return;
      let native;
      try { native = JSON.parse(event.line); } catch { return; }
      const item = native?.item;
      if (native?.type === "error" || native?.type === "turn.failed" || item?.type === "error") failed = true;
      if (native?.type !== "item.completed" || item?.type !== "mcp_tool_call") return;
      if (item.server !== "codex_apps" || !["gbrain_bo.recall", "gbrain_bo_recall"].includes(item.tool)) return;
      if (item.arguments?.entity !== "projects/bo") return;
      const id = typeof item.id === "string" && /^[a-zA-Z0-9_-]{1,160}$/.test(item.id) ? item.id : null;
      const success = id !== null && item.status === "completed" && item.error == null
        && Array.isArray(item.result?.content) && !hasError(item.result)
        && !hasError(item.result?.structured_content) && !hasError(item.result?.structuredContent);
      failed ||= !success;
      // Keep native call metadata only; facts, arguments and error payloads remain private.
      events.push({ source: "codex-exec", type: native.type, itemType: item.type,
        itemId: id, server: item.server, tool: item.tool, entity: "projects/bo", success });
    },
    report: () => ({ passed: events.some((event) => event.success) && !failed, events }),
  };
}
