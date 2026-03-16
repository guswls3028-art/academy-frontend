/**
 * 실제 운영 전체 검증 — 매 단계 스크린샷 저장
 * 0317테스트학생 (01034137466/0000) + admin97
 */
import { test, expect, type Page, type Browser } from "@playwright/test";
import { loginViaUI, loginDirect, getBaseUrl } from "../helpers/auth";
import { apiCall } from "../helpers/api";

const BASE = getBaseUrl("admin");

test.describe.serial("전체 운영 검증", () => {
  let browser: Browser;
  let T: Page; // teacher
  let S: Page; // student

  test.beforeAll(async ({ browser: b }) => { browser = b; });

  // ── 교사 로그인 ──
  test("01 교사 로그인", async () => {
    T = await (await browser.newContext()).newPage();
    await loginViaUI(T, "admin");
    await T.screenshot({ path: "test-results/01-teacher-login.png" });
  });

  // ── 교사: 학생 목록 확인 ──
  test("02 교사: 학생 목록에서 0317테스트학생 확인", async () => {
    await T.goto(`${BASE}/admin/students`);
    await T.waitForLoadState("load");
    await T.waitForTimeout(3000);
    await T.screenshot({ path: "test-results/02-student-list.png" });
    // 학생이 보이는지
    const stu = T.locator("text=0317테스트학생");
    await expect(stu).toBeVisible({ timeout: 10000 });
  });

  // ── 교사: 강의 목록 확인 ──
  test("03 교사: 강의 목록", async () => {
    await T.goto(`${BASE}/admin/lectures`);
    await T.waitForLoadState("load");
    await T.waitForTimeout(2000);
    await T.screenshot({ path: "test-results/03-lectures.png" });
    await expect(T.locator("text=Not Found")).not.toBeVisible();
  });

  // ── 교사: 공지 목록 ──
  test("04 교사: 공지 목록", async () => {
    await T.goto(`${BASE}/admin/community/notice`);
    await T.waitForLoadState("load");
    await T.waitForTimeout(2000);
    await T.screenshot({ path: "test-results/04-notice-list.png" });
    await expect(T.locator("text=Not Found")).not.toBeVisible();
  });

  // ── 교사: QnA 목록 ──
  test("05 교사: QnA 목록", async () => {
    await T.goto(`${BASE}/admin/community/qna`);
    await T.waitForLoadState("load");
    await T.waitForTimeout(2000);
    await T.screenshot({ path: "test-results/05-qna-list.png" });
  });

  // ── 교사: 클리닉 홈 ──
  test("06 교사: 클리닉 홈", async () => {
    await T.goto(`${BASE}/admin/clinic/home`);
    await T.waitForLoadState("load");
    await T.waitForTimeout(2000);
    await T.screenshot({ path: "test-results/06-clinic-home.png" });
    await expect(T.locator("text=Not Found")).not.toBeVisible();
  });

  // ── 교사: 메시지 설정 ──
  test("07 교사: 메시지 템플릿", async () => {
    await T.goto(`${BASE}/admin/message/templates`);
    await T.waitForLoadState("load");
    await T.waitForTimeout(2000);
    await T.screenshot({ path: "test-results/07-msg-templates.png" });
  });

  // ── 교사: 영상 ──
  test("08 교사: 영상 목록", async () => {
    await T.goto(`${BASE}/admin/videos`);
    await T.waitForLoadState("load");
    await T.waitForTimeout(2000);
    await T.screenshot({ path: "test-results/08-videos.png" });
  });

  // ══════════════════════════════
  // 학생 파트
  // ══════════════════════════════

  test("09 학생 로그인 (01034137466/0000)", async () => {
    S = await (await browser.newContext()).newPage();
    await S.goto(`${BASE}/login/hakwonplus`);
    await S.waitForLoadState("networkidle");
    // 로그인 버튼 클릭 → 폼 열기
    const expandBtn = S.locator('[data-testid="login-expand-btn"]');
    await expandBtn.waitFor({ state: "visible", timeout: 10000 });
    await expandBtn.click();
    // 입력 폼 대기
    const usernameInput = S.locator('[data-testid="login-username"]');
    await usernameInput.waitFor({ state: "visible", timeout: 10000 });
    await usernameInput.fill("01034137466");
    await S.locator('[data-testid="login-password"]').fill("0000");
    await S.locator('[data-testid="login-submit"]').click();
    await S.waitForURL(/\/(student)/, { timeout: 20000 });
    await S.waitForTimeout(2000);
    await S.screenshot({ path: "test-results/09-student-dashboard.png" });
  });

  // ── 학생: 공지 확인 ──
  test("10 학생: 공지 목록", async () => {
    await S.goto(`${BASE}/student/notices`);
    await S.waitForLoadState("load");
    await S.waitForTimeout(3000);
    await S.screenshot({ path: "test-results/10-student-notices.png" });
    await expect(S.locator("[data-app='student']").first()).toBeVisible();
  });

  // ── 학생: QnA 질문 등록 ──
  test("11 학생: QnA 질문 등록", async () => {
    await S.goto(`${BASE}/student/community`);
    await S.waitForLoadState("load");
    await S.waitForTimeout(2000);

    // QnA 탭
    const qnaTab = S.locator("button, [role='tab']").filter({ hasText: /QnA/ }).first();
    if (await qnaTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await qnaTab.click();
      await S.waitForTimeout(500);
    }
    await S.screenshot({ path: "test-results/11a-qna-tab.png" });

    // 질문하기
    const writeBtn = S.locator("button, a").filter({ hasText: /질문/ }).first();
    if (await writeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await writeBtn.click();
      await S.waitForTimeout(1000);

      // 제목
      const title = S.locator('input[placeholder*="제목"]').first();
      if (await title.isVisible({ timeout: 3000 }).catch(() => false)) {
        await title.fill("수학 도함수 질문입니다");

        // 내용
        const editor = S.locator('.ProseMirror, [contenteditable="true"]').first();
        if (await editor.isVisible({ timeout: 3000 }).catch(() => false)) {
          await editor.click();
          await S.keyboard.type("도함수 구하는 방법이 헷갈립니다.");
        }

        await S.screenshot({ path: "test-results/11b-qna-form.png" });

        // 제출
        const submit = S.locator("button").filter({ hasText: /보내기|등록/ }).first();
        if (await submit.isEnabled({ timeout: 3000 }).catch(() => false)) {
          await submit.click();
          await S.waitForTimeout(3000);
          await S.screenshot({ path: "test-results/11c-qna-submitted.png" });
        }
      }
    }
  });

  // ── 학생: 클리닉 ──
  test("12 학생: 클리닉 화면", async () => {
    await S.goto(`${BASE}/student/clinic`);
    await S.waitForLoadState("load");
    await S.waitForTimeout(3000);
    await S.screenshot({ path: "test-results/12-student-clinic.png" });
    await expect(S.locator("text=Not Found")).not.toBeVisible();
  });

  // ── 학생: 영상 홈 ──
  test("13 학생: 영상 홈", async () => {
    await S.goto(`${BASE}/student/video`);
    await S.waitForLoadState("load");
    await S.waitForTimeout(3000);
    await S.screenshot({ path: "test-results/13-student-video.png" });
  });

  // ── 학생: 세션/일정 ──
  test("14 학생: 일정", async () => {
    await S.goto(`${BASE}/student/sessions`);
    await S.waitForLoadState("load");
    await S.waitForTimeout(2000);
    await S.screenshot({ path: "test-results/14-student-sessions.png" });
  });

  // ── 학생: 시험 목록 ──
  test("15 학생: 시험 목록", async () => {
    await S.goto(`${BASE}/student/exams`);
    await S.waitForLoadState("load");
    await S.waitForTimeout(2000);
    await S.screenshot({ path: "test-results/15-student-exams.png" });
  });

  // ── 학생: 성적 ──
  test("16 학생: 성적", async () => {
    await S.goto(`${BASE}/student/grades`);
    await S.waitForLoadState("load");
    await S.waitForTimeout(2000);
    await S.screenshot({ path: "test-results/16-student-grades.png" });
  });

  // ── 학생: 제출 허브 ──
  test("17 학생: 제출", async () => {
    await S.goto(`${BASE}/student/submit`);
    await S.waitForLoadState("load");
    await S.waitForTimeout(2000);
    await S.screenshot({ path: "test-results/17-student-submit.png" });
  });

  // ── 학생: 프로필 ──
  test("18 학생: 프로필", async () => {
    await S.goto(`${BASE}/student/profile`);
    await S.waitForLoadState("load");
    await S.waitForTimeout(2000);
    await S.screenshot({ path: "test-results/18-student-profile.png" });
  });

  // ── 학생: 인벤토리 ──
  test("19 학생: 인벤토리", async () => {
    await S.goto(`${BASE}/student/inventory`);
    await S.waitForLoadState("load");
    await S.waitForTimeout(2000);
    await S.screenshot({ path: "test-results/19-student-inventory.png" });
  });

  // ── 학생: 출결 ──
  test("20 학생: 출결", async () => {
    await S.goto(`${BASE}/student/attendance`);
    await S.waitForLoadState("load");
    await S.waitForTimeout(2000);
    await S.screenshot({ path: "test-results/20-student-attendance.png" });
  });

  // ══════════════════════════════
  // 교사 복귀 — QnA 답변
  // ══════════════════════════════
  test("21 교사: QnA 답변", async () => {
    await T.goto(`${BASE}/admin/community/qna`);
    await T.waitForLoadState("load");
    await T.waitForTimeout(3000);
    await T.screenshot({ path: "test-results/21-teacher-qna.png" });

    // 학생 질문 찾아서 클릭
    const q = T.locator("text=도함수").first();
    if (await q.isVisible({ timeout: 5000 }).catch(() => false)) {
      await q.click();
      await T.waitForTimeout(1000);
      await T.screenshot({ path: "test-results/21b-qna-detail.png" });

      // 답변 입력
      const reply = T.locator('textarea').last();
      if (await reply.isVisible({ timeout: 3000 }).catch(() => false)) {
        await reply.fill("도함수는 lim(h→0) [f(x+h)-f(x)]/h 입니다. 교재 52p를 참고하세요.");
        const send = T.locator("button").filter({ hasText: /답변|등록/ }).first();
        await send.click();
        await T.waitForTimeout(2000);
        await T.screenshot({ path: "test-results/21c-qna-replied.png" });
      }
    }
  });

  // ── 교사: 클리닉 운영 콘솔 ──
  test("22 교사: 클리닉 운영", async () => {
    await T.goto(`${BASE}/admin/clinic/operations`);
    await T.waitForLoadState("load");
    await T.waitForTimeout(2000);
    await T.screenshot({ path: "test-results/22-clinic-operations.png" });
  });

  // ── 교사: 스태프 ──
  test("23 교사: 스태프", async () => {
    await T.goto(`${BASE}/admin/staff`);
    await T.waitForLoadState("load");
    await T.waitForTimeout(2000);
    await T.screenshot({ path: "test-results/23-staff.png" });
  });

  // ── 교사: 설정 ──
  test("24 교사: 설정", async () => {
    await T.goto(`${BASE}/admin/settings`);
    await T.waitForLoadState("load");
    await T.waitForTimeout(2000);
    await T.screenshot({ path: "test-results/24-settings.png" });
  });

  // ══════════════════════════════
  // 학생 복귀 — 답변 확인
  // ══════════════════════════════
  test("25 학생: QnA 답변 확인", async () => {
    await S.goto(`${BASE}/student/community`);
    await S.waitForLoadState("load");
    await S.waitForTimeout(2000);

    const qnaTab = S.locator("button, [role='tab']").filter({ hasText: /QnA/ }).first();
    if (await qnaTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await qnaTab.click();
      await S.waitForTimeout(1000);
    }

    const myQ = S.locator("text=도함수").first();
    if (await myQ.isVisible({ timeout: 5000 }).catch(() => false)) {
      await myQ.click();
      await S.waitForTimeout(2000);
    }
    await S.screenshot({ path: "test-results/25-student-qna-answer.png" });
  });

  test.afterAll(async () => {
    await S?.context()?.close();
    await T?.context()?.close();
  });
});
