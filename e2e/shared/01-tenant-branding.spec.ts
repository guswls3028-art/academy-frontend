import { test, expect } from "../fixtures/strictTest";

test.describe("테넌트 브랜딩 검증", () => {
  test("tchul.com 제목이 박철과학이다", async ({ page }) => {
    await page.goto("https://tchul.com");
    await page.waitForLoadState("domcontentloaded");
    const title = await page.title();
    expect(title).toContain("박철과학");
  });

  test("sswe.co.kr 제목이 SSWE이다", async ({ page }) => {
    await page.goto("https://sswe.co.kr");
    await page.waitForLoadState("domcontentloaded");
    const title = await page.title();
    expect(title).toContain("SSWE");
  });

  test("tchul.com에서 화면 타이틀에 다른 테넌트 브랜드가 보이지 않는다", async ({ page }) => {
    await page.goto("https://tchul.com");
    await page.waitForLoadState("domcontentloaded");
    const title = await page.title();
    // 화면 타이틀에 다른 테넌트 이름이 없어야 함
    expect(title).not.toContain("학원플러스");
    expect(title).not.toContain("limglish");
    expect(title).not.toContain("SSWE");
    expect(title).toContain("박철과학");
  });

  test("sswe.co.kr 파비콘이 sswe 아이콘이다", async ({ page }) => {
    await page.goto("https://sswe.co.kr");
    await page.waitForLoadState("domcontentloaded");
    const favicon = await page.locator('link[rel="icon"]').getAttribute("href");
    expect(favicon).toContain("sswe");
  });
});
