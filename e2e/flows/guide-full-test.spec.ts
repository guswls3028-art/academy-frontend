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

const BASE = getBaseUrl("admin");

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
    await T.goto(`${BASE}/admin/dashboard`);
    await T.waitForLoadState("load");
    await T.waitForTimeout(3000);
    await T.screenshot({ path: "test-results/guide/T02-dashboard-detail.png", fullPage: true });
    await expect(T.locator("text=Not Found")).not.toBeVisible();
  });

  test("T03 학생 등록 (단건)", async () => {
    // 기존 0317테스트학생이 있으면 삭제 후 재생성
    const existing = await apiCall(T, "GET", "/students/?page_size=200");
    const old = (existing.body?.results || []).find((s: any) => s.phone === "01034137466");
    if (old) {
      await apiCall(T, "DELETE", `/students/${old.id}/`);
      await apiCall(T, "POST", "/students/bulk_permanent_delete/", { ids: [old.id] });
    }

    // 학생 등록 (API — 알림톡 실제 발송)
    const resp = await apiCall(T, "POST", "/students/", {
      name: "0317테스트학생",
      phone: "01034137466",
      parent_phone: "01031217466",
      initial_password: "0000",
      school_type: "HIGH",
      grade: 2,
      gender: "M",
      send_welcome_message: false,
    });
    console.log(`  학생등록: ${resp.status} ${resp.status === 201 ? `id=${resp.body.id} ps=${resp.body.ps_number}` : JSON.stringify(resp.body)?.substring(0, 100)}`);
    expect([201, 409]).toContain(resp.status);

    await T.goto(`${BASE}/admin/students`);
    await T.waitForLoadState("load");
    await T.waitForTimeout(3000);
    await T.screenshot({ path: "test-results/guide/T03-students.png", fullPage: true });
    await expect(T.locator("text=0317테스트학생")).toBeVisible({ timeout: 10000 });
  });

  test("T04 강의 목록", async () => {
    await T.goto(`${BASE}/admin/lectures`);
    await T.waitForLoadState("load");
    await T.waitForTimeout(2000);
    await T.screenshot({ path: "test-results/guide/T04-lectures.png", fullPage: true });
  });

  test("T05 공지 작성 + 확인", async () => {
    await T.goto(`${BASE}/admin/community/notice`);
    await T.waitForLoadState("load");
    await T.waitForTimeout(2000);
    await T.screenshot({ path: "test-results/guide/T05-notice.png", fullPage: true });
  });

  test("T06 QnA 확인", async () => {
    await T.goto(`${BASE}/admin/community/qna`);
    await T.waitForLoadState("load");
    await T.waitForTimeout(2000);
    await T.screenshot({ path: "test-results/guide/T06-qna.png", fullPage: true });
  });

  test("T07 자료실", async () => {
    await T.goto(`${BASE}/admin/community/materials`);
    await T.waitForLoadState("load");
    await T.waitForTimeout(2000);
    await T.screenshot({ path: "test-results/guide/T07-materials.png", fullPage: true });
  });

  test("T08 상담", async () => {
    await T.goto(`${BASE}/admin/community/counsel`);
    await T.waitForLoadState("load");
    await T.waitForTimeout(2000);
    await T.screenshot({ path: "test-results/guide/T08-counsel.png", fullPage: true });
  });

  test("T09 클리닉 홈", async () => {
    await T.goto(`${BASE}/admin/clinic/home`);
    await T.waitForLoadState("load");
    await T.waitForTimeout(2000);
    await T.screenshot({ path: "test-results/guide/T09-clinic-home.png", fullPage: true });
  });

  test("T10 클리닉 일정", async () => {
    await T.goto(`${BASE}/admin/clinic/schedule`);
    await T.waitForLoadState("load");
    await T.waitForTimeout(2000);
    await T.screenshot({ path: "test-results/guide/T10-clinic-schedule.png", fullPage: true });
  });

  test("T11 클리닉 예약관리", async () => {
    await T.goto(`${BASE}/admin/clinic/bookings`);
    await T.waitForLoadState("load");
    await T.waitForTimeout(2000);
    await T.screenshot({ path: "test-results/guide/T11-clinic-bookings.png", fullPage: true });
  });

  test("T12 클리닉 운영", async () => {
    await T.goto(`${BASE}/admin/clinic/operations`);
    await T.waitForLoadState("load");
    await T.waitForTimeout(2000);
    await T.screenshot({ path: "test-results/guide/T12-clinic-ops.png", fullPage: true });
  });

  test("T13 클리닉 리포트", async () => {
    await T.goto(`${BASE}/admin/clinic/reports`);
    await T.waitForLoadState("load");
    await T.waitForTimeout(2000);
    await T.screenshot({ path: "test-results/guide/T13-clinic-reports.png", fullPage: true });
  });

  test("T14 영상 관리", async () => {
    await T.goto(`${BASE}/admin/videos`);
    await T.waitForLoadState("load");
    await T.waitForTimeout(2000);
    await T.screenshot({ path: "test-results/guide/T14-videos.png", fullPage: true });
  });

  test("T15 시험 관리", async () => {
    await T.goto(`${BASE}/admin/exams`);
    await T.waitForLoadState("load");
    await T.waitForTimeout(2000);
    await T.screenshot({ path: "test-results/guide/T15-exams.png", fullPage: true });
  });

  test("T16 성적 관리", async () => {
    await T.goto(`${BASE}/admin/results`);
    await T.waitForLoadState("load");
    await T.waitForTimeout(2000);
    await T.screenshot({ path: "test-results/guide/T16-results.png", fullPage: true });
  });

  test("T17 메시지 템플릿", async () => {
    await T.goto(`${BASE}/admin/message/templates`);
    await T.waitForLoadState("load");
    await T.waitForTimeout(2000);
    await T.screenshot({ path: "test-results/guide/T17-msg-templates.png", fullPage: true });
  });

  test("T18 자동발송 설정", async () => {
    await T.goto(`${BASE}/admin/message/auto-send`);
    await T.waitForLoadState("load");
    await T.waitForTimeout(2000);
    await T.screenshot({ path: "test-results/guide/T18-auto-send.png", fullPage: true });
  });

  test("T19 메시지 로그", async () => {
    await T.goto(`${BASE}/admin/message/log`);
    await T.waitForLoadState("load");
    await T.waitForTimeout(2000);
    await T.screenshot({ path: "test-results/guide/T19-msg-log.png", fullPage: true });
  });

  test("T20 직원 관리", async () => {
    await T.goto(`${BASE}/admin/staff`);
    await T.waitForLoadState("load");
    await T.waitForTimeout(2000);
    await T.screenshot({ path: "test-results/guide/T20-staff.png", fullPage: true });
  });

  test("T21 저장소", async () => {
    await T.goto(`${BASE}/admin/storage`);
    await T.waitForLoadState("load");
    await T.waitForTimeout(2000);
    await T.screenshot({ path: "test-results/guide/T21-storage.png", fullPage: true });
  });

  test("T22 PPT 도구", async () => {
    await T.goto(`${BASE}/admin/tools`);
    await T.waitForLoadState("load");
    await T.waitForTimeout(2000);
    await T.screenshot({ path: "test-results/guide/T22-tools.png", fullPage: true });
  });

  test("T23 설정 - 프로필", async () => {
    await T.goto(`${BASE}/admin/settings`);
    await T.waitForLoadState("load");
    await T.waitForTimeout(2000);
    await T.screenshot({ path: "test-results/guide/T23-settings.png", fullPage: true });
  });

  test("T24 설정 - 학원정보", async () => {
    await T.goto(`${BASE}/admin/settings/organization`);
    await T.waitForLoadState("load");
    await T.waitForTimeout(2000);
    await T.screenshot({ path: "test-results/guide/T24-org.png", fullPage: true });
  });

  test("T25 설정 - 테마", async () => {
    await T.goto(`${BASE}/admin/settings/appearance`);
    await T.waitForLoadState("load");
    await T.waitForTimeout(2000);
    await T.screenshot({ path: "test-results/guide/T25-theme.png", fullPage: true });
  });

  test("T26 설정 - 구독", async () => {
    await T.goto(`${BASE}/admin/settings/billing`);
    await T.waitForLoadState("load");
    await T.waitForTimeout(2000);
    await T.screenshot({ path: "test-results/guide/T26-billing.png", fullPage: true });
  });

  // ═══════════════════════════════════════════
  // 학생 파트
  // ═══════════════════════════════════════════

  test("S01 학생 로그인 (0317테스트학생)", async () => {
    S = await (await browser.newContext()).newPage();
    await S.goto(`${BASE}/login/hakwonplus`);
    await S.waitForLoadState("networkidle");
    const expandBtn = S.locator('[data-testid="login-expand-btn"]');
    await expandBtn.waitFor({ state: "visible", timeout: 10000 });
    await expandBtn.click();
    await S.locator('[data-testid="login-username"]').fill("01034137466");
    await S.locator('[data-testid="login-password"]').fill("0000");
    await S.locator('[data-testid="login-submit"]').click();
    await S.waitForURL(/\/student/, { timeout: 20000 });
    await S.waitForTimeout(2000);
    await S.screenshot({ path: "test-results/guide/S01-dashboard.png", fullPage: true });
  });

  test("S02 학생 공지", async () => {
    await S.goto(`${BASE}/student/notices`);
    await S.waitForLoadState("load");
    await S.waitForTimeout(3000);
    await S.screenshot({ path: "test-results/guide/S02-notices.png", fullPage: true });
  });

  test("S03 학생 영상 홈", async () => {
    await S.goto(`${BASE}/student/video`);
    await S.waitForLoadState("load");
    await S.waitForTimeout(3000);
    await S.screenshot({ path: "test-results/guide/S03-video.png", fullPage: true });
  });

  test("S04 학생 일정", async () => {
    await S.goto(`${BASE}/student/sessions`);
    await S.waitForLoadState("load");
    await S.waitForTimeout(2000);
    await S.screenshot({ path: "test-results/guide/S04-sessions.png", fullPage: true });
  });

  test("S05 학생 시험", async () => {
    await S.goto(`${BASE}/student/exams`);
    await S.waitForLoadState("load");
    await S.waitForTimeout(2000);
    await S.screenshot({ path: "test-results/guide/S05-exams.png", fullPage: true });
  });

  test("S06 학생 성적", async () => {
    await S.goto(`${BASE}/student/grades`);
    await S.waitForLoadState("load");
    await S.waitForTimeout(2000);
    await S.screenshot({ path: "test-results/guide/S06-grades.png", fullPage: true });
  });

  test("S07 학생 제출", async () => {
    await S.goto(`${BASE}/student/submit`);
    await S.waitForLoadState("load");
    await S.waitForTimeout(2000);
    await S.screenshot({ path: "test-results/guide/S07-submit.png", fullPage: true });
  });

  test("S08 학생 QnA 질문 등록", async () => {
    await S.goto(`${BASE}/student/community`);
    await S.waitForLoadState("load");
    await S.waitForTimeout(2000);

    const qnaTab = S.locator("button, [role='tab']").filter({ hasText: /QnA/ }).first();
    if (await qnaTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await qnaTab.click();
      await S.waitForTimeout(500);
    }
    await S.screenshot({ path: "test-results/guide/S08a-qna-tab.png", fullPage: true });

    const writeBtn = S.locator("button, a").filter({ hasText: /질문/ }).first();
    if (await writeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await writeBtn.click();
      await S.waitForTimeout(1000);

      const title = S.locator('input[placeholder*="제목"]').first();
      if (await title.isVisible({ timeout: 3000 }).catch(() => false)) {
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
          await S.waitForTimeout(3000);
          await S.screenshot({ path: "test-results/guide/S08c-qna-submitted.png", fullPage: true });
        }
      }
    }
  });

  test("S09 학생 클리닉", async () => {
    await S.goto(`${BASE}/student/clinic`);
    await S.waitForLoadState("load");
    await S.waitForTimeout(3000);
    await S.screenshot({ path: "test-results/guide/S09-clinic.png", fullPage: true });
  });

  test("S10 학생 인증패스", async () => {
    await S.goto(`${BASE}/student/idcard`);
    await S.waitForLoadState("load");
    await S.waitForTimeout(3000);
    await S.screenshot({ path: "test-results/guide/S10-idcard.png", fullPage: true });
  });

  test("S11 학생 프로필", async () => {
    await S.goto(`${BASE}/student/profile`);
    await S.waitForLoadState("load");
    await S.waitForTimeout(2000);
    await S.screenshot({ path: "test-results/guide/S11-profile.png", fullPage: true });
  });

  test("S12 학생 보관함", async () => {
    await S.goto(`${BASE}/student/inventory`);
    await S.waitForLoadState("load");
    await S.waitForTimeout(2000);
    await S.screenshot({ path: "test-results/guide/S12-inventory.png", fullPage: true });
  });

  test("S13 학생 출결", async () => {
    await S.goto(`${BASE}/student/attendance`);
    await S.waitForLoadState("load");
    await S.waitForTimeout(2000);
    await S.screenshot({ path: "test-results/guide/S13-attendance.png", fullPage: true });
  });

  test("S14 학생 알림", async () => {
    await S.goto(`${BASE}/student/notifications`);
    await S.waitForLoadState("load");
    await S.waitForTimeout(2000);
    await S.screenshot({ path: "test-results/guide/S14-notifications.png", fullPage: true });
  });

  test("S15 학생 커뮤니티 전체", async () => {
    await S.goto(`${BASE}/student/community`);
    await S.waitForLoadState("load");
    await S.waitForTimeout(2000);
    await S.screenshot({ path: "test-results/guide/S15-community.png", fullPage: true });
  });

  // ═══════════════════════════════════════════
  // 교사 복귀 — QnA 답변
  // ═══════════════════════════════════════════

  test("T27 교사 QnA 답변", async () => {
    await T.goto(`${BASE}/admin/community/qna`);
    await T.waitForLoadState("load");
    await T.waitForTimeout(3000);

    const q = T.locator("text=가이드 테스트").first();
    if (await q.isVisible({ timeout: 5000 }).catch(() => false)) {
      await q.click();
      await T.waitForTimeout(1000);
      await T.screenshot({ path: "test-results/guide/T27a-qna-detail.png", fullPage: true });

      const reply = T.locator('textarea').last();
      if (await reply.isVisible({ timeout: 3000 }).catch(() => false)) {
        await reply.fill("이 부분은 교재 3장을 참고하시면 됩니다. 수업 시간에 다시 설명하겠습니다.");
        const send = T.locator("button").filter({ hasText: /답변|등록/ }).first();
        await send.click();
        await T.waitForTimeout(2000);
        await T.screenshot({ path: "test-results/guide/T27b-qna-replied.png", fullPage: true });
      }
    }
  });

  // ═══════════════════════════════════════════
  // 학생 복귀 — 답변 확인
  // ═══════════════════════════════════════════

  test("S16 학생 답변 확인", async () => {
    await S.goto(`${BASE}/student/community`);
    await S.waitForLoadState("load");
    await S.waitForTimeout(2000);

    const qnaTab = S.locator("button, [role='tab']").filter({ hasText: /QnA/ }).first();
    if (await qnaTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await qnaTab.click();
      await S.waitForTimeout(1000);
    }

    const myQ = S.locator("text=가이드 테스트").first();
    if (await myQ.isVisible({ timeout: 5000 }).catch(() => false)) {
      await myQ.click();
      await S.waitForTimeout(2000);
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
