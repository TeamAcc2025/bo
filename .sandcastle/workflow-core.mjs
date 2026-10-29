import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { codex, createSandbox } from "@ai-hero/sandcastle";
import { noSandbox } from "@ai-hero/sandcastle/sandboxes/no-sandbox";

const complete = "<implementation>complete</implementation>";
const git = (cwd, ...args) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const clean = (cwd) => git(cwd, "status", "--porcelain=v1", "--untracked-files=all") === "";
const templates = new URL("./prompts/", import.meta.url);

export function reviewVerdict(stdout) {
  const matches = [...stdout.matchAll(/<review>([\s\S]*?)<\/review>/g)];
  assert.equal(matches.length, 1, "Reviewer must return one structured verdict");
  const value = JSON.parse(matches[0][1]);
  assert.ok(value && ["pass", "revise"].includes(value.verdict));
  assert.ok(Array.isArray(value.findings) && value.findings.every((s) => typeof s === "string" && s.trim()));
  assert.ok(value.verdict !== "pass" || value.findings.length === 0);
  assert.ok(value.verdict !== "revise" || value.findings.length > 0);
  return value;
}

export async function privateGitConfig(root, dir) {
  const config = join(dir, "gitconfig");
  await writeFile(config, "", { mode: 0o600 });
  const includes = process.env.GIT_CONFIG_GLOBAL
    ? [process.env.GIT_CONFIG_GLOBAL]
    : [join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), "git/config"), join(homedir(), ".gitconfig")];
  for (const path of includes) git(root, "config", "--file", config, "--add", "include.path", path);
  return config;
}

export async function runTask(job, overrides = {}) {
  const { root, task, branch, base, model, rounds, dir } = job;
  await mkdir(dir, { recursive: true, mode: 0o700 });
  await writeFile(join(dir, "task.json"), JSON.stringify(task), { mode: 0o600 });
  const config = await privateGitConfig(root, dir);
  const stage = (name) => writeFile(join(dir, "stage.txt"), name, { mode: 0o600 });
  await stage("create-worktree");
  const sandbox = await createSandbox({
    cwd: root, branch, baseBranch: base,
    sandbox: noSandbox({ env: { GIT_CONFIG_GLOBAL: config } }),
  });
  await writeFile(join(dir, "worktree.txt"), sandbox.worktreePath, { mode: 0o600 });
  assert.equal(git(sandbox.worktreePath, "rev-parse", "HEAD"), base, "Task branch must start at the pinned base");
  assert.ok(clean(sandbox.worktreePath), "Task worktree must start clean");
  const agent = overrides.agent || codex(model, { captureSessions: false, effort: "high" });
  await stage("setup");
  const setup = await sandbox.exec(overrides.setupCommand || "bash scripts/setup.sh --worktree");
  await writeFile(join(dir, "setup.log"), setup.stdout + setup.stderr, { mode: 0o600 });
  assert.equal(setup.exitCode, 0, "Worktree setup failed");
  let feedback = "Implement the selected task and its acceptance criteria.";
  const prompt = async (phase) => (await readFile(new URL(`${phase}.md`, templates), "utf8"))
    .replaceAll("{{TASK_FILE}}", join(dir, "task.json"))
    .replaceAll("{{FEEDBACK_FILE}}", join(dir, "feedback.txt"))
    .replaceAll("{{BASE}}", base);
  const invoke = async (phase, round) => sandbox.run({
    agent, prompt: await prompt(phase), maxIterations: 1,
    completionSignal: phase === "implement" ? complete : "</review>",
    idleTimeoutSeconds: 180, completionTimeoutSeconds: 10,
    logging: { type: "file", path: join(dir, `${phase}-${round}.log`) },
  });
  for (let round = 1; round <= rounds; round++) {
    await writeFile(join(dir, "feedback.txt"), feedback, { mode: 0o600 });
    await stage(`implement-${round}`);
    const implementation = await invoke("implement", round);
    if (implementation.completionSignal !== complete) {
      feedback = "The last attempt did not report completion. Continue the task; report blockers honestly.";
      continue;
    }
    await stage(`checks-${round}`);
    const check = await sandbox.exec(overrides.checkCommand || "bash scripts/check.sh");
    const checkFile = join(dir, `checks-${round}.log`);
    await writeFile(checkFile, check.stdout + check.stderr, { mode: 0o600 });
    if (check.exitCode !== 0) {
      feedback = `Repository checks failed. Read ${checkFile}, fix the cause, rerun checks and commit normally.`;
      continue;
    }
    if (!clean(sandbox.worktreePath) || git(sandbox.worktreePath, "rev-parse", "HEAD") === base) {
      feedback = "Checks passed, but the task needs committed changes and a clean worktree. Finish and commit without bypassing hooks.";
      continue;
    }
    const reviewedHead = git(sandbox.worktreePath, "rev-parse", "HEAD");
    await stage(`review-${round}`);
    const review = await invoke("review", round);
    const verdict = reviewVerdict(review.stdout);
    assert.equal(git(sandbox.worktreePath, "rev-parse", "HEAD"), reviewedHead, "Reviewer changed the reviewed revision");
    assert.ok(clean(sandbox.worktreePath), "Reviewer changed the working tree");
    if (verdict.verdict === "revise") {
      feedback = `Resolve these review findings, rerun checks and commit:\n${verdict.findings.join("\n")}`;
      continue;
    }
    await stage(`checks-final-${round}`);
    const finalCheck = await sandbox.exec(overrides.checkCommand || "bash scripts/check.sh");
    const finalFile = join(dir, `checks-final-${round}.log`);
    await writeFile(finalFile, finalCheck.stdout + finalCheck.stderr, { mode: 0o600 });
    if (finalCheck.exitCode !== 0) {
      feedback = `Final checks failed after review. Read ${finalFile}, fix the cause and commit normally.`;
      continue;
    }
    assert.equal(git(sandbox.worktreePath, "rev-parse", "HEAD"), reviewedHead, "Checks changed the reviewed revision");
    assert.ok(clean(sandbox.worktreePath), "Checks changed the working tree");
    const result = { status: "ready", id: task.id, issue: task.issue, branch, head: reviewedHead, base, rounds: round, reviewedHead, worktree: sandbox.worktreePath };
    await sandbox.close();
    return result;
  }
  throw new Error("Task exhausted its implementation/check/review rounds; worktree preserved");
}

export async function pool(items, concurrency, work) {
  let next = 0;
  const results = new Array(items.length);
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      try { results[i] = { status: "fulfilled", value: await work(items[i], i) }; }
      catch (reason) { results[i] = { status: "rejected", reason }; }
    }
  }));
  return results;
}
