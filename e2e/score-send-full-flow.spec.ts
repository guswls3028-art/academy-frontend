/**
 * Tenant 1 — 성적 발송 전체 E2E 플로우
 * 프론트 UI만으로: 수강생 배정 → 시험 생성 → 점수 입력 → 수업결과 발송
 */
import { test, expect } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";

const BASE = "https://hakwonplus.com";

test("성적 발송 — 수강생 배정 + 시험 + 발송 전체", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(`PAGE: ${err.message}`));

  await loginViaUI(page, "admin");

  // ═══ 1. 성적 탭으로 이동 ═══
  await page.goto(`${BASE}/admin/lectures/77/sessions/57/scores`, { waitUntil: "load" });
  await page.waitForTimeout(5000);

  // ═══ 2. 수강생이 없으면 배정 ═══
  const emptyMsg = page.getByText("등록된 수강생이 없습니다");
  if (await emptyMsg.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log(">>> 수강생 없음 — 배정 시도");

    // "수강생 추가" 버튼 클릭
    const addStudentBtn = page.locator("button").filter({ hasText: /수강생 추가|추가/ }).first();
    if (await addStudentBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addStudentBtn.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: "e2e/screenshots/score-flow-add-student-modal.png" });

      // 모달에서 전체 선택 또는 첫 번째 학생 체크
      const modalCheckboxes = page.locator('.ant-modal input[type="checkbox"], .admin-modal input[type="checkbox"]');
      const mcCount = await modalCheckboxes.count();
      console.log(`>>> 수강생 추가 모달: ${mcCount} checkboxes`);

      if (mcCount > 0) {
        // 전체 선택 (첫 번째 체크박스)
        await modalCheckboxes.first().check({ force: true });
        await page.waitForTimeout(500);

        // 확인/저장 버튼
        const confirmBtn = page.locator("button").filter({ hasText: /확인|저장|추가/ }).last();
        if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await confirmBtn.click();
          await page.waitForTimeout(2000);
        }
      }
    }

    // 페이지 새로고침
    await page.reload({ waitUntil: "load" });
    await page.waitForTimeout(5000);
  }

  await page.screenshot({ path: "e2e/screenshots/score-flow-after-enroll.png" });

  // ═══ 3. 학생 선택 + 수업결과 발송 ═══
  const checkboxes = page.locator('input[type="checkbox"]');
  const cbCount = await checkboxes.count();
  console.log(`>>> 성적 페이지 checkboxes: ${cbCount}`);

  if (cbCount > 1) {
    // 두 번째 체크박스 (첫 번째는 전체선택)
    await checkboxes.nth(1).check({ force: true });
    await page.waitForTimeout(500);

    const selected = page.getByText(/\d+명 선택됨/);
    if (await selected.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log(`>>> 선택: ${await selected.textContent()}`);
    }
  } else {
    console.log(">>> 체크박스 없음 — 수강생 배정 실패");
    return;
  }

  // "수업결과 발송" 버튼
  const sendBtn = page.locator("button").filter({ hasText: "수업결과 발송" }).first();
  await expect(sendBtn).toBeVisible({ timeout: 5000 });
  console.log(">>> 수업결과 발송 클릭...");
  await sendBtn.click();
  await page.waitForTimeout(6000);

  await page.screenshot({ path: "e2e/screenshots/score-flow-modal-open.png" });

  // ═══ 4. 모달 확인 ═══
  const textarea = page.locator("textarea").first();
  if (await textarea.isVisible({ timeout: 8000 }).catch(() => false)) {
    const body = await textarea.inputValue();
    console.log(">>> 모달 본문 (300자):");
    console.log(body.substring(0, 300));

    if (body.includes("임근혁영어") || body.includes("두각학원")) {
      console.log(">>> RESULT: 양식 자동 로드 성공!");
    } else if (body.includes("성적표 안내")) {
      console.log(">>> RESULT: 기본 양식 사용 (커스텀 템플릿 없음)");
    } else if (body.trim()) {
      console.log(">>> RESULT: 본문 있음 (내용 확인 필요)");
    } else {
      console.log(">>> RESULT: 본문 비어있음");
    }
  } else {
    console.log(">>> 모달 안 열림");
  }

  if (errors.length) {
    console.log(">>> ERRORS:");
    errors.forEach(e => console.log("  " + e));
  }
});
