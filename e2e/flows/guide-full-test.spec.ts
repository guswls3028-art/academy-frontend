/**
 * 사용자 가이드 기반 전체 플로우 테스트
 *
 * 가이드 순서대로 실행:
 * 교사: 로그인→학생확인→강의→차시→출결→시험→성적→공지→QnA→자료실→클리닉→메시지→영상→직원→설정
 * 학생: 로그인→홈→공지→영상→일정→시험→성적→제출→QnA질문→클리닉예약→인증패스→프로필→보관함
 * 교사복귀: QnA답변→클리닉출석
 * 학생복귀: 답변확인→클리닉상태
 *
 * 매 단계 스크린샷 저장
 */
import { test, expect } from "../fixtures/strictTest";
import type { Page, Browser } from "@playwright/test";
import { loginViaUI, getBaseUrl } from "../helpers/auth";
import { apiCall } from "../helpers/api";
import { TEST_RECIPIENT } from "../helpers/test-fixtures";
import { gotoAndSettle } from "../helpers/wait";

const BASE = getBaseUrl("admin");

/**
 * 가이드 투어용 화면 진입 + 스크린샷.
 * networkidle settle + 짧은 settleMs (SPA useEffect fetch 안정화) 후 캡처.
 */
async function visitAndSnap(page: Page, path: string, screenshot: string, settleMs = 1500) {
  await gotoAndSettle(page, `${BASE}${path}`, { settleMs });
  await page.screenshot({ path: `test-results/guide/${screenshot}.png`, fullPage: true });
}

test.describe.serial("가이드 기반 전체 테스트", () => {
  let browser: Browser;
  let T: Page; // teacher
  let S: Page; // student

  test.beforeAll(async ({ browser: b }) => { browser = b; });

  // ═══════════════════════════════════════════
  // 교사 파트
  // ═══════════════════════════════════════════

  test("T01 교사 로그인", async () => {
    T = await (await browser.newContext()).newPage();
    await loginViaUI(T, "admin");
    await T.screenshot({ path: "test-results/guide/T01-dashboard.png", fullPage: true });
  });

  test("T02 대시보드 확인", async () => {
    await visitAndSnap(T, "/admin/dashboard", "T02-dashboard-detail", 2000);
    await expect(T.locator("text=Not Found")).not.toBeVisible();
  });

  test("T03 학생 등록 (단건)", async () => {
    // 기존 테스트 학생이 있으면 삭제 후 재생성
    const existing = await apiCall(T, "GET", "/students/?page_size=200");
    const old = (existing.body?.results || []).find((s: any) => s.phone === TEST_RECIPIENT.studentPhone);
    if (old) {
      await apiCall(T, "DELETE", `/students/${old.id}/`);
      await apiCall(T, "POST", "/students/bulk_permanent_delete/", { ids: [old.id] });
    }

    // 학생 등록 (API — 알림톡 실제 발송)
    const resp = await apiCall(T, "POST", "/students/", {
      name: TEST_RECIPIENT.studentName,
      phone: TEST_RECIPIENT.studentPhone,
      parent_phone: TEST_RECIPIENT.parentPhone,
      initial_password: TEST_RECIPIENT.studentPassword,
      school_type: "HIGH",
      grade: 2,
      gender: "M",
      send_welcome_message: false,
    });
    expect([201, 409]).toContain(resp.status);

    await visitAndSnap(T, "/admin/students", "T03-students", 2000);
    await expect(T.locator(`text=${TEST_RECIPIENT.studentName}`)).toBeVisible({ timeout: 10000 });
  });

  test("T04 강의 목록", async () => {
    await visitAndSnap(T, "/admin/lectures", "T04-lectures");
  });

  test("T05 공지 작성 + 확인", async () => {
    await visitAndSnap(T, "/admin/community/notice", "T05-notice");
  });

  test("T06 QnA 확인", async () => {
    await visitAndSnap(T, "/admin/community/qna", "T06-qna");
  });

  test("T07 자료실", async () => {
    await visitAndSnap(T, "/admin/community/materials", "T07-materials");
  });

  test("T08 상담", async () => {
    await visitAndSnap(T, "/admin/community/counsel", "T08-counsel");
  });

  test("T09 클리닉 홈", async () => {
    await visitAndSnap(T, "/admin/clinic/home", "T09-clinic-home");
  });

  test("T10 클리닉 일정", async () => {
    await visitAndSnap(T, "/admin/clinic/schedule", "T10-clinic-schedule");
  });

  test("T11 클리닉 예약관리", async () => {
    await visitAndSnap(T, "/admin/clinic/bookings", "T11-clinic-bookings");
  });

  test("T12 클리닉 운영", async () => {
    await visitAndSnap(T, "/admin/clinic/operations", "T12-clinic-ops");
  });

  test("T13 클리닉 리포트", async () => {
    await visitAndSnap(T, "/admin/clinic/reports", "T13-clinic-reports");
  });

  test("T14 영상 관리", async () => {
    await visitAndSnap(T, "/admin/videos", "T14-videos");
  });

  test("T15 시험 관리", async () => {
    await visitAndSnap(T, "/admin/exams", "T15-exams");
  });

  test("T16 성적 관리", async () => {
    await visitAndSnap(T, "/admin/results", "T16-results");
  });

  test("T17 메시지 템플릿", async () => {
    await visitAndSnap(T, "/admin/message/templates", "T17-msg-templates");
  });

  test("T18 자동발송 설정", async () => {
    await visitAndSnap(T, "/admin/message/auto-send", "T18-auto-send");
  });

  test("T19 메시지 로그", async () => {
    await visitAndSnap(T, "/admin/message/log", "T19-msg-log");
  });

  test("T20 직원 관리", async () => {
    await visitAndSnap(T, "/admin/staff", "T20-staff");
  });

  test("T21 저장소", async () => {
    await visitAndSnap(T, "/admin/storage", "T21-storage");
  });

  test("T22 PPT 도구", async () => {
    await visitAndSnap(T, "/admin/tools", "T22-tools");
  });

  test("T23 설정 - 프로필", async () => {
    await visitAndSnap(T, "/admin/settings", "T23-settings");
  });

  test("T24 설정 - 학원정보", async () => {
    await visitAndSnap(T, "/admin/settings/organization", "T24-org");
  });

  test("T25 설정 - 테마", async () => {
    await visitAndSnap(T, "/admin/settings/appearance", "T25-theme");
  });

  test("T26 설정 - 구독", async () => {
    await visitAndSnap(T, "/admin/settings/billing", "T26-billing");
  });

  // ═══════════════════════════════════════════
  // 학생 파트
  // ═══════════════════════════════════════════

  test("S01 학생 로그인 (0317테스트학생)", async () => {
    S = await (await browser.newContext()).newPage();
    await gotoAndSettle(S, `${BASE}/login/hakwonplus`);
    const expandBtn = S.locator('[data-testid="login-expand-btn"]');
    await expandBtn.waitFor({ state: "visible", timeout: 10000 });
    await expandBtn.click();
    await S.locator('[data-testid="login-username"]').fill(TEST_RECIPIENT.studentPhone);
    await S.locator('[data-testid="login-password"]').fill(TEST_RECIPIENT.studentPassword);
    await S.locator('[data-testid="login-submit"]').click();
    await S.waitForURL(/\/student/, { timeout: 20000 });
    await S.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await S.screenshot({ path: "test-results/guide/S01-dashboard.png", fullPage: true });
  });

  test("S02 학생 공지", async () => {
    await visitAndSnap(S, "/student/notices", "S02-notices", 2000);
  });

  test("S03 학생 영상 홈", async () => {
    await visitAndSnap(S, "/student/video", "S03-video", 2000);
  });

  test("S04 학생 일정", async () => {
    await visitAndSnap(S, "/student/sessions", "S04-sessions");
  });

  test("S05 학생 시험", async () => {
    await visitAndSnap(S, "/student/exams", "S05-exams");
  });

  test("S06 학생 성적", async () => {
    await visitAndSnap(S, "/student/grades", "S06-grades");
  });

  test("S07 학생 제출", async () => {
    await visitAndSnap(S, "/student/submit", "S07-submit");
  });

  test("S08 학생 QnA 질문 등록", async () => {
    await gotoAndSettle(S, `${BASE}/student/community`, { settleMs: 1500 });

    const qnaTab = S.locator("button, [role='tab']").filter({ hasText: /QnA/ }).first();
    if (await qnaTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await qnaTab.click();
      await S.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
    }
    await S.screenshot({ path: "test-results/guide/S08a-qna-tab.png", fullPage: true });

    const writeBtn = S.locator("button, a").filter({ hasText: /질문/ }).first();
    if (await writeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await writeBtn.click();

      const title = S.locator('input[placeholder*="제목"]').first();
      if (await title.isVisible({ timeout: 5000 }).catch(() => false)) {
        await title.fill("가이드 테스트 질문입니다");
        const editor = S.locator('.ProseMirror, [contenteditable="true"]').first();
        if (await editor.isVisible({ timeout: 3000 }).catch(() => false)) {
          await editor.click();
          await S.keyboard.type("이 부분이 이해가 안 됩니다. 도움 부탁드립니다.");
        }
        await S.screenshot({ path: "test-results/guide/S08b-qna-form.png", fullPage: true });

        const submit = S.locator("button").filter({ hasText: /보내기|등록/ }).first();
        if (await submit.isEnabled({ timeout: 3000 }).catch(() => false)) {
          await submit.click();
          // 등록 후 목록 화면 복귀를 기다린다 — 게시글 제목이 목록에 보이면 성공.
          await expect(
            S.locator("text=가이드 테스트 질문입니다").first(),
            "QnA 등록 후 목록에 새 질문이 노출되어야 함",
          ).toBeVisible({ timeout: 10_000 });
          await S.screenshot({ path: "test-results/guide/S08c-qna-submitted.png", fullPage: true });
        }
      }
    }
  });

  test("S09 학생 클리닉", async () => {
    await visitAndSnap(S, "/student/clinic", "S09-clinic", 2000);
  });

  test("S10 학생 인증패스", async () => {
    await visitAndSnap(S, "/student/idcard", "S10-idcard", 2000);
  });

  test("S11 학생 프로필", async () => {
    await visitAndSnap(S, "/student/profile", "S11-profile");
  });

  test("S12 학생 보관함", async () => {
    await visitAndSnap(S, "/student/inventory", "S12-inventory");
  });

  test("S13 학생 출결", async () => {
    await visitAndSnap(S, "/student/attendance", "S13-attendance");
  });

  test("S14 학생 알림", async () => {
    await visitAndSnap(S, "/student/notifications", "S14-notifications");
  });

  test("S15 학생 커뮤니티 전체", async () => {
    await visitAndSnap(S, "/student/community", "S15-community");
  });

  // ═══════════════════════════════════════════
  // 교사 복귀 — QnA 답변
  // ═══════════════════════════════════════════

  test("T27 교사 QnA 답변", async () => {
    await gotoAndSettle(T, `${BASE}/admin/community/qna`, { settleMs: 2000 });

    const q = T.locator("text=가이드 테스트").first();
    if (await q.isVisible({ timeout: 5000 }).catch(() => false)) {
      await q.click();
      // 상세 진입 — textarea(답변창) 가 나타날 때까지.
      const reply = T.locator("textarea").last();
      await expect(reply, "QnA 상세 진입 후 답변 textarea 가 보여야 함").toBeVisible({ timeout: 5_000 });
      await T.screenshot({ path: "test-results/guide/T27a-qna-detail.png", fullPage: true });

      await reply.fill("이 부분은 교재 3장을 참고하시면 됩니다. 수업 시간에 다시 설명하겠습니다.");
      const send = T.locator("button").filter({ hasText: /답변|등록/ }).first();
      await send.click();
      // 답변 후 textarea 가 비워지거나 답변 내용이 화면에 노출되어야 함.
      await expect(
        T.locator("text=교재 3장을 참고").first(),
        "교사 답변이 게시글 상세에 즉시 반영되어야 함",
      ).toBeVisible({ timeout: 10_000 });
      await T.screenshot({ path: "test-results/guide/T27b-qna-replied.png", fullPage: true });
    }
  });

  // ═══════════════════════════════════════════
  // 학생 복귀 — 답변 확인
  // ═══════════════════════════════════════════

  test("S16 학생 답변 확인", async () => {
    await gotoAndSettle(S, `${BASE}/student/community`, { settleMs: 1500 });

    const qnaTab = S.locator("button, [role='tab']").filter({ hasText: /QnA/ }).first();
    if (await qnaTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await qnaTab.click();
      await S.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
    }

    const myQ = S.locator("text=가이드 테스트").first();
    if (await myQ.isVisible({ timeout: 5000 }).catch(() => false)) {
      await myQ.click();
      // 상세 진입 후 교사 답변이 보여야 학생 입장의 round-trip 검증 완료.
      await expect(
        S.locator("text=교재 3장을 참고").first(),
        "학생 화면에서도 교사 답변이 노출되어야 함 (round-trip)",
      ).toBeVisible({ timeout: 10_000 });
    }
    await S.screenshot({ path: "test-results/guide/S16-qna-answer.png", fullPage: true });
  });

  test.afterAll(async () => {
    // Cleanup QnA test post
    if (T) {
      try {
        const resp = await apiCall(T, "GET", "/community/posts/?post_type=qna&page_size=50");
        const target = (resp.body?.results || []).find((p: any) => p.title?.includes("가이드 테스트"));
        if (target) await apiCall(T, "DELETE", `/community/posts/${target.id}/`);
      } catch {}
    }
    await S?.context()?.close();
    await T?.context()?.close();
  });
});
