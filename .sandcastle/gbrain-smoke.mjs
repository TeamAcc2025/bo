import assert from "node:assert/strict";
import { gbrainSmokeOptions, marker, recallEvidence } from "./gbrain-smoke-config.mjs";
import { runSmoke } from "./smoke-runtime.mjs";

try {
  const evidence = recallEvidence();
  await runSmoke((config) => gbrainSmokeOptions(process.env.SANDCASTLE_MODEL, config, evidence), () => {
    assert.ok(evidence.passed(), "A completed successful native GBrain recall is required");
  });
  console.log(`${marker}: completed native recall, one iteration, no commits, HEAD and working tree unchanged`);
} catch {
  console.error("GBrain smoke failed. Inspect private .sandcastle/logs/smoke-*/smoke.log locally. Stop on authentication failure; do not retry models or change authentication.");
  process.exitCode = 1;
}
