import { marker, smokeOptions } from "./smoke-config.mjs";
import { runSmoke } from "./smoke-runtime.mjs";

try {
  await runSmoke((config) => smokeOptions(process.env.SANDCASTLE_MODEL, config), () => {});
  console.log(`${marker}: one iteration, no commits, HEAD and working tree unchanged`);
} catch {
  console.error("Sandcastle smoke failed. Check CLI authentication, network access, and private .sandcastle/logs/smoke-*/smoke.log.");
  process.exitCode = 1;
}
