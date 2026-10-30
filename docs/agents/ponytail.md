# Ponytail

Ponytail's core skill is vendored for repository-scoped Codex discovery alongside
the Matt Pocock Skills.

- Upstream: https://github.com/DietrichGebert/ponytail
- Package version: `5.3.3`
- Pinned revision: `96608e078b2d5ea607c5c3b8b5a54d1c1fba6846`
- Source: `skills/ponytail/SKILL.md`, copied unchanged to
  [the local skill](../../.agents/skills/ponytail/SKILL.md).
- License: MIT; the exact upstream notice is preserved in
  [PONYTAIL-LICENSE](../../.agents/PONYTAIL-LICENSE).

The upstream core directory contains only `SKILL.md`, with no linked resources
or Codex metadata. Its frontmatter is preserved exactly. The description permits
ordinary skill discovery; discovery is separate from automatic lifecycle hooks.

## Use

Invoke `$ponytail` and give the level as an explicit conversational instruction:

- `$ponytail Use lite level.` Build the requested solution and name the smaller
  option for the user to choose.
- `$ponytail Use full level.` Apply the core guidance; full is the default.
- `$ponytail Use ultra level.` Also question parts of the request that the need
  does not justify.

To change level, state the new level explicitly. Say `stop ponytail` or
`normal mode` to stop applying the guidance in the current conversation. If the
live catalog omits the skill, read `.agents/skills/ponytail/SKILL.md` directly.

This installation supplies skill guidance only. Upstream slash-command examples
do not provide plugin command dispatch here. It installs no persistent mode
flags, lifecycle hooks, automatic subagent injection, status indicators, or
additional review, audit, or debt commands.

BO's instructions, approved scope, selected Matt workflows, required tests and
checks, independent review, and publication controls remain authoritative when
applying Ponytail guidance.
