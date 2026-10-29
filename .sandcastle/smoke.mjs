import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { run } from "@ai-hero/sandcastle";
import { marker, smokeOptions } from "./smoke-config.mjs";

const snapshot = () => [
  execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }),
  execFileSync("git", ["status", "--porcelain=v1", "--untracked-files=all"], { encoding: "utf8" }),
];

try {
  const before = snapshot();
  assert.equal(before[1], "", "Run the smoke test from a clean checkout");
  const result = await run(smokeOptions(process.env.SANDCASTLE_MODEL));
  assert.equal(result.iterations.length, 1);
  assert.equal(result.completionSignal, marker);
  assert.equal(result.stdout.trim(), marker);
  assert.deepEqual(result.commits, []);
  assert.deepEqual(snapshot(), before);
  console.log(`${marker}: one iteration, no commits, HEAD and working tree unchanged`);
} catch {
  console.error("Sandcastle smoke failed. Check CLI authentication, network access, and private .sandcastle/logs/smoke.log.");
  process.exitCode = 1;
}
