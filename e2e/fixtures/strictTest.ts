/**
 * E2E 기본 진입: 모든 테스트에 엄격 브라우저 무결성(콘솔 error·pageerror) 적용.
 * 스펙 파일은 `@playwright/test` 대신 여기서 `test`, `expect` 를 import 할 것.
 */
import { test as base, expect, type ConsoleMessage, type Page } from "@playwright/test";
import { installAccountNotificationGuard } from "../helpers/accountNotificationSafety";
import { attachStrictBrowserGuards } from "../helpers/strictBrowser";
import { createReleaseContextObservation, installReleaseContextGuard, installReleaseRequestGuard, releaseBoundaryFromEnv,
  safeNativeTransportCode, type ReleaseBoundary, type ReleaseObservationEvent, type RequestTransportDiagnostic } from "../helpers/releaseApiBoundary";

type StrictBrowserOptions = {
  allowRecoveredProductionCors: boolean;
  strictBrowserAutoAssert: boolean;
};

function browserErrorCategory(message: string): ReleaseObservationEvent["category"] {
  if (/cors|access-control-allow-origin/i.test(message)) return "cors";
  if (/chunk|dynamically imported module/i.test(message)) return "chunk";
  if (/net::|network|failed to fetch|ECONN|EPIPE|ETIMEDOUT/i.test(message)) return "network";
  if (/failed to load resource/i.test(message)) return "resource";
  if (/TypeError|ReferenceError|SyntaxError|RangeError/i.test(message)) return "runtime";
  return "other";
}

function browserSourceKind(rawUrl: string, boundary: ReleaseBoundary): ReleaseObservationEvent["sourceKind"] {
  try {
    const source = new URL(rawUrl);
    if (source.origin === boundary.webOrigin) return "local";
    if (source.origin === boundary.apiOrigin || source.origin === "https://api.hakwonplus.com") return "api";
    if (source.protocol === "https:" || source.protocol === "http:") return "vendor";
  } catch { /* Missing console locations have no trustworthy source. */ }
  return "unknown";
}

export const test = base.extend<StrictBrowserOptions>({
  allowRecoveredProductionCors: [false, { option: true }],
  strictBrowserAutoAssert: [true, { option: true }],
  browser: [async ({ browser }, continueWithFixture) => {
    const boundary = releaseBoundaryFromEnv(process.env);
    if (!boundary) {
      await continueWithFixture(browser);
      return;
    }
    if (process.env.E2E_STRICT !== "strict") throw new Error("Release canary requires strict browser validation");
    const original = browser.newContext.bind(browser);
    const emitters: Array<() => void> = [];
    const checks: Array<() => void> = [];
    const disposeObservers: Array<() => void> = [];
    browser.newContext = async (options) => {
      const context = await original({ ...options, serviceWorkers: "block" });
      installAccountNotificationGuard(context.request);
      const boundaryGuard = await installReleaseContextGuard(context, boundary);
      const pages: ReturnType<typeof attachStrictBrowserGuards>[] = [];
      const disposePageObservers: Array<() => void> = [];
      const observePage = (page: Page) => {
        pages.push(attachStrictBrowserGuards(page, {
          allowNeutralizedCloudflareBeaconIntegrity: boundary.mode === "readonly",
        }));
        const consoleError = (message: ConsoleMessage) => {
          if (message.type() !== "error") return;
          boundaryGuard.observation.record({ phase: "browser-console", stage: "terminal",
            category: browserErrorCategory(message.text()), sourceKind: browserSourceKind(message.location().url, boundary),
            nativeCode: safeNativeTransportCode(new Error(message.text())) });
        };
        const pageError = (error: Error) => boundaryGuard.observation.record({ phase: "browser-pageerror", stage: "terminal",
          category: browserErrorCategory(`${error.name}: ${error.message}`), sourceKind: "unknown", nativeCode: safeNativeTransportCode(error) });
        const pageClose = () => boundaryGuard.observation.record({ phase: "page-close", stage: "terminal" });
        const pageCrash = () => boundaryGuard.observation.record({ phase: "page-crash", stage: "terminal" });
        page.on("console", consoleError);
        page.on("pageerror", pageError);
        page.once("close", pageClose);
        page.once("crash", pageCrash);
        disposePageObservers.push(() => {
          page.off("console", consoleError); page.off("pageerror", pageError);
          page.off("close", pageClose); page.off("crash", pageCrash);
        });
      };
      context.on("page", observePage);
      let evidenceEmitted = false;
      const emitEvidence = () => {
        if (evidenceEmitted) return false;
        console.log(JSON.stringify({ releaseApiMode: boundary.mode,
          authentication: boundaryGuard.authentication, observation: boundaryGuard.observations,
          transport: boundaryGuard.transport,
          requestTransportDiagnostics: boundaryGuard.requestTransportDiagnostics,
          releaseContextObservation: boundaryGuard.observation.snapshot() }));
        evidenceEmitted = true;
        return true;
      };
      const emitSnapshot = () => {
        if (!emitEvidence()) console.log(JSON.stringify({ releaseContextObservation: boundaryGuard.observation.snapshot() }));
      };
      emitters.push(emitSnapshot);
      let closeRequested = false;
      const disconnected = () => {
        boundaryGuard.observation.record({ phase: "browser-disconnected", stage: "terminal" });
        emitSnapshot();
      };
      browser.once("disconnected", disconnected);
      const disposePages = () => {
        context.off("page", observePage);
        for (const dispose of disposePageObservers.splice(0)) dispose();
      };
      const contextClose = () => {
        boundaryGuard.observation.record({ phase: "context-close", stage: "terminal" });
        emitSnapshot();
        disposePages();
        // A disconnected browser can emit context-close before disconnected.
        // Keep that one listener until the event or worker-fixture teardown.
        if (closeRequested) browser.off("disconnected", disconnected);
      };
      context.once("close", contextClose);
      disposeObservers.push(() => {
        disposePages();
        context.off("close", contextClose);
        browser.off("disconnected", disconnected);
      });
      const check = () => {
        emitEvidence();
        boundaryGuard.assertClean();
        for (const guard of pages) guard.assertZeroDefects();
      };
      let explicitlyClosed = false;
      checks.push(() => { if (!explicitlyClosed) check(); });
      const close = context.close.bind(context);
      context.close = async (closeOptions) => {
        closeRequested = true;
        try {
          await boundaryGuard.beginClose();
          check();
        } finally {
          try { await close(closeOptions); }
          finally { explicitlyClosed = true; }
        }
        check();
      };
      return context;
    };
    try { await continueWithFixture(browser); }
    finally {
      browser.newContext = original;
      try {
        for (const emit of emitters) emit();
        for (const check of checks) check();
      }
      finally { for (const dispose of disposeObservers) dispose(); }
    }
  }, { scope: "worker", timeout: 20 * 60_000 }],
  request: async ({ request }, continueWithFixture) => {
    const boundary = releaseBoundaryFromEnv(process.env);
    let violations = 0;
    const transport = { readFetchRetries: 0 };
    const requestTransportDiagnostics: RequestTransportDiagnostic[] = [];
    const observation = createReleaseContextObservation(null);
    if (boundary) installReleaseRequestGuard(request, boundary, undefined, undefined,
      () => { violations += 1; }, transport,
      (diagnostic) => observation.recordTransportDiagnostic(requestTransportDiagnostics, diagnostic), observation.record);
    try { await continueWithFixture(installAccountNotificationGuard(request)); }
    finally {
      if (boundary) console.log(JSON.stringify({ releaseApiMode: boundary.mode, transport, requestTransportDiagnostics,
        releaseContextObservation: observation.snapshot() }));
      expect(violations, "APIRequestContext release boundary violations").toBe(0);
    }
  },
  page: async ({ page, allowRecoveredProductionCors, strictBrowserAutoAssert }, continueWithFixture) => {
    installAccountNotificationGuard(page.request);
    const boundary = releaseBoundaryFromEnv(process.env);
    const strict = attachStrictBrowserGuards(page, { allowRecoveredProductionCors,
      allowNeutralizedCloudflareBeaconIntegrity: boundary?.mode === "readonly" });
    await continueWithFixture(page);
    if (strictBrowserAutoAssert) strict.assertZeroDefects();
  },
});

export { expect };
export type * from "@playwright/test";
