import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { run } from "@ai-hero/sandcastle";
import { privateGitConfig } from "./workflow-core.mjs";

export async function runSmoke(makeOptions, validate, { root = process.cwd(), runAgent = run } = {}) {
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const snapshot = () => [git("rev-parse", "HEAD"), git("status", "--porcelain=v1", "--untracked-files=all")];
  const before = snapshot();
  assert.equal(before[1], "", "Run the smoke test from a clean checkout");
  try {
    const logs = join(root, ".sandcastle/logs");
    // Refuse to create private artifacts if this checkout would track them.
    git("check-ignore", "--quiet", join(logs, "smoke-private"));
    await mkdir(logs, { recursive: true, mode: 0o700 });
    const dir = await mkdtemp(join(logs, "smoke-"));
    const config = await privateGitConfig(root, dir);
    const options = makeOptions(config);
    const path = join(dir, "smoke.log");
    await writeFile(path, "", { mode: 0o600 });
    const result = await runAgent({ ...options, cwd: root, logging: { ...options.logging, path } });
    assert.equal(result.iterations.length, 1, "Smoke requires one iteration");
    assert.equal(result.completionSignal, options.completionSignal, "Smoke marker missing");
    assert.equal(result.stdout.trim(), options.completionSignal, "Smoke requires the exact marker");
    assert.deepEqual(result.commits, [], "Smoke must produce no commits");
    validate(result);
  } finally {
    assert.deepEqual(snapshot(), before, "Smoke changed HEAD and working tree");
  }
}
