<phase>review</phase>
Read AGENTS.md and the selected specification in {{TASK_FILE}}. Review the complete
diff from base {{BASE}} to HEAD, relevant surrounding code, and the added tests.
Assess correctness against every acceptance criterion, documented standards,
regressions, public-data exposure, and preservation of required checks/hooks.

Review only. Keep HEAD, tracked files and Git status unchanged. The implementer
will repair findings in the next round; the controller owns publication.

Return exactly one structured verdict using this format:
<review>{"verdict":"pass","findings":[]}</review>
For actionable findings use verdict "revise" and a nonempty array of specific
strings explaining location, problem and required correction. A pass requires
all acceptance criteria satisfied and no remaining actionable findings.
