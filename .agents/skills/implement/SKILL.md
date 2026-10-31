---
name: implement
description: "Implement one approved piece of work from a spec or ticket, with tests at agreed seams, review, and a commit on the current branch. Use for a bounded implementation task; implement-spec coordinates a whole ticket graph."
---

Implement the work described by the user in the spec or tickets.

If the user passes a ticket reference, fetch it from the issue tracker and state its title before starting. If the reference is ambiguous, ask.

Call the Skill tool with "tdd" where possible, at pre-agreed seams.

Run typechecking regularly, single test files regularly, and the full test suite once at the end.

Once done, call the Skill tool with "code-review" to review the work.

Commit your work to the current branch.
