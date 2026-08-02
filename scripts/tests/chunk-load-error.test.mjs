import assert from "node:assert/strict";
import test from "node:test";

import { isChunkLoadError } from "../../src/shared/utils/chunkLoadError.ts";

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
