import { test } from "../../../e2e/fixtures/strictTest";

test("unrecovered route transport remains a visible fixture failure", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.setContent("<!doctype html><title>release transport fixture</title>");
  await page.evaluate(async () => {
    await fetch("https://api.hakwonplus.com/api/v1/core/tenant/by-host/?fixture-secret-query", {
      headers: { "X-Tenant-Code": "qa-ymath-realuse-fixture-transport", "X-Fixture-Secret": "fixture-secret-header" },
    }).catch(() => undefined);
  });
  await context.close();
});
