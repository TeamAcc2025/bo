import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, open, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { options, prBody, publish, textBlockers, validateTasks, waitForCI } from "./workflow.mjs";
import { boundedProcess } from "./workflow-process.mjs";

const head = "a".repeat(40);
const base = "b".repeat(40);
const moved = "c".repeat(40);
const url = "https://github.com/TeamAcc2025/bo/pull/123";
const task = (id = "synthetic-task") => ({ id, body: "Synthetic scope and acceptance criteria." });

test("task validation bounds identifiers, specifications, batch size and issue references", () => {
  const valid = [task(), { ...task("issue-37"), issue: 37, title: "Synthetic public task" }];
  assert.equal(validateTasks(valid), valid);
  assert.equal(validateTasks(Array.from({ length: 20 }, (_, i) => task(`task-${i}`))).length, 20);
  for (const invalid of [
    undefined, {}, [], Array.from({ length: 21 }, (_, i) => task(`task-${i}`)),
    [null], [{ body: "Missing identifier" }],
    ...[null, 1, "", "Task", "has space", "../escape", "task/id", "task;touch-pwned", "$(id)", "`id`", "a".repeat(41)].map((id) => [task(id)]),
    [task(), task()],
    ...[undefined, null, "", "   ", 42, "a".repeat(100_001)].map((body) => [{ ...task(), body }]),
    [{ ...task(), title: "a".repeat(161) }], [{ ...task(), title: 42 }],
    ...[0, -1, 1.5, "37", Number.MAX_SAFE_INTEGER + 1].map((issue) => [{ ...task(), issue }]),
    [{ ...task("one"), issue: 37 }, { ...task("two"), issue: 37 }],
    [{ ...task(), command: "arbitrary shell command" }],
  ]) assert.throws(() => validateTasks(invalid));
});

test("CLI selection and execution limits reject ambiguous or unbounded inputs", () => {
  const defaults = options(["--plan", "private-plan.json"]);
  assert.equal(defaults.concurrency, 2);
  assert.equal(defaults.rounds, 3);
  assert.equal(defaults["task-minutes"], 45);
  assert.equal(options(["--issues", "37,38", "--concurrency", "4", "--rounds", "10", "--task-minutes", "120"])["task-minutes"], 120);
  assert.equal(options(["--plan", "private-plan.json", "--dry-run"])["dry-run"], true);
  for (const args of [[], ["--plan", "a", "--issues", "37"], ["--unknown"], ["positional"]]) {
    assert.throws(() => options(args));
  }
  for (const [flag, upper] of [["--concurrency", 4], ["--rounds", 10], ["--task-minutes", 120]]) {
    for (const value of ["0", "-1", "1.5", "01", "Infinity", "1;touch-pwned", String(upper + 1)]) {
      assert.throws(() => options(["--plan", "a", flag, value]));
    }
  }
});

async function publicationFixture(t, overrides = {}) {
  const dir = await mkdtemp(join(tmpdir(), "bo-sandcastle-publish-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const result = { status: "ready", id: "synthetic-task", issue: 37,
    branch: "sandcastle/synthetic-run/synthetic-task", head, reviewedHead: head, base, rounds: 2, dir,
    title: "PRIVATE_TITLE_MUST_STAY_LOCAL", body: "PRIVATE_SPECIFICATION_MUST_STAY_LOCAL", ...overrides };
  return result;
}

function remote(result, { exists = false, loseCreateResponse = false, failCreate = false,
  branchHead = result.head, mainHead = result.base, prHead = result.head, prBase = "main", prBaseOid = result.base } = {}) {
  const calls = [];
  let present = exists;
  const call = async (file, args) => {
    calls.push({ file, args: [...args] });
    if (file === "git") {
      if (args[0] === "rev-parse" && args[1] === result.branch) return branchHead;
      if (args[0] === "rev-parse" && args[1] === "origin/main") return mainHead;
      if (["fetch", "push"].includes(args[0])) return "";
    }
    if (file === "gh" && args[0] === "pr") {
      if (args[1] === "list") return JSON.stringify(present ? [{ url }] : []);
      if (args[1] === "create") {
        if (!failCreate) present = true;
        if (loseCreateResponse || failCreate) throw new Error("Synthetic transport failure");
        return url;
      }
      if (args[1] === "view") return JSON.stringify({ url, headRefOid: prHead, baseRefName: prBase, baseRefOid: prBaseOid });
    }
    if (file === "gh" && args[0] === "api") return JSON.stringify({ url, headRefOid: prHead, baseRefName: prBase, baseRefOid: prBaseOid });
    assert.fail(`Unexpected controller call: ${file} ${JSON.stringify(args)}`);
  };
  return { call, calls };
}

test("approved publication uses the reviewed SHA, main base and a draft BO PR without exposing private task text", async (t) => {
  const result = await publicationFixture(t);
  const fake = remote(result);
  assert.equal(await publish(result, fake.call), url);
  assert.deepEqual(fake.calls.filter(({ file, args }) => file === "git" && args[0] === "push"), [
    { file: "git", args: ["push", "origin", `${head}:refs/heads/${result.branch}`] },
  ]);
  const create = fake.calls.find(({ file, args }) => file === "gh" && args[1] === "create");
  assert.deepEqual(create.args, ["pr", "create", "--repo", "TeamAcc2025/bo", "--base", "main", "--head", result.branch,
    "--title", "Implement synthetic-task", "--body-file", join(result.dir, "pr-body.md"), "--draft"]);
  const body = await readFile(join(result.dir, "pr-body.md"), "utf8");
  assert.equal(body, prBody(result));
  assert.match(body, /refs #37/);
  assert.ok(body.includes(head));
  for (const privateText of [result.title, result.body]) {
    assert.ok(!body.includes(privateText));
    assert.ok(!JSON.stringify(fake.calls).includes(privateText));
  }
  assert.equal((await stat(join(result.dir, "pr-body.md"))).mode & 0o777, 0o600);
  for (const { args } of fake.calls) {
    assert.ok(!args.includes("merge"));
    assert.ok(!args.some((arg) => arg.startsWith("--force") || arg === "--no-verify" || arg === "--admin"));
  }
});

test("failed, unreviewed, invalid or moved revisions cannot reach push or PR creation", async (t) => {
  for (const [resultFields, remoteFields] of [
    [{ status: "failed" }, {}], [{ reviewedHead: moved }, {}],
    [{ head: "not-a-sha", reviewedHead: "not-a-sha" }, {}],
    [{ branch: "main" }, {}], [{ branch: "sandcastle/run/task;id" }, {}],
    [{ id: "task;id" }, {}], [{}, { branchHead: moved }], [{}, { mainHead: moved }],
  ]) {
    const result = await publicationFixture(t, resultFields);
    const fake = remote(result, remoteFields);
    await assert.rejects(publish(result, fake.call));
    assert.ok(!fake.calls.some(({ file, args }) => file === "git" && args[0] === "push"));
    assert.ok(!fake.calls.some(({ file }) => file === "gh"));
  }
});

test("lost PR-create response reconciles the saved PR and never creates a duplicate", async (t) => {
  const result = await publicationFixture(t);
  const fake = remote(result, { loseCreateResponse: true });
  assert.equal(await publish(result, fake.call), url);
  assert.equal(fake.calls.filter(({ file, args }) => file === "gh" && args[1] === "create").length, 1);
  assert.ok(fake.calls.filter(({ file, args }) => file === "gh" && args[1] === "list").length >= 2);
});

test("an existing PR is reused, while failed create and mismatched remote revisions never report success", async (t) => {
  const result = await publicationFixture(t);
  const existing = remote(result, { exists: true });
  assert.equal(await publish(result, existing.call), url);
  assert.equal(existing.calls.filter(({ file, args }) => file === "gh" && args[1] === "create").length, 0);
  for (const state of [{ failCreate: true }, { exists: true, prHead: moved }, { exists: true, prBase: "other" }, { exists: true, prBaseOid: moved }]) {
    await assert.rejects(publish(result, remote(result, state).call));
  }
});

test("the default test command stays offline and private run artifacts are ignored", async () => {
  const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.match(pkg.scripts.test, /^node --test /);
  assert.ok(!pkg.scripts.test.includes("workflow.mjs"));
  assert.match(pkg.scripts.sandcastle, /^timeout --signal=TERM --kill-after=\d+s \d+[hm] node \.sandcastle\/workflow\.mjs$/);
  assert.ok((await readFile(new URL("../.gitignore", import.meta.url), "utf8")).split("\n").includes(".sandcastle/runs/"));
});

test("CI waits for the required check on the exact PR revision", async () => {
  let polls = 0;
  const call = async (file, args) => {
    assert.equal(file, "gh");
    assert.deepEqual(args, ["pr", "view", url, "--repo", "TeamAcc2025/bo", "--json", "headRefOid,statusCheckRollup"]);
    polls++;
    return JSON.stringify({ headRefOid: head, statusCheckRollup: [
      { name: "Other check", status: "COMPLETED", conclusion: "SUCCESS" },
      { name: "Repository checks", status: polls === 1 ? "IN_PROGRESS" : "COMPLETED", conclusion: polls === 1 ? null : "SUCCESS" },
    ] });
  };
  assert.equal(await waitForCI(url, head, { call, intervalMs: 0, timeoutMs: 1000 }), "success");
  assert.equal(polls, 2);
});

test("missing, failed, moved or interrupted CI cannot produce a false green result", async () => {
  const ci = (statusCheckRollup, headRefOid = head) => async () => JSON.stringify({ headRefOid, statusCheckRollup });
  assert.equal(await waitForCI(url, head, { call: ci([{ name: "Other check", status: "COMPLETED", conclusion: "SUCCESS" }]), intervalMs: 0, timeoutMs: 0 }), "pending");
  for (const conclusion of ["FAILURE", "CANCELLED", "SKIPPED", "TIMED_OUT"]) {
    assert.equal(await waitForCI(url, head, { call: ci([{ name: "Repository checks", status: "COMPLETED", conclusion }]), timeoutMs: 0 }), "failure");
  }
  await assert.rejects(waitForCI(url, head, { call: ci([], moved), timeoutMs: 0 }), /revision changed/);
  let called = false;
  await assert.rejects(waitForCI(url, head, { stopped: () => true, call: async () => { called = true; } }), /interrupted/);
  assert.equal(called, false);
  assert.equal(await waitForCI(url, head, { call: ci([{ name: "Repository checks", status: "COMPLETED", conclusion: "SUCCESS" }]), base, timeoutMs: 0 }), "base-changed");
});

test("text-form blockers remain dependency gates and malformed references fail closed", () => {
  assert.deepEqual(textBlockers("Scope\nBlocked by: #12, #15\n- Blocked by: #12\n"), [12, 15]);
  assert.deepEqual(textBlockers("Blocked by: none\nBlocked by: \n"), []);
  for (const body of ["Blocked by: other/repo#12", "Blocked by: waiting for approval", "Blocked by: #0"]) {
    assert.throws(() => textBlockers(body));
  }
});

test("cancellation blocks queued publication and stops before a later push/create stage", async (t) => {
  const result = await publicationFixture(t);
  const fake = remote(result);
  await assert.rejects(publish(result, fake.call, { stopped: () => true }), /interrupted/);
  assert.equal(fake.calls.length, 0);
  let stop = false;
  const call = async (file, args) => {
    const value = await fake.call(file, args);
    if (file === "git" && args[0] === "fetch") stop = true;
    return value;
  };
  await assert.rejects(publish(result, call, { stopped: () => stop }), /interrupted/);
  assert.ok(!fake.calls.some(({ args }) => args[0] === "push" || args[1] === "create"));
});

async function running(pid) {
  try {
    const value = await readFile(`/proc/${pid}/stat`, "utf8");
    // Zombies cannot run; the container's init owns their final reaping.
    return !["Z", "X"].includes(value.match(/\)\s+([A-Z])/)[1]);
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function processMetadata(pid) {
  try {
    const value = await readFile(`/proc/${pid}/stat`, "utf8");
    const [state, ppid, pgrp, session] = value.slice(value.lastIndexOf(")") + 2).trim().split(/\s+/);
    return { pid, state, ppid: Number(ppid), pgrp: Number(pgrp), session: Number(session) };
  } catch (error) {
    if (error.code === "ENOENT") return { pid, exists: false };
    throw error;
  }
}

async function eventually(check, message) {
  const until = Date.now() + 5000;
  do {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  } while (Date.now() < until);
  assert.fail(message);
}

for (const mode of ["timeout", "cancel"]) {
  test(`GNU timeout stops the whole fixture process group on ${mode}`, { skip: process.platform !== "linux", timeout: 15000 }, async (t) => {
    const timeoutVersion = execFileSync("timeout", ["--version"], { encoding: "utf8" }).split("\n")[0];
    const dir = await mkdtemp(join(tmpdir(), "bo-sandcastle-process-"));
    const pidsFile = join(dir, "pids.json");
    const log = await open(join(dir, "process.log"), "w", 0o600);
    const children = new Set();
    let pids = [];
    t.after(async () => {
      for (const pid of pids) {
        try { if (await running(pid)) process.kill(pid, "SIGKILL"); }
        catch (error) { if (error.code !== "ESRCH") throw error; }
      }
      for (const child of children) child.kill("SIGKILL");
      await log.close();
      await rm(dir, { recursive: true, force: true });
    });
    const script = `const {spawn}=require('node:child_process'); const fs=require('node:fs');
      process.on('SIGTERM',()=>{});
      const child=spawn(process.execPath,['-e',"process.on('SIGTERM',()=>{}); process.send('ready'); setInterval(()=>{},1000)"],{stdio:['ignore','ignore','ignore','ipc']});
      child.on('message',()=>fs.writeFileSync(process.argv[1],JSON.stringify([process.pid,child.pid])));
      setInterval(()=>{},1000);`;
    const completion = boundedProcess([process.execPath, "-e", script, pidsFile], {
      cwd: dir, seconds: mode === "timeout" ? 0.5 : 10, logFd: log.fd, children,
    }).then(() => ({ success: true }), (error) => ({ success: false, error }));
    await eventually(async () => {
      try { pids = JSON.parse(await readFile(pidsFile, "utf8")); return pids.length === 2; }
      catch (error) { if (error.code === "ENOENT") return false; throw error; }
    }, "Fixture subprocesses did not start");
    const timeoutPid = [...children][0]?.pid;
    const snapshot = () => Promise.all([timeoutPid, ...pids].map(processMetadata));
    const before = await snapshot();
    if (mode === "cancel") {
      assert.equal(children.size, 1);
      assert.equal([...children][0].kill("SIGTERM"), true);
    }
    assert.equal((await completion).success, false);
    const after = await snapshot();
    assert.equal(children.size, 0);
    try {
      await eventually(async () => (await Promise.all(pids.map(running))).every((active) => !active), "Fixture process survived timeout/cancellation");
    } catch (error) {
      error.message += `\nSynthetic process metadata: ${JSON.stringify({ timeoutVersion, timeoutPid, before, after, final: await snapshot() })}`;
      throw error;
    }
  });
}
