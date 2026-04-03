import { test, expect } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";

test.describe("뿌리오 메시징 설정 E2E", () => {
  test("메시지 설정 페이지 — 공급자 전환 + 뿌리오 설정 UI 전체 확인", async ({ page }) => {
    await loginViaUI(page, "admin");
    await page.goto("https://hakwonplus.com/admin/message/settings");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "e2e/screenshots/msg-settings-loaded.png", fullPage: true });

    const body = await page.textContent("body") ?? "";
    console.log("솔라피 표시:", body.includes("솔라피"));
    console.log("뿌리오 표시:", body.includes("뿌리오"));
    console.log("설정 표시:", body.includes("설정"));

    // 뿌리오 버튼 찾기
    const ppurioBtn = page.locator("button").filter({ hasText: "뿌리오" }).first();
    console.log("뿌리오 버튼 visible:", await ppurioBtn.isVisible().catch(() => false));

    // 뿌리오로 전환
    page.on("dialog", async (d) => { await d.accept(); });
    if (await ppurioBtn.isVisible().catch(() => false)) {
      await ppurioBtn.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: "e2e/screenshots/msg-ppurio-selected.png", fullPage: true });

      const bodyAfter = await page.textContent("body") ?? "";

      // 직접 연동 선택
      const selfBtn = page.locator("button").filter({ hasText: /직접 연동/ }).first();
      if (await selfBtn.isVisible().catch(() => false)) {
        await selfBtn.click();
        await page.waitForTimeout(1000);
      }
      await page.screenshot({ path: "e2e/screenshots/msg-ppurio-self-mode.png", fullPage: true });

      // 가이드 확인
      const checks = ["ppurio.com", "계정 ID", "API Key", "발신번호"];
      for (const c of checks) {
        console.log(`"${c}" 표시:`, bodyAfter.includes(c) || (await page.textContent("body"))?.includes(c));
      }

      // input 필드 확인
      const inputs = page.locator("input");
      const inputCount = await inputs.count();
      console.log("input 필드 수:", inputCount);
      for (let i = 0; i < inputCount; i++) {
        const ph = await inputs.nth(i).getAttribute("placeholder") ?? "";
        const type = await inputs.nth(i).getAttribute("type") ?? "";
        if (ph || type === "password") console.log(`  input[${i}]: type=${type} placeholder="${ph}"`);
      }

      // 저장 버튼 확인
      const saveBtn = page.getByRole("button", { name: /저장|연동 저장/ });
      console.log("저장 버튼:", await saveBtn.count() > 0);

      // 테스트 버튼 확인
      const testBtn = page.getByRole("button", { name: /테스트/ });
      console.log("테스트 버튼:", await testBtn.count() > 0);

      // 솔라피로 복원
      const solapiBtn = page.locator("button").filter({ hasText: "솔라피" }).first();
      if (await solapiBtn.isVisible().catch(() => false)) {
        await solapiBtn.click();
        await page.waitForTimeout(1000);
      }
    }
  });
});
