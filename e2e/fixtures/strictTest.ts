/**
 * E2E 기본 진입: 모든 테스트에 엄격 브라우저 무결성(콘솔 error·pageerror) 적용.
 * 스펙 파일은 `@playwright/test` 대신 여기서 `test`, `expect` 를 import 할 것.
 */
import { test as base, expect } from "@playwright/test";
import { attachStrictBrowserGuards } from "../helpers/strictBrowser";

export const test = base.extend({
  page: async ({ page }, continueWithFixture) => {
    const strict = attachStrictBrowserGuards(page);
    await continueWithFixture(page);
    strict.assertZeroDefects();
  },
});

export { expect };
