import { test, expect } from "../fixtures/strictTest";
import { loginViaUI, getBaseUrl } from "../helpers/auth";
import { apiCall } from "../helpers/api";

const BASE = getBaseUrl("admin");
const RUN_ID = Date.now();
const TITLE = `[E2E] 주간 예약 ${RUN_ID}`;
const LOCATION = `[E2E] 예약실 ${RUN_ID}`;

function tomorrowISO() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

test("관리자가 주간 예약 보드에서 세션을 확인하고 빠른 액션을 연다", async ({ page }) => {
  await loginViaUI(page, "admin", { landingPath: "/workspace/clinic/schedule" });

  let sessionId: number | null = null;
  try {
    const date = tomorrowISO();
    type SessionRow = { id: number; title?: string };
    const existing = await apiCall<SessionRow[] | { results?: SessionRow[] }>(
      page,
      "GET",
      `/clinic/sessions/?date_from=${date}&date_to=${date}`
    );
    const existingRows = Array.isArray(existing.body)
      ? existing.body
      : existing.body?.results ?? [];
    for (const session of existingRows) {
      if (session.title?.startsWith("[E2E] 주간 예약")) {
        await apiCall(page, "DELETE", `/clinic/sessions/${session.id}/`);
      }
    }

    const created = await apiCall<{ id: number }>(page, "POST", "/clinic/sessions/", {
      date,
      start_time: "17:00:00",
      duration_minutes: 60,
      location: LOCATION,
      max_participants: 10,
      title: TITLE,
    });
    expect(created.status).toBe(201);
    sessionId = created.body.id;

    await page.route("**/api/v1/results/admin/clinic-targets/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            enrollment_id: 901001,
            student_id: 801001,
            student_name: "중복검증학생",
            session_title: "대수 진단",
            lecture_title: "대수",
            lecture_color: "#2563eb",
            created_at: "2026-07-28T00:00:00Z",
          },
          {
            enrollment_id: 901001,
            student_id: 801001,
            student_name: "중복검증학생",
            session_title: "기하 진단",
            lecture_title: "기하",
            lecture_color: "#16a34a",
            created_at: "2026-07-28T00:00:00Z",
          },
        ]),
      });
    });
    await page.route("**/api/v1/students/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          count: 1,
          results: [
            {
              id: 802002,
              name: "전체학생검증",
              parent_phone: "01012345678",
              phone: "",
              school_type: "HIGH",
              high_school: "테스트고",
              grade: 1,
              enrollments: [],
            },
          ],
        }),
      });
    });

    await page.goto(`${BASE}/workspace/clinic/schedule`);
    await page.waitForLoadState("networkidle").catch(() => undefined);

    await expect(page.getByRole("heading", { name: "예약 일정", exact: true })).toBeVisible();
    await expect(page.getByRole("gridcell")).toHaveCount(7);
    await expect(page.getByRole("article").filter({ hasText: TITLE })).toHaveCount(1);
    await expect(page.getByRole("button", { name: "예약 일정", exact: true })).toBeVisible();

    const sessionCard = page.getByRole("article").filter({ hasText: TITLE });
    await sessionCard.getByRole("button", { name: `${TITLE} 설정 복사` }).click();
    await expect(page.getByRole("heading", { name: "클리닉 설정 복사" })).toBeVisible();
    await expect(page.getByPlaceholder("장소 / 룸")).toHaveValue(LOCATION);
    await page.locator(".ant-modal-close").click();

    await sessionCard.getByRole("button", { name: "학생 추가", exact: true }).click();
    await expect(page.getByRole("grid", { name: "미통과 대상자 명단" })).toBeVisible();
    const targetNames = (await page
      .locator(".clinic-target-select-modal__table tbody .modal-inner-table__name")
      .allTextContents())
      .map((name) => name.trim())
      .filter(Boolean);
    expect(targetNames).toHaveLength(1);
    expect(targetNames[0]).toContain("중복검증학생");
    expect(new Set(targetNames).size).toBe(targetNames.length);
    await page.getByRole("checkbox", { name: "중복검증학생 선택" }).check();
    await expect(page.locator(".clinic-target-select-modal__selected-count")).toHaveText("1명 선택됨");
    await page.getByRole("button", { name: "전체 학생", exact: true }).click();
    await expect(page.getByRole("grid", { name: "전체 학생 명단" })).toBeVisible();
    await expect(page.locator(".clinic-target-select-modal__selected-count")).toHaveText("0명 선택됨");
    await expect(page.getByRole("checkbox", { name: "전체학생검증 선택" })).toBeVisible();
    await page.getByRole("button", { name: "미통과 대상자", exact: true }).click();
    await expect(page.getByRole("grid", { name: "미통과 대상자 명단" })).toBeVisible();
    await expect(page.locator(".clinic-target-select-modal__selected-count")).toHaveText("0명 선택됨");
    await page.locator(".ant-modal-close").click();

    await page.getByRole("button", { name: "클리닉 만들기", exact: true }).click();
    const createDialog = page.getByRole("dialog").filter({ hasText: "클리닉 만들기" });
    await createDialog.getByRole("button", { name: "대상자 추가", exact: true }).click();
    await page.getByRole("checkbox", { name: "중복검증학생 선택" }).check();
    await page.getByRole("button", { name: "선택 확정 (1명)" }).click();
    await expect(createDialog.locator(".clinic-capacity-stepper__value")).toHaveText("10");
    await expect(createDialog.getByText("미통과 대상자 1명 선택 · 추가 예약 9명 가능")).toBeVisible();
    await page.locator(".ant-modal-close").last().click();

    if (process.env.CAPTURE_CLINIC_SCHEDULE === "1") {
      await page.screenshot({
        path: "../_artifacts/clinic-schedule-wide.png",
        fullPage: true,
      });
      await page.setViewportSize({ width: 1180, height: 820 });
      await page.screenshot({
        path: "../_artifacts/clinic-schedule-compact.png",
        fullPage: true,
      });
    }
  } finally {
    if (sessionId) {
      const deleted = await apiCall(page, "DELETE", `/clinic/sessions/${sessionId}/`);
      expect([204, 404]).toContain(deleted.status);
    }
  }
});
