import { test, expect } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";

test("학생 API 응답 vs DOM 하이라이트 비교", async ({ page }) => {
  page.setViewportSize({ width: 1920, height: 1080 });

  // API 응답 가로채기
  let apiResponse: any = null;
  page.on("response", async (resp) => {
    if (resp.url().includes("/api/v1/students/") && resp.status() === 200 && !resp.url().includes("tags")) {
      try {
        apiResponse = await resp.json();
      } catch {}
    }
  });

  await loginViaUI(page, "admin");

  // 사이드바 학생 클릭
  const studentNav = page.locator("aside a, aside button, nav a, nav button").filter({ hasText: /^학생$/ }).first();
  await studentNav.click();
  await page.waitForTimeout(6000);

  // API 응답 분석
  if (apiResponse) {
    const results = apiResponse.results ?? apiResponse ?? [];
    console.log(`\n=== API 응답 (${results.length}명) ===`);
    for (const s of results) {
      const hl = s.name_highlight_clinic_target;
      console.log(`  ${hl ? "🟡" : "  "} ${s.name}: name_highlight_clinic_target=${hl}`);
    }
    const apiHlCount = results.filter((s: any) => s.name_highlight_clinic_target === true).length;
    console.log(`API True 수: ${apiHlCount}`);
  } else {
    console.log("API 응답 캡처 실패");
  }

  // DOM 분석
  const hlElements = page.locator(".ds-student-name--clinic-highlight");
  const hlCount = await hlElements.count();
  console.log(`\n=== DOM 하이라이트: ${hlCount}개 ===`);

  const allChips = page.locator("span.inline-flex.items-center.gap-2");
  const chipCount = await allChips.count();
  console.log(`총 칩: ${chipCount}개`);

  await page.screenshot({ path: "e2e/screenshots/verify-hl-compare.png", fullPage: true });
});
