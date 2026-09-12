import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as runner from "../run-development-release-canary.mjs";

const source = readFileSync(new URL("../run-development-release-canary.mjs", import.meta.url), "utf8");
const tenantId = 912345;
const videoId = 823456;
const tenant = "qa-ymath-realuse-video-scope-unit";
const common = { TenantCode: [tenant], SyntheticLongVideo: ["true"] };
const manifest = { releaseImageTag: "unit-release", images: { "academy-api": { digest: "unit-digest" } } };
const runtime = {
  videos: 1, video_accesses: 2, proctored_video_accesses: 2, video_progresses: 2,
  playback_sessions: 4, active_playback_sessions: 0, playback_events: 20,
  player_errors: 0, violated_events: 0,
};
const inspect = {
  status: "DEVELOPMENT_QA_IDENTITY_PASS", tenant_code: tenant, tenant_id: tenantId,
  release_id: manifest.releaseImageTag, digest: manifest.images["academy-api"].digest,
  remaining: { tenants: 1, users: 3 }, synthetic_video_id: videoId,
  video_state: { ...runtime, videos: 2 }, synthetic_video_state: { ...runtime },
};

function observe(payload = inspect, expectedTenantId = tenantId, expectedVideoId = videoId) {
  return runner.observePostPlaybackInspect(payload, expectedTenantId, expectedVideoId, manifest);
}

function assertSafe(observation) {
  assert.doesNotMatch(JSON.stringify(observation), /912345|823456|tenant_code|synthetic_video_id|raw-secret|private\.example|token=|Bearer/);
}

test("exact VideoId is permitted only on synthetic post-playback Inspect with an exact TenantId", () => {
  assert.deepEqual(runner.fixedOperationParameters(common, "Inspect", tenantId, videoId), {
    ...common, Action: ["Inspect"], TenantId: [String(tenantId)], VideoId: [String(videoId)],
  });
  for (const [action, id] of [["Inspect", undefined], ["Setup", undefined], ["Cleanup", tenantId], ["Inspect", tenantId]]) {
    assert.equal(Object.hasOwn(runner.fixedOperationParameters(common, action, id), "VideoId"), false);
  }
  for (const invalid of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, "823456", null]) {
    assert.throws(() => runner.fixedOperationParameters(common, "Inspect", tenantId, invalid));
  }
  assert.throws(() => runner.fixedOperationParameters(common, "Inspect", undefined, videoId));
  assert.throws(() => runner.fixedOperationParameters(common, "Inspect", 0, videoId));
  assert.throws(() => runner.fixedOperationParameters(common, "Setup", undefined, videoId));
  assert.throws(() => runner.fixedOperationParameters(common, "Cleanup", tenantId, videoId));
  for (const synthetic of [undefined, ["false"], ["true", "false"]]) {
    assert.throws(() => runner.fixedOperationParameters({ ...common, SyntheticLongVideo: synthetic }, "Inspect", tenantId, videoId));
  }
});

test("post-playback runtime uses exact synthetic counts while preserving additional aggregate videos", () => {
  const observation = observe();
  assert.deepEqual(observation, {
    statusMatches: true, remainingZero: false, releaseMatches: true, digestMatches: true,
    tenantIdMatches: true, videoIdMatches: true,
    aggregateVideoState: inspect.video_state, syntheticVideoState: runtime,
  });
  assert.deepEqual(runner.assertPostPlaybackInspect(observation), runner.observeLongVideoRuntime(runtime));
  assert.throws(() => runner.observeLongVideoRuntime(inspect.video_state), "the existing exact video-count assertion stays strict");
  assertSafe(observation);
  observation.aggregateVideoState.videos = 99;
  observation.syntheticVideoState.videos = 99;
  assert.equal(inspect.video_state.videos, 2);
  assert.equal(inspect.synthetic_video_state.videos, 1);
});

test("missing scope, foreign echo and incomplete runtime remain failures with safe evidence", () => {
  for (const patch of [
    { synthetic_video_id: undefined }, { synthetic_video_id: videoId + 1 }, { synthetic_video_id: String(videoId) },
    { tenant_id: tenantId + 1 }, { tenant_id: undefined }, { synthetic_video_state: undefined },
    { status: "raw-secret" }, { release_id: "raw-secret" }, { digest: "raw-secret" },
    { remaining: { tenants: 0, users: 0 } },
    ...Object.entries({ videos: 2, video_accesses: 3, proctored_video_accesses: 1, video_progresses: 1,
      playback_sessions: 3, active_playback_sessions: 1, playback_events: 3, player_errors: 1, violated_events: 1 })
      .map(([key, value]) => ({ synthetic_video_state: { ...runtime, [key]: value } })),
  ]) {
    const observation = observe({ ...inspect, ...patch });
    assert.throws(() => runner.assertPostPlaybackInspect(observation));
    assert.deepEqual(observation.aggregateVideoState, inspect.video_state);
    assertSafe(observation);
  }
  for (const invalid of [0, -1, Number.MAX_SAFE_INTEGER + 1, String(tenantId), null]) {
    assert.equal(observe(inspect, invalid).tenantIdMatches, false);
    assert.equal(observe(inspect, tenantId, invalid).videoIdMatches, false);
  }
});

test("numeric snapshots reject malformed, extra and raw fields without discarding the other safe block", () => {
  const missing = { ...runtime };
  delete missing.video_progresses;
  for (const invalid of [null, [], "raw-secret https://private.example/?token=raw-secret", missing,
    { ...runtime, raw: "Bearer raw-secret" },
    ...["2", true, -1, 1.5, 1_000_001, Number.NaN, Number.POSITIVE_INFINITY]
      .map((value) => ({ ...runtime, video_accesses: value })),
  ]) {
    const aggregateInvalid = observe({ ...inspect, video_state: invalid, raw: "raw-secret" });
    assert.equal(aggregateInvalid.aggregateVideoState, null);
    assert.deepEqual(aggregateInvalid.syntheticVideoState, runtime);
    assertSafe(aggregateInvalid);
    const scopedInvalid = observe({ ...inspect, synthetic_video_state: invalid, raw: "raw-secret" });
    assert.deepEqual(scopedInvalid.aggregateVideoState, inspect.video_state);
    assert.equal(scopedInvalid.syntheticVideoState, null);
    assert.throws(() => runner.assertPostPlaybackInspect(scopedInvalid));
    assertSafe(scopedInvalid);
  }
  const absent = observe(null);
  assert.equal(absent.aggregateVideoState, null);
  assert.equal(absent.syntheticVideoState, null);
  assert.throws(() => runner.assertPostPlaybackInspect(absent));
  assertSafe(absent);
});

test("official post-playback operation persists numeric snapshots before command and ownership assertions", async () => {
  const operationSource = source.match(/  async function operation\([\s\S]*?\n  }\n  let server;/)?.[0]
    .replace(/\n  let server;$/, "");
  assert.ok(operationSource, "test must exercise the official operation function");
  const createOperation = new Function("deps", `
    const { assert, session, fixedOperationParameters, observeFixedOperationResult, setupTenantIdFromOperation,
      observePostPlaybackInspect, tenant, scenario, manifest, remember } = deps;
    const QA_DOCUMENT = "unit-fixed-document";
    const common = deps.common;
    const interrupted = false;
    let scenarioTenantId = null, cleanupObservation = null, postCleanupInspectOperationObservation = null;
    let operationObservation = null, postPlaybackInspectObservation = null;
    const writeEvidence = () => deps.persist(postPlaybackInspectObservation);
    ${operationSource}
    return operation;
  `);
  for (const failureStage of ["exit", "remember", "json", "status", "tenant"]) {
    const snapshots = [];
    const payload = { ...inspect, ...(failureStage === "status" ? { status: "DEVELOPMENT_QA_FAILED" } : {}),
      ...(failureStage === "tenant" ? { tenant_code: "raw-secret" } : {}) };
    const operation = createOperation({ assert, ...runner, tenant, common, manifest,
      scenario: { tenant_id: tenantId, synthetic_long_video: { video_id: videoId } },
      session: (_name, parameters) => {
        assert.deepEqual(parameters.VideoId, [String(videoId)]);
        assert.deepEqual(parameters.TenantId, [String(tenantId)]);
        return { done: Promise.resolve({ code: failureStage === "exit" ? 1 : 0,
          stdout: failureStage === "json" ? "{invalid raw-secret" : JSON.stringify(payload) }) };
      },
      remember: () => { if (failureStage === "remember") throw new Error("raw-secret"); },
      persist: (observation) => snapshots.push(structuredClone(observation)),
    });
    await assert.rejects(operation("Inspect", tenantId, "post-playback", videoId));
    assert.equal(snapshots.length, 1, `${failureStage}: numeric observation must persist before rejection`);
    if (failureStage !== "json") {
      assert.deepEqual(snapshots[0].aggregateVideoState, inspect.video_state);
      assert.deepEqual(snapshots[0].syntheticVideoState, runtime);
    }
    assertSafe(snapshots[0]);
  }
});

test("official flow passes Setup video only to post-playback Inspect and preserves inert initial evidence", async () => {
  assert.ok(/operation\("Inspect", scenario\.tenant_id, "post-playback", (?:longVideo\.video_id|scenario\.synthetic_long_video\.video_id)\)/.test(source));
  assert.ok(/videoRuntimeObservation = assertPostPlaybackInspect\(postPlaybackInspectObservation\)/.test(source));
  assert.equal(/observeLongVideoRuntime\(postPlayback\.video_state\)/.test(source), false);
  assert.ok(/operation\("Cleanup", scenarioTenantId\)/.test(source));
  assert.ok(/operation\("Inspect", scenarioTenantId, "post-cleanup"\)/.test(source));
  const snapshots = [];
  const stages = ["process", "bundle", "governance", "iam", "document", "host", "ssm"];
  await runner.runPreflightStages(stages.map((name) => [name, () => {}]),
    (evidence) => snapshots.push(structuredClone(evidence)), "a".repeat(40));
  assert.equal(snapshots[0].postPlaybackInspectObservation, null);
  assert.equal(snapshots[0].passed, false);
});
