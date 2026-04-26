/**
 * 실제 운영 전체 검증 — 매 단계 스크린샷 저장
 * 0317테스트학생 (01034137466/0000) + admin97
 */
import { test, expect } from "../fixtures/strictTest";
import type { Page, Browser } from "@playwright/test";
import { loginViaUI, getBaseUrl } from "../helpers/auth";
import { gotoAndSettle } from "../helpers/wait";

const BASE = getBaseUrl("admin");

async function visitAndSnap(page: Page, path: string, screenshot: string, settleMs = 1500) {
  await gotoAndSettle(page, `${BASE}${path}`, { settleMs });
  await page.screenshot({ path: `test-results/${screenshot}.png` });
}

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
    await visitAndSnap(T, "/admin/students", "02-student-list", 2000);
    const stu = T.locator("text=0317테스트학생");
    await expect(stu).toBeVisible({ timeout: 10000 });
  });

  // ── 교사: 강의 목록 확인 ──
  test("03 교사: 강의 목록", async () => {
    await visitAndSnap(T, "/admin/lectures", "03-lectures");
    await expect(T.locator("text=Not Found")).not.toBeVisible();
  });

  // ── 교사: 공지 목록 ──
  test("04 교사: 공지 목록", async () => {
    await visitAndSnap(T, "/admin/community/notice", "04-notice-list");
    await expect(T.locator("text=Not Found")).not.toBeVisible();
  });

  // ── 교사: QnA 목록 ──
  test("05 교사: QnA 목록", async () => {
    await visitAndSnap(T, "/admin/community/qna", "05-qna-list");
  });

  // ── 교사: 클리닉 홈 ──
  test("06 교사: 클리닉 홈", async () => {
    await visitAndSnap(T, "/admin/clinic/home", "06-clinic-home");
    await expect(T.locator("text=Not Found")).not.toBeVisible();
  });

  // ── 교사: 메시지 설정 ──
  test("07 교사: 메시지 템플릿", async () => {
    await visitAndSnap(T, "/admin/message/templates", "07-msg-templates");
  });

  // ── 교사: 영상 ──
  test("08 교사: 영상 목록", async () => {
    await visitAndSnap(T, "/admin/videos", "08-videos");
  });

  // ══════════════════════════════
  // 학생 파트
  // ══════════════════════════════

  test("09 학생 로그인 (01034137466/0000)", async () => {
    S = await (await browser.newContext()).newPage();
    await gotoAndSettle(S, `${BASE}/login/hakwonplus`);
    const expandBtn = S.locator('[data-testid="login-expand-btn"]');
    await expandBtn.waitFor({ state: "visible", timeout: 10000 });
    await expandBtn.click();
    const usernameInput = S.locator('[data-testid="login-username"]');
    await usernameInput.waitFor({ state: "visible", timeout: 10000 });
    await usernameInput.fill("01034137466");
    await S.locator('[data-testid="login-password"]').fill("0000");
    await S.locator('[data-testid="login-submit"]').click();
    await S.waitForURL(/\/(student)/, { timeout: 20000 });
    await S.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await S.screenshot({ path: "test-results/09-student-dashboard.png" });
  });

  // ── 학생: 공지 확인 ──
  test("10 학생: 공지 목록", async () => {
    await visitAndSnap(S, "/student/notices", "10-student-notices", 2000);
    await expect(S.locator("[data-app='student']").first()).toBeVisible();
  });

  // ── 학생: QnA 질문 등록 ──
  test("11 학생: QnA 질문 등록", async () => {
    await gotoAndSettle(S, `${BASE}/student/community`, { settleMs: 1500 });

    const qnaTab = S.locator("button, [role='tab']").filter({ hasText: /QnA/ }).first();
    if (await qnaTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await qnaTab.click();
      await S.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
    }
    await S.screenshot({ path: "test-results/11a-qna-tab.png" });

    const writeBtn = S.locator("button, a").filter({ hasText: /질문/ }).first();
    if (await writeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await writeBtn.click();

      const title = S.locator('input[placeholder*="제목"]').first();
      if (await title.isVisible({ timeout: 5000 }).catch(() => false)) {
        await title.fill("수학 도함수 질문입니다");

        const editor = S.locator('.ProseMirror, [contenteditable="true"]').first();
        if (await editor.isVisible({ timeout: 3000 }).catch(() => false)) {
          await editor.click();
          await S.keyboard.type("도함수 구하는 방법이 헷갈립니다.");
        }

        await S.screenshot({ path: "test-results/11b-qna-form.png" });

        const submit = S.locator("button").filter({ hasText: /보내기|등록/ }).first();
        if (await submit.isEnabled({ timeout: 3000 }).catch(() => false)) {
          await submit.click();
          // 등록 후 목록에 새 질문이 노출되어야 round-trip 검증 완료.
          await expect(
            S.locator("text=수학 도함수 질문입니다").first(),
            "QnA 등록 후 목록에 새 질문이 노출되어야 함",
          ).toBeVisible({ timeout: 10_000 });
          await S.screenshot({ path: "test-results/11c-qna-submitted.png" });
        }
      }
    }
  });

  // ── 학생: 클리닉 ──
  test("12 학생: 클리닉 화면", async () => {
    await visitAndSnap(S, "/student/clinic", "12-student-clinic", 2000);
    await expect(S.locator("text=Not Found")).not.toBeVisible();
  });

  // ── 학생: 영상 홈 ──
  test("13 학생: 영상 홈", async () => {
    await visitAndSnap(S, "/student/video", "13-student-video", 2000);
  });

  // ── 학생: 세션/일정 ──
  test("14 학생: 일정", async () => {
    await visitAndSnap(S, "/student/sessions", "14-student-sessions");
  });

  // ── 학생: 시험 목록 ──
  test("15 학생: 시험 목록", async () => {
    await visitAndSnap(S, "/student/exams", "15-student-exams");
  });

  // ── 학생: 성적 ──
  test("16 학생: 성적", async () => {
    await visitAndSnap(S, "/student/grades", "16-student-grades");
  });

  // ── 학생: 제출 허브 ──
  test("17 학생: 제출", async () => {
    await visitAndSnap(S, "/student/submit", "17-student-submit");
  });

  // ── 학생: 프로필 ──
  test("18 학생: 프로필", async () => {
    await visitAndSnap(S, "/student/profile", "18-student-profile");
  });

  // ── 학생: 인벤토리 ──
  test("19 학생: 인벤토리", async () => {
    await visitAndSnap(S, "/student/inventory", "19-student-inventory");
  });

  // ── 학생: 출결 ──
  test("20 학생: 출결", async () => {
    await visitAndSnap(S, "/student/attendance", "20-student-attendance");
  });

  // ══════════════════════════════
  // 교사 복귀 — QnA 답변
  // ══════════════════════════════
  test("21 교사: QnA 답변", async () => {
    await gotoAndSettle(T, `${BASE}/admin/community/qna`, { settleMs: 2000 });
    await T.screenshot({ path: "test-results/21-teacher-qna.png" });

    const q = T.locator("text=도함수").first();
    if (await q.isVisible({ timeout: 5000 }).catch(() => false)) {
      await q.click();
      const reply = T.locator("textarea").last();
      await expect(reply, "QnA 상세 진입 후 답변 textarea 가 보여야 함").toBeVisible({ timeout: 5_000 });
      await T.screenshot({ path: "test-results/21b-qna-detail.png" });

      await reply.fill("도함수는 lim(h→0) [f(x+h)-f(x)]/h 입니다. 교재 52p를 참고하세요.");
      const send = T.locator("button").filter({ hasText: /답변|등록/ }).first();
      await send.click();
      await expect(
        T.locator("text=교재 52p를 참고").first(),
        "교사 답변이 게시글 상세에 즉시 반영되어야 함",
      ).toBeVisible({ timeout: 10_000 });
      await T.screenshot({ path: "test-results/21c-qna-replied.png" });
    }
  });

  // ── 교사: 클리닉 운영 콘솔 ──
  test("22 교사: 클리닉 운영", async () => {
    await visitAndSnap(T, "/admin/clinic/operations", "22-clinic-operations");
  });

  // ── 교사: 스태프 ──
  test("23 교사: 스태프", async () => {
    await visitAndSnap(T, "/admin/staff", "23-staff");
  });

  // ── 교사: 설정 ──
  test("24 교사: 설정", async () => {
    await visitAndSnap(T, "/admin/settings", "24-settings");
  });

  // ══════════════════════════════
  // 학생 복귀 — 답변 확인
  // ══════════════════════════════
  test("25 학생: QnA 답변 확인", async () => {
    await gotoAndSettle(S, `${BASE}/student/community`, { settleMs: 1500 });

    const qnaTab = S.locator("button, [role='tab']").filter({ hasText: /QnA/ }).first();
    if (await qnaTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await qnaTab.click();
      await S.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
    }

    const myQ = S.locator("text=도함수").first();
    if (await myQ.isVisible({ timeout: 5000 }).catch(() => false)) {
      await myQ.click();
      await expect(
        S.locator("text=교재 52p를 참고").first(),
        "학생 화면에서도 교사 답변이 노출되어야 함 (round-trip)",
      ).toBeVisible({ timeout: 10_000 });
    }
    await S.screenshot({ path: "test-results/25-student-qna-answer.png" });
  });

  test.afterAll(async () => {
    await S?.context()?.close();
    await T?.context()?.close();
  });
});
