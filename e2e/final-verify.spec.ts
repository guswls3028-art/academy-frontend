import { test } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";

test("최종 검증: SMS 모달 + 알림톡 컴팩트", async ({ page }) => {
  await loginViaUI(page, "admin");
  await page.goto("https://hakwonplus.com/admin/students", { waitUntil: "load" });
  await page.waitForTimeout(5000);

  // 학생 선택
  const cb = page.locator('table input[type="checkbox"]');
  if (await cb.count() > 1) await cb.nth(1).check();
  await page.waitForTimeout(300);

  // 메시지 발송
  await page.locator("button").filter({ hasText: /메시지 발송/ }).first().click();
  await page.waitForTimeout(2000);

  // SMS 모드 확인
  await page.screenshot({ path: "e2e/screenshots/final-sms-mode.png" });
  const ta = page.locator("textarea").first();
  console.log(">>> SMS textarea:", await ta.isVisible().catch(() => false));

  // 알림톡 전환
  await page.locator("button").filter({ hasText: "알림톡" }).click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "e2e/screenshots/final-alimtalk-compact.png" });

  // 드롭다운 select 확인
  const select = page.locator("select");
  console.log(">>> 알림톡 select:", await select.isVisible().catch(() => false));

  // 템플릿 선택
  const options = select.locator("option");
  const oc = await options.count();
  console.log(`>>> 템플릿 options: ${oc}개`);
  if (oc > 1) {
    await select.selectOption({ index: 1 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: "e2e/screenshots/final-alimtalk-selected.png" });
    console.log(">>> 템플릿 선택됨 → 미리보기 표시");
  }
});
