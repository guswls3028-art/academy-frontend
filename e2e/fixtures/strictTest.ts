/**
 * E2E 기본 진입: 모든 테스트에 엄격 브라우저 무결성(콘솔 error·pageerror) 적용.
 * 스펙 파일은 `@playwright/test` 대신 여기서 `test`, `expect` 를 import 할 것.
 */
import { test as base, expect } from "@playwright/test";
import { installAccountNotificationGuard } from "../helpers/accountNotificationSafety";
import { attachStrictBrowserGuards } from "../helpers/strictBrowser";
import { installReleaseContextGuard, installReleaseRequestGuard, releaseBoundaryFromEnv } from "../helpers/releaseApiBoundary";

type StrictBrowserOptions = {
  allowRecoveredProductionCors: boolean;
  strictBrowserAutoAssert: boolean;
};

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
    const checks: Array<() => void> = [];
    browser.newContext = async (options) => {
      const context = await original({ ...options, serviceWorkers: "block" });
      installAccountNotificationGuard(context.request);
      const boundaryGuard = await installReleaseContextGuard(context, boundary);
      const pages: ReturnType<typeof attachStrictBrowserGuards>[] = [];
      context.on("page", (page) => pages.push(attachStrictBrowserGuards(page, {
        allowNeutralizedCloudflareBeaconIntegrity: boundary.mode === "readonly",
      })));
      const check = () => {
        boundaryGuard.assertClean();
        for (const guard of pages) guard.assertZeroDefects();
      };
      let explicitlyClosed = false;
      checks.push(() => { if (!explicitlyClosed) check(); });
      const close = context.close.bind(context);
      context.close = async (closeOptions) => {
        try {
          await boundaryGuard.beginClose();
          console.log(JSON.stringify({ releaseApiMode: boundary.mode,
            authentication: boundaryGuard.authentication, observation: boundaryGuard.observations,
            transport: boundaryGuard.transport,
            requestTransportDiagnostics: boundaryGuard.requestTransportDiagnostics }));
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
      for (const check of checks) check();
    }
  }, { scope: "worker", timeout: 20 * 60_000 }],
  request: async ({ request }, continueWithFixture) => {
    const boundary = releaseBoundaryFromEnv(process.env);
    let violations = 0;
    const transport = { readFetchRetries: 0 };
    const requestTransportDiagnostics: unknown[] = [];
    if (boundary) installReleaseRequestGuard(request, boundary, undefined, undefined,
      () => { violations += 1; }, transport,
      (diagnostic) => requestTransportDiagnostics.push(diagnostic));
    try { await continueWithFixture(installAccountNotificationGuard(request)); }
    finally {
      if (boundary) console.log(JSON.stringify({ releaseApiMode: boundary.mode, transport, requestTransportDiagnostics }));
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
