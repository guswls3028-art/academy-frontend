import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { isChunkLoadError } from "../../src/shared/utils/chunkLoadError.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("React.lazy default export TypeError is treated as a deploy chunk race", () => {
  const error = new TypeError(
    "Cannot read properties of undefined (reading 'default')",
  );

  assert.equal(isChunkLoadError(error, "\n    at Lazy\n    at Suspense"), true);
});

test("React lazy module-shape errors are treated as deploy chunk races", () => {
  const error = new Error(
    "Element type is invalid. Received a promise that resolves to: undefined. Lazy element type must resolve to a class or function.",
  );

  assert.equal(isChunkLoadError(error, "\n    at Lazy\n    at Suspense"), true);
});

test("ordinary component TypeErrors are not hidden by chunk recovery", () => {
  const error = new TypeError(
    "Cannot read properties of undefined (reading 'map')",
  );

  assert.equal(isChunkLoadError(error, "\n    at Lazy\n    at ClinicPrintoutPage"), false);
});

test("known dynamic import failures remain recoverable", () => {
  assert.equal(
    isChunkLoadError(new Error("Failed to fetch dynamically imported module")),
    true,
  );
  assert.equal(isChunkLoadError(new Error("LAZY_DEFAULT_UNDEFINED")), true);
  assert.equal(
    isChunkLoadError(new Error("Unable to preload CSS for /assets/StopwatchPage-example.css")),
    true,
  );
});

test("production errors reach the chunk-recovering boundary before developer UI", () => {
  const main = fs.readFileSync(path.join(root, "src/main.tsx"), "utf8");
  assert.match(
    main,
    /<ErrorBoundary>[\s\S]*\{import\.meta\.env\.DEV \? \([\s\S]*<DevErrorBoundary>[\s\S]*\) : AppContent\}[\s\S]*<\/ErrorBoundary>/,
  );
  assert.doesNotMatch(
    main,
    /<ErrorBoundary>\s*<DevErrorBoundary>/,
    "DevErrorBoundary must not intercept production chunk errors",
  );
});
