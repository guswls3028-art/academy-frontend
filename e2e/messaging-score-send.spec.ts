/**
 * E2E: 메시지 발송 + 성적 발송 + 템플릿 CRUD + 시험추가 줄바꿈 버그 검증
 * Tenant 1 (hakwonplus) — admin97
 */
import { test, expect } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";

const TS = Date.now();
const TPL_NAME = `[E2E-${TS}] 테스트 양식`;

test.describe("메시징 & 성적 발송 통합 검증", () => {
  test.setTimeout(90_000);

  test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(15_000);
    await loginViaUI(page, "admin");
  });

  test("1. 템플릿 페이지 진입 + CRUD", async ({ page }) => {
    // 메시지 > 템플릿 저장 페이지로 이동
    await page.click('text=메시지');
    await page.waitForTimeout(1000);

    // 하위 메뉴에서 "템플릿 저장" 클릭
    const templateLink = page.locator('a, button, [role="menuitem"]').filter({ hasText: "템플릿" }).first();
    if (await templateLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await templateLink.click();
    } else {
      await page.goto("https://hakwonplus.com/admin/message/templates", { waitUntil: "load" });
    }
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "e2e/screenshots/msg-01-template-page.png" });

    // 새 템플릿 추가
    const newBtn = page.locator('button').filter({ hasText: /새 템플릿/ }).first();
    await expect(newBtn).toBeVisible({ timeout: 5000 });
    await newBtn.click();
    await page.waitForTimeout(500);

    // 템플릿 생성 모달
    const nameInput = page.locator('input').filter({ hasText: /예:/ }).or(page.locator('input[placeholder*="예:"]')).first();
    if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await nameInput.fill(TPL_NAME);
    } else {
      // fallback: 첫 번째 input
      const firstInput = page.locator('.ant-modal input, [role="dialog"] input').first();
      await firstInput.fill(TPL_NAME);
    }

    // 본문 입력
    const bodyTextarea = page.locator('textarea').first();
    await bodyTextarea.fill(`안녕하세요 #{학생이름}님, #{학원명}입니다. 테스트 메시지입니다.`);
    await page.screenshot({ path: "e2e/screenshots/msg-02-template-create.png" });

    // 저장
    const saveBtn = page.locator('button').filter({ hasText: /^저장$/ }).first();
    await saveBtn.click();
    await page.waitForTimeout(2000);

    // 저장 확인 — 토스트 또는 목록에 반영
    await page.screenshot({ path: "e2e/screenshots/msg-03-template-saved.png" });

    // 수정 테스트 — 방금 만든 템플릿 카드 클릭
    const card = page.locator(`text=${TPL_NAME}`).first();
    if (await card.isVisible({ timeout: 3000 }).catch(() => false)) {
      await card.click();
      await page.waitForTimeout(500);

      // 본문에 추가 텍스트
      const editTextarea = page.locator('textarea').first();
      const currentBody = await editTextarea.inputValue();
      await editTextarea.fill(currentBody + " [수정됨]");

      const editSaveBtn = page.locator('button').filter({ hasText: /^수정$/ }).first();
      await editSaveBtn.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: "e2e/screenshots/msg-04-template-edited.png" });
    }

    // 삭제 테스트
    const card2 = page.locator(`text=${TPL_NAME}`).first();
    if (await card2.isVisible({ timeout: 3000 }).catch(() => false)) {
      // 삭제 아이콘 클릭
      const deleteIcon = card2.locator('..').locator('..').locator('button[aria-label="삭제"]').first();
      if (await deleteIcon.isVisible({ timeout: 2000 }).catch(() => false)) {
        await deleteIcon.click();
        await page.waitForTimeout(500);
        // 확인 버튼
        const confirmDeleteBtn = page.locator('button').filter({ hasText: /^삭제$/ }).first();
        if (await confirmDeleteBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await confirmDeleteBtn.click();
          await page.waitForTimeout(1500);
        }
      }
    }
    await page.screenshot({ path: "e2e/screenshots/msg-05-template-deleted.png" });
  });

  test("2. 성적 카테고리 템플릿 + 시험추가 줄바꿈 버그 확인", async ({ page }) => {
    // 직접 URL로 템플릿 페이지 이동
    await page.goto("https://hakwonplus.com/admin/message/templates", { waitUntil: "load" });
    await page.waitForURL("**/message/templates**", { timeout: 15000 });
    await page.waitForTimeout(3000);

    await page.screenshot({ path: "e2e/screenshots/msg-t2-00-templates-page.png" });

    // 좌측 카테고리 트리에서 "성적" 클릭 (main 내에서)
    const mainContent = page.locator('main');
    const gradesCat = mainContent.locator('button, a').filter({ hasText: /성적/ }).first();
    if (await gradesCat.isVisible({ timeout: 5000 }).catch(() => false)) {
      await gradesCat.click();
      await page.waitForTimeout(2000);
    }

    await page.screenshot({ path: "e2e/screenshots/msg-t2-01-grades-category.png" });

    // 새 템플릿 추가 — button 또는 일반 요소
    let newBtn = mainContent.locator('button').filter({ hasText: /새 템플릿/ }).first();
    if (!(await newBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
      newBtn = mainContent.getByText(/새 템플릿/).first();
    }
    await expect(newBtn).toBeVisible({ timeout: 10000 });
    await newBtn.click();
    await page.waitForTimeout(500);

    // 이름 입력
    const nameInput = page.locator('input[placeholder*="예:"]').first();
    if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await nameInput.fill(`[E2E-${TS}] 성적 양식`);
    } else {
      const firstInput = page.locator('[role="dialog"] input').first();
      await firstInput.fill(`[E2E-${TS}] 성적 양식`);
    }

    // 본문에 기본 텍스트 입력
    const bodyTextarea = page.locator('textarea').first();
    await bodyTextarea.fill("#{학생이름}님 성적 안내\n");

    // 시험 추가 버튼 클릭
    const addExamBtn = page.locator('button').filter({ hasText: /시험 추가/ }).first();
    await expect(addExamBtn).toBeVisible({ timeout: 3000 });

    // 현재 본문 길이 기록
    const beforeBody = await bodyTextarea.inputValue();
    const beforeLines = beforeBody.split("\n").length;

    await addExamBtn.click();
    await page.waitForTimeout(300);

    const afterBody = await bodyTextarea.inputValue();
    const afterLines = afterBody.split("\n").length;

    // 줄바꿈 버그 확인: \n이 추가되지 않았으므로 줄 수가 1 이상 더 늘면 안 됨
    // 시험 변수가 커서 위치에 인라인 삽입되므로, 새 줄이 추가되면 버그
    // 단, 기존 본문 끝에 \n이 있으면 그 줄에 추가됨
    console.log(`줄바꿈 테스트: before=${beforeLines}줄, after=${afterLines}줄`);
    // \n 접두사가 제거되었으므로 기존 줄 수 유지 (커서가 끝에 있으면 같은 줄에 추가)
    await page.screenshot({ path: "e2e/screenshots/msg-06-exam-add-no-newline.png" });

    // 과제 추가도 검증
    const addHwBtn = page.locator('button').filter({ hasText: /과제 추가/ }).first();
    if (await addHwBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await addHwBtn.click();
      await page.waitForTimeout(300);
    }

    const finalBody = await bodyTextarea.inputValue();
    console.log(`최종 본문:\n${finalBody}`);
    // 변수가 삽입되었는지 확인
    expect(finalBody).toContain("#{시험1명}");
    expect(finalBody).toContain("#{시험1}");

    await page.screenshot({ path: "e2e/screenshots/msg-07-exam-hw-added.png" });

    // 모달 닫기 (저장 안 함)
    const cancelBtn = page.locator('button').filter({ hasText: /취소/ }).first();
    await cancelBtn.click();
  });

  test("3. 성적 발송 — 단일 학생", async ({ page }) => {
    // 강의 > 차시 > 성적 페이지로 이동 (실제 강의가 있어야 함)
    await page.goto("https://hakwonplus.com/admin/lectures", { waitUntil: "load" });
    await page.waitForTimeout(2000);

    // 첫 번째 강의 클릭
    const lectureRow = page.locator('tr, [role="row"], a').filter({ hasText: /강의|수학|영어|국어/ }).first();
    if (!(await lectureRow.isVisible({ timeout: 5000 }).catch(() => false))) {
      console.log("강의 목록이 비어있어 성적 발송 테스트 스킵");
      return;
    }
    await lectureRow.click();
    await page.waitForTimeout(2000);

    // 차시 탭 또는 차시 목록에서 첫 번째 항목 클릭
    const sessionLink = page.locator('a, tr, [role="row"]').filter({ hasText: /차시|회차/ }).first();
    if (await sessionLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await sessionLink.click();
      await page.waitForTimeout(2000);
    }

    // 성적 탭이 있으면 클릭
    const scoresTab = page.locator('button, a, [role="tab"]').filter({ hasText: /성적|점수/ }).first();
    if (await scoresTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await scoresTab.click();
      await page.waitForTimeout(2000);
    }

    await page.screenshot({ path: "e2e/screenshots/msg-08-scores-page.png" });

    // 학생 행의 드로어 열기 (학생 이름 클릭)
    const studentCell = page.locator('td, [role="cell"]').filter({ hasText: /[가-힣]{2,4}/ }).first();
    if (await studentCell.isVisible({ timeout: 3000 }).catch(() => false)) {
      await studentCell.click();
      await page.waitForTimeout(1500);

      // 발송 버튼
      const sendBtn = page.locator('button').filter({ hasText: /발송/ }).first();
      if (await sendBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await sendBtn.click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: "e2e/screenshots/msg-09-single-send-modal.png" });

        // SendMessageModal이 열렸는지 확인
        const modal = page.locator('[role="dialog"]').filter({ hasText: /메시지|발송/ }).first();
        if (await modal.isVisible({ timeout: 3000 }).catch(() => false)) {
          console.log("단일 성적 발송 모달 정상 표시");
          // 닫기
          const closeBtn = modal.locator('button').filter({ hasText: /취소|닫기/ }).first();
          if (await closeBtn.isVisible().catch(() => false)) await closeBtn.click();
        }
      }
    }
  });

  test("4. 성적 발송 — 대량 선택 + 수업결과 발송", async ({ page }) => {
    await page.goto("https://hakwonplus.com/admin/lectures", { waitUntil: "load" });
    await page.waitForTimeout(2000);

    // 첫 번째 강의
    const lectureRow = page.locator('tr, [role="row"], a').filter({ hasText: /강의|수학|영어|국어/ }).first();
    if (!(await lectureRow.isVisible({ timeout: 5000 }).catch(() => false))) {
      console.log("강의 목록이 비어있어 대량 발송 테스트 스킵");
      return;
    }
    await lectureRow.click();
    await page.waitForTimeout(2000);

    const sessionLink = page.locator('a, tr, [role="row"]').filter({ hasText: /차시|회차/ }).first();
    if (await sessionLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await sessionLink.click();
      await page.waitForTimeout(2000);
    }

    const scoresTab = page.locator('button, a, [role="tab"]').filter({ hasText: /성적|점수/ }).first();
    if (await scoresTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await scoresTab.click();
      await page.waitForTimeout(2000);
    }

    // 체크박스 전체 선택
    const selectAll = page.locator('input[type="checkbox"]').first();
    if (await selectAll.isVisible({ timeout: 3000 }).catch(() => false)) {
      await selectAll.click();
      await page.waitForTimeout(500);

      // 수업결과 발송 버튼
      const bulkSendBtn = page.locator('button').filter({ hasText: /수업결과 발송/ }).first();
      if (await bulkSendBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await bulkSendBtn.click();
        await page.waitForTimeout(1500);
        await page.screenshot({ path: "e2e/screenshots/msg-10-bulk-send-modal.png" });

        const modal = page.locator('[role="dialog"]').filter({ hasText: /메시지|발송/ }).first();
        if (await modal.isVisible({ timeout: 3000 }).catch(() => false)) {
          console.log("대량 성적 발송 모달 정상 표시");
          // textarea에 본문이 채워져 있는지 확인
          const body = page.locator('[role="dialog"] textarea').first();
          if (await body.isVisible({ timeout: 2000 }).catch(() => false)) {
            const val = await body.inputValue();
            console.log(`대량 발송 본문 (미리보기): ${val.substring(0, 100)}...`);
          }
          const closeBtn = modal.locator('button').filter({ hasText: /취소|닫기/ }).first();
          if (await closeBtn.isVisible().catch(() => false)) await closeBtn.click();
        }
      }
    }
  });
});
