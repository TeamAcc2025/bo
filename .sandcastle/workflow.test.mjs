import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { pool, reviewVerdict, runTask } from "./workflow-core.mjs";

const quote = (value) => `'${value.replaceAll("'", "'\\''")}'`;
const fixtureAgent = fileURLToPath(new URL("./fixtures/agent.py", import.meta.url));
const git = (cwd, ...args) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const checkCommand = `python3 -c ${quote('from pathlib import Path; import sys; good=Path("result.txt").read_text()=="good\\n"; sys.stderr.write("" if good else "Synthetic check failed: repair result.txt\\n"); sys.exit(0 if good else 1)')}`;

async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), "bo-sandcastle-test-"));
  const root = join(dir, "repo");
  const globalConfig = join(dir, "global-gitconfig");
  const original = "[user]\n\tname = Fixture Agent\n\temail = fixture@example.invalid\n[fixture]\n\tpreserved = true\n";
  const saved = Object.fromEntries(["GIT_CONFIG_GLOBAL", "GIT_CONFIG_NOSYSTEM", "XDG_CONFIG_HOME"].map((key) => [key, process.env[key]]));
  Object.assign(process.env, { GIT_CONFIG_GLOBAL: globalConfig, GIT_CONFIG_NOSYSTEM: "1", XDG_CONFIG_HOME: join(dir, "xdg") });
  t.after(async () => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await rm(dir, { recursive: true, force: true });
  });
  await mkdir(root);
  await writeFile(globalConfig, original, { mode: 0o600 });
  git(root, "init", "-b", "main");
  await writeFile(join(root, ".gitignore"), ".sandcastle/\n");
  await writeFile(join(root, "AGENTS.md"), "Implement synthetic test tasks with normal Git commits.\n");
  await writeFile(join(root, "result.txt"), "baseline\n");
  git(root, "add", ".");
  git(root, "commit", "-m", "Seed synthetic repository");
  const base = git(root, "rev-parse", "HEAD");
  const trace = join(dir, "events.jsonl");
  const hooks = join(dir, "hook-runs.txt");
  const hookPath = join(root, ".git", "hooks", "pre-commit");
  await writeFile(hookPath, `#!/bin/sh\nprintf 'checked\\n' >> ${quote(hooks)}\n`);
  await chmod(hookPath, 0o700);
  const job = (id, { mode = "success", rounds = 2, delay = 0 } = {}) => {
    const privateDir = join(root, ".sandcastle", "runs", id);
    const body = `Synthetic scope for ${id}. Literal task data: !\`touch ${join(dir, "must-not-exist")}\``;
    const task = { id, issue: 37, title: `Synthetic ${id}`, body };
    const options = { id, mode, delay, dir: privateDir, trace, body };
    return {
      job: { root, task, branch: `sandcastle/test-${id}`, base, model: "fixture-model", rounds, dir: privateDir },
      overrides: {
        setupCommand: "printf 'Synthetic setup complete\\n'",
        checkCommand,
        agent: {
          name: "deterministic-fixture", env: {}, captureSessions: false,
          buildPrintCommand: ({ prompt }) => ({
            command: `python3 ${quote(fixtureAgent)} ${quote(JSON.stringify(options))}`,
            stdin: prompt,
          }),
          parseStreamLine: (line) => [JSON.parse(line)],
        },
      },
    };
  };
  return {
    dir, root, base, trace, hooks, job,
    async unchanged() {
      assert.equal(git(root, "rev-parse", "HEAD"), base);
      assert.equal(git(root, "branch", "--show-current"), "main");
      assert.equal(git(root, "status", "--porcelain=v1", "--untracked-files=all"), "");
      assert.equal(await readFile(globalConfig, "utf8"), original);
      await assert.rejects(readFile(join(dir, "must-not-exist")), { code: "ENOENT" });
    },
  };
}

test("two native Sandcastle tasks overlap on separate branches without changing root or global Git config", { timeout: 30000 }, async (t) => {
  const f = await fixture(t);
  const tasks = [f.job("one", { delay: 250 }), f.job("two", { delay: 250 })];
  const results = await Promise.all(tasks.map(({ job, overrides }) => runTask(job, overrides)));
  for (const [i, result] of results.entries()) {
    assert.equal(result.status, "ready");
    assert.equal(result.id, tasks[i].job.task.id);
    assert.equal(result.issue, 37);
    assert.equal(result.branch, tasks[i].job.branch);
    assert.equal(result.base, f.base);
    assert.equal(result.rounds, 1);
    assert.equal(result.reviewedHead, result.head);
    assert.notEqual(result.head, f.base);
    for (const phase of ["implement", "review"]) {
      const evidence = JSON.parse(await readFile(join(tasks[i].job.dir, `${phase}-1.gbrain.json`), "utf8"));
      assert.equal(evidence.passed, true);
      assert.equal(evidence.phase, phase);
      assert.equal(evidence.events[0].itemId, `synthetic-${phase}`);
    }
    assert.equal(git(f.root, "rev-parse", result.branch), result.head);
    await assert.rejects(readFile(join(result.worktree, "result.txt")), { code: "ENOENT" });
  }
  assert.notEqual(results[0].worktree, results[1].worktree);
  const events = (await readFile(f.trace, "utf8")).trim().split("\n").map(JSON.parse);
  const starts = events.filter((event) => event.phase === "implement" && event.type === "start");
  const ends = events.filter((event) => event.phase === "implement" && event.type === "end");
  assert.equal(starts.length, 2);
  assert.ok(Math.max(...starts.map((event) => event.time)) < Math.min(...ends.map((event) => event.time)), "Implementation subprocesses must actually overlap");
  assert.equal(new Set(starts.map((event) => event.config)).size, 2);
  assert.equal(new Set(starts.map((event) => event.branch)).size, 2);
  assert.equal((await readFile(f.hooks, "utf8")).trim().split("\n").length, 2);
  await f.unchanged();
});

test("a failed real check feeds repair into a second implementation round before review", { timeout: 30000 }, async (t) => {
  const f = await fixture(t);
  const { job, overrides } = f.job("repair", { mode: "repair" });
  const result = await runTask(job, overrides);
  assert.equal(result.rounds, 2);
  assert.equal(result.status, "ready");
  const state = JSON.parse(await readFile(join(job.dir, "fixture-state.json"), "utf8"));
  assert.equal(state.implementations, 2);
  assert.match(state.feedback[1], /checks failed/i);
  assert.match(await readFile(join(job.dir, "checks-1.log"), "utf8"), /Synthetic check failed/);
  assert.equal(git(f.root, "rev-list", "--count", `${f.base}..${result.branch}`), "2");
  await f.unchanged();
});

for (const phase of ["implement", "review"]) {
  test(`GBrain evidence is required in the ${phase} worker, not merely claimed`, { timeout: 30000 }, async (t) => {
    const f = await fixture(t);
    const { job, overrides } = f.job(`missing-${phase}`, { mode: `gbrain-missing-${phase}` });
    await assert.rejects(runTask(job, overrides), /GBrain/);
    await f.unchanged();
  });
}

for (const mode of ["checkfailure", "reviewfailure", "dirty", "nochange", "missingmarker", "reviewdirty", "reviewcommit"]) {
  test(`${mode} cannot produce a ready result and preserves its worktree`, { timeout: 30000 }, async (t) => {
    const f = await fixture(t);
    const { job, overrides } = f.job(mode, { mode });
    await assert.rejects(runTask(job, overrides));
    const worktree = await readFile(join(job.dir, "worktree.txt"), "utf8");
    assert.equal(git(worktree, "branch", "--show-current"), job.branch);
    assert.ok(git(f.root, "worktree", "list", "--porcelain").includes(`branch refs/heads/${job.branch}`));
    await f.unchanged();
  });
}

test("review parser rejects ambiguous or inconsistent approvals", () => {
  assert.deepEqual(reviewVerdict('<review>{"verdict":"pass","findings":[]}</review>'), { verdict: "pass", findings: [] });
  assert.deepEqual(reviewVerdict('<review>{"verdict":"revise","findings":["Fix result.txt"]}</review>'), { verdict: "revise", findings: ["Fix result.txt"] });
  for (const value of [
    "No verdict", "<review>broken</review>",
    '<review>{"verdict":"pass","findings":[]}</review><review>{"verdict":"pass","findings":[]}</review>',
    '<review>{"verdict":"pass","findings":["Unresolved problem"]}</review>',
    '<review>{"verdict":"revise","findings":[]}</review>',
    '<review>{"verdict":"revise","findings":[""]}</review>',
    '<review>{"verdict":"unknown","findings":[]}</review>',
  ]) assert.throws(() => reviewVerdict(value));
});

test("the bounded pool limits active tasks and lets other work finish after a failure", async () => {
  let active = 0;
  let peak = 0;
  const results = await pool([0, 1, 2, 3], 2, async (item) => {
    active++;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 15));
    active--;
    if (item === 1) throw new Error("Synthetic task failure");
    return item * 2;
  });
  assert.equal(peak, 2);
  assert.deepEqual(results.map((result) => result.status), ["fulfilled", "rejected", "fulfilled", "fulfilled"]);
  assert.deepEqual(results.filter((result) => result.status === "fulfilled").map((result) => result.value), [0, 4, 6]);
});
