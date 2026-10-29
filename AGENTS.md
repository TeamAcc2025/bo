# Working on BO

BO is a back-office project. Its first business workflow, application stack,
hosting, and integrations remain undecided. Confirm the first workflow and its
acceptance criteria with the owner before introducing an application framework.

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

Report the resulting behavior, verification, and any remaining limitation in the
owner's language. Keep code identifiers and repository tooling in English.

## Agent skills

Matt Pocock Skills are installed in `.agents/skills/`; see
`docs/agents/matt-skills.md` for the pinned source and invocation examples.
For an explicitly named Matt skill, or one invoked by another skill, read
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
