import { test } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";

test("전체: 시험생성 → 수업결과발송 → 양식확인", async ({ page }) => {
  await loginViaUI(page, "admin");
  await page.goto("https://hakwonplus.com/admin/lectures/77/sessions/57/scores", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(10000);

  // ═══ 1. 시험 4개 생성 ═══
  console.log(">>> 1. 시험 추가");
  await page.locator("button").filter({ hasText: "시험 추가" }).click();
  await page.waitForTimeout(2000);
  await page.locator("button").filter({ hasText: /신규 시험.*한번에/ }).first().click();
  await page.waitForTimeout(2000);

  // 시험 1: 어휘 30점
  await page.locator('input[placeholder*="시험"]').first().fill("어휘");
  await page.locator('input[placeholder="100"]').first().clear();
  await page.locator('input[placeholder="100"]').first().fill("30");

  // + 추가 3번
  const addMore = page.locator("button").filter({ hasText: "+ 추가" });
  for (const [name, max] of [["문장암기", "10"], ["어법", "8"], ["서술형", "8"]]) {
    await addMore.click();
    await page.waitForTimeout(400);
    await page.locator('input[placeholder*="시험"]').last().fill(name);
    await page.locator('input[placeholder="100"]').last().clear();
    await page.locator('input[placeholder="100"]').last().fill(max);
  }

  await page.screenshot({ path: "e2e/screenshots/flow-exams-ready.png" });
  console.log(">>> 1. 일괄 생성 클릭");
  await page.locator("button").filter({ hasText: "일괄 생성" }).click();
  await page.waitForTimeout(4000);

  // ═══ 2. 새로고침 → 학생 확인 ═══
  await page.reload({ waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(8000);
  await page.screenshot({ path: "e2e/screenshots/flow-with-exams.png" });

  const cbs = page.locator('input[type="checkbox"]');
  const n = await cbs.count();
  console.log(`>>> 2. 체크박스 ${n}개`);
  if (n <= 1) { console.log(">>> 학생 없음. 종료."); return; }

  // ═══ 3. 학생 1명 선택 → 수업결과 발송 ═══
  await cbs.nth(1).check({ force: true });
  await page.waitForTimeout(500);
  console.log(">>> 3. 수업결과 발송 클릭");
  await page.locator("button").filter({ hasText: "수업결과 발송" }).click();
  await page.waitForTimeout(6000);
  await page.screenshot({ path: "e2e/screenshots/flow-modal-result.png" });

  // ═══ 4. 모달 본문 확인 ═══
  const ta = page.locator("textarea").first();
  if (await ta.isVisible({ timeout: 8000 }).catch(() => false)) {
    const body = await ta.inputValue();
    console.log(">>> === MODAL BODY ===");
    console.log(body);
    console.log(">>> === END ===");
    if (body.includes("임근혁영어")) console.log(">>> PASS: 양식 자동 로드 + 변수 치환 성공!");
    else if (body.includes("성적표")) console.log(">>> 기본 양식 사용");
    else console.log(">>> 기타 본문");
  } else {
    console.log(">>> 모달 안 열림");
  }
});
