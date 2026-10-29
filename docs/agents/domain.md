# Domain docs

BO uses a single context. Domain documents are created when real terminology or
architectural decisions are agreed, not as empty setup placeholders.

## Before engineering exploration

- Read root `GLOSSARY.md` if it exists. If a future `GLOSSARY-MAP.md` exists,
  follow it to the contexts relevant to the task.
- Read ADRs under `docs/adr/` that concern the area being changed.
- If these documents do not exist, proceed silently. The domain-modeling skill
  creates them as terms or decisions are resolved.

## Vocabulary and decisions

Use glossary terms consistently in code, tests, specs, and issues. Surface a
conflict with an existing ADR before changing its decision; include the ADR ID
and the reason to revisit it. Keep unresolved product and stack choices explicit.
