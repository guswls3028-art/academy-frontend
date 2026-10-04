import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { developmentRealUseCases } from "../e2e/suites.mjs";

const output = fileURLToPath(new URL("../test-results/development-release-progress.json", import.meta.url));
const allowed = new Set(Object.keys(developmentRealUseCases).map((file) => path.basename(file)));
const statuses = new Set(["passed", "failed", "timedOut", "skipped", "interrupted"]);

// This diagnostic is not acceptance evidence. The complete JSON report and
// exact cleanup-zero assertions remain the only release gate.
export default class ReleaseCanaryProgressReporter {
  constructor() { this.completed = []; this.active = null; }
  identify(test) {
    const file = path.basename(test.location.file);
    const line = test.location.line;
    return allowed.has(file) && Number.isSafeInteger(line) && line > 0 ? { file, line } : null;
  }
  persist() {
    fs.mkdirSync(path.dirname(output), { recursive: true });
    const progress = { schema: "release-canary-progress/v1", diagnosticOnly: true,
      active: this.active, completed: this.completed, updatedAt: new Date().toISOString() };
    fs.writeFileSync(output, JSON.stringify(progress, null, 2));
  }
  onBegin() { this.persist(); }
  onTestBegin(test) { this.active = this.identify(test); this.persist(); }
  onTestEnd(test, result) {
    const identity = this.identify(test);
    if (identity && statuses.has(result.status) && Number.isFinite(result.duration)
        && result.duration >= 0 && result.duration <= 2 * 60 * 60_000 && this.completed.length < 64) {
      this.completed.push({ ...identity, status: result.status, durationMs: Math.round(result.duration) });
    }
    this.active = null;
    this.persist();
  }
}
