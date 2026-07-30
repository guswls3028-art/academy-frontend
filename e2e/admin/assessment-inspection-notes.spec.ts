import type { Page } from "@playwright/test";

import { expect, test } from "../fixtures/strictTest";
import { getBaseUrl } from "../helpers/auth";
import { installTenantOneInitScript } from "../helpers/localAuthApiStubs";

const LECTURE_ID = 991101;
const SESSION_ID = 991102;

function isLocalBaseUrl(url: string) {
  return /^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(url);
}

function createLocalJwt() {
  const encode = (payload: unknown) => Buffer.from(JSON.stringify(payload)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  return `${encode({ alg: "none", typ: "JWT" })}.${encode({
    exp: now + 3600,
    tenant_code: "hakwonplus",
    user_id: 12,
  })}.sig`;
}

async function installApi(page: Page, options: { failCorrection?: boolean } = {}) {
  const baseUrl = getBaseUrl("admin");
  test.skip(!isLocalBaseUrl(baseUrl), "검사 상태 route-mock 검증은 로컬 dev 서버 전용");
  const token = createLocalJwt();
  const corsHeaders = {
    "access-control-allow-origin": baseUrl,
    "access-control-allow-headers": "authorization,content-type,x-client,x-client-version,x-tenant-code",
    "access-control-allow-methods": "GET,POST,PUT,PATCH,OPTIONS",
  };
  let homeworkStatus: "PENDING" | "COMPLETED" | null = null;
  let homeworkNote = "";
  const correctionRequests: Array<{
    source_type: "exam" | "homework";
    completed: boolean;
    note?: string;
  }> = [];
  let examStatus: "PENDING" | "COMPLETED" = "PENDING";
  let examNote = "서술형 3번 풀이 확인";

  await page.route("**/version.json?*", async (route) => {
    await route.fulfill({ status: 404, contentType: "text/plain", body: "" });
  });
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }
    const pathname = new URL(request.url()).pathname;
    const fulfill = (json: unknown, status = 200) => route.fulfill({
      status,
      headers: corsHeaders,
      contentType: "application/json",
      json,
    });

    if (pathname.endsWith("/token/refresh/")) {
      await fulfill({ access: token, refresh: `${token}-refresh` });
      return;
    }
    if (pathname.endsWith("/core/program/")) {
      await fulfill({
        tenantCode: "hakwonplus",
        display_name: "학원플러스 테스트",
        ui_config: { primary_color: "#2563eb" },
        feature_flags: {},
        is_active: true,
      });
      return;
    }
    if (pathname.endsWith("/core/me/")) {
      await fulfill({
        id: 12,
        username: "inspection-admin",
        name: "검사 선생님",
        is_staff: true,
        is_superuser: true,
        tenantRole: "admin",
        must_change_password: false,
      });
      return;
    }
    if (pathname.endsWith(`/lectures/lectures/${LECTURE_ID}/`)) {
      await fulfill({
        id: LECTURE_ID,
        title: "중등 수학 심화",
        color: "#2563eb",
        chip_label: "수심",
      });
      return;
    }
    if (pathname.endsWith(`/lectures/sessions/${SESSION_ID}/`)) {
      await fulfill({
        id: SESSION_ID,
        lecture: LECTURE_ID,
        order: 4,
        title: "4차시",
        date: "2026-07-29",
      });
      return;
    }
    if (pathname.endsWith("/lectures/attendance/")) {
      await fulfill({
        count: 1,
        next: null,
        previous: null,
        page_size: 500,
        results: [{
          id: 8101,
          enrollment_id: 9101,
          student_id: 7101,
          student_name: "윤지용 학생",
          status: "PRESENT",
        }],
      });
      return;
    }
    if (pathname.endsWith(`/results/admin/sessions/${SESSION_ID}/scores/`)) {
      await fulfill({
        meta: {
          session_title: "4차시",
          lecture_title: "중등 수학 심화",
          lecture_id: LECTURE_ID,
          exams: [{
            exam_id: 3101,
            title: "방정식 단원평가",
            pass_score: 70,
            max_score: 100,
            display_order: 1,
            questions: [],
          }, {
            exam_id: 3102,
            title: "함수 단원평가",
            pass_score: 70,
            max_score: 100,
            display_order: 2,
            questions: [],
          }],
          homeworks: [{
            homework_id: 4101,
            title: "서술형 워크북 12~15번",
            unit: null,
            max_score: 100,
            display_order: 1,
          }],
        },
        rows: [{
          enrollment_id: 9101,
          student_id: 7101,
          student_name: "윤지용 학생",
          profile_photo_url: null,
          lecture_title: "중등 수학 심화",
          lecture_color: "#2563eb",
          lecture_chip_label: "수심",
          exams: [{
            exam_id: 3101,
            title: "방정식 단원평가",
            pass_score: 70,
            block: {
              score: 66,
              max_score: 100,
              passed: false,
              clinic_required: true,
              correction_status: examStatus,
              correction_completed_at: examStatus === "COMPLETED"
                ? "2026-07-29T16:35:00+09:00"
                : null,
              correction_note: examNote,
              meta: null,
            },
            items: [],
            attempt_count: 1,
            attempts: [],
          }, {
            exam_id: 3102,
            title: "함수 단원평가",
            pass_score: 70,
            block: {
              score: 40,
              max_score: 100,
              passed: false,
              clinic_required: false,
              correction_status: "COMPLETED",
              correction_completed_at: "2026-07-29T16:20:00+09:00",
              correction_note: "오답 확인 완료",
              meta: null,
            },
            items: [],
            attempt_count: 1,
            attempts: [],
          }],
          homeworks: [{
            homework_id: 4101,
            title: "서술형 워크북 12~15번",
            block: {
              score: null,
              max_score: null,
              passed: null,
              clinic_required: false,
              correction_status: homeworkStatus,
              correction_completed_at: homeworkStatus === "COMPLETED"
                ? "2026-07-29T16:40:00+09:00"
                : null,
              correction_note: homeworkNote,
              meta: null,
            },
            attempt_count: 0,
          }],
          updated_at: "2026-07-29T16:30:00+09:00",
          clinic_required: false,
          progress_completed: false,
          progress_status: "in_progress",
          correction_pending_count: homeworkStatus === "PENDING" ? 2 : 1,
          name_highlight_followup_required: true,
        }],
      });
      return;
    }
    if (
      pathname.endsWith(`/results/admin/sessions/${SESSION_ID}/score-correction/`)
      && request.method() === "PATCH"
    ) {
      const payload = request.postDataJSON() as {
        source_type: "exam" | "homework";
        completed: boolean;
        note?: string;
      };
      correctionRequests.push(payload);
      if (options.failCorrection) {
        await fulfill({
          source_id: ["점수가 입력된 항목만 상태를 바꿀 수 있습니다."],
        }, 400);
        return;
      }
      if (payload.source_type === "homework") {
        homeworkStatus = payload.completed ? "COMPLETED" : "PENDING";
        homeworkNote = payload.note ?? homeworkNote;
      } else {
        examStatus = payload.completed ? "COMPLETED" : "PENDING";
        examNote = payload.note ?? examNote;
      }
      await fulfill({
        correction_status: payload.completed ? "COMPLETED" : "PENDING",
        correction_completed_at: payload.completed
          ? "2026-07-29T16:40:00+09:00"
          : null,
        correction_note: payload.note ?? "",
      });
      return;
    }
    if (pathname.endsWith("/results/admin/attempt-history/")) {
      await fulfill({
        source_type: "homework",
        source_id: 4101,
        source_title: "서술형 워크북 12~15번",
        pass_score: null,
        max_score: 100,
        attempts: [],
        clinic_link_id: null,
        resolved: null,
      });
      return;
    }
    if (pathname.endsWith(`/results/admin/sessions/${SESSION_ID}/score-draft/`)) {
      await fulfill({ changes: [] });
      return;
    }
    if (pathname.endsWith("/results/admin/clinic-targets/")) {
      await fulfill([]);
      return;
    }
    await fulfill({ count: 0, next: null, previous: null, results: [] });
  });

  await installTenantOneInitScript(page);
  await page.addInitScript((jwt) => {
    localStorage.setItem("access", jwt);
    localStorage.setItem("refresh", `${jwt}-refresh`);
    localStorage.setItem("tenant_code", "hakwonplus");
    sessionStorage.setItem("tenantCode", "hakwonplus");
  }, token);

  return { correctionRequests };
}

async function openHomeworkInspection(page: Page) {
  await page.locator('tbody tr[role="button"]').first().locator('[data-col-type="name"]').click();
  const drawer = page.locator(".student-scores-drawer");
  await expect(drawer).toBeVisible();
  await drawer.locator(".student-scores-drawer__hw-card")
    .getByText("서술형 워크북 12~15번", { exact: true })
    .click();
  await expect(drawer.getByRole("group", { name: "과제 검사 상태" })).toBeVisible();
  return drawer;
}

test.describe("시험·과제 수동 검사 상태", () => {
  test("점수 없는 과제도 완료/미완료와 비고를 저장하고 다시 불러온다", async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1366, height: 900 });
    const api = await installApi(page);
    const baseUrl = getBaseUrl("admin");
    const url = `${baseUrl}/admin/lectures/${LECTURE_ID}/sessions/${SESSION_ID}/scores`;
    await page.goto(url, { waitUntil: "load", timeout: 45_000 });

    let drawer = await openHomeworkInspection(page);
    await expect(drawer.getByText("검수 대기", { exact: true }).first()).toBeVisible();
    await expect(drawer.getByText("방정식 단원평가", { exact: true }).first()).toBeVisible();
    await expect(drawer.getByText("미입력", { exact: true })).toBeVisible();
    await expect(drawer.getByText("서술형 워크북 12~15번", { exact: true }).first()).toBeVisible();
    await expect(drawer.getByText("미달 항목", { exact: true })).toBeVisible();
    await expect(drawer.getByText("함수 단원평가", { exact: true }).first()).toBeVisible();
    await expect(drawer.getByText("점수 미입력", { exact: true })).toBeVisible();
    const note = drawer.getByRole("textbox", { name: "과제 검사 비고" });
    await expect(note).toBeEnabled();
    await note.fill("연습문제 12~15번 미완료");
    await drawer.getByRole("button", { name: "미완료", exact: true }).click();
    await expect(drawer.getByText("검사 미완료", { exact: true }).first()).toBeVisible();
    await expect(note).toHaveValue("연습문제 12~15번 미완료");
    expect(api.correctionRequests.at(-1)).toMatchObject({
      source_type: "homework",
      completed: false,
      note: "연습문제 12~15번 미완료",
    });

    await note.fill("12~13번 완료, 14~15번 남음");
    await drawer.getByRole("button", { name: "비고 저장", exact: true }).click();
    await expect(note).toHaveValue("12~13번 완료, 14~15번 남음");
    expect(api.correctionRequests.at(-1)).toMatchObject({
      source_type: "homework",
      completed: false,
      note: "12~13번 완료, 14~15번 남음",
    });

    await drawer.locator(".student-scores-drawer__exam-card")
      .filter({ hasText: "방정식 단원평가" })
      .getByText("방정식 단원평가", { exact: true })
      .click();
    const examNote = drawer.getByRole("textbox", { name: "오답 확인 비고" });
    await expect(examNote).toHaveValue("서술형 3번 풀이 확인");
    await examNote.fill("서술형 3번 풀이와 단위를 다시 확인");
    await drawer.locator(".student-scores-drawer__exam-card")
      .getByRole("button", { name: "비고 저장", exact: true })
      .click();
    expect(api.correctionRequests.at(-1)).toMatchObject({
      source_type: "exam",
      completed: false,
      note: "서술형 3번 풀이와 단위를 다시 확인",
    });

    await page.reload({ waitUntil: "load" });
    drawer = await openHomeworkInspection(page);
    await expect(drawer.getByRole("textbox", { name: "과제 검사 비고" }))
      .toHaveValue("12~13번 완료, 14~15번 남음");
    await drawer.getByRole("button", { name: "완료", exact: true }).click();
    await expect(drawer.getByText("검사 완료", { exact: true }).first()).toBeVisible();
    await expect(drawer.getByText("1/1 완료", { exact: false })).toBeVisible();
    await expect(drawer.getByText("미입력", { exact: true })).toHaveCount(0);
    expect(api.correctionRequests.at(-1)).toMatchObject({
      source_type: "homework",
      completed: true,
      note: "12~13번 완료, 14~15번 남음",
    });

    await page.screenshot({
      path: testInfo.outputPath("assessment-inspection-completed-1366.png"),
      fullPage: false,
    });
  });

  test("390px에서도 검사 상태와 비고가 가로 넘침 없이 보인다", async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await installApi(page);
    const baseUrl = getBaseUrl("admin");
    await page.goto(
      `${baseUrl}/admin/lectures/${LECTURE_ID}/sessions/${SESSION_ID}/scores`,
      { waitUntil: "load", timeout: 45_000 },
    );

    const drawer = await openHomeworkInspection(page);
    await expect(drawer.getByRole("button", { name: "미완료", exact: true })).toBeVisible();
    await expect(drawer.getByRole("button", { name: "완료", exact: true })).toBeVisible();
    await expect(drawer.getByRole("textbox", { name: "과제 검사 비고" })).toBeVisible();
    expect(await drawer.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);

    await page.screenshot({
      path: testInfo.outputPath("assessment-inspection-390.png"),
      fullPage: false,
    });
  });

  test("학생 상세를 Escape로 닫고 서버 검증 사유를 그대로 안내한다", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1366, height: 900 });
    await installApi(page, { failCorrection: true });
    const baseUrl = getBaseUrl("admin");
    await page.goto(
      `${baseUrl}/admin/lectures/${LECTURE_ID}/sessions/${SESSION_ID}/scores`,
      { waitUntil: "load", timeout: 45_000 },
    );

    let drawer = await openHomeworkInspection(page);
    await drawer.getByRole("button", { name: "미완료", exact: true }).click();
    await expect(page.getByText("점수가 입력된 항목만 상태를 바꿀 수 있습니다.", { exact: true }))
      .toBeVisible();
    await expect(drawer.getByText("검사 미완료", { exact: true })).toHaveCount(0);

    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();

    drawer = await openHomeworkInspection(page);
    await drawer.getByRole("button", { name: "학생 성적 상세 닫기 (Esc)" }).click();
    await expect(drawer).toBeHidden();
  });
});
