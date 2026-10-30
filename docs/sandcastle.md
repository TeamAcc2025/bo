# Sandcastle

`@ai-hero/sandcastle` is pinned to `0.12.0` in the lockfile. It is development
tooling and does not select the application's stack. `bash scripts/setup.sh`
installs it; `bash scripts/check.sh` runs its offline configuration and workflow tests.

## Working on BO

The controller runs independent tasks in separate Git worktrees and branches,
with two tasks active by default. Each task gets up to three rounds:

```text
implement and commit → repository checks → independent review
     ↑                      │                    │
     └──── repair feedback ─┴────────────────────┘
                              pass → final checks → push exact revision
                                   → draft PR → required GitHub CI
```

Review runs in a fresh Codex process. Its structured verdict must approve the
same clean, committed revision that passed checks. A task failing implementation,
local checks, or review does not publish. Other independent tasks may finish. The controller creates
one draft PR per passing task, waits up to ten minutes for `Repository checks`,
and reports pending, failed, or unconfirmed CI as an unsuccessful batch result.
It never merges, deploys, closes issues, or force-pushes.

Before a batch, run `cloud_environment.environment_status` through the cloud
agent and confirm current enforced network/credential readiness. Use the BO
managed cloud VM, a clean checkout, and `bash scripts/setup.sh` at the coordinator
root. GitHub CLI must have write access to BO; the model must have working auth.
The controller checks both and performs the smoke test before starting workers.
Workers do not run nested batches or live smoke tests.

Use the [owner subscription runtime](codex-cloud.md#owner-subscription-runtime):
two independent saved ChatGPT sessions, with exclusive use of each slot by one
native process at a time. Keep native execution within those two slots even if
the batch concurrency setting is higher. Private provisioning supplies the
runtime, persistent storage bindings, and `sandcastle.env` selector. Source it
in the same shell as each batch or smoke command; a separate shell/tool call
does not carry that selection forward. The private paths in examples are
placeholders. Keep parent `CODEX_HOME` at its standard platform location and
preserve parent config/auth, proxy, CA, authentication headers, guards, hooks,
and checks. A read-only platform auth store is not a reason to replace it or
copy credentials from another machine.

Native Codex refreshes each slot's cache; persist and write back the updated
cache to its private storage before releasing the slot or discarding the VM.
Reuse the latest saved cache for future tasks. New VMs require the runtime and
bindings provisioned, then the same-shell selector; they do not require routine
new logins. Missing bindings or failed persistence must fail visibly. On auth
failure, stop for owner repair rather than blindly retrying or changing platform
auth. No API-key requirement or fallback applies to this selected runtime.
Keep production auth/cache and private binding values out of public Git,
Actions, logs, artifacts, and images.

This owner-private choice does not establish official support for public CI.
OpenAI's [advanced CI/CD account-auth recipe](https://learn.chatgpt.com/docs/auth/ci-cd-auth)
excludes public and open-source repositories; BO's public Actions checks remain
offline and credential-free.

Select explicit issues whose scope and acceptance criteria are agreed, whose
label is `ready-for-agent`, and whose native blocking issues are closed:

```sh
source /private/path/sandcastle.env && \
SANDCASTLE_MODEL=gpt-6.1-sol npm run sandcastle -- --issues 12,15
```

Issue numbers above are illustrative. Select tasks that can be reviewed and
merged independently; tasks depending on each other's changes belong in later
batches. The runner does not sweep the public backlog automatically.
The documented `Blocked by: #N` body fallback is checked too; unresolved or
unrecognised dependency references stop selection before any worker starts.

For owner-selected work without issues, provide a private JSON file containing
objects with `id`, `title`, and `body` (specification plus acceptance criteria).
An optional integer `issue` links an existing public issue. IDs use lowercase
letters, digits and hyphens, up to 40 characters. Do not commit private plans.

```sh
source /private/path/sandcastle.env && \
SANDCASTLE_MODEL=gpt-6.1-sol npm run sandcastle -- --plan /private/path/tasks.json
```

The checked-in synthetic example is for previewing configuration:

```sh
SANDCASTLE_MODEL=gpt-6.1-sol npm run sandcastle -- \
  --plan .sandcastle/tasks.example.json --dry-run
```

`--dry-run` validates input and prints only IDs/settings. It starts no agents and
creates no branches or PRs. It reads GitHub when selecting issues; a file-based
preview requires no model or GitHub calls. Normal execution publishes draft PRs.
PR titles/bodies use task IDs, issue references and verification evidence, never
raw task text, model output or private logs. The driving agent must attach every
created PR to its Codex chat and report its CI state. Owners review the diff and
authorize merges through the normal required checks.

All workers start from the same fetched `origin/main` commit. If `main` moves
before publication, the controller preserves the task branch for rebase,
checks and another review. It does not silently merge another task's work.

Use `--concurrency 1..4`, `--rounds 1..10`, and `--task-minutes 1..120` to set
bounds. Defaults are 2, 3 and 45 minutes. GNU timeout bounds each entire worker;
the batch has a four-hour cap. Interruptions stop worker process groups. Internal
Sandcastle idle timeouts alone cannot kill a stuck `noSandbox` child.
Setup verifies GNU coreutils `timeout`: the uutils implementation is not a
substitute for the tested process-group termination behavior. CI uses Ubuntu
24.04 for this runtime contract. The cloud execution mode must permit process
groups/signals; report an `EPERM` instead of disabling the timeout or its checks.

Each worktree installs its own dependencies using `scripts/setup.sh --worktree`.
The coordinator installs the shared Git hook once; workers keep that hook active
and do not overwrite it. Per-worker Git config includes the inherited config by
path, then receives Sandcastle's Git writes. HOME, CODEX_HOME and existing auth
stay intact. Worktrees separate changes; all workers still share the VM's access.

Private run artifacts live under ignored `.sandcastle/runs/<run-id>/`: task
specifications, setup/check/agent logs, repair feedback and `summary.json`.
Successful clean worktrees are removed; named branches remain. Failed worktrees
and committed/uncommitted work are preserved, including on timeout. Inspect the
recorded `worktree.txt` and branch before recovery. Do not rerun a failed task
blindly or remove a worktree containing needed changes. A failed publication can
leave a pushed branch or draft PR; inspect the private report and GitHub before
retrying. Never upload raw run artifacts.

## Cloud smoke test

Use the existing isolated BO cloud VM, Node.js 22+, Git, GNU `timeout`, and a
Codex CLI with working authentication and network access through the provisioned
owner runtime. The controller sources the private selector in the same shell
before checking `codex login status` or running the test; keep credential values
and credential-file contents private. A successful status check alone is not
proof of a working model call. Workers never run this live test.

From a clean repository checkout, select a model available to that CLI/account:

```sh
source /private/path/sandcastle.env && \
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

CI runs only offline configuration tests. It does not receive model credentials
or run inference. Reuse provisioned private subscription bindings for later tasks
and new VMs as described above; local Mac credentials are not copied into them.

The smoke prompt remains nonmutating. Product work uses the task workflow above.

## Verification

`npm test` exercises native Sandcastle against temporary Git repositories using
deterministic subprocess agents: parallel overlap, separate branches, normal
hooks, check/repair rounds, review failures and publication boundaries. Linux CI
also exercises GNU timeout cleanup. These tests require no model credentials and
do not publish PRs; they do not establish live model authorization.

Sources: [Sandcastle reusable sandboxes](https://github.com/mattpocock/sandcastle/blob/a53e227250fb51df0ad54155b85fecc1c090c937/src/createSandbox.ts),
[native issue dependencies](https://docs.github.com/en/rest/issues/issue-dependencies),
[Codex saved CLI authentication](https://learn.chatgpt.com/docs/non-interactive-mode#authenticate-in-automation),
[advanced CI/CD account-auth scope](https://learn.chatgpt.com/docs/auth/ci-cd-auth).
