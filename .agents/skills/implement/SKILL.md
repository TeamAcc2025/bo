---
name: implement
description: "Implement one approved piece of work from a spec or ticket, with tests at agreed seams, review, and a commit on the current branch. Use for a bounded implementation task; implement-spec coordinates a whole ticket graph."
---

Implement the work described by the user in the spec or tickets.

If the user passes a ticket reference, fetch it from the issue tracker and state its title before starting. If the reference is ambiguous, ask.

Call the Skill tool with "tdd" where possible, at pre-agreed seams.

Use the repository's declared validation scope and commands. Run focused tests and typechecking while implementing, then complete its required acceptance checks and independent review before hand-back. An explicit user request for the full suite remains binding; a repository policy that reserves full checks for main after merge does not require an extra full run on every task branch.

Once done, call the Skill tool with "code-review" to review the work.

Commit your work to the current branch.
