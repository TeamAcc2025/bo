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
  overrides invocation, selection and dependency metadata as described below. Repository
  initialization lives in `AGENTS.md` and this directory. Experimental, deprecated, and
  miscellaneous skills are not installed.

## Use

Before choosing a phase or moving between skills, read
[BO workflows](workflows.md) for transitions, capability preflights and approval
gates. Native BO GBrain recall is required before planning; a dependency declaration
alone does not prove readiness. Local work does not require GitHub unless its
inputs or authorized outputs use the tracker.

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

BO deliberately applies four local metadata overrides to all 27 released skills:

- Invocation: every `agents/openai.yaml` sets
  `policy.allow_implicit_invocation: true`, and skill frontmatter omits
  `disable-model-invocation: true`.
- Selection: `SKILL.md` descriptions state concrete task triggers and workflow
  boundaries for automatic selection, including valid nested support workflows.
- Explicit invocation: each `agents/openai.yaml` has an
  `interface.default_prompt` with a short English starter containing the exact
  `$skill-name`. These are suggested invocation text, not always-loaded routing
  instructions. Interview starters ask one question at a time.
- Tool dependencies: each `agents/openai.yaml` declares a `dependencies.tools`
  entry with `type: mcp`, `value: codex_apps` for BO native GBrain recall, mentioning
  GitHub only for skills with tracker actions. This is the verified native server
  used by BO phase recalls. It does not install tools, grant permissions, register
  a server/plugin, or establish connection readiness. See the workflow preflight
  matrix before dependent actions.

Instruction bodies, supporting resources, skill names, display names, short
descriptions, argument hints, credits, and other metadata remain unchanged. These
overrides preserve workflow approval, review, and publication rules. They grant
no permissions: BO's controller owns publication, and phase workers stay within
their assigned task without starting nested batches or workers.

Repository discovery and a separately installed plugin or UI selector have
different installation and refresh paths. Changing these repository files does
not immediately update an existing plugin installation or slash menu.

## Updating

The reviewed preservation manifest is
[`.agents/matt-skills.json`](../../.agents/matt-skills.json). It records the explicit
27-skill released allowlist, pinned upstream provenance, exact BO descriptions,
default prompts and dependencies, plus SHA-256 hashes of instruction bodies,
supporting resources and license. Invocation stays implicitly enabled and disabling
frontmatter is removed. This is update policy, not a credential/runtime config store.
Unrelated future skills (such as Ponytail) may coexist outside the allowlist.

After `bash scripts/setup.sh` (or `--worktree` in an existing worker worktree):

```sh
.venv/bin/python scripts/matt_skills.py audit
.venv/bin/python scripts/matt_skills.py reapply
```

`audit` is offline and nonmutating. `scripts/check.sh` runs it and the CLI fixture
tests, so CI rejects lost or disabled metadata and unexpected protected content.
`reapply` is explicit: it validates the entire manifest, metadata syntax, inventory
and protected content before writing any file. It restores only the four documented
overrides, preserves bodies byte-for-byte and other metadata semantically, then
audits. Invalid input, missing protected files or changed upstream content abort
before mutation. A valid reapplication can change YAML formatting; unchanged files
are left byte-for-byte intact. Neither command fetches, upgrades, resets user work,
or generates a new baseline. `--root` selects a repository fixture for offline tests.

For a future upstream update:

1. Review and pin a new **released** upstream version and its explicit skill paths.
   Preserve the license and review the upstream diff, every changed instruction
   body and supporting resource, including generic `SKILL-MECHANICS.md` examples.
2. Explicitly review changes to the manifest's provenance, allowlist, resource
   inventory and hashes. Changed content requires a reviewed baseline update;
   do not regenerate hashes merely to silence an audit failure.
3. Retain or adapt the approved BO metadata after reading changed entry points.
   Review matching and near-miss cases for overlapping workflows; preserve all
   unrequested metadata. Run `reapply` only against that reviewed content/baseline.
4. Run `audit` and `bash scripts/check.sh`, review the full diff, and verify fresh
   native repository discovery of the released skills. Metadata checks and routing
   review do not prove native selector execution or service readiness.

This change preserves the upstream pin, bodies, resources, license and existing
descriptions/default prompts; it adds dependency declarations and preservation
tooling only. A separately installed ChatGPT plugin or visible slash menu has its
own editable source/refresh process and is not updated by these files. Avoid a
second skill copy through a plugin in the same cloud environment.
