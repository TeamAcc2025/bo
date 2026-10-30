# Native GBrain smoke

The opt-in command checks native GBrain BO recall through the pinned Sandcastle
SDK and its Codex provider. Run it from a clean, committed checkout in the
authorized managed environment, after the implementation/review batch ends:

```bash
SANDCASTLE_MODEL=<available-model> npm run sandcastle:smoke:gbrain
```

The driving agent runs this command. Implementation and review workers run only
offline tests and ordinary repository checks; they must never start a nested
model batch or live smoke. No inference or credentials are needed in CI.

The command uses `noSandbox`, one iteration, `captureSessions: false`, a 30-second
idle timeout and an outer 120-second wall timeout with a five-second termination
grace period. It inherits platform authentication, `CODEX_HOME`, proxy and CA
settings. Do not log in, copy local authentication, supply API keys, or modify
platform configuration to make it pass. Stop on authentication failure and
investigate privately; do not blindly retry models. Native errors abort the run.

The first requested action is the actual native `codex_apps` tool
`gbrain_bo_recall` with `entity: "projects/bo"` and numeric `limit: 1`. The agent
must emit `GBRAIN_SMOKE_OK` only after successful completion, without printing
returned facts. The runner accepts success only when all of these hold:

- A native `item.completed` / `mcp_tool_call` event identifies that exact server,
  tool, entity and limit, has `status: "completed"`, a result and no error.
- No native error, failed recall, duplicate recall or premature marker was seen.
- The SDK reports one iteration, the exact marker and no commits.
- HEAD and the complete tracked/untracked working-tree status were clean before
  the run and remain unchanged afterward, including when the SDK fails.

Model claims, tool installation metadata, a started call and marker-only output
cannot establish success. The pinned SDK's `AgentStreamEvent` raw variant is
available via file logging's `onAgentStreamEvent`. Its Codex parsed stream omits
MCP completions, so the evidence checker parses raw native JSON lines instead.
The native wire fields are documented in the
[Codex exec event definitions](https://github.com/openai/codex/blob/main/codex-rs/exec/src/exec_events.rs).
Unknown event formats fail closed when completed recall evidence is absent.

Both this command and the existing connectivity-only `sandcastle:smoke` use
`privateGitConfig` for every SDK invocation. A temporary Git config includes the
inherited config and receives SDK Git setup writes, supporting a read-only HOME.
The commands do not commit or publish anything.

Each invocation stores its config and log in a unique ignored directory under
`.sandcastle/logs/smoke-*/`. Directories are private and files have mode `0600`.
Raw event payloads are inspected in memory; verbose raw logging and session
capture stay disabled. Treat all runtime artifacts as private. Never attach
them, returned facts, endpoints, credentials or business data to public output.
The command prints only a neutral pass/fail summary. A pass proves this single
read-only recall, not application authorization or company isolation.

Offline regression tests run through `npm test` and `bash scripts/check.sh`.
They use synthetic native events and a substituted SDK boundary; they never
invoke a model or GBrain.
