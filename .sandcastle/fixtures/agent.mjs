import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const options = JSON.parse(process.argv[2]);
let prompt = "";
for await (const chunk of process.stdin) prompt += chunk;
const phase = prompt.includes("<phase>implement</phase>") ? "implement" : "review";
assert.ok(prompt.includes(`<phase>${phase}</phase>`));
const git = (...args) => execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const event = (type) => appendFileSync(options.trace, JSON.stringify({
  type, phase, id: options.id, time: Date.now(), cwd: process.cwd(),
  branch: git("branch", "--show-current"), config: process.env.GIT_CONFIG_GLOBAL,
}) + "\n");
const emit = (result) => console.log(JSON.stringify({ type: "result", result }));
const statePath = join(options.dir, "fixture-state.json");
const state = existsSync(statePath)
  ? JSON.parse(readFileSync(statePath, "utf8"))
  : { implementations: 0, feedback: [] };
const task = JSON.parse(readFileSync(join(options.dir, "task.json"), "utf8"));
assert.equal(task.body, options.body);
assert.ok(!prompt.includes(task.body), "Task text must be loaded as data, not expanded in the prompt");
event("start");
if (options.delay) await new Promise((resolve) => setTimeout(resolve, options.delay));

if (phase === "implement") {
  state.implementations++;
  state.feedback.push(readFileSync(join(options.dir, "feedback.txt"), "utf8"));
  writeFileSync(statePath, JSON.stringify(state));
  if (options.mode !== "nochange") {
    const bad = options.mode === "checkfailure" || (options.mode === "repair" && state.implementations === 1);
    writeFileSync("result.txt", bad ? "bad\n" : "good\n");
    git("add", "result.txt");
    if (git("diff", "--cached", "--name-only")) git("commit", "-m", "Implement synthetic task");
  }
  if (options.mode === "dirty") writeFileSync("unfinished.txt", "Uncommitted synthetic work\n");
  event("end");
  emit(options.mode === "missingmarker" ? "Incomplete attempt" : "<implementation>complete</implementation>");
} else {
  if (options.mode === "reviewdirty") writeFileSync("result.txt", "Reviewer changed files\n");
  if (options.mode === "reviewcommit") {
    writeFileSync("result.txt", "Reviewer changed HEAD\n");
    git("add", "result.txt");
    git("commit", "-m", "Unexpected reviewer commit");
  }
  event("end");
  emit(options.mode === "reviewfailure"
    ? '<review>{"verdict":"revise","findings":["Correct the synthetic behavior"]}</review>'
    : '<review>{"verdict":"pass","findings":[]}</review>');
}
