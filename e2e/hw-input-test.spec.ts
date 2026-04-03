import { test, expect } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";
const API = process.env.E2E_API_URL || "https://api.hakwonplus.com";

test("과제 점수 입력 — 편집모드에서 contentEditable 셀에 값 입력", async ({ page }) => {
  // 로그인
  const res = await page.request.post(`${API}/api/v1/token/`, {
    data: { username: process.env.E2E_ADMIN_USER || "admin97", password: process.env.E2E_ADMIN_PASS || "koreaseoul97", tenant_code: "hakwonplus" },
    headers: { "Content-Type": "application/json", "X-Tenant-Code": "hakwonplus" },
  });
  const tokens = await res.json();
  await page.goto(`${BASE}/login`, { waitUntil: "commit" });
  await page.evaluate(({ a, r }) => {
    localStorage.setItem("access", a);
    localStorage.setItem("refresh", r);
    try { sessionStorage.setItem("tenantCode", "hakwonplus"); } catch {}
  }, { a: tokens.access, r: tokens.refresh });

  // 강의 목록 → 첫 강의 → 차시 → 성적탭
  await page.goto(`${BASE}/admin/lectures`, { waitUntil: "load", timeout: 20000 });
  await page.waitForTimeout(2000);

  // 스크린샷: 강의 목록
  await page.screenshot({ path: "e2e/screenshots/hw-input-01-lectures.png" });

  // 첫 강의 클릭
  const lectureCard = page.locator("a[href*='/admin/lectures/']").first();
  if (await lectureCard.isVisible({ timeout: 5000 }).catch(() => false)) {
    await lectureCard.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "e2e/screenshots/hw-input-02-lecture-detail.png" });

    // 차시 클릭 (첫 번째)
    const sessionLink = page.locator("a[href*='/sessions/'], button").filter({ hasText: /차시|1차|Session/ }).first();
    if (await sessionLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await sessionLink.click();
      await page.waitForTimeout(2000);
    }
    await page.screenshot({ path: "e2e/screenshots/hw-input-03-session.png" });

    // 성적 탭 또는 편집 버튼
    const scoresTab = page.locator("button, a").filter({ hasText: /성적|점수|Scores/ }).first();
    if (await scoresTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await scoresTab.click();
      await page.waitForTimeout(2000);
    }

    // 편집모드 버튼 찾기
    const editBtn = page.locator("button").filter({ hasText: /편집|수정|Edit/ }).first();
    if (await editBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await editBtn.click();
      await page.waitForTimeout(1000);
    }
    await page.screenshot({ path: "e2e/screenshots/hw-input-04-edit-mode.png" });

    // 과제 관련 contentEditable 셀 찾기
    const editableCells = page.locator("[contenteditable=true]");
    const cellCount = await editableCells.count();
    console.log(`편집 가능 셀 수: ${cellCount}`);

    if (cellCount > 0) {
      // 첫 번째 셀에 값 입력 시도
      const firstCell = editableCells.first();
      await firstCell.click();
      await page.waitForTimeout(300);
      await page.keyboard.type("85");
      await page.waitForTimeout(300);
      const typed = await firstCell.innerText();
      console.log(`입력 후 셀 내용: "${typed}"`);
      await page.screenshot({ path: "e2e/screenshots/hw-input-05-after-type.png" });

      // Tab으로 다음 셀로 이동 (blur 트리거)
      await page.keyboard.press("Tab");
      await page.waitForTimeout(500);
      await page.screenshot({ path: "e2e/screenshots/hw-input-06-after-tab.png" });
    } else {
      console.log("편집 가능 셀이 없음 — 과제/시험이 없거나 편집모드가 활성화되지 않음");
      await page.screenshot({ path: "e2e/screenshots/hw-input-05-no-editable-cells.png" });
    }
  } else {
    console.log("강의가 없음");
    await page.screenshot({ path: "e2e/screenshots/hw-input-02-no-lectures.png" });
  }
});
