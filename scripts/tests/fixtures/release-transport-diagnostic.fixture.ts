import { test } from "../../../e2e/fixtures/strictTest";

test("unrecovered route transport remains a visible fixture failure", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.setContent("<!doctype html><title>release transport fixture</title>");
  await page.evaluate(async () => {
    const headers = {
      "X-Tenant-Code": "qa-ymath-realuse-fixture-transport",
      "X-Fixture-Secret": "fixture-secret-header",
    };
    await fetch("https://api.hakwonplus.com/api/v1/student/video/sessions/987654321/videos/?fixture-secret-query", { headers })
      .catch(() => undefined);
    await fetch("https://api.hakwonplus.com/api/v1/private/secret-student-name-839201/", { headers })
      .catch(() => undefined);
  });
  await context.close();
});
