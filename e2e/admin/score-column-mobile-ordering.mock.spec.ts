import { expect, test, type Page } from "../fixtures/strictTest";
import { getBaseUrl } from "../helpers/auth";
import {
  installLocalAuthApiStubs,
  installTenantOneInitScript,
} from "../helpers/localAuthApiStubs";

const LECTURE_ID = 9001;
const SESSION_ID = 9002;
const EXAM_IDS = [9101, 9102] as const;
const HOMEWORK_IDS = [9151, 9152] as const;

const examTitles: Record<number, string> = {
  9101: "첫 시험",
  9102: "둘째 시험",
};

const homeworkTitles: Record<number, string> = {
  9151: "첫 과제",
  9152: "둘째 과제",
};

function createLocalJwt() {
  const encode = (payload: unknown) => Buffer.from(JSON.stringify(payload)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  return `${encode({ alg: "none", typ: "JWT" })}.${encode({
    exp: now + 3600,
    tenant_code: "hakwonplus",
    user_id: 12,
  })}.sig`;
}

type OrderingHarness = {
  reorderPayloads: Array<{ exams?: number[]; homeworks?: number[] }>;
  unexpectedMutations: string[];
};

async function installOrderingRoutes(page: Page): Promise<OrderingHarness> {
  let examOrder: number[] = [...EXAM_IDS];
  let homeworkOrder: number[] = [...HOMEWORK_IDS];
  let failNextReorder = true;
  const reorderPayloads: OrderingHarness["reorderPayloads"] = [];
  const unexpectedMutations: string[] = [];

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();

    if (
      path.endsWith(`/results/admin/sessions/${SESSION_ID}/reorder/`)
      && method === "POST"
    ) {
      const payload = request.postDataJSON() as { exams?: number[]; homeworks?: number[] };
      reorderPayloads.push(payload);
      if (failNextReorder) {
        failNextReorder = false;
        await route.fulfill({ status: 500, json: { detail: "순서 저장 실패" } });
        return;
      }
      if (payload.exams) examOrder = [...payload.exams];
      if (payload.homeworks) homeworkOrder = [...payload.homeworks];
      await route.fulfill({ json: { ok: true } });
      return;
    }

    if (
      path.endsWith(`/results/admin/sessions/${SESSION_ID}/scores/`)
      && method === "GET"
    ) {
      await route.fulfill({
        json: {
          meta: {
            session_title: "모바일 순서 검증 차시",
            lecture_title: "모바일 순서 검증반",
            lecture_id: LECTURE_ID,
            exams: examOrder.map((examId, index) => ({
              exam_id: examId,
              title: examTitles[examId],
              pass_score: 60,
              max_score: 100,
              objective_max_score: 100,
              subjective_max_score: 0,
              display_order: index + 1,
            })),
            homeworks: homeworkOrder.map((homeworkId, index) => ({
              homework_id: homeworkId,
              title: homeworkTitles[homeworkId],
              unit: "점",
              grading_mode: "SCORE",
              max_score: 100,
              display_order: index + 1,
            })),
          },
          rows: [{
            enrollment_id: 9201,
            student_id: 9301,
            student_name: "모바일순서학생",
            lecture_title: "모바일 순서 검증반",
            lecture_color: "#2563eb",
            lecture_chip_label: "모",
            exams: examOrder.map((examId) => ({
              exam_id: examId,
              title: examTitles[examId],
              pass_score: 60,
              attempt_count: 1,
              clinic_link_id: null,
              block: {
                score: 80,
                max_score: 100,
                passed: true,
                clinic_required: false,
                is_locked: false,
                objective_score: 80,
                subjective_score: 0,
                correction_status: "NOT_REQUIRED",
                meta: {},
              },
            })),
            homeworks: homeworkOrder.map((homeworkId) => ({
              homework_id: homeworkId,
              title: homeworkTitles[homeworkId],
              block: {
                score: 90,
                max_score: 100,
                passed: true,
                clinic_required: false,
                is_locked: false,
                meta: {},
              },
            })),
            clinic_required: false,
            progress_completed: false,
            updated_at: "2026-08-25T12:00:00+09:00",
          }],
        },
      });
      return;
    }

    if (path.endsWith("/lectures/attendance/") && method === "GET") {
      await route.fulfill({
        json: { count: 1, results: [{ id: 9401, enrollment_id: 9201, status: "PRESENT" }] },
      });
      return;
    }
    if (path.endsWith(`/lectures/lectures/${LECTURE_ID}/`) && method === "GET") {
      await route.fulfill({
        json: { id: LECTURE_ID, title: "모바일 순서 검증반", color: "#2563eb", chip_label: "모" },
      });
      return;
    }
    if (path.endsWith(`/lectures/sessions/${SESSION_ID}/`) && method === "GET") {
      await route.fulfill({
        json: { id: SESSION_ID, lecture: LECTURE_ID, order: 1, title: "모바일 순서 검증 차시", date: "2026-08-25" },
      });
      return;
    }
    if (path.endsWith("/enrollments/session-enrollments/") && method === "GET") {
      await route.fulfill({
        json: {
          count: 1,
          results: [{
            id: 9501,
            session: SESSION_ID,
            enrollment: 9201,
            student_id: 9301,
            student_name: "모바일순서학생",
          }],
        },
      });
      return;
    }
    if (path.endsWith("/staffs/currently-working/") && method === "GET") {
      await route.fulfill({ json: [] });
      return;
    }

    if (!["GET", "OPTIONS"].includes(method)) {
      unexpectedMutations.push(`${method} ${path}`);
      await route.fulfill({ status: 500, json: { detail: "unexpected mutation" } });
      return;
    }
    await route.fallback();
  });

  return { reorderPayloads, unexpectedMutations };
}

async function openScores(page: Page): Promise<OrderingHarness> {
  const baseUrl = getBaseUrl("admin");
  test.skip(
    !/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(baseUrl),
    "성적 컬럼 모바일 순서 route-mock은 로컬 dev 서버 전용",
  );
  await installLocalAuthApiStubs(page);
  await installTenantOneInitScript(page);
  await page.addInitScript((token) => {
    localStorage.setItem("access", token);
    localStorage.setItem("refresh", `${token}-refresh`);
  }, createLocalJwt());
  const harness = await installOrderingRoutes(page);
  await page.goto(
    `${baseUrl}/workspace/lectures/${LECTURE_ID}/sessions/${SESSION_ID}/scores`,
    { waitUntil: "domcontentloaded", timeout: 45_000 },
  );
  await expect(page).toHaveURL(
    new RegExp(`/workspace/lectures/${LECTURE_ID}/sessions/${SESSION_ID}/scores`),
  );
  return harness;
}

async function orderedIds(page: Page, type: "exam" | "homework") {
  return page.locator(`[data-testid^="score-column-order-${type}-"]`).evaluateAll((nodes) => (
    nodes.map((node) => Number(node.getAttribute("data-column-id")))
  ));
}

async function expectDocumentOverflowZero(page: Page) {
  await expect.poll(() => page.evaluate(() => ({
    body: document.body.scrollWidth - document.body.clientWidth,
    document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }))).toEqual({ body: 0, document: 0 });
}

test.describe("성적 컬럼 모바일 순서 제어", () => {
  test.setTimeout(90_000);
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    serviceWorkers: "block",
  });

  test("390px에서 키보드·터치 순서 변경, 실패 유지와 retry를 보장한다", async ({ page }) => {
    const { reorderPayloads, unexpectedMutations } = await openScores(page);

    const firstExamPrevious = page.getByRole("button", { name: "첫 시험 이전 순서로 이동" });
    const firstExamNext = page.getByRole("button", { name: "첫 시험 다음 순서로 이동" });
    const secondExamNext = page.getByRole("button", { name: "둘째 시험 다음 순서로 이동" });
    const firstHomeworkNext = page.getByRole("button", { name: "첫 과제 다음 순서로 이동" });

    await expect(firstExamPrevious).toBeVisible();
    await expect(firstExamPrevious).toBeDisabled();
    await expect(firstExamPrevious).toHaveAttribute("title", /첫 번째/);
    await expect(secondExamNext).toBeDisabled();
    await expect(secondExamNext).toHaveAttribute("title", /마지막/);

    const compactButtons = page.locator('[data-testid^="score-column-order-"] .ds-button');
    await expect(compactButtons).toHaveCount(8);
    for (const button of await compactButtons.all()) {
      const box = await button.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }

    await firstExamNext.focus();
    await expect(firstExamNext).toBeFocused();
    await firstExamNext.press("Enter");
    await expect.poll(() => reorderPayloads).toEqual([{ exams: [9102, 9101] }]);
    await expect(page.getByText("순서 변경 실패", { exact: true })).toBeVisible();
    await expect.poll(() => orderedIds(page, "exam")).toEqual([9101, 9102]);

    await firstExamNext.press("Space");
    await expect.poll(() => reorderPayloads).toEqual([
      { exams: [9102, 9101] },
      { exams: [9102, 9101] },
    ]);
    await expect.poll(() => orderedIds(page, "exam")).toEqual([9102, 9101]);

    await firstHomeworkNext.tap();
    await expect.poll(() => reorderPayloads).toEqual([
      { exams: [9102, 9101] },
      { exams: [9102, 9101] },
      { homeworks: [9152, 9151] },
    ]);
    await expect.poll(() => orderedIds(page, "homework")).toEqual([9152, 9151]);

    expect(unexpectedMutations).toEqual([]);
    await expectDocumentOverflowZero(page);
  });

  test("1366px에서는 compact control을 숨기고 기존 drag contract를 유지한다", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    const { unexpectedMutations } = await openScores(page);

    await expect(page.locator('[data-testid^="score-column-order-"]')).toHaveCount(4);
    await expect(page.locator('[data-testid^="score-column-order-"]').first()).toBeHidden();
    await expect(page.locator(".scores-col-drag-handle")).toHaveCount(4);
    for (const handle of await page.locator(".scores-col-drag-handle").all()) {
      await expect(handle).toHaveAttribute("draggable", "true");
    }

    expect(unexpectedMutations).toEqual([]);
    await expectDocumentOverflowZero(page);
  });
});
