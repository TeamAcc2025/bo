# Issue tracker: GitHub

Tasks and specifications live in GitHub Issues in `TeamAcc2025/bo`.
Use connected GitHub tools when available, or the authenticated `gh` CLI.
Scope every operation explicitly to `TeamAcc2025/bo`; never publish BO work
into the upstream skills repository. Public-data rules are in `AGENTS.md`.

## Operations

- Publish a spec or ticket: create a GitHub issue with its title, scope,
  acceptance criteria, and verification plan. Use structured tool arguments or
  `--body-file` for multiline text.
- Fetch a ticket: read its body, labels, comments, and dependency state.
- Link child tickets with native GitHub sub-issues. If unavailable, use a task
  list in the parent and `Part of #<parent>` in each child.
- Represent blockers with native issue dependencies when available; otherwise
  use `Blocked by: #<number>` in the body. Start only after all blockers close.
- Closing work: include verification evidence and link the implementation PR.
  Generated development PRs remain draft; merging requires the owner's explicit
  request and passing required checks.
  A triage label alone does not override dependencies or owner approval gates.

## Pull requests as a triage surface

**PRs as a request surface: no.** External PRs are not automatically treated as
feature requests. Development PRs still follow the repository's required checks.

## Wayfinding operations

A map is an issue labelled `wayfinder:map`. Its tickets are linked as sub-issues
(or task-list entries), with `wayfinder:research`, `wayfinder:prototype`,
`wayfinder:grilling`, or `wayfinder:task` according to type. Create these labels
only when that workflow is first used. Claim a startable ticket by assigning it
to the driving developer, then record the outcome and evidence before closing it.
