import { expect, test, type Page } from "../fixtures/strictTest";
import { apiCall } from "../helpers/api";
import { loginViaUI } from "../helpers/auth";
import { waitForRenderSettled } from "../helpers/wait";

type ListEnvelope<T> = T[] | { results?: T[] };
type LectureRow = { id?: number; title?: string; is_active?: boolean };
type SessionRow = { id?: number };

type TargetLecture = {
  id: number;
  title: string;
};

function rows<T>(value: ListEnvelope<T>): T[] {
  return Array.isArray(value) ? value : value.results ?? [];
}

async function findLectureWithSession(page: Page): Promise<TargetLecture | null> {
  const lectureResponse = await apiCall<ListEnvelope<LectureRow>>(page, "GET", "/lectures/lectures/");
  if (lectureResponse.status !== 200) return null;

  for (const lecture of rows(lectureResponse.body)) {
    if (!lecture.id || lecture.is_active === false) continue;
    const sessionResponse = await apiCall<ListEnvelope<SessionRow>>(
      page,
      "GET",
      `/lectures/sessions/?lecture=${lecture.id}`,
    );
    if (sessionResponse.status !== 200 || rows(sessionResponse.body).every((session) => !session.id)) continue;
    return { id: lecture.id, title: lecture.title?.trim() || `Lecture ${lecture.id}` };
  }
  return null;
}

async function openScoresFromDashboard(page: Page, lecture: TargetLecture): Promise<void> {
  const lecturesLink = page
    .locator('nav a[href="/admin/lectures"], aside a[href="/admin/lectures"], [class*=sidebar] a[href="/admin/lectures"]')
    .filter({ hasText: "강의" })
    .first();
  await expect(lecturesLink).toBeVisible({ timeout: 10_000 });
  await lecturesLink.click();
  await waitForRenderSettled(page, { timeout: 15_000 });

  const lectureRow = page
    .locator('[data-guide="lectures-table"] tbody tr[role="button"]')
    .filter({ hasText: lecture.title })
    .first();
  await expect(lectureRow).toBeVisible({ timeout: 10_000 });
  await lectureRow.click();

  const sessionBlock = page.locator("button.session-block:not(.session-block--add)").first();
  await expect(sessionBlock).toBeVisible({ timeout: 15_000 });
  await sessionBlock.click();
  await expect(page).toHaveURL(/\/admin\/lectures\/\d+\/sessions\/\d+\/attendance/);

  await installScoreRoutes(page);
  const scoresTab = page.getByRole("button", { name: "성적", exact: true }).first();
  await expect(scoresTab).toBeVisible({ timeout: 10_000 });
  await scoresTab.click();
  await expect(page).toHaveURL(/\/admin\/lectures\/\d+\/sessions\/\d+\/scores/);
  await expect(page.locator(".ds-scores-cell-editable").first()).toBeVisible({ timeout: 10_000 });
}

const scorePatches: Array<Record<string, unknown>> = [];
const draftPuts: Array<Record<string, unknown>> = [];
let currentScores = [65, 52];
let currentDraft: unknown[] = [];

async function installScoreRoutes(page: Page): Promise<void> {
  scorePatches.length = 0;
  draftPuts.length = 0;
  currentScores = [65, 52];
  currentDraft = [];

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();

    if (/\/api\/v1\/results\/admin\/sessions\/\d+\/scores\/$/.test(path) && method === "GET") {
      await route.fulfill({
        json: {
          meta: {
            session_title: "자동 저장 검증 차시",
            lecture_title: "자동 저장 검증반",
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
            homeworks: [],
          },
          rows: currentScores.map((score, index) => ({
            enrollment_id: 9201 + index,
            student_id: 9301 + index,
            student_name: `자동저장학생${index + 1}`,
            lecture_title: "자동 저장 검증반",
            lecture_color: "#2563eb",
            lecture_chip_label: "자",
            exams: [{
              exam_id: 9101,
              title: "주간 확인",
              pass_score: 60,
              attempt_count: 1,
              clinic_link_id: null,
              block: {
                score,
                max_score: 100,
                passed: score >= 60,
                clinic_required: score < 60,
                is_locked: false,
                objective_score: score,
                subjective_score: 0,
                meta: {},
              },
            }],
            homeworks: [],
            clinic_required: score < 60,
            progress_completed: false,
            updated_at: "2026-07-25T12:00:00+09:00",
          })),
        },
      });
      return;
    }

    if (path.endsWith("/score-draft/commit/") && method === "POST") {
      currentDraft = [];
      await route.fulfill({ status: 204, body: "" });
      return;
    }

    if (path.endsWith("/score-draft/")) {
      if (method === "GET") {
        await route.fulfill({ json: { changes: currentDraft } });
        return;
      }
      if (method === "PUT") {
        const body = request.postDataJSON() as { changes?: unknown[] };
        draftPuts.push(body as Record<string, unknown>);
        currentDraft = body.changes ?? [];
        await route.fulfill({ json: { changes: currentDraft } });
        return;
      }
    }

    if (/\/api\/v1\/results\/admin\/exams\/9101\/enrollments\/92\d+\/score\/$/.test(path) && method === "PATCH") {
      const body = request.postDataJSON() as Record<string, unknown>;
      scorePatches.push(body);
      const enrollmentId = Number(path.match(/enrollments\/(\d+)\/score/)?.[1]);
      const rowIndex = enrollmentId - 9201;
      if (rowIndex >= 0 && rowIndex < currentScores.length && typeof body.score === "number") {
        currentScores[rowIndex] = body.score;
      }
      await route.fulfill({
        json: {
          ok: true,
          exam_id: 9101,
          enrollment_id: enrollmentId,
          total_score: currentScores[rowIndex],
          max_score: 100,
        },
      });
      return;
    }

    if (path.endsWith("/api/v1/lectures/attendance/") && method === "GET") {
      await route.fulfill({
        json: {
          count: 2,
          results: currentScores.map((_, index) => ({
            id: 9401 + index,
            enrollment_id: 9201 + index,
            status: "PRESENT",
          })),
        },
      });
      return;
    }

    await route.continue();
  });
}

test.describe("성적 입력 자동 저장과 Excel 단축키", () => {
  test.setTimeout(120_000);
  test.use({ viewport: { width: 1366, height: 900 }, serviceWorkers: "block" });

  test("항상 입력 가능하고 자동 저장·Ctrl+S·Ctrl+Z/Redo가 실제 PATCH에 반영된다", async ({ page }, testInfo) => {
    await loginViaUI(page, "admin");
    const target = await findLectureWithSession(page);
    if (target == null) {
      test.skip(true, "성적 탭으로 이동할 기존 Tenant 1 차시가 없습니다.");
      return;
    }
    await openScoresFromDashboard(page, target);

    await expect(page.getByRole("button", { name: "편집 모드" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "지금 저장" })).toBeVisible();
    await expect(page.getByText("Ctrl+S 저장 · Ctrl+Z 실행 취소")).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("score-entry-1366.png"), fullPage: true });
    await page.setViewportSize({ width: 1100, height: 900 });
    await expect(page.getByRole("button", { name: "지금 저장" })).toBeVisible();
    await expect(page.getByText("Ctrl+S 저장 · Ctrl+Z 실행 취소")).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("score-entry-1100.png"), fullPage: true });
    await page.setViewportSize({ width: 1366, height: 900 });

    const cells = page.locator(".ds-scores-cell-editable");
    await cells.nth(0).fill("74");
    await cells.nth(0).press("Enter");
    await expect.poll(() => scorePatches.length, { timeout: 10_000 }).toBe(1);
    expect(scorePatches[0]).toMatchObject({ score: 74, max_score: 100 });
    await expect(page.getByRole("status")).toContainText("저장됨");

    await page.keyboard.press("Control+z");
    await expect.poll(() => scorePatches.length, { timeout: 10_000 }).toBe(2);
    expect(scorePatches[1]).toMatchObject({ score: 65, max_score: 100 });
    await expect(cells.nth(0)).toHaveText("65");

    await page.keyboard.press("Control+Shift+z");
    await expect.poll(() => scorePatches.length, { timeout: 10_000 }).toBe(3);
    expect(scorePatches[2]).toMatchObject({ score: 74, max_score: 100 });
    await expect(cells.nth(0)).toHaveText("74");

    await cells.nth(0).fill("77");
    await page.keyboard.press("Control+s");
    await expect.poll(() => scorePatches.length, { timeout: 10_000 }).toBe(4);
    expect(scorePatches[3]).toMatchObject({ score: 77, max_score: 100 });
    expect(draftPuts.length).toBeGreaterThanOrEqual(4);

    await cells.nth(0).click();
    await page.keyboard.press("Control+z");
    await expect.poll(() => scorePatches.at(-1)?.score, { timeout: 10_000 }).toBe(74);
    await page.keyboard.press("Control+z");
    await expect.poll(() => scorePatches.at(-1)?.score, { timeout: 10_000 }).toBe(65);
    await page.keyboard.press("Control+Shift+z");
    await expect.poll(() => scorePatches.at(-1)?.score, { timeout: 10_000 }).toBe(74);
    await page.keyboard.press("Control+Shift+z");
    await expect.poll(() => scorePatches.at(-1)?.score, { timeout: 10_000 }).toBe(77);

    const patchCountBeforeNativeUndo = scorePatches.length;
    const searchInput = page.getByRole("searchbox", { name: "학생 이름 검색" });
    await searchInput.fill("자동");
    await searchInput.press("Control+z");
    await expect
      .poll(() => scorePatches.length)
      .toBe(patchCountBeforeNativeUndo);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator(".ds-scores-cell-editable").first()).toHaveText("77", { timeout: 10_000 });
    await expect(page.getByRole("dialog", { name: /임시저장된 변경/ })).toHaveCount(0);
  });
});
