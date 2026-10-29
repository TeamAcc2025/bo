# Sandcastle

`@ai-hero/sandcastle` is pinned to `0.12.0` in the lockfile. It is development
tooling and does not select the application's stack. `bash scripts/setup.sh`
installs it; `bash scripts/check.sh` runs its offline configuration tests.

## Cloud smoke test

Use the existing isolated BO cloud VM, Node.js 22+, Git, GNU `timeout`, and a
Codex CLI with working authentication and network access. Check authentication
with `codex login status`; keep credential values and credential-file contents
private. A successful status check alone is not proof of a working model call.

From a clean repository checkout, select a model available to that CLI/account:

```sh
SANDCASTLE_MODEL=gpt-6.1-sol npm run sandcastle:smoke
```

The test calls `run()` with `noSandbox()` and one iteration. As approved by the
owner, it uses Sandcastle's standard Codex flag:
`--dangerously-bypass-approvals-and-sandbox`. The outer cloud VM provides
isolation; the child has no inner Codex sandbox or approval gate. GNU `timeout`
limits the entire Node process to 120 seconds, with a 5-second termination grace
period. Sandcastle session capture is disabled; the CLI can retain its own
session data outside the repository.

Success requires the expected model response, one iteration, no commits, and
unchanged Git HEAD and working-tree status. The test performs no push or merge.
Logs stay under ignored `.sandcastle/logs/`; never upload them with credentials
or private business content. If a timeout occurs, verify that no test child is
left running before retrying.

CI runs only offline configuration tests. It does not receive model credentials or run
inference. Configure model-service access in the private cloud environment when
needed; local Mac credentials are not copied into it.

For implementation work, agree the task and configure an explicit task branch
and the required checks before changing this nonmutating test prompt.
All resulting changes still follow the repository's required PR and CI checks.
