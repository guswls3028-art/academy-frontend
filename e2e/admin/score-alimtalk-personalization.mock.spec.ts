import { expect, test, type Page } from "../fixtures/strictTest";
import { getBaseUrl } from "../helpers/auth";
import {
  installLocalAuthApiStubs,
  installTenantOneInitScript,
} from "../helpers/localAuthApiStubs";
import { realMessagingSkipReason } from "../helpers/safety";

type SendPayload = {
  student_ids?: number[];
  send_to?: string;
  block_category?: string;
  raw_body?: string;
  alimtalk_extra_vars?: Record<string, string>;
  alimtalk_extra_vars_per_student?: Record<string, Record<string, string>>;
  request_id?: string;
};

type PreflightMode = "success" | "stale";

function createLocalJwt() {
  const encode = (payload: unknown) => Buffer.from(JSON.stringify(payload)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  return `${encode({ alg: "none", typ: "JWT" })}.${encode({
    exp: now + 3600,
    tenant_code: "hakwonplus",
    user_id: 12,
  })}.sig`;
}

async function installScoreAlimtalkRoutes(
  page: Page,
  mode: PreflightMode,
  preflightPayloads: SendPayload[],
  sendPayloads: SendPayload[],
) {
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();

    if (/\/api\/v1\/results\/admin\/sessions\/9002\/scores\/$/.test(path) && method === "GET") {
      await route.fulfill({
        json: {
          meta: {
            session_title: "개인화 검증 차시",
            lecture_title: "개인화 검증반",
            lecture_id: 9001,
            exams: [{
              exam_id: 9101,
              title: "주간 확인",
              pass_score: 60,
              max_score: 100,
              objective_max_score: 100,
              subjective_max_score: 0,
              display_order: 1,
            }],
            homeworks: [{
              homework_id: 9151,
              title: "단원 복습",
              unit: "점",
              grading_mode: "SCORE",
              max_score: 100,
              display_order: 2,
            }],
          },
          rows: [
            { examScore: 70, homeworkScore: 100 },
            { examScore: 80, homeworkScore: 20 },
          ].map(({ examScore, homeworkScore }, index) => ({
            enrollment_id: 9201 + index,
            student_id: 9301 + index,
            student_name: `개인화학생${index + 1}`,
            lecture_title: "개인화 검증반",
            lecture_color: "#2563eb",
            lecture_chip_label: "개",
            exams: [{
              exam_id: 9101,
              title: "주간 확인",
              pass_score: 60,
              attempt_count: 1,
              clinic_link_id: null,
              block: {
                score: examScore,
                max_score: 100,
                passed: examScore >= 60,
                achievement: examScore >= 60 ? "PASS" : "FAIL",
                clinic_required: examScore < 60,
                is_locked: false,
                objective_score: examScore,
                subjective_score: 0,
                correction_status: examScore >= 100 ? "NOT_REQUIRED" : "PENDING",
                meta: {},
              },
            }],
            homeworks: [{
              homework_id: 9151,
              title: "단원 복습",
              block: {
                score: homeworkScore,
                max_score: 100,
                passed: homeworkScore >= 60,
                clinic_required: homeworkScore < 60,
                is_locked: false,
                meta: {},
              },
            }],
            clinic_required: examScore < 60 || homeworkScore < 60,
            progress_completed: false,
            updated_at: "2026-08-31T22:00:00+09:00",
          })),
        },
      });
      return;
    }

    if (path.endsWith("/score-draft/") && method === "GET") {
      await route.fulfill({ json: { changes: [] } });
      return;
    }

    if (path.endsWith("/api/v1/enrollments/session-enrollments/") && method === "GET") {
      await route.fulfill({
        json: {
          count: 2,
          results: [0, 1].map((index) => ({
            id: 9501 + index,
            session: 9002,
            enrollment: 9201 + index,
            student_id: 9301 + index,
            student_name: `개인화학생${index + 1}`,
          })),
        },
      });
      return;
    }

    if (path.endsWith("/api/v1/lectures/attendance/") && method === "GET") {
      await route.fulfill({
        json: {
          count: 2,
          results: [0, 1].map((index) => ({
            id: 9401 + index,
            enrollment_id: 9201 + index,
            status: "PRESENT",
          })),
        },
      });
      return;
    }

    if (path.endsWith("/api/v1/lectures/lectures/9001/") && method === "GET") {
      await route.fulfill({ json: { id: 9001, title: "개인화 검증반", color: "#2563eb", chip_label: "개" } });
      return;
    }

    if (path.endsWith("/api/v1/lectures/sessions/9002/") && method === "GET") {
      await route.fulfill({
        json: { id: 9002, lecture: 9001, order: 1, title: "개인화 검증 차시", date: "2026-08-31" },
      });
      return;
    }

    if (path.endsWith("/api/v1/lectures/sessions/") && method === "GET") {
      await route.fulfill({
        json: [{ id: 9002, lecture: 9001, order: 1, title: "개인화 검증 차시", date: "2026-08-31" }],
      });
      return;
    }

    if (path.endsWith("/api/v1/lectures/attendance/arrival-overview/") && method === "GET") {
      await route.fulfill({
        json: {
          generated_at: "2026-08-31T22:00:00+09:00",
          today: "2026-08-31",
          tomorrow: "2026-09-01",
          range_end: "2026-09-07",
          range_days: 7,
          soon_window_minutes: 30,
          summary: { soon: 0, today: 0, tomorrow: 0, upcoming: 0, time_unset: 0, overdue: 0 },
          items: [],
        },
      });
      return;
    }

    if (path.endsWith("/api/v1/staffs/currently-working/") && method === "GET") {
      await route.fulfill({ json: [] });
      return;
    }

    if (path.endsWith("/api/v1/staffs/me/") && method === "GET") {
      await route.fulfill({
        json: {
          is_authenticated: true,
          is_superuser: true,
          is_staff: true,
          is_payroll_manager: true,
          is_owner: true,
          owner_display_name: "관리자",
          staff_id: 12,
        },
      });
      return;
    }

    if (path.endsWith("/api/v1/messaging/templates/") && method === "GET") {
      await route.fulfill({ json: [] });
      return;
    }

    if (path.endsWith("/api/v1/messaging/send/preflight/") && method === "POST") {
      const payload = request.postDataJSON() as SendPayload;
      preflightPayloads.push(payload);
      if (mode === "stale") {
        await route.fulfill({
          status: 409,
          json: { detail: "성적 데이터가 변경되었습니다. 최신 성적을 다시 불러온 뒤 미리보세요." },
        });
        return;
      }
      const perStudent = payload.alimtalk_extra_vars_per_student ?? {};
      await route.fulfill({
        json: {
          ok: true,
          can_send: true,
          mode: "now",
          send_to: payload.send_to ?? "parent",
          recipient: {
            selected: 2,
            resolved: 2,
            valid_phone: 2,
            skipped_no_phone: 0,
            duplicate_phone: 0,
            unique_phone: 2,
            invalid_or_deleted: 0,
            limit: 500,
          },
          template: {
            ok: true,
            source: "unified",
            name: "성적 안내",
            solapi_template_id: "E2E_GRADES",
            solapi_status: "APPROVED",
            detail: "",
            uses_unified_template: true,
            template_type: "grades",
          },
          preview_recipients: [9301, 9302].map((studentId, index) => ({
            student_id: studentId,
            student_name: `개인화학생${index + 1}`,
            phone: `010****00${index + 1}`,
            excluded: false,
            exclude_reason: "",
            full_message_body: perStudent[String(studentId)]?._body_subst ?? "",
          })),
          limits: { hourly_limit: 500, sent_last_hour: 0, remaining_this_hour: 500 },
          blockers: [],
          warnings: [],
        },
      });
      return;
    }

    if (path.endsWith("/api/v1/messaging/send/") && method === "POST") {
      const payload = request.postDataJSON() as SendPayload;
      sendPayloads.push(payload);
      await route.fulfill({
        json: {
          detail: "queued",
          batch_id: payload.request_id,
          accepted_count: 2,
          enqueued: 2,
          scheduled: 0,
          enqueue_failed: 0,
          skipped_no_phone: 0,
        },
      });
      return;
    }

    if (path.endsWith("/api/v1/messaging/log/") && method === "GET") {
      const originId = new URL(request.url()).searchParams.get("origin_id");
      const logs = originId
        ? (["parent", "student"] as const).map((target, index) => ({
            id: 9701 + index,
            origin_type: "manual_send",
            origin_id: originId,
            sent_at: "2026-09-07T10:00:00+09:00",
            success: true,
            status: "sent",
            claimed_at: "2026-09-07T10:00:00+09:00",
            amount_deducted: "7.00",
            recipient_summary: `개인화학생1 ${target === "parent" ? "학부모" : "학생"}`,
            template_summary: "성적 안내",
            provider_message_id: "",
            provider_evidence: true,
            provider_message_reference: `•••• accepted-${index}`,
            provider_delivery_status: "provider_accepted",
            failure_code: "",
            failure_reason: "",
            body_visibility: "available",
            message_body_included: false,
            message_body: "",
            message_mode: "alimtalk",
            notification_type: "manual_send",
            target_type: target,
            target_id: "9301",
            target_name: "개인화학생1",
          }))
        : [];
      await route.fulfill({ json: { results: logs, count: logs.length } });
      return;
    }

    if (/\/api\/v1\/messaging\/log\/970[12]\/$/.test(path) && method === "GET") {
      const verifyProvider = new URL(request.url()).searchParams.get("verify_provider") === "true";
      await route.fulfill({
        json: {
          id: Number(path.match(/(970[12])/)?.[1]),
          sent_at: "2026-09-07T10:00:00+09:00",
          success: true,
          status: "sent",
          claimed_at: "2026-09-07T10:00:00+09:00",
          amount_deducted: "7.00",
          recipient_summary: "개인화학생1 학부모",
          template_summary: "성적 안내",
          provider_message_id: "provider-e2e-proof",
          provider_evidence: true,
          provider_message_reference: "•••• proof",
          provider_delivery_status: verifyProvider ? "delivered" : "provider_accepted",
          provider_status_code: verifyProvider ? "DELIVERED" : "ACCEPTED",
          provider_delivery_checked_at: verifyProvider ? "2026-09-07T10:01:00+09:00" : null,
          provider_delivery_updated_at: "2026-09-07T10:00:30+09:00",
          provider_delivery_failure_reason: "",
          failure_code: "",
          failure_reason: "",
          body_visibility: "available",
          message_body_included: true,
          message_body: "개인화 성적 안내",
          message_mode: "alimtalk",
          notification_type: "manual_send",
          target_type: "parent",
          target_id: "9301",
          target_name: "개인화학생1",
        },
      });
      return;
    }

    if (path.endsWith("/api/v1/messaging/scheduled/") && method === "GET") {
      await route.fulfill({ json: { results: [], count: 0 } });
      return;
    }

    if (path.endsWith("/api/v1/messaging/operations/status/") && method === "GET") {
      await route.fulfill({
        json: {
          checked_at: "2026-09-07T10:01:00+09:00",
          worker: { status: "ok", last_seen_at: "2026-09-07T10:00:59+09:00", age_seconds: 1, instance: "mock", version: "mock" },
          scheduled: { pending: 0, due_now: 0, overdue: 0, failed_24h: 0 },
          log_24h: { sent: 2, failed: 0, processing: 0, sending: 0, retryable_failed: 0, ambiguous: 0, action_required: 0, total: 2 },
          templates: { approved: 1, owner_approved: 1, freeform_available: true, freeform_template_name: "성적 안내" },
          auto_send: { enabled: 0, enabled_without_template: 0, enabled_unapproved_template: 0, enabled_manual_only: 0 },
          risks: [],
        },
      });
      return;
    }

    await route.fallback();
  });
}

async function openPersonalizedScores(
  page: Page,
  mode: PreflightMode,
  preflightPayloads: SendPayload[],
  sendPayloads: SendPayload[],
) {
  const baseUrl = getBaseUrl("admin");
  const mockOnlyReason = realMessagingSkipReason(baseUrl, "", "0");
  test.skip(
    !/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(baseUrl),
    mockOnlyReason ?? "성적 알림톡 개인화 route-mock 검증은 로컬 dev 서버 전용",
  );
  await installLocalAuthApiStubs(page);
  await installTenantOneInitScript(page);
  await page.addInitScript((token) => {
    localStorage.setItem("access", token);
    localStorage.setItem("refresh", `${token}-refresh`);
  }, createLocalJwt());
  await installScoreAlimtalkRoutes(page, mode, preflightPayloads, sendPayloads);
  await page.goto(`${baseUrl}/workspace/lectures/9001/sessions/9002/scores`, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  await expect(page).toHaveURL(/\/workspace\/lectures\/9001\/sessions\/9002\/scores/);
}

async function selectBothStudentsAndOpen(page: Page) {
  const firstStudent = page.getByRole("checkbox", { name: "개인화학생1 선택" });
  await expect(firstStudent).toBeVisible({ timeout: 45_000 });
  await firstStudent.check();
  await page.getByRole("checkbox", { name: "개인화학생2 선택" }).check();
  await page.getByRole("button", { name: "수업결과 알림톡 발송" }).click();
  await expect(page.getByRole("dialog", { name: "알림톡 발송" })).toBeVisible();
}

test.describe("성적 알림톡 학생별 개인화", () => {
  test.setTimeout(120_000);
  test.use({ viewport: { width: 1366, height: 900 }, serviceWorkers: "block" });

  test("학생·학부모 개인화 발송을 exact 요청 로그와 최종 전달 상태까지 확인한다", async ({ page }, testInfo) => {
    const preflightPayloads: SendPayload[] = [];
    const sendPayloads: SendPayload[] = [];
    await openPersonalizedScores(page, "success", preflightPayloads, sendPayloads);
    await selectBothStudentsAndOpen(page);

    const modal = page.getByRole("dialog", { name: "알림톡 발송" });
    await expect(modal.getByRole("checkbox", { name: "학부모" })).toBeChecked();
    await expect(modal.getByRole("checkbox", { name: "학생" })).toBeChecked();
    const requestButton = modal.locator(".send-modal__send-btn");
    await expect(requestButton).toBeEnabled();
    await requestButton.click();

    const confirm = page.getByRole("dialog", { name: "보내기 전 마지막 확인" });
    const preview = page.getByLabel("카카오톡 실제 발송 미리보기");
    await expect(confirm).toBeVisible();
    await expect(preview).toContainText("개인화학생1");
    await expect(preview).toContainText("주간 확인");
    await expect(preview).toContainText("70/100");
    await expect(preview).toContainText("단원 복습");
    await expect(preview).toContainText("100/100");
    await page.getByRole("button", { name: "전체 학생 열기" }).click();
    await page.getByRole("radio", { name: /개인화학생2/ }).click();
    await expect(preview).toContainText("개인화학생2");
    await expect(preview).toContainText("주간 확인");
    await expect(preview).toContainText("80/100");
    await expect(preview).toContainText("단원 복습");
    await expect(preview).toContainText("20/100");
    await page.screenshot({ path: testInfo.outputPath("score-alimtalk-personalized-1366.png") });

    expect(new Set(preflightPayloads.map((payload) => payload.send_to))).toEqual(new Set(["parent", "student"]));
    const latestPreflight = preflightPayloads.find((payload) => payload.send_to === "parent");
    expect(latestPreflight?.alimtalk_extra_vars).toEqual({
      강의명: "개인화 검증반",
      차시명: "개인화 검증 차시",
    });
    const perStudentBodies = latestPreflight?.alimtalk_extra_vars_per_student;
    expect(perStudentBodies?.["9301"]?._body_subst).toContain("주간 확인");
    expect(perStudentBodies?.["9301"]?._body_subst).toContain("70/100");
    expect(perStudentBodies?.["9301"]?._body_subst).toContain("단원 복습");
    expect(perStudentBodies?.["9301"]?._body_subst).toContain("100/100");
    expect(perStudentBodies?.["9302"]?._body_subst).toContain("주간 확인");
    expect(perStudentBodies?.["9302"]?._body_subst).toContain("80/100");
    expect(perStudentBodies?.["9302"]?._body_subst).toContain("단원 복습");
    expect(perStudentBodies?.["9302"]?._body_subst).toContain("20/100");
    expect(perStudentBodies?.["9301"]?._body_subst).not.toBe(perStudentBodies?.["9302"]?._body_subst);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(confirm).toBeVisible();
    await expect(confirm.getByRole("button", { name: "발송하기" })).toBeVisible();
    expect(await confirm.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("score-alimtalk-personalized-390.png") });

    await confirm.getByRole("button", { name: "발송하기" }).click();
    await expect(page.getByText(/학부모·학생 알림톡 4건 발송 접수/)).toBeVisible();
    await expect(modal).toBeHidden();
    expect(sendPayloads).toHaveLength(2);
    expect(new Set(sendPayloads.map((payload) => payload.send_to))).toEqual(new Set(["parent", "student"]));
    expect(sendPayloads[0]?.request_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(sendPayloads[1]?.request_id).toBe(sendPayloads[0]?.request_id);
    for (const payload of sendPayloads) {
      expect(payload.alimtalk_extra_vars).toEqual({
        강의명: "개인화 검증반",
        차시명: "개인화 검증 차시",
      });
      expect(payload.alimtalk_extra_vars_per_student).toEqual(
        latestPreflight?.alimtalk_extra_vars_per_student,
      );
    }

    await page.getByRole("button", { name: "발송 내역 확인" }).click();
    await expect(page).toHaveURL(new RegExp(`/workspace/message/log\\?origin_id=${sendPayloads[0]?.request_id}$`));
    await expect(page.getByLabel("이번 발송 요청 필터")).toBeVisible();
    await expect(page.getByText("개인화학생1 학부모")).toBeVisible();
    await expect(page.getByText("개인화학생1 학생")).toBeVisible();

    await page.reload({ waitUntil: "domcontentloaded", timeout: 90_000 });
    await expect(page.getByLabel("이번 발송 요청 필터")).toBeVisible();
    await page.getByRole("button", { name: /개인화학생1 학부모/ }).click();
    const logDialog = page.getByRole("dialog", { name: "알림톡 발송 기록" });
    await expect(logDialog.getByText("공급사 접수 기록 있음")).toBeVisible();
    await logDialog.getByRole("button", { name: "최종 상태 확인" }).click();
    await expect(logDialog.getByText("최종 전달 확인")).toBeVisible();
  });

  test("성적이 바뀐 미리보기는 이유를 표시하고 발송을 열지 않는다", async ({ page }, testInfo) => {
    const preflightPayloads: SendPayload[] = [];
    await openPersonalizedScores(page, "stale", preflightPayloads, []);
    await selectBothStudentsAndOpen(page);

    const modal = page.getByRole("dialog", { name: "알림톡 발송" });
    const staleMessage = modal
      .getByText("성적 데이터가 변경되었습니다. 최신 성적을 다시 불러온 뒤 미리보세요.")
      .first();
    await expect(staleMessage).toBeVisible();
    await expect(modal.locator(".send-modal__send-btn")).toBeDisabled();
    await expect(page.getByRole("dialog", { name: "보내기 전 마지막 확인" })).toHaveCount(0);
    expect(preflightPayloads.length).toBeGreaterThan(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(staleMessage).toBeVisible();
    expect(await modal.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("score-alimtalk-stale-390.png") });
  });
});
