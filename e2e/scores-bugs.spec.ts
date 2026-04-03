/**
 * 성적탭 버그 재현 — 직접 URL 진입
 */
import { test, expect } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";

const BASE = "https://hakwonplus.com";

test("성적 입력 페이지 — 직접 URL 진입 → 버그 검증", async ({ page }) => {
  await loginViaUI(page, "admin");

  // 직접 성적 입력 URL로 이동 (Lecture 19, Session 17)
  await page.goto(`${BASE}/admin/lectures/19/sessions/17`, { waitUntil: "load", timeout: 20000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: "e2e/screenshots/sb-01-session-detail.png", fullPage: true });

  // 성적 탭 클릭
  const tabs = page.locator("[role='tab'], button").filter({ hasText: "성적" });
  if (await tabs.first().isVisible({ timeout: 5000 }).catch(() => false)) {
    await tabs.first().click();
    await page.waitForTimeout(3000);
  }
  // 또는 직접 scores 경로
  await page.goto(`${BASE}/admin/lectures/19/sessions/17/scores`, { waitUntil: "load", timeout: 20000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: "e2e/screenshots/sb-02-scores.png", fullPage: true });

  // 테이블 확인
  const hasTable = await page.locator("table").first().isVisible({ timeout: 8000 }).catch(() => false);
  console.log(`테이블: ${hasTable}`);

  if (hasTable) {
    // 행 데이터 수집
    const rows = await page.locator("table tbody tr").all();
    console.log(`행: ${rows.length}`);
    for (let i = 0; i < Math.min(rows.length, 5); i++) {
      const cells = await rows[i].locator("td").all();
      const texts: string[] = [];
      for (const c of cells.slice(0, 10)) texts.push((await c.textContent() || "").trim().substring(0, 20));
      console.log(`  [${i}] ${texts.join(" | ")}`);
    }

    // 합격/불합격 배지
    const pass = await page.locator(".ds-scores-pass-fail-badge[data-tone='success']").count();
    const fail = await page.locator(".ds-scores-pass-fail-badge[data-tone='danger']").count();
    console.log(`합격배지: ${pass}, 불합격배지: ${fail}`);

    // ── 편집 모드 ──
    const editBtn = page.locator("button").filter({ hasText: /편집/ }).first();
    if (await editBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await editBtn.click();
      await page.waitForTimeout(1000);
      console.log("편집 ON");
    }
    await page.screenshot({ path: "e2e/screenshots/sb-03-edit.png", fullPage: true });

    // 프리셋 버튼 상태
    const presetBtns = await page.locator("button[aria-pressed]").all();
    for (const btn of presetBtns) {
      const text = (await btn.textContent() || "").trim();
      const pressed = await btn.getAttribute("aria-pressed");
      console.log(`  프리셋 "${text}" pressed=${pressed}`);
    }

    // 과제 프리셋 클릭
    const hwBtn = page.locator("button[aria-pressed]").filter({ hasText: "과제" }).first();
    if (await hwBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await hwBtn.click();
      await page.waitForTimeout(500);
      console.log("과제 프리셋 클릭");
    }
    await page.screenshot({ path: "e2e/screenshots/sb-04-hw-preset.png", fullPage: true });

    // contentEditable 셀 확인
    const eCells = page.locator("[contenteditable='true']");
    const eCount = await eCells.count();
    console.log(`편집셀: ${eCount}`);

    if (eCount > 0) {
      const cell = eCells.first();
      await cell.click();
      await page.waitForTimeout(300);
      const activeCount = await page.locator(".ds-scores-cell-active").count();
      console.log(`활성셀 하이라이트: ${activeCount}`);

      await page.keyboard.type("77");
      const val = await cell.innerText();
      console.log(`입력: "${val}"`);
      await page.screenshot({ path: "e2e/screenshots/sb-05-typed.png", fullPage: true });

      await page.keyboard.press("Tab");
      await page.waitForTimeout(500);
      await page.screenshot({ path: "e2e/screenshots/sb-06-tab.png", fullPage: true });
    }
  } else {
    console.log("테이블 없음 — 페이지 확인 필요");
  }
});
