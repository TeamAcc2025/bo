import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify, parseArgs } from "node:util";
import { access, mkdir, readFile, writeFile, open } from "node:fs/promises";
import { constants } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pool, runTask, privateGitConfig } from "./workflow-core.mjs";
import { boundedProcess } from "./workflow-process.mjs";

const exec = promisify(execFile);
const repo = "TeamAcc2025/bo";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const command = async (file, args, cwd = root) => (await exec(file, args, {
  cwd, encoding: "utf8", timeout: 60_000, maxBuffer: 2 * 1024 * 1024,
})).stdout.trim();
const git = (...args) => command("git", args);
const gh = (...args) => command("gh", args);
const privateJSON = (path, value) => writeFile(path, JSON.stringify(value, null, 2) + "\n", { mode: 0o600 });

export function validateTasks(tasks) {
  assert.ok(Array.isArray(tasks) && tasks.length >= 1 && tasks.length <= 20, "Select 1–20 independent tasks");
  const ids = new Set();
  const issues = new Set();
  for (const task of tasks) {
    assert.ok(task && typeof task.id === "string" && /^[a-z0-9][a-z0-9-]{0,39}$/.test(task.id), "Task IDs must be short lowercase identifiers");
    assert.ok(!ids.has(task.id), "Task IDs must be unique");
    ids.add(task.id);
    assert.ok(typeof task.body === "string" && task.body.trim() && task.body.length <= 100_000, "Each task needs a bounded specification with acceptance criteria");
    assert.ok(task.title === undefined || (typeof task.title === "string" && task.title.length <= 160));
    if (task.issue !== undefined) {
      assert.ok(Number.isSafeInteger(task.issue) && task.issue > 0 && !issues.has(task.issue), "Issue numbers must be positive and unique");
      issues.add(task.issue);
    }
    assert.ok(Object.keys(task).every((key) => ["id", "issue", "title", "body"].includes(key)), "Unexpected task field");
  }
  return tasks;
}

export function options(args) {
  const { values } = parseArgs({ args, options: {
    plan: { type: "string" }, issues: { type: "string" },
    concurrency: { type: "string", default: "2" }, rounds: { type: "string", default: "3" },
    "task-minutes": { type: "string", default: "45" },
    "dry-run": { type: "boolean", default: false }, help: { type: "boolean", default: false },
  } });
  if (values.help) return values;
  assert.ok(Boolean(values.plan) !== Boolean(values.issues), "Provide either --plan FILE or --issues N,N");
  for (const [name, max] of [["concurrency", 4], ["rounds", 10], ["task-minutes", 120]]) {
    assert.ok(/^[1-9]\d*$/.test(values[name]) && Number(values[name]) <= max, `Invalid --${name}`);
    values[name] = Number(values[name]);
  }
  return values;
}

async function selectedTasks(config) {
  if (config.plan) return validateTasks(JSON.parse(await readFile(resolve(config.plan), "utf8")));
  assert.ok(/^[1-9]\d*(,[1-9]\d*)*$/.test(config.issues), "Use --issues N,N");
  const numbers = config.issues.split(",").map(Number);
  assert.ok(numbers.length <= 20 && new Set(numbers).size === numbers.length, "Select distinct issues, at most 20");
  assert.ok(numbers.every(Number.isSafeInteger), "Invalid issue number");
  const tasks = [];
  for (const number of numbers) {
    const issue = JSON.parse(await gh("issue", "view", String(number), "--repo", repo, "--json", "number,title,body,state,labels,comments"));
    assert.ok(issue.state === "OPEN" && issue.labels.some((label) => label.name === "ready-for-agent"), "Selected issues must be open and ready-for-agent");
    const blockers = await gh("api", "--paginate", `repos/${repo}/issues/${number}/dependencies/blocked_by`, "--jq", ".[].state");
    assert.ok(blockers.split("\n").filter(Boolean).every((state) => state === "closed"), "Selected issue has an open blocker");
    tasks.push({ id: `issue-${number}`, issue: number, title: issue.title,
      body: JSON.stringify({ specification: issue.body, comments: issue.comments }) });
  }
  return validateTasks(tasks);
}

export function prBody(result) {
  return `## Summary\n\nImplement task \`${result.id}\`${result.issue ? ` (refs #${result.issue})` : ""}.\n\n\`\`\`text\nimplementation → repository checks → independent review → draft PR\n\`\`\`\n\n## Evidence\n\n- Repository checks passed for \`${result.head}\`.\n- Independent review approved that same revision after ${result.rounds} round(s).\n- GitHub CI must pass before owner-controlled merge.\n\n## Merge Danger\n\n**Door:** two-way\n\nTask branch; no automatic merge or deployment.\n\n**Blast Radius:** task\n`;
}

export async function publish(result, call = command, { stopped = () => false } = {}) {
  assert.ok(!stopped(), "Batch interrupted");
  assert.equal(result.status, "ready");
  assert.equal(result.head, result.reviewedHead, "Publication requires review of the exact HEAD");
  assert.match(result.head, /^[0-9a-f]{40}$/);
  assert.match(result.branch, /^sandcastle\/[a-z0-9-]+\/[a-z0-9-]+$/);
  assert.match(result.id, /^[a-z0-9][a-z0-9-]{0,39}$/);
  assert.match(result.base, /^[0-9a-f]{40}$/);
  assert.ok(result.issue === undefined || (Number.isSafeInteger(result.issue) && result.issue > 0));
  assert.ok(Number.isSafeInteger(result.rounds) && result.rounds >= 1 && result.rounds <= 10);
  const head = await call("git", ["rev-parse", result.branch]);
  assert.equal(head, result.head, "Task branch moved after review");
  await call("git", ["fetch", "origin", "main"]);
  assert.equal(await call("git", ["rev-parse", "origin/main"]), result.base, "main changed; rebase, check and review before publication");
  assert.ok(!stopped(), "Batch interrupted");
  await call("git", ["push", "origin", `${result.head}:refs/heads/${result.branch}`]);
  const bodyPath = join(result.dir, "pr-body.md");
  await writeFile(bodyPath, prBody(result), { mode: 0o600 });
  const existing = async () => JSON.parse(await call("gh", ["pr", "list", "--repo", repo, "--head", result.branch, "--base", "main", "--state", "open", "--json", "url"]));
  let prs = await existing();
  if (prs.length === 0) {
    assert.ok(!stopped(), "Batch interrupted");
    try {
      await call("gh", ["pr", "create", "--repo", repo, "--base", "main", "--head", result.branch,
        "--title", `Implement ${result.id}`, "--body-file", bodyPath, "--draft"]);
    } catch {
      // A create response can be lost after the PR was saved; reconcile before retrying.
      prs = await existing();
      assert.equal(prs.length, 1, "PR creation failed; the pushed branch is preserved");
    }
    prs = await existing();
  }
  assert.equal(prs.length, 1, "Expected one task PR");
  const pr = JSON.parse(await call("gh", ["pr", "view", prs[0].url, "--repo", repo, "--json", "url,headRefOid,baseRefName"]));
  assert.equal(pr.headRefOid, result.head);
  assert.equal(pr.baseRefName, "main");
  return pr.url;
}

export async function waitForCI(pr, head, { call = command, stopped = () => false, timeoutMs = 600_000, intervalMs = 5000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  do {
    assert.ok(!stopped(), "Batch interrupted");
    const value = JSON.parse(await call("gh", ["pr", "view", pr, "--repo", repo, "--json", "headRefOid,statusCheckRollup"]));
    assert.equal(value.headRefOid, head, "PR revision changed while waiting for checks");
    const check = (value.statusCheckRollup || []).find((entry) => entry.name === "Repository checks");
    if (check?.status === "COMPLETED") return check.conclusion === "SUCCESS" ? "success" : "failure";
    await new Promise((done) => setTimeout(done, intervalMs));
  } while (Date.now() < deadline);
  return "pending";
}

async function main(args) {
  if (args[0] === "--worker") {
    assert.equal(args.length, 2);
    assert.equal(process.platform, "linux", "Workers run only in the managed BO cloud VM");
    assert.ok(resolve(args[1]).startsWith(join(root, ".sandcastle/runs") + "/") && resolve(args[1]).endsWith("/job.json"));
    const job = JSON.parse(await readFile(args[1], "utf8"));
    assert.equal(job.root, root);
    assert.ok(job.dir.startsWith(join(root, ".sandcastle/runs/")) && !job.dir.includes(".."));
    validateTasks([job.task]);
    assert.match(job.base, /^[0-9a-f]{40}$/);
    assert.match(job.branch, /^sandcastle\/[a-z0-9-]+\/[a-z0-9-]+$/);
    try { await privateJSON(join(job.dir, "result.json"), await runTask(job)); }
    catch { await privateJSON(join(job.dir, "result.json"), { status: "failed", id: job.task.id, branch: job.branch }); process.exitCode = 1; }
    return;
  }
  const config = options(args);
  if (config.help) {
    console.log("Sandcastle BO: --issues N,N | --plan FILE [--concurrency 1..4] [--rounds 1..10] [--task-minutes 1..120] [--dry-run]\nSet SANDCASTLE_MODEL. Normal execution creates draft PRs; it never merges them.");
    return;
  }
  assert.equal(await git("status", "--porcelain=v1", "--untracked-files=all"), "", "Start from a clean checkout");
  assert.match(await git("remote", "get-url", "origin"), /^(https:\/\/github\.com\/TeamAcc2025\/bo(?:\.git)?|git@github\.com:TeamAcc2025\/bo(?:\.git)?)$/i, "Expected BO origin");
  const model = process.env.SANDCASTLE_MODEL;
  assert.ok(typeof model === "string" && /^[a-zA-Z0-9._/-]{1,100}$/.test(model), "Set SANDCASTLE_MODEL");
  const tasks = await selectedTasks(config);
  if (config["dry-run"]) {
    console.log(JSON.stringify({ tasks: tasks.map(({ id }) => id), concurrency: config.concurrency, rounds: config.rounds,
      taskMinutes: config["task-minutes"], model, publication: "draft PR per passing task; no merge" }, null, 2));
    return;
  }
  assert.equal(process.platform, "linux", "Execute agents only inside the BO managed cloud VM");
  const policy = JSON.parse(await readFile("/etc/codex/network-policy.json", "utf8"));
  assert.equal(policy.version, 1, "Managed cloud network policy unavailable");
  await command("timeout", ["--version"]);
  const permissions = JSON.parse(await gh("repo", "view", repo, "--json", "viewerPermission"));
  assert.ok(["ADMIN", "MAINTAIN", "WRITE"].includes(permissions.viewerPermission), "GitHub write authorization is required");
  await access(resolve(root, await git("rev-parse", "--git-path", "hooks/pre-commit")), constants.X_OK);
  await git("fetch", "origin", "main");
  const base = await git("rev-parse", "origin/main");
  const originalHead = await git("rev-parse", "HEAD");
  const runId = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const dir = join(root, ".sandcastle/runs", runId);
  await mkdir(dir, { recursive: true, mode: 0o700 });
  console.log(`Private run artifacts: ${dir}`);
  const preflightConfig = await privateGitConfig(root, dir);
  const children = new Set();
  let stopping = false;
  const stop = () => { stopping = true; for (const child of children) child.kill("SIGTERM"); };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  const preflight = await open(join(dir, "preflight.log"), "w", 0o600);
  try {
    await boundedProcess([process.execPath, join(root, ".sandcastle/smoke.mjs")], {
      cwd: root, seconds: 120, logFd: preflight.fd, children,
      env: { ...process.env, GIT_CONFIG_GLOBAL: preflightConfig },
    });
  } finally { await preflight.close(); }
  let publication = Promise.resolve();
  const outcomes = await pool(tasks, config.concurrency, async (task) => {
    assert.ok(!stopping, "Batch interrupted");
    const taskDir = join(dir, task.id);
    await mkdir(taskDir, { mode: 0o700 });
    const branch = `sandcastle/${runId}/${task.id}`;
    const jobPath = join(taskDir, "job.json");
    await privateJSON(jobPath, { root, task, branch, base, model, rounds: config.rounds, dir: taskDir });
    const log = await open(join(taskDir, "worker.log"), "w", 0o600);
    console.log(`${task.id}: started`);
    try {
      await boundedProcess([process.execPath, fileURLToPath(import.meta.url), "--worker", jobPath], {
        cwd: root, seconds: config["task-minutes"] * 60, logFd: log.fd, children,
      });
    } finally { await log.close(); }
    const result = JSON.parse(await readFile(join(taskDir, "result.json"), "utf8"));
    assert.ok(!stopping, "Batch interrupted");
    assert.equal(result.status, "ready");
    assert.equal(result.id, task.id);
    assert.equal(result.issue, task.issue);
    assert.equal(result.branch, branch);
    assert.equal(result.base, base);
    assert.equal(await git("rev-parse", "HEAD"), originalHead, "Coordinator HEAD changed");
    assert.equal(await git("status", "--porcelain=v1", "--untracked-files=all"), "", "Coordinator working tree changed");
    result.dir = taskDir;
    publication = publication.catch(() => {}).then(() => {
      assert.ok(!stopping, "Batch interrupted");
      return publish(result, command, { stopped: () => stopping });
    });
    result.pr = await publication;
    result.status = "pr-created";
    result.ci = "pending";
    await privateJSON(join(taskDir, "result.json"), result);
    console.log(`${task.id}: ${result.pr}`);
    try { result.ci = await waitForCI(result.pr, result.head, { stopped: () => stopping }); }
    catch { result.ci = "unconfirmed"; }
    await privateJSON(join(taskDir, "result.json"), result);
    console.log(`${task.id}: CI ${result.ci}`);
    return result;
  });
  process.removeListener("SIGINT", stop);
  process.removeListener("SIGTERM", stop);
  const summary = outcomes.map((outcome, i) => outcome.status === "fulfilled"
    ? outcome.value : { id: tasks[i].id, status: "failed", branch: `sandcastle/${runId}/${tasks[i].id}` });
  await privateJSON(join(dir, "summary.json"), summary);
  console.log(`Private run report: ${dir}/summary.json`);
  if (summary.some((task) => task.status !== "pr-created" || task.ci !== "success")) process.exitCode = stopping ? 130 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch(() => { console.error("Sandcastle failed. Check preflight, authentication and private .sandcastle/runs artifacts; no automatic merge."); process.exitCode = 1; });
}
