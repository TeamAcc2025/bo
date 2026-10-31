# BO skill workflows

Use this guide when choosing or moving between phases. Read the selected skill's
actual `SKILL.md` and its invoked skills, as directed by [AGENTS.md](../../AGENTS.md).
Project instructions and the owner's selected scope govern generic skill steps.
Reuse decisions, agreed test seams, and authorization already in context; ask only
for a missing decision or an action outside that authorization. Keep unresolved
questions explicit in the next artifact.

## Before planning: capability preflight

Call the actual native `codex_apps` GBrain BO recall tool (`gbrain_bo.recall`, also
exposed as `gbrain_bo_recall`) with `entity="projects/bo"` before planning BO work.
Use normal recall or task-appropriate bounds to retrieve the project context needed
for the phase. Each Sandcastle implementation and review worker must make its own
native call before planning its phase. Read the result privately;
keep recalled facts and private authentication out of logs and public artifacts.
If recall is unavailable or fails, report the blocker and stop BO phase planning.
A coordinator's recall, tool catalog entry, shell/API call, or claimed receipt
cannot substitute for this native call. Existing controller enforcement remains
authoritative; these docs and dependency metadata do not change it.

| Stage/action | Required capability and read-only proof | Gate on failure |
| --- | --- | --- |
| Every BO phase | Successful native GBrain recall scoped to `projects/bo` | Stop BO phase planning; report the missing/failing native capability. |
| Local discovery, interviews, glossary/ADR work, research from available sources, prototype, bounded implementation, local review, retrospective, handoff, PR-body drafting | Native recall plus local files/tools; no GitHub requirement unless the selected input or output is on GitHub | Continue local work when its inputs are available. Block only an unavailable source or dependent action. |
| Reading tracker work: `triage`, `wayfinder`, supplied issues/specs for `to-spec`, `to-tickets`, `implement`, `implement-spec`, or `code-review` | Connected GitHub read capability: actually read the relevant BO issue, labels/comments and dependencies as needed | Pause tracker-dependent work; continue independent local work. |
| Publishing/updating specs, tickets, triage or decision records; changing tracker configuration | Relevant connected GitHub write capability **and** existing owner authorization; first make a native read scoped to `TeamAcc2025/bo` | A successful read proves read access only. Establish write authority from the connection's permissions and authorized scope; do not infer it from read success. If missing or uncertain, stop the write. |
| Draft PR publication and CI observation | Controller's GitHub publication capability and repository-scoped reads; exact checked/reviewed commit and required CI | Follow [Sandcastle](../sandcastle.md); preserve failed/pending work and report its state. Workers hand back local commits. |

Verify service readiness with actual native read-only calls scoped to BO before
dependent work. Tool discovery only identifies candidates. Do not create an issue,
comment, PR, message, or other record as a probe. For GitHub only, the authenticated
`gh` fallback in [issue-tracker.md](issue-tracker.md) remains available when connected
tools are unavailable or insufficient; use an actual BO-scoped read such as
`gh repo view TeamAcc2025/bo` and fetch the needed issue. It does not establish write
authority. Native GBrain has no shell fallback. Report the specific missing
capability; avoid blocking unrelated work when only GitHub is missing.

Each skill's `dependencies.tools` declares the verified native MCP server
`codex_apps`. The description identifies GBrain recall and, where applicable,
GitHub actions. This metadata installs nothing, grants no permission, and proves
neither connection readiness nor write access. It is not a server/plugin manifest.

## Normal path

`discovery/decision → to-spec → to-tickets → implement → independent review → checked draft PR`

| Transition | Input | Completion evidence for the next phase | Legitimate gate |
| --- | --- | --- | --- |
| Discovery/decision → `to-spec` | Owner's problem and constraints; `grill-with-docs` in a repo (`grill-me` for an interview without records), or `wayfinder` for a large uncertain route | Settled scope, acceptance criteria, relevant code context, resolved terms/decisions and explicit remaining questions | Owner resolves decisions needed to specify behavior. Use `domain.md`; introduce no application framework before the first workflow and acceptance criteria are confirmed. |
| `to-spec` → `to-tickets` | Agreed discussion/decisions and test seams | A coherent spec with behavior, verification and out-of-scope boundaries; published to the configured tracker when authorized | Confirm only seams not already agreed. Tracker publication requires write capability and authorization. Do not restart discovery. |
| `to-tickets` → implementation | Agreed spec or bounded plan | Owner-approved verifiable vertical slices with explicit blocking edges; tracker links where authorized | Approve slices/dependencies before publishing. Start only approved tasks whose blockers are resolved; a ready label alone is insufficient. |
| `implement` → independent review | One approved bounded task, acceptance criteria, agreed public test seams | Focused regression tests for behavior changes, passing repository checks, normal commits, clean worktree, baseline/spec pointers | Stop on missing decisions or dependencies. In a phase worker, hand back the committed revision; the controller starts independent review. |
| Independent `code-review` → checked draft PR | Fixed baseline, spec, clean exact committed revision and check evidence | Standards and spec assessments at that exact revision; findings repaired and checked/reviewed again | Independent approval must cover the same revision that passed checks, including the approved ESRCH test blob. The controller publishes only after these gates. |
| Checked draft PR → owner decision | Controller's draft PR for the reviewed revision | Required GitHub CI passes; PR attached to the chat with its actual CI state | Skill completion grants no merge, deployment, issue-closing or other publication authority. Owner authorization and normal required checks still govern activation. |

`implement` handles one bounded piece. `implement-spec` coordinates an entire
approved spec's dependency graph on an integration branch. In BO managed runs,
the driving agent must map that orchestration onto the
[Sandcastle task workflow](../sandcastle.md). Phase workers implement or review
only their assigned task; generic skill instructions never authorize nested
worker batches, resets, merges, issue edits, or PR publication. Do not activate
another skill's publication steps merely because the preceding skill completed.

## Short paths and detours

| Route | Input and completion evidence | Next step and gate |
| --- | --- | --- |
| Direct bounded fix → `implement`/`tdd` | Already authorized small scope, concrete acceptance criteria and agreed public seam; finish with regression evidence, checks and commit | Skip redundant specs/tickets when the existing context is sufficient. Independent review and publication gates still apply. |
| Observed failure → `diagnosing-bugs` | A symptom; build a tight reproducible loop, minimise it, test hypotheses, fix at a suitable seam and rerun the original repro | Follow bounded implementation/review once verified. A missing correct test seam stays explicit; do not invent acceptance results. |
| Unknown fact → `research` | A specific decision question; produce cited primary-source findings in a Markdown artifact | Return the answer to discovery/spec; unresolved facts stay explicit. Source access gates only dependent research. Delegation and publication remain subject to the assigned role. |
| Runnable question → `prototype` | A state/logic or appearance question; produce a marked throwaway artifact and a recorded answer | Return validated decisions to discovery/spec. A prototype alone does not approve production behavior. Use `handoff` when moving directories/harnesses; publish artifacts only within authorization. |
| Completed/troubled session → `retro` | Session evidence; propose improvements to navigation, checks, standards or tools | Select/authorize follow-up work separately; a retrospective does not activate its suggestions. |
| Continuation → `handoff` | Work moving to another colleague, harness or directory; save a redacted portable brief outside the workspace with artifact pointers and suggested skills | Resume from those pointers, preserving scope and unresolved gates. Each new BO phase still performs native recall. |

## Managed execution boundaries

The authoritative execution and CI rules remain in [Sandcastle](../sandcastle.md)
and [Codex Cloud](../codex-cloud.md). For managed BO runs, preserve the controller
pinned by `BO_SANDCASTLE_CONTROLLER_COMMIT`, and select at most two independent
approved tasks; dependent tasks wait for their prerequisites. Before any
Sandcastle command, source `/home/agent/.local/share/bo-sandcastle/sandcastle.env`
in the same shell; default `SANDCASTLE_MODEL=gpt-6.1-sol`. Phase workers never start
Sandcastle. Preserve native recall enforcement, the approved ESRCH prerequisite,
hooks, authentication bindings, proxy/CA settings, process cleanup and timeouts.
Follow the assigned phase prompt for the exact approved fix and baseline.

Workers keep Git operations local. The controller owns publication of the exact
checked/reviewed revision and required CI; subsequent edits require new checks
and independent review. A completed skill does not automatically push, publish,
close issues, merge, deploy, or start another batch. Keep private run artifacts
and authentication in private runtime storage.
