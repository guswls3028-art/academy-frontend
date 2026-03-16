/**
 * QnA 왕복 플로우 E2E
 *
 * 학생 질문 등록 → 선생 확인 → 선생 답변 → 학생 답변 확인
 * Tenant 1 (hakwonplus) 개발 테넌트에서 실행
 */
import { test, expect, type Page, type Browser } from "@playwright/test";
import { loginViaUI, getBaseUrl } from "../helpers/auth";
import { apiCall } from "../helpers/api";

const BASE = getBaseUrl("admin");
const TIMESTAMP = Date.now();
const Q_TITLE = `[E2E] QnA 테스트 질문 ${TIMESTAMP}`;
const Q_CONTENT = `E2E 자동 테스트 — 답변 확인용 (${TIMESTAMP})`;
const A_CONTENT = `E2E 답변입니다. 확인해주세요. (${TIMESTAMP})`;

test.describe.serial("QnA 왕복: 학생→선생→학생", () => {
  let browser: Browser;
  let studentPage: Page;
  let adminPage: Page;

  test.beforeAll(async ({ browser: b }) => {
    browser = b;
  });

  test("1. 학생이 QnA 질문을 등록한다", async () => {
    const ctx = await browser.newContext();
    studentPage = await ctx.newPage();
    await loginViaUI(studentPage, "student");

    // 커뮤니티 QnA 이동
    await studentPage.goto(`${BASE}/student/community`);
    await studentPage.waitForLoadState("networkidle");

    // "질문하기" 또는 QnA 탭 찾기
    const qnaTab = studentPage.locator("button, a, [role='tab']").filter({ hasText: /질문|Q&A|QnA/ }).first();
    if (await qnaTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await qnaTab.click();
      await studentPage.waitForTimeout(500);
    }

    // 질문 작성 버튼
    const writeBtn = studentPage.locator("button, a").filter({ hasText: /질문|작성|글쓰기/ }).first();
    await writeBtn.waitFor({ state: "visible", timeout: 5000 });
    await writeBtn.click();
    await studentPage.waitForTimeout(500);

    // 제목 입력
    const titleInput = studentPage.locator('input[placeholder*="제목"], input[name*="title"], textarea[placeholder*="제목"]').first();
    await titleInput.waitFor({ state: "visible", timeout: 5000 });
    await titleInput.fill(Q_TITLE);

    // 내용 입력 (TipTap RichTextEditor — ProseMirror contenteditable)
    const editor = studentPage.locator('.ProseMirror[contenteditable="true"], [contenteditable="true"]').first();
    await editor.waitFor({ state: "visible", timeout: 5000 });
    await editor.click();
    await studentPage.keyboard.type(Q_CONTENT);

    // 제출 버튼 활성화 대기 후 클릭
    const submitBtn = studentPage.locator("button").filter({ hasText: /보내기|등록|제출/ }).first();
    await expect(submitBtn).toBeEnabled({ timeout: 3000 });
    await submitBtn.click();

    // 제출 성공 확인: 목록으로 복귀하여 내 질문이 보이는지
    await studentPage.waitForTimeout(2000);
    // 토스트 또는 질문 목록에 제목이 보이면 성공
    const submitted = studentPage.locator(`text=${Q_TITLE}`).first();
    await expect(submitted).toBeVisible({ timeout: 10000 });
  });

  test("2. 선생 QnA 목록에 학생 질문이 보인다", async () => {
    const ctx = await browser.newContext();
    adminPage = await ctx.newPage();
    await loginViaUI(adminPage, "admin");

    // QnA 페이지 이동
    await adminPage.goto(`${BASE}/admin/community/qna`);
    await adminPage.waitForLoadState("networkidle");

    // 학생이 등록한 질문 찾기
    const question = adminPage.locator(`text=${Q_TITLE}`).first();
    await expect(question).toBeVisible({ timeout: 10000 });
  });

  test("3. 선생이 답변을 등록한다 (API + 화면 반영)", async () => {
    // 먼저 질문 ID를 찾기
    const listResp = await apiCall(adminPage, "GET", "/community/posts/?post_type=qna&page_size=50");
    const posts = listResp.body?.results || listResp.body || [];
    const target = posts.find((p: any) => p.title === Q_TITLE);
    expect(target).toBeTruthy();

    // API로 답변 등록
    const replyResp = await apiCall(adminPage, "POST", `/community/posts/${target.id}/replies/`, {
      content: A_CONTENT,
    });
    expect(replyResp.status).toBe(201);

    // 관리자 QnA 목록 새로고침 → 답변 상태 반영 확인
    await adminPage.goto(`${BASE}/admin/community/qna`);
    await adminPage.waitForLoadState("networkidle");
    // 질문이 여전히 보이는지 확인
    await expect(adminPage.locator(`text=${Q_TITLE}`).first()).toBeVisible({ timeout: 5000 });
  });

  test("4. 학생이 질문 상세에서 답변을 확인한다", async () => {
    // 학생 페이지 새로고침하여 QnA로 돌아감
    await studentPage.goto(`${BASE}/student/community`);
    await studentPage.waitForLoadState("networkidle");

    // QnA 탭
    const qnaTab = studentPage.locator("button, a, [role='tab']").filter({ hasText: /질문|Q&A|QnA/ }).first();
    if (await qnaTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await qnaTab.click();
      await studentPage.waitForTimeout(500);
    }

    // 내 질문 찾기
    const myQuestion = studentPage.locator(`text=${Q_TITLE}`).first();
    await expect(myQuestion).toBeVisible({ timeout: 5000 });
    await myQuestion.click();
    await studentPage.waitForTimeout(1000);

    // 답변 내용 확인
    const answer = studentPage.locator(`text=${A_CONTENT}`).first();
    await expect(answer).toBeVisible({ timeout: 5000 });
  });

  test.afterAll(async () => {
    // Cleanup: E2E 테스트 글 삭제 (관리자로)
    if (adminPage) {
      try {
        // QnA 목록에서 E2E 글 삭제
        await adminPage.goto(`${BASE}/admin/community/qna`);
        await adminPage.waitForLoadState("networkidle");
        const item = adminPage.locator(`text=${Q_TITLE}`).first();
        if (await item.isVisible({ timeout: 3000 }).catch(() => false)) {
          await item.click();
          await adminPage.waitForTimeout(500);
          const deleteBtn = adminPage.locator("button").filter({ hasText: /삭제/ }).first();
          if (await deleteBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await deleteBtn.click();
            // confirm 모달
            const confirmBtn = adminPage.locator("button").filter({ hasText: /삭제|확인/ }).last();
            if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
              await confirmBtn.click();
            }
          }
        }
      } catch { /* cleanup failure is not test failure */ }
    }
    await studentPage?.context()?.close();
    await adminPage?.context()?.close();
  });
});
