import test from "node:test";
import { runClosedFixtures } from "./fixtures/public-video-native-closed.mjs";
import { runLifecycleFaults } from "./fixtures/public-video-native-lifecycle.mjs";
import { runActualGuardComposition } from "./fixtures/public-video-native-composition.mjs";
import { runStreamingCloseFixtures } from "./fixtures/public-video-native-streaming.mjs";
import { runClosingIntentFaults } from "./fixtures/public-video-native-close-intent.mjs";

test("native diagnostic remains closed under real browser boundary and lifecycle failures", { timeout: 120_000 }, async t => {
  await t.test("20 local response, frame, redirect, cookie and deadline cases", runClosedFixtures);
  await t.test("6 close and route-install fault cases", runLifecycleFaults);
  await t.test("6 actual release guard and exact runner adapter composition cases", runActualGuardComposition);
  await t.test("3 approved streaming body and pending header close cases", runStreamingCloseFixtures);
  await t.test("4 explicit close intent and ambiguous or admitted failure cases", runClosingIntentFaults);
});
