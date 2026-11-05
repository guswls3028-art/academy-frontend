import { expect, test, type Page } from "../fixtures/strictTest";
import { getBaseUrl } from "../helpers/auth";
import { installWorkspaceReadApiStubs } from "../helpers/workspaceReadApiStubs";
import {
  installLocalAuthApiStubs,
  installTenantOneInitScript,
} from "../helpers/localAuthApiStubs";

const LECTURE_ID = 9001;
const SESSION_ID = 9002;
const EXAM_IDS = [9101, 9102] as const;
const HOMEWORK_IDS = [9151, 9152] as const;

const initialExamTitles: Record<number, string> = {
  9101: "첫 시험",
  9102: "둘째 시험",
};

const initialHomeworkTitles: Record<number, string> = {
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
  titlePatches: Array<{ kind: string; payload: unknown }>;
  reorderPayloads: Array<{ exams?: number[]; homeworks?: number[] }>;
  unexpectedMutations: string[];
  deletedAssessments: string[];
};

async function installOrderingRoutes(page: Page): Promise<OrderingHarness> {
  const examTitles = { ...initialExamTitles };
  const homeworkTitles = { ...initialHomeworkTitles };
  const titlePatches: OrderingHarness["titlePatches"] = [];
  const examSettings = {
    id: EXAM_IDS[0], exam_type: "regular", grading_mode: "written", manual_grading_method: "score",
    max_score: 100, pass_score: 60, student_results_published: true, allow_retake: false,
    max_attempts: 1, open_at: null, close_at: null, answer_visibility: "hidden", essay_numbering: "continuous",
    updated_at: "2026-08-25T12:00:00+09:00",
  };
  const homeworkSettings = {
    id: HOMEWORK_IDS[0], session_id: SESSION_ID, grading_mode: "SCORE", max_score: 100,
    effective_cutline_mode: "PERCENT", effective_cutline_value: 80, effective_round_unit_percent: 5,
    meta: {}, updated_at: "2026-08-25T12:00:00+09:00",
  };
  let examOrder: number[] = [...EXAM_IDS];
  let homeworkOrder: number[] = [...HOMEWORK_IDS];
  let failNextReorder = true;
  let version = 0;
  const reorderPayloads: OrderingHarness["reorderPayloads"] = [];
  const unexpectedMutations: string[] = [];
  const deletedAssessments: string[] = [];

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (path.endsWith(`/exams/${EXAM_IDS[0]}/`)) {
      if (method === "PATCH") {
        expect(request.headers()["x-expected-updated-at"]).toBe("2026-08-25T12:00:00+09:00");
        const payload = request.postDataJSON();
        titlePatches.push({ kind: "exam", payload });
        if (payload.title) examTitles[EXAM_IDS[0]] = payload.title;
        Object.assign(examSettings, payload);
        await route.fulfill({ json: { ...examSettings, title: examTitles[EXAM_IDS[0]] } });
        return;
      }
      if (method === "DELETE") {
        if (url.searchParams.get("session_id") !== String(SESSION_ID)) {
          await route.fulfill({ status: 400, json: { detail: "차시가 일치하지 않습니다." } });
          return;
        }
        examOrder = examOrder.filter((id) => id !== EXAM_IDS[0]);
        deletedAssessments.push(`exam:${EXAM_IDS[0]}`);
        await route.fulfill({ json: { action: "archived" } });
        return;
      }
      if (method === "GET") {
        await route.fulfill({ json: {
          ...examSettings, title: examTitles[EXAM_IDS[0]],
        } });
        return;
      }
    }

    if (path.endsWith(`/exams/${EXAM_IDS[0]}/questions/`) && method === "GET") {
      await route.fulfill({ json: [] });
      return;
    }

    if (path.endsWith(`/homeworks/${HOMEWORK_IDS[0]}/`)) {
      if (method === "PATCH") {
        expect(request.headers()["x-expected-updated-at"]).toBe("2026-08-25T12:00:00+09:00");
        const payload = request.postDataJSON();
        titlePatches.push({ kind: "homework", payload });
        if (payload.title) homeworkTitles[HOMEWORK_IDS[0]] = payload.title;
        Object.assign(homeworkSettings, payload);
        await route.fulfill({ json: { ...homeworkSettings, title: homeworkTitles[HOMEWORK_IDS[0]] } });
        return;
      }
      if (method === "DELETE") {
        homeworkOrder = homeworkOrder.filter((id) => id !== HOMEWORK_IDS[0]);
        deletedAssessments.push(`homework:${HOMEWORK_IDS[0]}`);
        await route.fulfill({ status: 204, body: "" });
        return;
      }
      if (method === "GET") {
        await route.fulfill({ json: {
          ...homeworkSettings, title: homeworkTitles[HOMEWORK_IDS[0]],
        } });
        return;
      }
    }

    if (
      path.endsWith(`/results/admin/sessions/${SESSION_ID}/total-config/`)
      && method === "PUT"
    ) {
      const body = request.postDataJSON() as { expected_version: number; exam_order: number[]; homework_order: number[] };
      expect(body.expected_version).toBe(version);
      const payload = JSON.stringify(body.exam_order) !== JSON.stringify(examOrder)
        ? { exams: body.exam_order } : { homeworks: body.homework_order };
      reorderPayloads.push(payload);
      if (failNextReorder) {
        failNextReorder = false;
        await route.fulfill({ status: 500, json: { detail: "순서 저장 실패" } });
        return;
      }
      if (payload.exams) examOrder = [...payload.exams];
      if (payload.homeworks) homeworkOrder = [...payload.homeworks];
      version++;
      await route.fulfill({ json: { version, exam_ids: examOrder, homework_ids: homeworkOrder, exam_order: examOrder, homework_order: homeworkOrder } });
      return;
    }

    if (
      path.endsWith(`/results/admin/sessions/${SESSION_ID}/scores/`)
      && method === "GET"
    ) {
      await route.fulfill({
        json: {
          meta: {
            total_config: { version, exam_ids: examOrder, homework_ids: homeworkOrder, exam_order: examOrder, homework_order: homeworkOrder },
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

    if (path.endsWith(`/results/admin/sessions/${SESSION_ID}/score-draft/`) && method === "GET") {
      await route.fulfill({ json: { changes: [], active_editors: [], stale: false } });
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

  return { reorderPayloads, unexpectedMutations, deletedAssessments, titlePatches };
}

async function openScores(page: Page): Promise<OrderingHarness> {
  const baseUrl = getBaseUrl("admin");
  test.skip(
    !/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(baseUrl),
    "성적 컬럼 모바일 순서 route-mock은 로컬 dev 서버 전용",
  );
  await installLocalAuthApiStubs(page);
  await installWorkspaceReadApiStubs(page);
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
  await expect(page.getByRole("button", { name: "첫 시험 작업 선택", exact: true })).toBeVisible({ timeout: 45_000 });
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

  for (const width of [1366, 1100, 390]) {
    test(`@assessment-edit ${width}px 성적표는 제목 메뉴에서 시험·과제 전체 수정 모달을 연다`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 844 });
      const harness = await openScores(page);
      for (const [kind, previous, next, actionName, dialogName] of [
        ['exam', '첫 시험', '수정된 시험 제목 서술형 소수 배점 1793679432205', '시험 설정', '시험 설정'],
        ['homework', '첫 과제', '수정된 과제 제목 수학 개념복습 1793679432205', '과제 수정', '과제 수정'],
      ] as const) {
        await expect(page.getByRole('button', { name: `${previous} 제목 수정`, exact: true })).toHaveCount(0);
        const trigger = page.getByRole('button', { name: `${previous} 작업 선택`, exact: true });
        await trigger.scrollIntoViewIfNeeded();
        await expect(trigger).toBeInViewport();
        await trigger.click();
        const menu = page.getByRole('menu', { name: `${previous} 작업 선택`, exact: true });
        const editAction = menu.getByRole('menuitem', { name: new RegExp(`^${actionName}`) });
        await expect(editAction).toBeVisible();
        await page.screenshot({ path: testInfo.outputPath(`assessment-edit-menu-${width}-${kind}.png`), animations: 'disabled' });
        await editAction.click();

        const dialog = page.getByRole('dialog').filter({ hasText: dialogName });
        const input = dialog.getByRole('textbox', { name: kind === 'exam' ? '시험명' : '과제명', exact: true });
        await expect(input).toBeEnabled();
        if (kind === 'exam') {
          await expect(dialog.getByRole('spinbutton', { name: '만점', exact: true })).toBeVisible();
          await expect(dialog.getByRole('spinbutton', { name: /^합격 기준/ })).toBeVisible();
          await expect(dialog.getByRole('group', { name: '시험 채점 방식', exact: true })).toBeVisible();
        } else {
          await expect(dialog.locator('input[type="date"]')).toBeVisible();
          await expect(dialog.getByRole('spinbutton', { name: '만점', exact: true })).toBeVisible();
          await expect(dialog.getByRole('group', { name: '과제 채점 방식', exact: true })).toBeVisible();
        }
        const dialogBox = await dialog.boundingBox();
        expect(dialogBox?.x).toBeGreaterThanOrEqual(0);
        expect((dialogBox?.x ?? 0) + (dialogBox?.width ?? width + 1)).toBeLessThanOrEqual(width + 1);
        await page.screenshot({ path: testInfo.outputPath(`assessment-edit-modal-${width}-${kind}.png`), animations: 'disabled' });

        await input.fill(next);
        await dialog.getByRole('button', { name: kind === 'exam' ? '저장' : '운영 설정 저장', exact: true }).click();
        await expect(dialog).not.toBeVisible();
        expect(harness.titlePatches.at(-1)).toEqual({ kind, payload: { title: next } });
        await expect(page.getByRole('button', { name: `${next} 작업 선택`, exact: true })).toBeVisible();
        if (kind === 'exam') {
          await page.getByRole('button', { name: `${next} 작업 선택`, exact: true }).press('Enter');
          await page.getByRole('menuitem', { name: /^시험 설정/ }).click();
          await dialog.getByRole('spinbutton', { name: '만점', exact: true }).fill('120');
          await dialog.getByRole('spinbutton', { name: /^합격 기준/ }).fill('70');
          await dialog.getByRole('checkbox', { name: '학생 성적 공개', exact: true }).uncheck();
          await dialog.locator('summary').filter({ hasText: '응시 기간·정답 공개·재응시' }).click();
          await expect(dialog.getByLabel('응시 시작', { exact: true })).toBeVisible();
          await expect(dialog.getByLabel('정답 공개', { exact: true })).toBeVisible();
          await dialog.getByRole('button', { name: '저장', exact: true }).click();
          await expect(dialog).not.toBeVisible();
          expect(harness.titlePatches.at(-1)).toEqual({ kind, payload: { max_score: 120, pass_score: 70, student_results_published: false } });
          await page.reload();
          await page.getByRole('button', { name: `${next} 작업 선택`, exact: true }).click();
          await page.getByRole('menuitem', { name: /^시험 설정/ }).click();
          await expect(dialog.getByRole('spinbutton', { name: '만점', exact: true })).toHaveValue('120');
          await expect(dialog.getByRole('checkbox', { name: '학생 성적 공개', exact: true })).not.toBeChecked();
          await dialog.getByRole('button', { name: '닫기', exact: true }).click();
          await expect(dialog).not.toBeVisible();
        } else {
          await page.getByRole('button', { name: `${next} 작업 선택`, exact: true }).click();
          await page.getByRole('menuitem', { name: /^과제 수정/ }).click();
          await dialog.getByRole('spinbutton', { name: '만점', exact: true }).fill('120');
          await dialog.locator('input[type="date"]').fill('2026-12-01');
          await dialog.getByRole('button', { name: '운영 설정 저장', exact: true }).click();
          await expect(dialog).not.toBeVisible();
          expect(harness.titlePatches.at(-1)).toEqual({ kind, payload: { max_score: 120, meta: { due_date: '2026-12-01' } } });
          await page.reload();
          await page.getByRole('button', { name: `${next} 작업 선택`, exact: true }).click();
          await page.getByRole('menuitem', { name: /^과제 수정/ }).click();
          await expect(dialog.getByRole('spinbutton', { name: '만점', exact: true })).toHaveValue('120');
          await expect(dialog.locator('input[type="date"]')).toHaveValue('2026-12-01');
          await page.keyboard.press('Escape');
          await expect(dialog).not.toBeVisible();
        }
      }
      await page.reload();
      await expect(page.getByRole('button', { name: '수정된 시험 제목 서술형 소수 배점 1793679432205 작업 선택', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: '수정된 과제 제목 수학 개념복습 1793679432205 작업 선택', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: /제목 수정$/ })).toHaveCount(0);
      await expectDocumentOverflowZero(page);
      expect(harness.unexpectedMutations).toEqual([]);
      for (const [kind, title] of [["exam", "수정된 시험 제목 서술형 소수 배점 1793679432205"], ["homework", "수정된 과제 제목 수학 개념복습 1793679432205"]]) {
        const target = page.getByRole("button", { name: `${title} 작업 선택`, exact: true });
        await target.scrollIntoViewIfNeeded();
        await expect(target).toBeInViewport();
        expect((await target.boundingBox())?.height).toBeGreaterThanOrEqual(44);
        const titleBox = await target.locator('.scores-table-head-title').boundingBox();
        expect(titleBox?.height).toBeLessThanOrEqual(40);
        expect((await target.locator('xpath=ancestor::th').boundingBox())?.height).toBeLessThan(180);
        await page.screenshot({ path: testInfo.outputPath(`assessment-header-${width}-${kind}.png`), animations: "disabled" });
        await target.click();
        const menu = page.getByRole('menu', { name: `${title} 작업 선택`, exact: true });
        await expect(menu.getByText(title, { exact: true })).toBeVisible();
        await page.screenshot({ path: testInfo.outputPath(`assessment-long-title-menu-${width}-${kind}.png`), animations: "disabled" });
        await target.click();
      }
    });
  }

  test("@assessment-edit 실패한 저장과 빠른 닫기 뒤 입력을 복구하고 재저장한다", async ({ page }) => {
    const harness = await openScores(page);
    let failNextSave = true;
    await page.route(`**/api/v1/exams/${EXAM_IDS[0]}/`, async (route) => {
      if (route.request().method() === "PATCH" && failNextSave) {
        failNextSave = false;
        await route.fulfill({ status: 500, json: { detail: "일시적인 저장 오류입니다. 다시 시도해 주세요." } });
        return;
      }
      await route.fallback();
    });
    const openEditor = async (title: string) => {
      await page.getByRole("button", { name: `${title} 작업 선택`, exact: true }).click();
      await page.getByRole("menuitem", { name: /^시험 설정/ }).click();
    };
    await openEditor("첫 시험");
    const dialog = page.getByRole("dialog", { name: "시험 설정", exact: true });
    const title = dialog.getByRole("textbox", { name: "시험명", exact: true });
    await title.fill("저장 실패 후 복구된 시험");
    await dialog.getByRole("button", { name: "저장", exact: true }).click();
    await expect(dialog.getByRole("alert")).toContainText("일시적인 저장 오류");
    await expect(title).toHaveValue("저장 실패 후 복구된 시험");
    await title.fill("빠르게 닫은 시험 초안");
    await dialog.getByRole("button", { name: "닫기", exact: true }).click();
    await page.getByRole("alertdialog", { name: "시험 수정 닫기" }).getByRole("button", { name: "닫기", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    expect(harness.titlePatches).toEqual([]);
    await openEditor("첫 시험");
    await dialog.getByRole("button", { name: "이어서 편집", exact: true }).click();
    await expect(title).toHaveValue("빠르게 닫은 시험 초안");
    await dialog.getByRole("button", { name: "저장", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await page.reload();
    await openEditor("빠르게 닫은 시험 초안");
    await expect(title).toHaveValue("빠르게 닫은 시험 초안");
    await expect(dialog.getByTestId("assessment-draft-recovery")).toHaveCount(0);
    expect(harness.titlePatches).toEqual([{ kind: "exam", payload: { title: "빠르게 닫은 시험 초안" } }]);
    expect(harness.unexpectedMutations).toEqual([]);
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

  test("시험·과제 머리글에서 수정 모달과 확인 후 삭제가 작동하고 새로고침에도 반영된다", async ({ page }) => {
    const { deletedAssessments, unexpectedMutations } = await openScores(page);

    const examTrigger = page.getByRole("button", { name: "첫 시험 작업 선택" });
    await examTrigger.click();
    const examMenu = page.getByRole("menu", { name: "첫 시험 작업 선택" });
    await expect(examMenu.getByRole("menuitem", { name: "시험 설정" })).toBeVisible();
    await examMenu.getByRole("menuitem", { name: "시험 설정" }).click();
    await expect(page.getByRole("dialog").filter({ hasText: "시험 설정" }).getByRole("textbox", { name: "시험명" })).toHaveValue("첫 시험");
    await page.keyboard.press("Escape");

    await examTrigger.click();
    await examMenu.getByRole("menuitem", { name: "삭제" }).click();
    const examConfirm = page.getByRole("alertdialog", { name: "시험 삭제" });
    await examConfirm.getByRole("button", { name: "취소" }).click();
    expect(deletedAssessments).toEqual([]);
    await examTrigger.click();
    await examMenu.getByRole("menuitem", { name: "삭제" }).click();
    await page.getByRole("alertdialog", { name: "시험 삭제" }).getByRole("button", { name: "삭제" }).click();
    await expect(examTrigger).toHaveCount(0);

    const homeworkTrigger = page.getByRole("button", { name: "첫 과제 작업 선택" });
    await homeworkTrigger.click();
    const homeworkMenu = page.getByRole("menu", { name: "첫 과제 작업 선택" });
    await expect(homeworkMenu.getByRole("menuitem", { name: "과제 수정" })).toBeVisible();
    await homeworkMenu.getByRole("menuitem", { name: "과제 수정" }).click();
    await expect(page.getByRole("dialog").filter({ hasText: "과제 수정" }).getByRole("textbox", { name: "과제명" })).toHaveValue("첫 과제");
    await page.keyboard.press("Escape");

    await homeworkTrigger.click();
    await homeworkMenu.getByRole("menuitem", { name: "삭제" }).click();
    const homeworkConfirm = page.getByRole("alertdialog", { name: "과제 삭제" });
    await homeworkConfirm.getByRole("button", { name: "취소" }).click();
    expect(deletedAssessments).toEqual(["exam:9101"]);
    await homeworkTrigger.click();
    await homeworkMenu.getByRole("menuitem", { name: "삭제" }).click();
    await page.getByRole("alertdialog", { name: "과제 삭제" }).getByRole("button", { name: "삭제" }).click();
    await expect(homeworkTrigger).toHaveCount(0);

    expect(deletedAssessments).toEqual(["exam:9101", "homework:9151"]);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: "첫 시험 작업 선택" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "첫 과제 작업 선택" })).toHaveCount(0);
    expect(unexpectedMutations).toEqual([]);
    await expectDocumentOverflowZero(page);
  });
});
