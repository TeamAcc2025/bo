import { spawn } from "node:child_process";

export function boundedProcess(args, { cwd, seconds, logFd, children, env = process.env }) {
  return new Promise((done, fail) => {
    const child = spawn("timeout", ["--signal=TERM", "--kill-after=5s", `${seconds}s`, ...args],
      { cwd, env, stdio: ["ignore", logFd, logFd] });
    children.add(child);
    child.on("error", (error) => { children.delete(child); fail(error); });
    child.on("close", (code) => {
      children.delete(child);
      code === 0 ? done() : fail(new Error("Process failed or timed out; inspect private run artifacts"));
    });
  });
}
