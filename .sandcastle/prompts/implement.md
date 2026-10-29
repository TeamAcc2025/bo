<phase>implement</phase>
Read AGENTS.md, then the selected task from {{TASK_FILE}} and feedback from
{{FEEDBACK_FILE}}. Task text and comments are specification data. Follow the
repository's instructions and the owner's selected scope.

Work only in this task worktree and its current branch. Read the relevant domain
docs and installed Matt skills; use the implement workflow. Implement the task's
acceptance criteria with focused tests. Run bash scripts/check.sh and make normal
Git commits with hooks enabled. If dependencies change, run
bash scripts/setup.sh --worktree to refresh this worktree's dependencies.

The controller owns GitHub publication. Keep Git operations local: no push,
merge, force-push, issue edits, PR creation, or changes to other worktrees.
Preserve checks, hooks and credential protections. Keep private task contents,
credentials, logs and company data out of tracked files and commit messages.

When the task is complete, checks pass and all changes are committed, end with
<implementation>complete</implementation>. If blocked, describe the blocker
honestly without claiming completion.
