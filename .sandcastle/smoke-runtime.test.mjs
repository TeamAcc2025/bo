import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { runSmoke } from "./smoke-runtime.mjs";
import { marker, smokeOptions } from "./smoke-config.mjs";

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "bo-offline-smoke-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  git("init", "-q");
  await writeFile(join(root, ".gitignore"), ".sandcastle/logs/\n");
  git("add", ".gitignore");
  git("-c", "user.name=Synthetic", "-c", "user.email=synthetic@example.invalid", "commit", "-qm", "Synthetic fixture");
  return { root, git };
}

const options = (config) => smokeOptions("test-model", config);
const result = () => ({ iterations: [{}], completionSignal: marker, stdout: marker, commits: [] });

test("smoke uses a private Git config and ignored private logs without changing the checkout", async (t) => {
  const { root } = await fixture(t);
  await runSmoke(options, () => {}, { root, runAgent: async (opts) => {
    const config = opts.sandbox.env.GIT_CONFIG_GLOBAL;
    assert.ok((await readFile(config, "utf8")).includes("include"));
    assert.equal((await stat(config)).mode & 0o777, 0o600);
    assert.equal((await stat(dirname(opts.logging.path))).mode & 0o777, 0o700);
    assert.equal((await stat(opts.logging.path)).mode & 0o777, 0o600);
    assert.equal(opts.cwd, root);
    return result();
  } });
});

test("a dirty checkout fails before starting the SDK", async (t) => {
  const { root } = await fixture(t);
  await writeFile(join(root, "synthetic.txt"), "synthetic\n");
  let started = false;
  await assert.rejects(runSmoke(options, () => {}, { root, runAgent: async () => { started = true; } }), /clean checkout/);
  assert.equal(started, false);
});

for (const [name, change] of [
  ["new file", async ({ root }) => writeFile(join(root, "synthetic.txt"), "synthetic\n")],
  ["new commit", async ({ git }) => git("-c", "user.name=Synthetic", "-c", "user.email=synthetic@example.invalid", "commit", "--allow-empty", "-qm", "Synthetic fixture")],
]) {
  test(`smoke rejects a ${name}, including when the SDK fails`, async (t) => {
    const f = await fixture(t);
    await assert.rejects(runSmoke(options, () => {}, { root: f.root, runAgent: async () => {
      await change(f);
      throw new Error("Synthetic SDK failure");
    } }), /HEAD and working tree/);
  });
}

test("reported commits cannot pass even when the checkout appears unchanged", async (t) => {
  const { root } = await fixture(t);
  await assert.rejects(runSmoke(options, () => {}, { root, runAgent: async () => ({ ...result(), commits: [{ sha: "a".repeat(40) }] }) }), /no commits/);
});
