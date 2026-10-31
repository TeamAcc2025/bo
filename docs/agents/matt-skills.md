# Matt Pocock Skills

The 27 released skills are vendored in `.agents/skills/` for repository-scoped
Codex discovery, including Codex Cloud. Personal skills on a local machine do not
provide the cloud installation.

- Upstream: https://github.com/mattpocock/skills
- Release manifest version: `1.3.2`
- Pinned revision: `a496f5513d4a4cf889bc48e189e579f4b0bdf6aa`
- Selection: only the 27 paths in upstream `.claude-plugin/plugin.json`.
- License: MIT; the upstream notice is preserved in `.agents/MATT-SKILLS-LICENSE`.
- Skill instruction bodies and supporting resources are preserved. BO deliberately
  overrides invocation and selection metadata as described below. Repository
  initialization lives in `AGENTS.md` and this directory. Experimental, deprecated, and
  miscellaneous skills are not installed.

## Use

Agents automatically select appropriate Matt skills for the task. You can also
invoke `$ask-matt` to choose a workflow or name a skill directly. Examples:

- `$grill-with-docs` to clarify the first workflow and record agreed domain terms.
- `$to-spec` then `$to-tickets` to publish agreed work to the configured tracker.
- `$implement` for an approved ticket; `$diagnosing-bugs` for a reported failure.
- `$code-review` to review changes against their baseline and spec.

In a selector that uses `@`, select the skill by its name. The project is already
initialized; re-run setup only to change its conventions. Current settings are in
`issue-tracker.md`, `triage-labels.md`, and `domain.md`.

`AGENTS.md` directs agents to read the relevant repository `SKILL.md` for automatic,
explicit, and nested invocation, even when the live catalog omits the skill.

BO deliberately applies three local metadata overrides to all 27 released skills:

- Invocation: every `agents/openai.yaml` sets
  `policy.allow_implicit_invocation: true`, and skill frontmatter omits
  `disable-model-invocation: true`.
- Selection: `SKILL.md` descriptions state concrete task triggers and workflow
  boundaries for automatic selection, including valid nested support workflows.
- Explicit invocation: each `agents/openai.yaml` has an
  `interface.default_prompt` with a short English starter containing the exact
  `$skill-name`. These are suggested invocation text, not always-loaded routing
  instructions. Interview starters ask one question at a time.

Instruction bodies, supporting resources, skill names, display names, short
descriptions, argument hints, credits, and other metadata remain unchanged. These
overrides preserve workflow approval, review, and publication rules. They grant
no permissions: BO's controller owns publication, and phase workers stay within
their assigned task without starting nested batches or workers.

Repository discovery and a separately installed plugin or UI selector have
different installation and refresh paths. Changing these repository files does
not immediately update an existing plugin installation or slash menu.

## Updating

Review and pin an upstream revision, install only its released manifest paths,
preserve the license, and update this provenance. Reapply BO's invocation policy,
selection descriptions, and default prompts to every released skill. Read changed
upstream bodies and supporting entry points before retaining or adapting local
descriptions and prompts; review matching and near-miss scenarios for overlapping
workflows. Keep all other metadata, instruction bodies, and supporting resources
unchanged, including generic `SKILL-MECHANICS.md` examples.

Audit YAML and frontmatter for unique valid names, explicit boolean invocation
policies, absence of disabling frontmatter, meaningful descriptions, and nonempty
prompts containing each exact skill name. Compare bodies, resources, and other
metadata against the pinned upstream revision, accounting only for the documented
overrides. Run repository checks and verify repository discovery before handing
back the update. Semantic routing review does not prove native selector execution;
plugin or UI refresh requires separate installation and verification.
Avoid installing a second copy through a plugin in the same cloud environment.
