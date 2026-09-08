import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REGION = "ap-northeast-2";
const ACCOUNT = "809466760795";
const QA_DOCUMENT = "academy-frontend-development-qa";
const PORT_DOCUMENT = "academy-frontend-development-api-port";
const PASSWORD_PARAMETER = "/academy/api/development/ymath-realuse-password";
const WEB_ORIGIN = "http://localhost:4173";
const API_ORIGIN = "http://127.0.0.1:18000";
const FLOW_COUNTS = {
  "notice-roundtrip.spec.ts": 3,
  "qna-roundtrip.spec.ts": 4,
  "clinic-roundtrip.spec.ts": 3,
  "video-playback-renewal.realuse.spec.ts": 1,
};
const LONG_VIDEO_CHECKPOINT_STAGES = [
  "context-created", "routes-installed", "authenticated", "navigated",
  "bootstrap-observed", "access-observed", "playlist-observed", "video-mounted",
  "poster-loaded", "metadata-ready", "marker-set", "playback-state-checked",
  "play-control-visible", "play-clicked", "playback-running", "playback-started", "position-530",
  "renewal-observed", "renewal-advanced", "playback-690", "progress-observed",
  "reload-bootstrap", "reload-playlist", "reload-metadata", "reload-progress", "completed",
];
const SYNTHETIC_LONG_VIDEO_PATH = "qa-fixtures/video-long/master.m3u8";
const SYNTHETIC_LONG_VIDEO_INIT_GZIP = "H4sIAAAAAAACCpVRP0sDMRx913YqikUqOnSoUMFBj95Zby516eCqILjES2pDE++4pEHdHQRHv4EO+i0cHJz8AG5ujo5u1UsV04qCj8u9/Mj7/QdQ6+mTlKtkEyggZ66SSKatACiWZZIYAEKaPsUEii+WPPt9w5tUTdtt/IkCUJjVGRkA2NcDm7P4R/T/5a0DmLdmg1GtANSYUPqHh715Z5JykntJOt37uIude0vrfSqyrxfDKXOVu5yypEuOqGC5xmtKftQDUDXSBnXLbNDxW41mrOeUMjPMRP3z/qr0gfjQXiutqKO5JCYOfh1SHfPoAvZYxcI2MXEU+mHoB82gLvjBcRi1HI+l0QiAT0y85XXuyqNnLB527spPK28XpXa+E/u7uj+/8VDqP849AKikRKWf+fNTUdoO+QsVpVXs2FWl1elUpRWl48SxV6Vhx3kHOrMMJ74LMqQ6X9aeZJZzLLuLkZRnJE2F67TGx9tv3OoksYMn1tkG3yamF4V+5AfNjXcsVg90JgMAAA==";
const SYNTHETIC_LONG_VIDEO_MEDIA_GZIP = "H4sIAAAAAAACCu2ZQYscRRiGv5mQBUMQkURymMMHiWIg01vdOzusAwUbQzAXiSDkpp2aqurtYru7eqpr3ZmclrCHHLwFPIyXIPgbPAmLN3+BBnIwF9GLQq4RIzWbrUXw4E0iXx/mebum662HnkMXPQBwqfOLtu5UCQAQWHdmDgCjzqh5D1ZHD2Ab/uHoAbx/FZ4CHKxOB4e1tQUAvFEXpTq9ZlB5J8L4wIfxPmyddvZ3eseLXPCF8r2/1Q9G3u01AGs9gDOHAIPPw/X94y/PvZxHJBKJRCLx1eOb9DwnEolEIpGe50QikUgkEul5TiQSif+Ob39dK+EB+h+vnX3x4vaTm79++/PjW998ce1HfHz5t9/n2XiEQ5TWaUzHm+g2smwD2WiLySnDId5KsvFo/cOPbn4wHOH1OzdQWqUlDvGGbReVLjxmjG0MM5Zt4hBL79vJ+vr+/n7ymVHaVqJJrNtZD6skpa8rHKJtvbFNN0EppkJyhk4XPEWlp5WVu5xN2IShaES16HQ4w1pzZQR2e9Nac4Ztt+Bp+Myd4mnC2IQljGFt5lrloSvMyJ1odjRPxyhLZ2uR15qn6J2uKtNxhlvzLSU9ZyhnNWeotFD3bKN5ll5LUyxE5/O22zUtT08KZm1ui6LTYZIvnRaq4ylW1u6KUguVn451lZH6dIBh41ZLSFMLHzRM47WrhNSKM5xWe04scmnrVqyEbNN5J0yjVW4a70S4pnCi1qFqX5ud0rec4a5emMbzbPMk5rVpwupSN1ruharV9HBLnO7KcKMll67AeuqdDndSuoJnGwnDWVids2TMcNaGmhXFnI/fw1nbed3yEZo2d8Iby9NkxFDMOFv9y31ePzicvPMuvNb//odPAWDt+hIvfHV0nLYvnqS7MR3E9Cimo5h+eutl+hJiwpi2Y7ob00FMj2I6iin2LWPfMvYtY98y9i1j3zL2LWMf+ZEf+ZEf+ZEf+ZHf/8nvdf3gfu/ele8O4M8/Hsa93EXay5Ef+ZEf+ZEf+ZEf+b0ae7nDs788PAdnnj+7/cmc9nLkR37kR37kR37kR370Xo5+K/IjP/Ijv//a7y/rfhtCdUIAAA==";
const RELEASE_BOUNDARY_CODES = new Set([
  "api-origin", "context-disposed", "cors", "credentials", "mutation", "observation-schema",
  "origin", "redirect", "tenant", "transport", "fetch-transport", "fulfill-transport",
]);
const LONG_VIDEO_ERROR_PATTERNS = [
  ["test-timeout", /Test timeout of [0-9]+ms exceeded/i],
  ["context-closed", /Target page, context or browser has been closed|Test ended\.?/i],
  ["page-crashed", /Page crashed|browser has disconnected/i],
  ["playback-below-690", /toBeGreaterThanOrEqual[\s\S]{0,500}(?:Expected:\s*>=\s*690|690)/i],
  ["poll-timeout", /Timeout [0-9]+ms exceeded while waiting on the predicate/i],
  ["video-evaluate-failed", /locator\.evaluate/i],
  ["route-handler-failed", /route\.(?:fetch|fulfill|fallback)/i],
];
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const sha = (value) => crypto.createHash("sha256").update(value).digest("hex");
const canonical = (value) => JSON.stringify(value, function (_key, item) {
  return item && typeof item === "object" && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item;
});
const FIXED_ACTIONS = new Set(["Inspect", "Setup", "Cleanup"]);
const FIXED_STATUSES = new Set([
  "DEVELOPMENT_QA_FAILED",
  "DEVELOPMENT_QA_IDENTITY_PASS",
  "YMATH_REALUSE_SCENARIO_READY",
  "YMATH_REALUSE_SCENARIO_DESTROYED",
  "YMATH_REALUSE_SCENARIO_ABSENT",
]);
const FIXED_ERROR_TYPES = new Set([
  "AssertionError", "BotoCoreError", "ClientError", "CommandError", "ConnectionError", "DatabaseError",
  "IntegrityError", "KeyError", "OperationalError", "PermissionError", "RuntimeError", "TimeoutError",
  "TypeError", "ValueError",
]);
const PREFLIGHT_STAGES = ["process", "bundle", "governance", "iam", "document", "host", "ssm"];
const PREFLIGHT_CHECKS = PREFLIGHT_STAGES.slice(1);

function initialPreflightEvidence(frontendSha) {
  return {
    frontendSha: /^[a-f0-9]{40}$/.test(frontendSha || "") ? frontendSha : null,
    backendGovernanceSha: null, backendReleaseId: null, apiDigest: null, instanceId: null,
    tenantCode: null, artifactSha256: null, cases: null, documentSha256: {}, cleanup: null,
    operationObservation: null, inspectObservation: null, realUseObservation: null,
    videoRuntimeObservation: null,
    preflightStage: "process",
    preflightChecks: Object.fromEntries(PREFLIGHT_CHECKS.map((name) => [name, false])),
    terminalOutcome: "preflight_running", passed: false,
    failures: ["development preflight unfinished; cleanup not proven"],
  };
}

function observeLongVideoBrowserEvidence(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const expectedKeys = [
    "bootstrapCount", "consoleErrorCount", "contexts", "desktop", "endBeforeRenewCount",
    "horizontalOverflowCount", "initialMasterLoadCount", "initialMediaLoadCount",
    "maxReloadDriftSeconds", "minimumPlaybackSeconds", "minimumRenewalAdvanceSeconds",
    "minimumWallSeconds", "mobile", "pageErrorCount", "posterLoadCount", "progressPersistedCount",
    "renewCount", "requestErrorCount", "sameDomCount", "sameSessionCount", "schema",
    "sourceReloadCount", "tokenRotationCount",
  ];
  if (Object.keys(payload).sort().join(",") !== expectedKeys.sort().join(",")) return null;
  if (payload.schema !== "student-video-renewal/v1") return null;
  const numericKeys = expectedKeys.filter((key) => key !== "schema");
  if (numericKeys.some((key) => !Number.isInteger(payload[key]) || payload[key] < 0 || payload[key] > 10_000)) return null;
  if (payload.contexts !== 2 || payload.desktop !== 1 || payload.mobile !== 1
    || payload.minimumPlaybackSeconds < 690 || payload.minimumPlaybackSeconds > 900
    || payload.minimumWallSeconds < 690 || payload.minimumWallSeconds > 1_000
    || payload.bootstrapCount !== 2 || payload.renewCount !== 2 || payload.endBeforeRenewCount !== 0
    || payload.initialMasterLoadCount < 2 || payload.initialMediaLoadCount < 4
    || payload.posterLoadCount < 2
    || payload.minimumRenewalAdvanceSeconds < 5 || payload.sourceReloadCount !== 0
    || payload.sameDomCount !== 2 || payload.sameSessionCount !== 2 || payload.tokenRotationCount !== 2
    || payload.progressPersistedCount !== 2 || payload.maxReloadDriftSeconds > 2
    || payload.consoleErrorCount !== 0 || payload.pageErrorCount !== 0
    || payload.requestErrorCount !== 0 || payload.horizontalOverflowCount !== 0) return null;
  return {
    schemaMatches: true,
    contextCount: payload.contexts,
    desktopCount: payload.desktop,
    mobileCount: payload.mobile,
    minimumPlaybackSeconds: payload.minimumPlaybackSeconds,
    minimumWallSeconds: payload.minimumWallSeconds,
    bootstrapCount: payload.bootstrapCount,
    renewCount: payload.renewCount,
    endBeforeRenewCount: payload.endBeforeRenewCount,
    initialMasterLoadCount: payload.initialMasterLoadCount,
    initialMediaLoadCount: payload.initialMediaLoadCount,
    posterLoadCount: payload.posterLoadCount,
    minimumRenewalAdvanceSeconds: payload.minimumRenewalAdvanceSeconds,
    sourceReloadCount: payload.sourceReloadCount,
    sameDomCount: payload.sameDomCount,
    sameSessionCount: payload.sameSessionCount,
    tokenRotationCount: payload.tokenRotationCount,
    progressPersistedCount: payload.progressPersistedCount,
    maxReloadDriftSeconds: payload.maxReloadDriftSeconds,
    consoleErrorCount: payload.consoleErrorCount,
    pageErrorCount: payload.pageErrorCount,
    requestErrorCount: payload.requestErrorCount,
    horizontalOverflowCount: payload.horizontalOverflowCount,
  };
}

function observeLongVideoFailure(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  if (Object.keys(payload).sort().join(",") !== "contexts,schema"
    || payload.schema !== "student-video-renewal-failure/v1"
    || !Array.isArray(payload.contexts) || payload.contexts.length !== 2) return null;
  const expectedKeys = [
    "accessCheckCount", "bootstrapCount", "consoleErrorCount", "currentTime", "duration", "ended",
    "latestProgress", "masterLoads", "mediaLoads", "networkState", "pageErrorCount", "paused",
    "progressCount", "readyState", "renewCount", "requestErrorCount", "videoMounted", "viewport",
    "wallSeconds",
  ];
  const numericKeys = [
    "accessCheckCount", "bootstrapCount", "consoleErrorCount", "masterLoads", "mediaLoads",
    "pageErrorCount", "progressCount", "renewCount", "requestErrorCount", "wallSeconds",
  ];
  const nullableNumericKeys = ["currentTime", "duration", "latestProgress", "networkState", "readyState"];
  const nullableBooleanKeys = ["ended", "paused"];
  const contexts = payload.contexts.map((context) => {
    if (!context || typeof context !== "object" || Array.isArray(context)
      || Object.keys(context).sort().join(",") !== expectedKeys.sort().join(",")
      || !["desktop", "mobile"].includes(context.viewport)
      || typeof context.videoMounted !== "boolean"
      || numericKeys.some((key) => !Number.isInteger(context[key]) || context[key] < 0 || context[key] > 10_000)
      || nullableNumericKeys.some((key) => context[key] !== null
        && (!Number.isInteger(context[key]) || context[key] < 0 || context[key] > 10_000))
      || nullableBooleanKeys.some((key) => context[key] !== null && typeof context[key] !== "boolean")) return null;
    return Object.fromEntries(expectedKeys.map((key) => [key, context[key]]));
  });
  if (contexts.some((context) => context === null)
    || contexts.filter((context) => context.viewport === "desktop").length !== 1
    || contexts.filter((context) => context.viewport === "mobile").length !== 1) return null;
  return { schemaMatches: true, contexts };
}

export function observeReleaseTestResult(stdout) {
  const observation = {
    reportStatus: "unparsed",
    stats: { expected: null, skipped: null, unexpected: null, flaky: null },
    failedFiles: [], boundaryCodes: [], runnerErrorCount: null,
    readFetchRetries: null, suppressedAnalyticsBatches: null,
    suppressedAnalyticsEvents: null, suppressedCloudflareBeacons: null,
    longVideo: null, longVideoFailure: null, longVideoErrorCodes: [],
    longVideoCheckpoint: { desktop: null, mobile: null },
  };
  let report;
  try { report = JSON.parse(typeof stdout === "string" ? stdout : ""); }
  catch { return observation; }
  observation.reportStatus = "parsed";
  const safeCount = (value) => Number.isInteger(value) && value >= 0 && value <= 1000 ? value : null;
  observation.stats = Object.fromEntries(Object.keys(observation.stats)
    .map((name) => [name, safeCount(report?.stats?.[name])]));
  observation.runnerErrorCount = safeCount(Array.isArray(report?.errors) ? report.errors.length : null);
  const failedFiles = new Set();
  const messages = [];
  const transportKeys = [
    "readFetchRetries", "suppressedAnalyticsBatches",
    "suppressedAnalyticsEvents", "suppressedCloudflareBeacons",
  ];
  const transportTotals = Object.fromEntries(transportKeys.map((key) => [key, 0]));
  const transportEvidenceCounts = Object.fromEntries(transportKeys.map((key) => [key, 0]));
  const longVideoEvidence = [];
  const longVideoFailureEvidence = [];
  const longVideoMessages = [];
  const collectErrors = (errors) => {
    for (const error of Array.isArray(errors) ? errors : []) {
      if (typeof error?.message === "string") messages.push(error.message);
    }
  };
  collectErrors(report?.errors);
  const visit = (suite) => {
    for (const spec of Array.isArray(suite?.specs) ? suite.specs : []) {
      const file = path.basename(String(spec.file || suite.file || ""));
      for (const test of Array.isArray(spec.tests) ? spec.tests : []) {
        const results = Array.isArray(test.results) ? test.results : [];
        const failed = test.expectedStatus !== "passed" || test.status !== "expected"
          || results.length !== 1 || results[0]?.status !== "passed";
        if (failed && Object.hasOwn(FLOW_COUNTS, file)) failedFiles.add(file);
        for (const result of results) {
          collectErrors(result?.errors || (result?.error ? [result.error] : []));
          if (file === "video-playback-renewal.realuse.spec.ts") {
            for (const error of result?.errors || (result?.error ? [result.error] : [])) {
              if (typeof error?.message === "string") longVideoMessages.push(error.message);
            }
          }
          for (const output of Array.isArray(result?.stdout) ? result.stdout : []) {
            const text = typeof output === "string" ? output : output?.text;
            for (const line of typeof text === "string" ? text.split(/\r?\n/) : []) {
              let payload;
              try { payload = JSON.parse(line); } catch { continue; }
              if (["development", "readonly"].includes(payload?.releaseApiMode)) {
                for (const key of transportKeys) {
                  const value = safeCount(payload?.transport?.[key]);
                  if (value !== null) {
                    transportTotals[key] += value;
                    transportEvidenceCounts[key] += 1;
                  }
                }
              }
              const longVideo = observeLongVideoBrowserEvidence(payload?.longVideoRealUse);
              if (longVideo) longVideoEvidence.push(longVideo);
              const longVideoFailure = observeLongVideoFailure(payload?.longVideoFailure);
              if (longVideoFailure) longVideoFailureEvidence.push(longVideoFailure);
              const checkpoint = payload?.longVideoCheckpoint;
              if (checkpoint && typeof checkpoint === "object" && !Array.isArray(checkpoint)
                && Object.keys(checkpoint).sort().join(",") === "schema,stage,viewport"
                && checkpoint.schema === "student-video-renewal-checkpoint/v1"
                && ["desktop", "mobile"].includes(checkpoint.viewport)
                && LONG_VIDEO_CHECKPOINT_STAGES.includes(checkpoint.stage)) {
                const current = observation.longVideoCheckpoint[checkpoint.viewport];
                if (current === null || LONG_VIDEO_CHECKPOINT_STAGES.indexOf(checkpoint.stage)
                  > LONG_VIDEO_CHECKPOINT_STAGES.indexOf(current)) {
                  observation.longVideoCheckpoint[checkpoint.viewport] = checkpoint.stage;
                }
              }
            }
          }
        }
      }
    }
    for (const child of Array.isArray(suite?.suites) ? suite.suites : []) visit(child);
  };
  for (const suite of Array.isArray(report?.suites) ? report.suites : []) visit(suite);
  observation.failedFiles = [...failedFiles].sort();
  observation.boundaryCodes = [...new Set(messages.flatMap((message) =>
    [...message.matchAll(/Release request rejected \[([a-z-]+)\]/g)].map((match) => match[1])
      .filter((code) => RELEASE_BOUNDARY_CODES.has(code))))].sort();
  for (const key of transportKeys) {
    observation[key] = transportEvidenceCounts[key] > 0 ? transportTotals[key] : null;
  }
  observation.longVideo = longVideoEvidence.length === 1 ? longVideoEvidence[0] : null;
  observation.longVideoFailure = longVideoFailureEvidence.length === 1 ? longVideoFailureEvidence[0] : null;
  observation.longVideoErrorCodes = [...new Set(LONG_VIDEO_ERROR_PATTERNS
    .filter(([, pattern]) => longVideoMessages.some((message) => pattern.test(message)))
    .map(([code]) => code))].sort();
  return observation;
}

export async function runPreflightStages(stages, persist, frontendSha) {
  const evidence = initialPreflightEvidence(frontendSha);
  persist(evidence);
  try {
    assert.deepEqual(stages.map(([name]) => name), PREFLIGHT_STAGES, "Unexpected development preflight stages");
    for (const [name, check] of stages) {
      evidence.preflightStage = name;
      persist(evidence);
      await check();
      if (Object.hasOwn(evidence.preflightChecks, name)) evidence.preflightChecks[name] = true;
      persist(evidence);
    }
    evidence.preflightStage = "complete";
    evidence.terminalOutcome = "qa_running";
    persist(evidence);
    return evidence;
  } catch (error) {
    evidence.terminalOutcome = "preflight_failed";
    persist(evidence);
    throw error;
  }
}

export function observeFixedOperationResult(action, result) {
  const stdout = typeof result?.stdout === "string" ? result.stdout : "";
  const jsonLines = stdout.split(/\r?\n/).filter((line) => line.trim().startsWith("{"));
  let payload = null;
  let parseError = null;
  if (jsonLines.length === 1) {
    try { payload = JSON.parse(jsonLines[0]); }
    catch (error) { parseError = error; }
  }
  const errorType = typeof payload?.error_type === "string" && payload.error_type.length > 0
    ? (FIXED_ERROR_TYPES.has(payload.error_type) ? payload.error_type : "OtherError") : null;
  return {
    observation: {
      action: FIXED_ACTIONS.has(action) ? action : null,
      exitCode: Number.isInteger(result?.code) && result.code >= -1 && result.code <= 255 ? result.code : null,
      jsonLineCount: jsonLines.length,
      sessionIdObserved: /Starting session with SessionId:\s*[A-Za-z0-9_.:-]+/.test(stdout),
      payloadStatus: FIXED_STATUSES.has(payload?.status) ? payload.status : null,
      errorType,
    },
    payload,
    parseError,
  };
}

export function inspectMatchObservation(payload, manifest) {
  return {
    statusMatches: payload?.status === "DEVELOPMENT_QA_IDENTITY_PASS",
    remainingZero: canonical(payload?.remaining) === canonical({ tenants: 0, users: 0 }),
    releaseMatches: payload?.release_id === manifest?.releaseImageTag,
    digestMatches: payload?.digest === manifest?.images?.["academy-api"]?.digest,
  };
}

export function assertLongVideoSetup(payload) {
  assert.equal(payload?.status, "YMATH_REALUSE_SCENARIO_READY");
  assert.ok(Number.isInteger(payload?.tenant_id) && payload.tenant_id > 0);
  assert.ok(Array.isArray(payload.student_ids) && payload.student_ids.length === 2
    && payload.student_ids.every((id) => Number.isInteger(id) && id > 0));
  assert.ok(Array.isArray(payload.session_ids) && payload.session_ids.length === 2
    && payload.session_ids.every((id) => Number.isInteger(id) && id > 0));
  const fixture = payload.synthetic_long_video;
  assert.equal(fixture?.access_mode, "PROCTORED_CLASS");
  assert.equal(fixture?.duration_seconds, 900);
  assert.equal(fixture?.hls_path, SYNTHETIC_LONG_VIDEO_PATH);
  assert.equal(fixture?.video_accesses, 2);
  assert.ok(Number.isInteger(fixture?.video_id) && fixture.video_id > 0);
  return fixture;
}

export function observeLongVideoRuntime(state) {
  const keys = [
    "videos", "video_accesses", "proctored_video_accesses", "video_progresses",
    "playback_sessions", "active_playback_sessions", "playback_events", "player_errors",
    "violated_events",
  ];
  assert.ok(state && typeof state === "object" && !Array.isArray(state));
  assert.ok(keys.every((key) => Number.isInteger(state[key]) && state[key] >= 0 && state[key] <= 1_000_000));
  assert.equal(state.videos, 1);
  assert.equal(state.video_accesses, 2);
  assert.equal(state.proctored_video_accesses, 2);
  assert.equal(state.video_progresses, 2);
  assert.equal(state.playback_sessions, 4);
  assert.equal(state.active_playback_sessions, 0);
  assert.ok(state.playback_events >= 4);
  assert.equal(state.player_errors, 0);
  assert.equal(state.violated_events, 0);
  return {
    videoCount: state.videos,
    videoAccessCount: state.video_accesses,
    progressCount: state.video_progresses,
    playbackSessionCount: state.playback_sessions,
    activePlaybackSessionCount: state.active_playback_sessions,
    playbackEventCount: state.playback_events,
    playerErrorCount: state.player_errors,
    violatedEventCount: state.violated_events,
  };
}

const SYNTHETIC_LONG_VIDEO_ASSETS = new Map([
  ["/__qa__/video-long/master.m3u8", {
    contentType: "application/vnd.apple.mpegurl",
    body: Buffer.from([
      "#EXTM3U", "#EXT-X-VERSION:7", "#EXT-X-TARGETDURATION:900",
      "#EXT-X-MEDIA-SEQUENCE:0", "#EXT-X-PLAYLIST-TYPE:VOD",
      '#EXT-X-MAP:URI="init.mp4"', "#EXTINF:900.0,", "media.m4s", "#EXT-X-ENDLIST", "",
    ].join("\n")),
  }],
  ["/__qa__/video-long/init.mp4", {
    contentType: "video/mp4",
    body: gunzipSync(Buffer.from(SYNTHETIC_LONG_VIDEO_INIT_GZIP, "base64")),
  }],
  ["/__qa__/video-long/media.m4s", {
    contentType: "video/iso.segment",
    body: gunzipSync(Buffer.from(SYNTHETIC_LONG_VIDEO_MEDIA_GZIP, "base64")),
  }],
]);

export function syntheticLongVideoAsset(pathname) {
  const asset = SYNTHETIC_LONG_VIDEO_ASSETS.get(pathname);
  assert.ok(asset, "Unknown synthetic long-video asset");
  return asset;
}

export function assertReadOnlyAssessmentSource(source) {
  assert.ok(source.includes('from "../fixtures/strictTest"'), "Assessment must use the release-aware strict fixture");
  assert.ok(!/productionWriteOptInSkipReason|test\.skip|request\.(?:post|put|patch|delete)|["'](?:POST|PUT|PATCH|DELETE)["']/.test(source),
    "Reviewed assessment cannot add business writes or skip its required read-only assertions");
}

export function assertReleaseSummary(report, expected = FLOW_COUNTS) {
  const counts = {};
  const visit = (suite) => {
    for (const spec of suite.specs || []) {
      const file = path.basename(String(spec.file || suite.file || ""));
      assert.ok(Object.hasOwn(expected, file), "Unexpected release spec");
      assert.equal(spec.tests?.length, 1, "Exactly one project is required");
      for (const test of spec.tests) {
        assert.equal(test.expectedStatus, "passed", "Skipped/expected-failure case cannot satisfy release");
        assert.equal(test.status, "expected", "Unexpected/flaky release case");
        assert.equal(test.results?.length, 1, "Retries cannot satisfy release");
        assert.equal(test.results[0].status, "passed", "Non-passed release case");
        counts[file] = (counts[file] || 0) + 1;
      }
    }
    for (const child of suite.suites || []) visit(child);
  };
  visit(report);
  assert.deepEqual(counts, expected, "Missing or duplicate release cases");
  assert.equal(report.errors?.length, 0, "Release runner errors");
  assert.equal(report.stats?.skipped, 0, "Release skips are forbidden");
  assert.equal(report.stats?.unexpected, 0);
  assert.equal(report.stats?.flaky, 0);
  assert.equal(report.stats?.expected, Object.values(expected).reduce((a, b) => a + b, 0));
  return counts;
}

export function assertCleanup(payload, tenantCode) {
  assert.equal(payload.tenant_code, tenantCode, "Wrong cleanup tenant");
  assert.ok(["YMATH_REALUSE_SCENARIO_DESTROYED", "YMATH_REALUSE_SCENARIO_ABSENT"].includes(payload.status));
  assert.deepEqual(payload.remaining, { tenants: 0, users: 0 }, "Cleanup residue must be numeric zero");
}

export function isOwnedSessionTerminal(active, history, sessionId, target) {
  if (!Array.isArray(active) || active.length !== 0 || !Array.isArray(history) || history.length !== 1) return false;
  if (typeof sessionId !== "string" || !sessionId.startsWith("academy-fe-qa-")) return false;
  const session = history[0];
  return session?.SessionId === sessionId
    && session?.Target === target
    && session?.EndDate != null
    && ["Terminated", "Terminating"].includes(session?.Status);
}

export function assertManifest(manifest) {
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.complete, true);
  assert.equal(manifest.status, "successful");
  assert.match(manifest.gitSha, /^[a-f0-9]{40}$/);
  assert.match(manifest.releaseImageTag, new RegExp(`^sha-${manifest.gitSha}-run-[0-9]+-[0-9]+$`));
  assert.match(manifest.images?.["academy-api"]?.digest, /^sha256:[a-f0-9]{64}$/);
}

export function assertActiveInstance(instances, manifest) {
  assertManifest(manifest);
  assert.equal(instances.length, 1, "Exactly one active development instance is required");
  const instance = instances[0];
  const tags = Object.fromEntries((instance.Tags || []).map(({ Key, Value }) => [Key, Value]));
  for (const [key, value] of Object.entries({ Name: "academy-v1-api-development", ManagedBy: "academy-api-development",
    Environment: "development", Lifecycle: "active", ReleaseId: manifest.releaseImageTag, VerifiedReleaseId: manifest.releaseImageTag })) {
    assert.equal(tags[key], value, `Wrong development ${key}`);
  }
  assert.equal(instance.State?.Name, "running");
  assert.equal(instance.IamInstanceProfile?.Arn, `arn:aws:iam::${ACCOUNT}:instance-profile/academy-api-development`);
  assert.match(instance.InstanceId, /^i-[a-f0-9]+$/);
  return instance;
}

function aws(args) {
  try {
    return JSON.parse(execFileSync("aws", [...args, "--region", REGION, "--output", "json"], {
      encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 8 * 1024 * 1024,
      timeout: 20_000, killSignal: "SIGKILL",
    }));
  } catch { throw new Error(`AWS operation failed: ${args[0]} ${args[1]}`); }
}

async function publicJson(url) {
  const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(30_000) });
  assert.equal(response.status, 200, "Public governance metadata unavailable");
  return response.json();
}

export function artifactFingerprint(directory) {
  const entries = [];
  const visit = (folder) => {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const file = path.join(folder, entry.name);
      assert.ok(!entry.isSymbolicLink(), "Artifact cannot contain symbolic links");
      if (entry.isDirectory()) visit(file);
      else entries.push([path.relative(directory, file).replaceAll("\\", "/"), sha(fs.readFileSync(file))]);
    }
  };
  visit(directory);
  assert.ok(entries.length > 1, "Deploy artifact is empty");
  return sha(canonical(entries.sort(([a], [b]) => a.localeCompare(b))));
}

function serveArtifact(directory) {
  const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
    ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".woff2": "font/woff2", ".webp": "image/webp" };
  const server = http.createServer((request, response) => {
    try {
      assert.ok(["GET", "HEAD"].includes(request.method));
      const route = decodeURIComponent(new URL(request.url, WEB_ORIGIN).pathname);
      if (route.startsWith("/__qa__/video-long/")) {
        const asset = syntheticLongVideoAsset(route);
        response.writeHead(200, {
          "content-type": asset.contentType,
          "cache-control": "no-store",
          "access-control-allow-origin": "*",
        });
        response.end(request.method === "HEAD" ? undefined : asset.body);
        return;
      }
      let file = path.resolve(directory, `.${route}`);
      assert.ok(file.startsWith(`${directory}${path.sep}`) || file === directory);
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        assert.ok(!path.extname(route), "Missing artifact asset");
        file = path.join(directory, "index.html");
      }
      response.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream", "cache-control": "no-store" });
      response.end(request.method === "HEAD" ? undefined : fs.readFileSync(file));
    } catch { response.writeHead(404); response.end(); }
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(4173, "127.0.0.1", () => resolve(server));
  });
}

export function createRunOwnership(env) {
  assert.match(env.GITHUB_RUN_ID || "", /^[0-9]+$/);
  assert.match(env.GITHUB_RUN_ATTEMPT || "", /^[0-9]+$/);
  const tenant = `qa-ymath-realuse-fe-${env.GITHUB_RUN_ID}-${env.GITHUB_RUN_ATTEMPT}-${crypto.randomBytes(6).toString("hex")}`;
  assert.ok(tenant.length <= 50, "QA tenant exceeds the database code boundary");
  return { tenant, capability: crypto.randomBytes(32).toString("hex") };
}

export function ownedProcess(command, args, options = {}, timeout = 240_000, killGrace = 5_000) {
  const child = spawn(command, args, { cwd: ROOT, env: process.env, stdio: ["ignore", "pipe", "pipe"],
    detached: process.platform !== "win32", windowsHide: true, ...options });
  let escalation;
  let closed = false;
  const kill = (signal) => {
    if (closed || !child.pid) return;
    try {
      if (process.platform === "win32") child.kill(signal);
      else process.kill(-child.pid, signal);
    } catch { /* already exited */ }
  };
  const stop = () => {
    // An exited group leader can leave a descendant holding the output pipes.
    // Wait for close, not exitCode, before considering the whole process reaped.
    if (closed || !child.pid) return;
    kill("SIGTERM");
    escalation ??= setTimeout(() => kill("SIGKILL"), killGrace);
  };
  let stdout = "";
  let failed = false;
  child.stdout.on("data", (data) => { stdout += data; if (stdout.length > 16 * 1024 * 1024) { failed = true; stop(); } });
  // Raw stderr may contain request payloads or credentials. Never relay it.
  child.stderr.resume();
  const timer = setTimeout(() => { failed = true; stop(); }, timeout);
  const done = new Promise((resolve) => {
    child.once("error", () => { closed = true; failed = true; clearTimeout(timer); clearTimeout(escalation); resolve({ code: -1, stdout }); });
    child.once("close", (code) => { closed = true; clearTimeout(timer); clearTimeout(escalation); resolve({ code: failed ? -1 : code, stdout }); });
  });
  return { child, done, stop, output: () => stdout };
}

async function assertFreePort(port) {
  const probe = net.createServer();
  await new Promise((resolve, reject) => {
    probe.once("error", () => reject(new Error("Required loopback port is already owned")));
    probe.listen(port, "127.0.0.1", resolve);
  });
  await new Promise((resolve) => probe.close(resolve));
}

async function waitPort(port, interrupted) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    assert.equal(interrupted(), false, "Development run interrupted");
    const open = await new Promise((resolve) => {
      const socket = net.connect({ host: "127.0.0.1", port });
      socket.once("connect", () => { socket.destroy(); resolve(true); });
      socket.once("error", () => resolve(false));
    });
    if (open) return;
    await delay(1_000);
  }
  throw new Error("Owned development tunnel did not become ready");
}

export async function run() {
  const evidencePath = path.join(ROOT, "test-results/development-release.json");
  const persistEvidence = (evidence) => {
    fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
    fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2));
  };
  let identity;
  let bundle;
  let fingerprint;
  let revision;
  let raw;
  let manifest;
  let expectedDocuments;
  let instance;
  let instanceId;
  let tenant;
  let capability;
  const evidence = await runPreflightStages([
    ["process", () => {
      assert.equal(process.env.GITHUB_ACTIONS, "true", "Official CI only; no implicit local synthetic run");
      assert.equal(process.env.GITHUB_EVENT_NAME, "push");
      assert.equal(process.env.GITHUB_REF, "refs/heads/main");
      assert.match(process.env.GITHUB_SHA || "", /^[a-f0-9]{40}$/);
      identity = aws(["sts", "get-caller-identity"]);
      assert.equal(identity.Account, ACCOUNT);
      assert.match(identity.Arn, /:assumed-role\/academy-frontend-development-qa\/academy-fe-qa-[0-9-]+$/);
      ({ tenant, capability } = createRunOwnership(process.env));
      assert.ok(identity.Arn.endsWith(`/academy-fe-qa-${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT}`));
    }],
    ["bundle", () => {
      bundle = path.join(ROOT, ".deploy-bundle");
      fingerprint = artifactFingerprint(bundle);
      assert.equal(JSON.parse(fs.readFileSync(path.join(bundle, "dist/version.json"), "utf8")).version, process.env.GITHUB_SHA);
    }],
    ["governance", async () => {
      const backend = "https://api.github.com/repos/guswls3028-art/academy-backend/commits/main";
      revision = (await publicJson(backend)).sha;
      assert.match(revision, /^[a-f0-9]{40}$/);
      raw = `https://raw.githubusercontent.com/guswls3028-art/academy-backend/${revision}/`;
      manifest = await publicJson(`${raw}docs/reports/release-manifest.latest.json`);
      assertManifest(manifest);
    }],
    ["iam", async () => {
      const expectedBoundary = await publicJson(`${raw}scripts/v1/templates/iam/policy_api_development_parameter_boundary.json`);
      const expanded = JSON.parse(JSON.stringify(expectedBoundary).replaceAll("__REGION__", REGION).replaceAll("__ACCOUNT_ID__", ACCOUNT));
      const hostRole = "academy-api-development-role";
      assert.deepEqual(aws(["iam", "list-role-policies", "--role-name", hostRole]).PolicyNames, ["academy-api-development-runtime"]);
      const attachments = aws(["iam", "list-attached-role-policies", "--role-name", hostRole]).AttachedPolicies;
      assert.deepEqual(attachments.map((item) => item.PolicyArn), ["arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"]);
      const hostPolicy = aws(["iam", "get-role-policy", "--role-name", hostRole, "--policy-name", "academy-api-development-runtime"]).PolicyDocument;
      for (const statement of expanded.Statement) assert.equal(canonical(hostPolicy.Statement.find((item) => item.Sid === statement.Sid)), canonical(statement), "Development parameter deny is not applied");
    }],
    ["document", async () => {
      const documents = [[QA_DOCUMENT, "frontend_development_qa.json"], [PORT_DOCUMENT, "frontend_development_api_port.json"]];
      expectedDocuments = new Map();
      for (const [name, file] of documents) {
        const expected = await publicJson(`${raw}scripts/v1/templates/ssm/${file}`);
        const actual = aws(["ssm", "get-document", "--name", name, "--document-format", "JSON"]);
        assert.equal(actual.DocumentType, "Session");
        assert.equal(actual.Status, "Active");
        assert.equal(canonical(JSON.parse(actual.Content)), canonical(expected), "Fixed SSM document content drift");
        expectedDocuments.set(name, canonical(expected));
      }
    }],
    ["host", () => {
      const discovered = aws(["ec2", "describe-instances", "--filters", "Name=tag:Name,Values=academy-v1-api-development", "Name=tag:Lifecycle,Values=active", "Name=instance-state-name,Values=running"]);
      instance = assertActiveInstance(discovered.Reservations.flatMap((item) => item.Instances), manifest);
      instanceId = instance.InstanceId;
      assert.equal(aws(["ec2", "describe-instance-attribute", "--instance-id", instanceId, "--attribute", "disableApiTermination"]).DisableApiTermination.Value, true);
      const groups = aws(["ec2", "describe-security-groups", "--group-ids", ...instance.SecurityGroups.map((item) => item.GroupId)]).SecurityGroups;
      assert.ok(groups.length > 0 && groups.every((group) => group.IpPermissions.length === 0), "Development ingress must be zero");
    }],
    ["ssm", () => {
      const online = aws(["ssm", "describe-instance-information", "--filters", `Key=InstanceIds,Values=${instanceId}`]).InstanceInformationList;
      assert.equal(online.length, 1);
      assert.equal(online[0].PingStatus, "Online");
    }],
  ], persistEvidence, process.env.GITHUB_SHA);
  const common = { TenantCode: [tenant], OwnershipCapability: [capability],
    ReleaseId: [manifest.releaseImageTag], ApiDigest: [manifest.images["academy-api"].digest],
    SyntheticLongVideo: ["true"] };
  const sessions = new Set();
  const processes = [];
  let operationObservation = null;
  let inspectObservation = null;
  let primaryFailed = false;
  function session(name, parameters = {}) {
    const current = aws(["ssm", "get-document", "--name", name, "--document-format", "JSON"]);
    assert.equal(canonical(JSON.parse(current.Content)), expectedDocuments.get(name), "Fixed document changed before operation");
    const process = ownedProcess("aws", ["ssm", "start-session", "--region", REGION, "--target", instanceId,
      "--document-name", name, "--parameters", JSON.stringify(parameters)],
    { stdio: ["pipe", "pipe", "pipe"] }, name === PORT_DOCUMENT ? 25 * 60_000 : 240_000);
    processes.push(process);
    return process;
  }
  function remember(process) {
    const match = process.output().match(/Starting session with SessionId:\s*([A-Za-z0-9_.:-]+)/);
    assert.ok(match, "Owned session ID is missing");
    assert.ok(match[1].startsWith("academy-fe-qa-"), "Unexpected session ownership");
    sessions.add(match[1]);
  }
  async function operation(action) {
    const process = session(QA_DOCUMENT, { ...common, Action: [action] });
    const result = await process.done;
    const observed = observeFixedOperationResult(action, result);
    if (action !== "Cleanup" || !primaryFailed) operationObservation = observed.observation;
    remember(process);
    if (action !== "Cleanup") assert.equal(interrupted, false, "Development run interrupted");
    assert.equal(result.code, 0, `Fixed development ${action} command failed`);
    assert.equal(observed.observation.jsonLineCount, 1, "Missing/ambiguous fixed operation readback");
    if (observed.parseError) throw observed.parseError;
    const payload = observed.payload;
    assert.ok(payload, "Missing fixed operation payload");
    assert.notEqual(payload.status, "DEVELOPMENT_QA_FAILED", `Development ${action} boundary failed`);
    assert.equal(payload.tenant_code, tenant);
    return payload;
  }
  let server;
  let setupAttempted = false;
  let cleanup;
  let counts;
  let realUseObservation;
  let videoRuntimeObservation;
  let scenario;
  let tests;
  let interrupted = false;
  let finalizing = false;
  const failures = [];
  const interrupt = () => {
    interrupted = true;
    if (!finalizing) {
      tests?.stop();
      for (const process of processes) process.stop();
    }
  };
  const writeEvidence = (passed, errors = failures, terminalOutcome = "qa_running") => {
    Object.assign(evidence, { frontendSha: process.env.GITHUB_SHA, backendGovernanceSha: revision,
      backendReleaseId: manifest.releaseImageTag, apiDigest: manifest.images["academy-api"].digest,
      instanceId, tenantCode: tenant, artifactSha256: fingerprint, cases: counts || null,
      documentSha256: Object.fromEntries([...expectedDocuments].map(([name, content]) => [name, sha(content)])),
      cleanup: cleanup ? { tenantCode: tenant, remaining: cleanup.remaining } : null,
      operationObservation, inspectObservation, realUseObservation: realUseObservation || null,
      videoRuntimeObservation: videoRuntimeObservation || null,
      terminalOutcome, passed, failures: errors });
    persistEvidence(evidence);
    return evidence;
  };
  // A killed/lost runner cannot turn an unfinished attempt into cleanup success.
  writeEvidence(false, ["development attempt unfinished; cleanup not proven"]);
  process.on("SIGINT", interrupt);
  process.on("SIGTERM", interrupt);
  try {
    await assertFreePort(18000);
    await assertFreePort(4173);
    const inspected = await operation("Inspect");
    inspectObservation = inspectMatchObservation(inspected, manifest);
    assert.equal(inspected.status, "DEVELOPMENT_QA_IDENTITY_PASS");
    assert.deepEqual(inspected.remaining, { tenants: 0, users: 0 }, "Never reuse an existing QA tenant");
    assert.equal(inspected.release_id, manifest.releaseImageTag);
    assert.equal(inspected.digest, manifest.images["academy-api"].digest);
    setupAttempted = true;
    scenario = await operation("Setup");
    const longVideo = assertLongVideoSetup(scenario);
    const tunnel = session(PORT_DOCUMENT);
    await waitPort(18000, () => interrupted);
    remember(tunnel);
    server = await serveArtifact(path.join(bundle, "dist"));
    const secret = aws(["ssm", "get-parameter", "--name", PASSWORD_PARAMETER, "--with-decryption"]);
    assert.equal(secret.Parameter.Name, PASSWORD_PARAMETER);
    assert.ok(secret.Parameter.Value);
    assert.equal(interrupted, false, "Development run interrupted");
    tests = ownedProcess(process.execPath, [path.join(ROOT, "node_modules/@playwright/test/cli.js"), "test", "--config=playwright.development-release.config.ts"], {
      env: { ...process.env, E2E_BASE_URL: WEB_ORIGIN, E2E_API_URL: API_ORIGIN, API_BASE_URL: API_ORIGIN,
        E2E_RELEASE_API_MODE: "development", E2E_ALLOW_PRODUCTION_WRITES: "0", E2E_STRICT: "strict",
        E2E_TENANT_CODE: tenant, E2E_ADMIN_USER: "ymath-qa-teacher", E2E_STUDENT_USER: "ymath-qa-student-01",
        E2E_STUDENT2_USER: "ymath-qa-student-02", E2E_LONG_VIDEO_TENANT_ID: String(scenario.tenant_id),
        E2E_LONG_VIDEO_ID: String(scenario.synthetic_long_video.video_id),
        E2E_LONG_VIDEO_HLS_PATH: longVideo.hls_path,
        E2E_ADMIN_PASS: secret.Parameter.Value, E2E_STUDENT_PASS: secret.Parameter.Value,
        E2E_STUDENT2_PASS: secret.Parameter.Value },
    }, 20 * 60_000);
    const result = await tests.done;
    realUseObservation = observeReleaseTestResult(result.stdout);
    assert.equal(result.code, 0, "Required development real-use failed (raw credential-bearing report is not published)");
    counts = assertReleaseSummary(JSON.parse(result.stdout));
    assert.ok(realUseObservation.longVideo, "Long-video browser evidence missing or invalid");
    const postPlayback = await operation("Inspect");
    assert.deepEqual(inspectMatchObservation(postPlayback, manifest), {
      statusMatches: true, remainingZero: false, releaseMatches: true, digestMatches: true,
    });
    videoRuntimeObservation = observeLongVideoRuntime(postPlayback.video_state);
  } catch { primaryFailed = true; failures.push("development identity/setup/real-use failed"); }
  finally {
    finalizing = true;
    // No test process may still mutate the scenario while Cleanup is running.
    if (tests) { tests.stop(); await tests.done; }
    if (interrupted) failures.push("development run interrupted; promotion forbidden");
    if (setupAttempted) {
      try { cleanup = await operation("Cleanup"); assertCleanup(cleanup, tenant); }
      catch { failures.push("development cleanup failed or zero residue not proven"); }
    }
    for (const process of processes) {
      try { remember(process); } catch { failures.push("session ownership readback failed"); }
      process.stop();
      await process.done;
    }
    for (const sessionId of sessions) {
      try {
        const filters = ["--filters", `key=SessionId,value=${sessionId}`];
        if (aws(["ssm", "describe-sessions", "--state", "Active", ...filters]).Sessions.length) {
          assert.equal(aws(["ssm", "terminate-session", "--session-id", sessionId]).SessionId, sessionId);
        }
        let terminated = false;
        for (let attempt = 0; attempt < 10; attempt += 1) {
          const active = aws(["ssm", "describe-sessions", "--state", "Active", ...filters]).Sessions;
          const history = aws(["ssm", "describe-sessions", "--state", "History", ...filters]).Sessions;
          if (isOwnedSessionTerminal(active, history, sessionId, instanceId)) { terminated = true; break; }
          await delay(1_000);
        }
        assert.equal(terminated, true, "Owned session termination readback missing");
      } catch { failures.push("owned SSM session cleanup not proven"); }
    }
    if (server) {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
    try { if (artifactFingerprint(bundle) !== fingerprint) failures.push("deployment artifact changed during QA"); }
    catch { failures.push("deployment artifact final readback failed"); }
    if (interrupted && !failures.some((failure) => failure.includes("interrupted"))) failures.push("development run interrupted; promotion forbidden");
    process.off("SIGINT", interrupt);
    process.off("SIGTERM", interrupt);
    const passed = failures.length === 0 && Boolean(counts) && Boolean(cleanup)
      && Boolean(realUseObservation?.longVideo) && Boolean(videoRuntimeObservation);
    const resultEvidence = writeEvidence(passed, failures, passed ? "passed" : "qa_failed");
    assert.equal(resultEvidence.passed, true, "Development release gate failed; see PII-free evidence");
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run().catch(() => { console.error("Development release gate failed closed; no production promotion authorized."); process.exitCode = 1; });
}
