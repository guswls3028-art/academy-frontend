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
      context.on("page", (page) => pages.push(attachStrictBrowserGuards(page)));
      const check = () => {
        boundaryGuard.assertClean();
        for (const guard of pages) guard.assertZeroDefects();
      };
      checks.push(check);
      const close = context.close.bind(context);
      context.close = async (closeOptions) => {
        try {
          check();
          console.log(JSON.stringify({ releaseApiMode: boundary.mode,
            authentication: boundaryGuard.authentication, observation: boundaryGuard.observations }));
        } finally { await close(closeOptions); }
      };
      return context;
    };
    try { await continueWithFixture(browser); }
    finally {
      browser.newContext = original;
      for (const check of checks) check();
    }
  }, { scope: "worker" }],
  request: async ({ request }, continueWithFixture) => {
    const boundary = releaseBoundaryFromEnv(process.env);
    let violations = 0;
    if (boundary) installReleaseRequestGuard(request, boundary, undefined, undefined, () => { violations += 1; });
    try { await continueWithFixture(installAccountNotificationGuard(request)); }
    finally { expect(violations, "APIRequestContext release boundary violations").toBe(0); }
  },
  page: async ({ page, allowRecoveredProductionCors, strictBrowserAutoAssert }, continueWithFixture) => {
    installAccountNotificationGuard(page.request);
    const strict = attachStrictBrowserGuards(page, { allowRecoveredProductionCors });
    await continueWithFixture(page);
    if (strictBrowserAutoAssert) strict.assertZeroDefects();
  },
});

export { expect };
export type * from "@playwright/test";
