# Matt Pocock Skills

The 27 released skills are vendored in `.agents/skills/` for repository-scoped
Codex discovery, including Codex Cloud. Personal skills on a local machine do not
provide the cloud installation.

- Upstream: https://github.com/mattpocock/skills
- Release manifest version: `1.3.2`
- Pinned revision: `a496f5513d4a4cf889bc48e189e579f4b0bdf6aa`
- Selection: only the 27 paths in upstream `.claude-plugin/plugin.json`.
- License: MIT; the upstream notice is preserved in `.agents/MATT-SKILLS-LICENSE`.
- Skill directories and their supporting resources are copied without editing
  their instructions. Repository initialization lives in `AGENTS.md` and this
  directory. Experimental, deprecated, and miscellaneous skills are not installed.

## Use

BO's standing owner instruction in `AGENTS.md` requests automatic selection of
task-appropriate Matt Skills. Users only need to describe their task; agents read
the selected repository `SKILL.md` before applying it. Use `$ask-matt` when a
workflow choice needs guidance. Manual invocations remain available. Examples:

- `$grill-with-docs` to clarify the first workflow and record agreed domain terms.
- `$to-spec` then `$to-tickets` to publish agreed work to the configured tracker.
- `$implement` for an approved ticket; `$diagnosing-bugs` for a reported failure.
- `$code-review` to review changes against their baseline and spec.

In a selector that uses `@`, select the skill by its name. The project is already
initialized; re-run setup only to change its conventions. Current settings are in
`issue-tracker.md`, `triage-labels.md`, and `domain.md`.

If a cloud session's live catalog omits a selected skill, load its repository
file as directed by `AGENTS.md`. Vendored invocation metadata is unchanged;
the owner's standing BO request supplies explicit authorization to select the
appropriate workflows without repeating skill names in each task.

## Updating

Review and pin an upstream revision, install only its released manifest paths,
preserve the license, and update this provenance. Verify the skill metadata,
resources, repository checks, and cloud discovery before handing back the update.
Avoid installing a second copy through a plugin in the same cloud environment.
