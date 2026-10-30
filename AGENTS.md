# Working on BO

BO is a back-office project. Its first business workflow, application stack,
hosting, and integrations remain undecided. Confirm the first workflow and its
acceptance criteria with the owner before introducing an application framework.

## Working language

Use English for written analysis, plans, agent task instructions, progress
updates, replies, code comments, documentation, commit messages, and PRs, even
when the task is submitted in another language. Preserve user-provided content
and domain terms when their original language matters. Follow explicit requests
for translation or localized product content.

## Automatic workflow

The owner should provide only the task and its acceptance criteria. Apply these
defaults without requiring a repeated setup prompt or manual skill mentions:

1. Read project instructions and recall `projects/bo` through the connected
   GBrain BO plugin before planning. Project files remain authoritative. Save
   durable user decisions, preferences, commitments, and location pointers;
   keep Git and task progress in project records. Use `ttl: "3d"` for short-lived
   state another session needs, `replaces` for changed facts, and `content_origin`
   on every save. Report unavailable GBrain access instead of inventing context.
2. Select the appropriate Matt Skills for the task, as requested by the owner's
   standing instruction. Read each selected `.agents/skills/<name>/SKILL.md`
   before using it, including when the live catalog omits it. Clarify/specify
   only when needed; use implementation, diagnosis, review, and PR skills at
   their relevant stages. Preserve the vendored skill metadata.
3. For implementation in the managed BO Cloud environment, use the existing
   Sandcastle controller in `docs/sandcastle.md`. Derive an owner-selected
   private plan from the requested scope or use approved tracker issues.
   Run independent tasks with at most two concurrent agents; keep dependent
   work sequential. Phase workers follow their assigned prompt without nested
   CLI/model batches. Read-only investigation and environment setup use tools
   directly.
4. Before Sandcastle commands, source
   `/home/agent/.local/share/bo-sandcastle/sandcastle.env` in the same shell.
   Require the private runtime and `BO_AUTH_STORE_URL` /
   `BO_AUTH_STORE_AUTHORIZATION` bindings without displaying their values.
   Use the saved ChatGPT subscription sessions. Preserve the parent's
   `CODEX_HOME`, proxy, CA trust, authentication headers, and mandatory guards.
   Stop on missing bindings or authentication failure; do not introduce an
   API-key fallback or request a new login as routine setup.
5. Complete implementation, normal checks, independent review of the checked
   revision, draft PR publication, and required CI. Keep hooks enabled and
   attach every created PR. Merge and deploy only on the owner's explicit
   request. Report results and remaining limitations in English; verify remote
   auth writeback and removal of temporary custom caches after execution.

## Public repository

- Use synthetic fixtures and neutral examples. Keep company identities, personal
  data, financial records, production exports, credentials, and internal system
  addresses out of code, commits, issues, PRs, screenshots, and CI logs.
- Keep real data and credentials in private runtime storage. `.env.example` may
  contain documented variable names and empty values, never working credentials.
- Keep public metadata minimal. Publish no website, deployment, announcement, or
  message to another person unless the owner requests it.

## Development

- Run `bash scripts/setup.sh` once per fresh environment. Run
  `bash scripts/check.sh` before handing back changes. It checks repository
  hygiene; application tests must be added alongside application behavior.
- Prefer the smallest complete change. Reuse existing code and conventions;
  add dependencies only when the requested behavior needs them.
- For behavior changes, add a focused regression test and run affected tests.
  Report unavailable or failing checks; preserve hooks and required CI checks.
- Keep changes on a task branch and submit a focused PR. Merge only when the
  owner requests it and the required checks pass. Do not force-push `main`.
- Update setup and checks in the same PR when dependencies or commands change.
  Cloud environment publishing is separate from repository changes; see
  `docs/codex-cloud.md` when configuring or changing that environment.

## Review

Check correctness, tests, public-data exposure, and CI permissions. Once company
data is introduced, verify authorization and company isolation at every data
access boundary. Do not invent business rules, integrations, or acceptance results.

Report the resulting behavior, verification, and any remaining limitation in
English. Keep code identifiers and repository tooling in English.

## Agent skills

Matt Pocock Skills are installed in `.agents/skills/`; see
`docs/agents/matt-skills.md` for the pinned source and invocation examples.
Select task-appropriate skills automatically under the standing workflow above.
For a selected Matt skill, one explicitly named, or one invoked by another skill, read
`.agents/skills/<name>/SKILL.md` and follow it with the available Codex tools.
This also applies when the environment's live skill catalog omits the skill.

### Issue tracker

Tasks and specs live in GitHub Issues for `TeamAcc2025/bo`. When reading or
publishing tickets, follow `docs/agents/issue-tracker.md`.

### Triage labels

Use the five canonical triage labels. For triage, read
`docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `GLOSSARY.md` and `docs/adr/`, created as decisions emerge.
Before engineering exploration, follow `docs/agents/domain.md`.

### Sandcastle

Driving agents: for BO implementation in Codex Cloud, follow the task workflow
in `docs/sandcastle.md`. Select independent approved tasks; the controller owns
publication after checks and review. Attach every created PR to the chat.
Sandcastle phase workers follow their assigned implementation or review prompt
and keep execution within their task; they do not start nested batches.
