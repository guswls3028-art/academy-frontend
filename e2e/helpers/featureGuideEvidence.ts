import { expect, type Page, type TestInfo } from "@playwright/test";

/** Read-only image checks; capture only public documentation, never account chrome. */
export async function verifyFeatureGuideImages(page: Page, info: TestInfo, name: string) {
  const reader = page.getByRole("region", { name: "기능 둘러보기", exact: true });
  const image = reader.locator("figure img");
  const selector = reader.getByLabel("설명서 페이지");
  const topic = new URL(page.url()).searchParams.get("topic");
  await reader.getByRole("button", { name: "핵심 요약 5쪽", exact: true }).click();
  await expect(selector).toHaveValue("1");
  for (const [index, title] of ["알림톡", "수업 영상", "엑셀 업로드", "정오표·문항별 채점"].entries()) {
    await reader.getByRole("navigation", { name: "핵심 기능 바로 읽기" }).getByRole("button", { name: title, exact: true }).click();
    await expect(selector).toHaveValue(String(index + 2));
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true);
    await info.attach(`${name}-feature-${index + 2}`, {
      body: await image.screenshot({ path: info.outputPath(`${name}-feature-${index + 2}.png`) }), contentType: "image/png",
    });
  }
  await reader.getByRole("button", { name: "상세 설명 43쪽", exact: true }).click();
  await selector.selectOption("43");
  await page.reload();
  await expect(selector).toHaveValue("43");
  expect(new URL(page.url()).searchParams.get("topic")).toBe(topic);
  await image.scrollIntoViewIfNeeded();
  await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true);
  const enlarge = reader.getByRole("button", { name: "글씨 크게 보기 ↗", exact: true });
  await enlarge.click();
  const dialog = page.getByRole("dialog", { name: "설명서 글씨 확대" });
  await expect(dialog).toBeVisible();
  await expect.poll(() => dialog.getByRole("img").evaluate((element: HTMLImageElement) => element.naturalWidth)).toBe(2200);
  await info.attach(`${name}-enlarged`, {
    body: await dialog.screenshot({ path: info.outputPath(`${name}-enlarged.png`) }), contentType: "image/png",
  });
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(enlarge).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}
