import { expect, test, type Page } from "../fixtures/strictTest";
import { openCompositionScores } from "../helpers/assessmentCompositionMock";

async function installComposition(page: Page, includeRefreshRow = false, totalRecovery?: "removed" | "lost-response") {
  const writes: Record<string, unknown>[] = [];
  let version = 0, text = "", commentVersion = 0, failSave = true;
  let staleNextRead: { text: string; version: number } | undefined;
  const commentWrites: number[] = [];
  let refreshText = "", refreshVersion = 0, primaryAssigned = true, failCommentReads = false;
  let examIds = [9101, 9102], homeworkIds = [9151, 9152];
  let examOrder = [9101, 9102], homeworkOrder = [9151, 9152, 9153];
  const total = (ids: number[], values: Record<number, number | null>) => ({
    score: ids.some(id => values[id] != null) ? ids.reduce((sum, id) => sum + (values[id] ?? 0), 0) : null,
    max_score: ids.length * 100, selected_count: ids.length, scored_count: ids.filter(id => values[id] != null).length,
    complete: ids.length > 0 && ids.every(id => values[id] != null),
  });
  await page.route("**/api/v1/results/admin/sessions/9002/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/total-config/") && route.request().method() === "PUT") {
      const body = route.request().postDataJSON(); writes.push(body);
      if (totalRecovery === "removed" && failSave) {
        failSave = false; examOrder = [9101]; examIds = [9101];
        await route.fulfill({ status: 400, json: { detail: "차시 평가 목록이 변경되었습니다. 새 목록을 확인해 주세요." } }); return;
      }
      if (!totalRecovery && failSave) { failSave = false; await route.fulfill({ status: 503, json: { detail: "합산 저장 일시 실패" } }); return; }
      if (body.expected_version !== version) {
        await route.fulfill({ status: 409, json: { detail: "다른 선생님이 합산 설정을 변경했습니다." } }); return;
      }
      expect(body.expected_version).toBe(version);
      examIds = body.exam_ids; homeworkIds = body.homework_ids;
      examOrder = body.exam_order ?? examOrder; homeworkOrder = body.homework_order ?? homeworkOrder; version++;
      if (totalRecovery === "lost-response" && failSave) {
        failSave = false; await route.abort("aborted"); return;
      }
      await route.fulfill({ json: { version, exam_ids: examIds, homework_ids: homeworkIds } }); return;
    }
    if (path.includes("/exam/9101/parent-comments/")) {
      if (route.request().method() === "GET" && failCommentReads) {
        await route.fulfill({ status: 503, json: { detail: "코멘트 조회 일시 실패" } }); return;
      }
      if (route.request().method() === "PUT" && path.endsWith("/9202/")) {
        const body = route.request().postDataJSON();
        expect(body.version).toBe(refreshVersion);
        refreshText = body.text; refreshVersion++;
        await route.fulfill({ json: { enrollment_id: 9202, student_id: 9302, student_name: "함께 배정된 학생",
          text: refreshText, version: refreshVersion, updated_by: 12, updated_at: "2026-10-19T10:00:00Z", history: [] } }); return;
      }
      if (route.request().method() === "PUT" && !primaryAssigned) {
        await route.fulfill({ status: 404, json: { detail: "평가 배정 없음" } }); return;
      }
      if (route.request().method() === "PUT") {
        const body = route.request().postDataJSON(); commentWrites.push(body.version);
        if (body.version !== commentVersion) { await route.fulfill({ status: 409, json: { detail: "동시 수정" } }); return; }
        text = body.text; commentVersion++;
      }
      const row = { enrollment_id: 9201, student_id: 9301, student_name: "모바일순서학생", text, version: commentVersion,
        updated_by: 12, updated_at: "2026-10-19T10:00:00Z", history: text ? [{ version: commentVersion, text, author_id: 12, author_name: "선생님", created_at: "2026-10-19T10:00:00Z" }] : [] };
      if (route.request().method() === "GET" && staleNextRead) {
        row.text = staleNextRead.text; row.version = staleNextRead.version;
        staleNextRead = undefined;
      }
      await route.fulfill({ json: route.request().method() === "PUT" ? row : { items: [...(primaryAssigned ? [row] : []), ...(includeRefreshRow ? [{
        enrollment_id: 9202, student_id: 9302, student_name: "함께 배정된 학생", text: refreshText,
        version: refreshVersion, updated_by: 12, updated_at: "2026-10-19T10:00:00Z", history: [],
      }] : [])] } }); return;
    }
    if (!path.endsWith("/scores/")) { await route.fallback(); return; }
    await route.fulfill({ json: { meta: { session_title: "모바일 순서 검증 차시", lecture_title: "모바일 순서 검증반", lecture_id: 9001,
      total_config: { version, exam_ids: examIds, homework_ids: homeworkIds },
      exams: examOrder.map((id, i) => ({ exam_id: id, title: id === 9102 ? "둘째 시험" : "첫 시험", max_score: 100, pass_score: 60, display_order: i, objective_max_score: 100, subjective_max_score: 0 })),
      homeworks: homeworkOrder.map((id, i) => ({ homework_id: id, title: id === 9153 ? "준비물 통과형" : id === 9152 ? "둘째 과제" : "첫 과제", max_score: id === 9153 ? 1 : 100, grading_mode: id === 9153 ? "COMPLETION" : "SCORE", display_order: i, unit: "점" })) },
      rows: [{ enrollment_id: 9201, student_id: 9301, student_name: "모바일순서학생", lecture_title: "모바일 순서 검증반",
        exams: [9101, 9102].map((id, i) => ({ exam_id: id, title: i ? "둘째 시험" : "첫 시험", attempt_count: 1, block: { score: i ? null : 0, max_score: 100, passed: false, is_locked: false, meta: {}, correction_status: "NOT_REQUIRED" } })),
        homeworks: [9151, 9152, 9153].map((id, i) => ({ homework_id: id, title: id === 9153 ? "준비물 통과형" : i ? "둘째 과제" : "첫 과제", block: { score: id === 9153 ? 1 : i ? 40 : 25, max_score: id === 9153 ? 1 : 100, passed: false, is_locked: false, meta: {} } })),
        exam_total: total(examIds, { 9101: 0, 9102: null }), homework_total: total(homeworkIds, { 9151: 25, 9152: 40 }), clinic_required: false, progress_completed: false }] } });
  });
  return { writes, totals: () => ({ version, examIds: [...examIds], examOrder: [...examOrder] }), commentWrites, comment: () => ({ text, version: commentVersion }),
    setCommentReadFailure: (value: boolean) => { failCommentReads = value; },
    setAssigned: (value: boolean) => { primaryAssigned = value; },
    serverEdit: (value: string) => { text = value; commentVersion++; },
    staleNextCommentRead: (value: string, version: number) => { staleNextRead = { text: value, version }; },
  };
}

// Shared exams are legitimate across sessions; homework remains session-owned.
// Keep both versions equal so a scope leak cannot hide behind a 409 response.
async function installScopedComposition(page: Page) {
  await installComposition(page);
  const states: Record<number, { version: number; examIds: number[]; examOrder: number[] }> = {
    9002: { version: 0, examIds: [9101, 9102], examOrder: [9101, 9102] },
    9003: { version: 0, examIds: [9102], examOrder: [9102, 9101] },
  };
  const writes: Array<{ sessionId: number; body: Record<string, unknown> }> = [];
  let holdNextSave: Promise<void> | undefined;
  const sessions = [9002, 9003].map((id, index) => ({ id, lecture: 9001, order: index + 1,
    regular_order: index + 1, session_type: "REGULAR", title: index ? "다음 합산 차시" : "모바일 순서 검증 차시",
    date: index ? "2026-08-26" : "2026-08-25" }));
  await page.route("**/api/v1/lectures/sessions/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() !== "GET") { await route.fallback(); return; }
    const session = sessions.find(item => path.endsWith(`/sessions/${item.id}/`));
    if (session) { await route.fulfill({ json: session }); return; }
    if (path.endsWith("/sessions/")) { await route.fulfill({ json: sessions }); return; }
    await route.fallback();
  });
  await page.route(/\/api\/v1\/results\/admin\/sessions\/900[23]\//, async route => {
    const path = new URL(route.request().url()).pathname;
    const sessionId = Number(path.match(/sessions\/(\d+)/)?.[1]);
    const state = states[sessionId];
    if (path.endsWith("/score-draft/") && route.request().method() === "GET") {
      await route.fulfill({ json: { changes: [], active_editors: [], stale: false } }); return;
    }
    if (path.endsWith("/total-config/") && route.request().method() === "PUT") {
      const body = route.request().postDataJSON();
      writes.push({ sessionId, body });
      if (body.expected_version !== state.version) {
        await route.fulfill({ status: 409, json: { detail: "동시 수정" } }); return;
      }
      expect([...body.exam_order].sort()).toEqual([9101, 9102]);
      expect(body.homework_ids).toEqual([]);
      expect(body.homework_order).toEqual([]);
      expect(body.exam_ids.every((id: number) => state.examOrder.includes(id))).toBe(true);
      state.examIds = [...body.exam_ids]; state.examOrder = [...body.exam_order]; state.version++;
      const held = holdNextSave; holdNextSave = undefined;
      if (held) await held;
      await route.fulfill({ json: { version: state.version, exam_ids: state.examIds, homework_ids: [] } }); return;
    }
    if (!path.endsWith("/scores/")) { await route.fallback(); return; }
    await route.fulfill({ json: { meta: { session_title: sessions.find(item => item.id === sessionId)!.title,
      lecture_title: "모바일 순서 검증반", lecture_id: 9001,
      total_config: { version: state.version, exam_ids: state.examIds, homework_ids: [] },
      exams: state.examOrder.map((id, index) => ({ exam_id: id, title: id === 9101 ? "첫 시험" : "둘째 시험",
        max_score: 100, pass_score: 60, display_order: index, objective_max_score: 100, subjective_max_score: 0 })), homeworks: [] },
      rows: [{ enrollment_id: 9201, student_id: 9301, student_name: "모바일순서학생", lecture_title: "모바일 순서 검증반",
        exams: [9101, 9102].map(id => ({ exam_id: id, title: id === 9101 ? "첫 시험" : "둘째 시험", attempt_count: 1,
          block: { score: id === 9101 ? 0 : 40, max_score: 100, passed: false, is_locked: false, meta: {}, correction_status: "NOT_REQUIRED" } })),
        homeworks: [], exam_total: { score: state.examIds.includes(9102) ? 40 : 0, max_score: state.examIds.length * 100,
          selected_count: state.examIds.length, scored_count: state.examIds.length, complete: state.examIds.length > 0 },
        homework_total: { score: null, max_score: 0, selected_count: 0, scored_count: 0, complete: false },
        clinic_required: false, progress_completed: false }] } });
  });
  return { states, writes, holdSave: (promise: Promise<void>) => { holdNextSave = promise; } };
}

async function switchCompositionSession(page: Page, sessionId: 9002 | 9003) {
  const date = sessionId === 9002 ? "2026-08-25" : "2026-08-26";
  await page.locator("button.session-block").filter({ hasText: date }).click();
  await expect(page).toHaveURL(new RegExp(`/sessions/${sessionId}/scores`));
  // React Router can update the address before committing the destination UI.
  // Wait for the same session selection that keys the score-entry page.
  await expect(page.locator("button.session-block--selected").filter({ hasText: date })).toBeVisible();
  await expect(page.getByRole("button", { name: "시험 총점 합산 설정", exact: true })).toBeVisible();
}

for (const width of [1366, 390]) {
  test(`@total-config-scope ${width}px 차시를 오가도 합산 초안과 저장 대상은 섞이지 않는다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openCompositionScores(page);
    const harness = await installScopedComposition(page);
    await page.reload();
    // Warm B through real SPA navigation before editing A: both queries must be cached.
    await switchCompositionSession(page, 9003);
    await switchCompositionSession(page, 9002);
    const open = () => page.getByRole("button", { name: "시험 총점 합산 설정", exact: true }).click();
    const modal = page.getByRole("dialog", { name: "합산 설정", exact: true });
    const group = modal.getByRole("group", { name: /시험 총점/ });
    await open();
    await modal.getByRole("button", { name: "시험 총점 위로 이동", exact: true }).click();
    await expect(group).toHaveAccessibleName("시험 총점 · 1개 합산");
    await modal.getByTitle("최소화", { exact: true }).click();
    await switchCompositionSession(page, 9003);
    await expect(modal).toBeHidden();
    await open();
    // B's one selected exam is SECOND; A's one selected exam is FIRST.
    await expect(group.locator(".assessment-totals-option").first()).toContainText("둘째 시험");
    await expect(group).toHaveAccessibleName("시험 총점 · 1개 합산");
    await modal.getByRole("button", { name: "합산 설정 저장", exact: true }).click();
    await expect(modal).toBeHidden();
    expect(harness.writes).toEqual([{ sessionId: 9003, body: { expected_version: 0,
      exam_ids: [9102], homework_ids: [], exam_order: [9102, 9101], homework_order: [] } }]);
    await switchCompositionSession(page, 9002);
    await open();
    await expect(group).toHaveAccessibleName("시험 총점 · 1개 합산");
    await expect(group.locator(".assessment-totals-option").first()).toContainText("첫 시험");
    await modal.getByRole("button", { name: "합산 설정 저장", exact: true }).click();
    await expect(modal).toBeHidden();
    expect(harness.writes[1]).toEqual({ sessionId: 9002, body: { expected_version: 0,
      exam_ids: [9101], homework_ids: [], exam_order: [9101, 9102], homework_order: [] } });
    await page.reload();
    await open();
    await expect(group).toHaveAccessibleName("시험 총점 · 1개 합산");
    await expect(group.locator(".assessment-totals-option").first()).toContainText("첫 시험");
    expect(harness.states[9002].version).toBe(1);
    expect(harness.states[9003].examIds).toEqual([9102]);
  });
}

test("@total-config-delayed-scope 1366px 이전 차시 저장 응답은 현재 차시의 합산 초안을 닫거나 바꾸지 않는다", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await openCompositionScores(page);
  const harness = await installScopedComposition(page);
  await page.reload();
  await switchCompositionSession(page, 9003);
  await switchCompositionSession(page, 9002);
  const open = () => page.getByRole("button", { name: "시험 총점 합산 설정", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "합산 설정", exact: true });
  const group = modal.getByRole("group", { name: /시험 총점/ });
  await open();
  await modal.getByRole("button", { name: "시험 총점 위로 이동", exact: true }).click();
  let releaseSave!: () => void;
  harness.holdSave(new Promise<void>(resolve => { releaseSave = resolve; }));
  try {
    await modal.getByRole("button", { name: "합산 설정 저장", exact: true }).click();
    await expect.poll(() => harness.writes.length).toBe(1);
    expect(harness.writes[0]).toEqual({ sessionId: 9002, body: { expected_version: 0,
      exam_ids: [9101], homework_ids: [], exam_order: [9101, 9102], homework_order: [] } });
    // Browser Back is real SPA navigation even while A's response is pending.
    await page.goBack();
    await expect(page).toHaveURL(/\/sessions\/9003\/scores/);
    await expect(page.locator("button.session-block--selected").filter({ hasText: "2026-08-26" })).toBeVisible();
    await expect(modal).toBeHidden();
    await open();
    await expect(group.locator(".assessment-totals-option").first()).toContainText("둘째 시험");
    await modal.getByRole("button", { name: "시험 총점 아래로 이동", exact: true }).click();
    await expect(group).toHaveAccessibleName("시험 총점 · 2개 합산");
    const response = page.waitForResponse(item => item.url().includes("/sessions/9002/total-config/") && item.request().method() === "PUT");
    releaseSave();
    expect((await response).status()).toBe(200);
    await expect(modal).toBeVisible();
    await expect(group).toHaveAccessibleName("시험 총점 · 2개 합산");
    await modal.getByRole("button", { name: "합산 설정 저장", exact: true }).click();
    await expect(modal).toBeHidden();
    expect(harness.writes[1]).toEqual({ sessionId: 9003, body: { expected_version: 0,
      exam_ids: [9102, 9101], homework_ids: [], exam_order: [9102, 9101], homework_order: [] } });
    await page.reload();
    await open();
    await expect(group).toHaveAccessibleName("시험 총점 · 2개 합산");
    await expect(group.locator(".assessment-totals-option").first()).toContainText("둘째 시험");
    expect(harness.states[9002].examIds).toEqual([9101]);
    expect(harness.states[9003].version).toBe(1);
  } finally { releaseSave(); }
});

test("@total-config-close-draft 1366px 복원 초안의 닫기를 취소하거나 명시적으로 버릴 수 있다", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await openCompositionScores(page);
  const harness = await installScopedComposition(page);
  await page.reload();
  const open = () => page.getByRole("button", { name: "시험 총점 합산 설정", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "합산 설정", exact: true });
  const group = modal.getByRole("group", { name: /시험 총점/ });
  await open();
  await modal.getByRole("button", { name: "시험 총점 위로 이동", exact: true }).click();
  await modal.getByTitle("최소화", { exact: true }).click();
  await switchCompositionSession(page, 9003);
  await switchCompositionSession(page, 9002);
  await open();
  await expect(group).toHaveAccessibleName("시험 총점 · 1개 합산");
  await modal.getByRole("button", { name: "취소", exact: true }).click();
  const confirm = page.getByRole("alertdialog", { name: "저장하지 않은 합산 설정", exact: true });
  await expect(confirm).toBeVisible();
  await confirm.screenshot({ path: testInfo.outputPath("total-draft-close-confirm-1366.png"), animations: "disabled" });
  await confirm.getByRole("button", { name: "계속 편집", exact: true }).click();
  await expect(confirm).toBeHidden();
  await expect(group).toHaveAccessibleName("시험 총점 · 1개 합산");
  expect(harness.writes).toHaveLength(0);
  await modal.getByRole("button", { name: "취소", exact: true }).click();
  await confirm.getByRole("button", { name: "저장하지 않고 닫기", exact: true }).click();
  await expect(modal).toBeHidden();
  await open();
  await expect(group).toHaveAccessibleName("시험 총점 · 2개 합산");
  await modal.getByRole("button", { name: "시험 총점 위로 이동", exact: true }).click();
  await modal.getByRole("button", { name: "합산 설정 저장", exact: true }).click();
  await expect(modal).toBeHidden();
  await open();
  await expect(group).toHaveAccessibleName("시험 총점 · 1개 합산");
  await modal.getByRole("button", { name: "취소", exact: true }).click();
  await expect(modal).toBeHidden();
  await expect(confirm).toBeHidden();
  expect(harness.writes[0]).toEqual({ sessionId: 9002, body: { expected_version: 0,
    exam_ids: [9101], homework_ids: [], exam_order: [9101, 9102], homework_order: [] } });
});

test("@total-config-background-error 390px 배경 성적 재조회 실패에도 합산 초안을 유지하고 복구 뒤 저장한다", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await openCompositionScores(page);
  const harness = await installScopedComposition(page);
  let failRead = false;
  await page.route("**/api/v1/results/admin/sessions/9002/score-draft/", async route => {
    await route.fulfill({ json: { changes: [], active_editors: [], stale: false } });
  });
  await page.route("**/api/v1/results/admin/sessions/9002/scores/", async route => {
    if (failRead) { await route.fulfill({ status: 503, json: { detail: "성적 조회 일시 실패" } }); return; }
    await route.fallback();
  });
  await page.reload();
  await page.getByRole("button", { name: "수정", exact: true }).click();
  await expect(page.getByRole("button", { name: "저장하고 잠금", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "시험 총점 합산 설정", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "합산 설정", exact: true });
  const group = modal.getByRole("group", { name: /시험 총점/ });
  await modal.getByRole("button", { name: "시험 총점 위로 이동", exact: true }).click();
  const failedRead = page.waitForResponse(response => response.url().includes("/sessions/9002/scores/") && response.status() === 503);
  failRead = true;
  await failedRead; // Normal edit-mode polling, not a synthetic query-client invocation.
  await expect(modal).toBeVisible();
  await expect(group).toHaveAccessibleName("시험 총점 · 1개 합산");
  await modal.screenshot({ path: testInfo.outputPath("total-draft-background-error-390.png"), animations: "disabled" });
  await modal.getByTitle("최소화", { exact: true }).click();
  await expect(page.getByText("성적을 불러오지 못했습니다", { exact: true }).first()).toBeVisible();
  failRead = false;
  const recovered = page.waitForResponse(response => response.url().includes("/sessions/9002/scores/") && response.status() === 200);
  await page.getByRole("button", { name: "다시 시도", exact: true }).first().click();
  await recovered;
  await page.locator(".modal-taskbar__tab-restore").filter({ hasText: "합산 설정" }).click();
  await expect(group).toHaveAccessibleName("시험 총점 · 1개 합산");
  await modal.getByRole("button", { name: "합산 설정 저장", exact: true }).click();
  await expect(modal).toBeHidden();
  expect(harness.writes).toEqual([{ sessionId: 9002, body: { expected_version: 0,
    exam_ids: [9101], homework_ids: [], exam_order: [9101, 9102], homework_order: [] } }]);
  await page.reload();
  await page.getByRole("button", { name: "시험 총점 합산 설정", exact: true }).click();
  await expect(group).toHaveAccessibleName("시험 총점 · 1개 합산");
});

for (const width of [1366, 390]) test(`@total-config-filter ${width}px 검색과 출결 이동 뒤에도 최소화한 합산 초안을 복원하고 저장한다`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await openCompositionScores(page);
  const harness = await installScopedComposition(page);
  await page.reload();
  await page.getByRole("button", { name: "시험 총점 합산 설정", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "합산 설정", exact: true });
  await modal.getByRole("button", { name: "시험 총점 위로 이동", exact: true }).click();
  await modal.getByTitle("최소화", { exact: true }).click();
  const search = page.getByRole("searchbox", { name: "학생 이름 검색" });
  await search.fill("검색결과없는학생");
  await expect(page.locator(".modal-taskbar__tab-restore").filter({ hasText: "합산 설정" })).toBeVisible();
  await page.locator(".modal-taskbar__tab-restore").filter({ hasText: "합산 설정" }).click();
  await expect(modal).toBeVisible();
  await expect(modal.getByRole("group", { name: /시험 총점/ })).toHaveAccessibleName("시험 총점 · 1개 합산");
  await modal.getByTitle("최소화", { exact: true }).click();
  await search.fill("");
  await page.getByRole("tab", { name: "출결", exact: true }).click();
  await expect(page).toHaveURL(/\/attendance$/);
  await expect(page.getByRole("tab", { name: "출결", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("button", { name: "시험 총점 합산 설정", exact: true })).toHaveCount(0);
  await page.goBack();
  await expect(page).toHaveURL(/\/scores$/);
  await expect(page.getByRole("tab", { name: "성적", exact: true })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: "시험 총점 합산 설정", exact: true }).click();
  await expect(modal.getByRole("group", { name: /시험 총점/ })).toHaveAccessibleName("시험 총점 · 1개 합산");
  await modal.getByRole("button", { name: "합산 설정 저장", exact: true }).click();
  await expect(modal).toBeHidden();
  expect(harness.writes).toEqual([{ sessionId: 9002, body: { expected_version: 0,
    exam_ids: [9101], homework_ids: [], exam_order: [9101, 9102], homework_order: [] } }]);
  await page.reload();
  await page.getByRole("button", { name: "시험 총점 합산 설정", exact: true }).click();
  await expect(modal.getByRole("group", { name: /시험 총점/ })).toHaveAccessibleName("시험 총점 · 1개 합산");
});

for (const width of [1366, 390]) {
  test(`@parent-comment-refresh-draft ${width}px 최신 코멘트를 기다리며 고친 초안은 화면 전환 뒤에도 유지한다`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await openCompositionScores(page);
    const harness = await installComposition(page);
    await page.reload();
    const openComments = async () => {
      await page.getByRole("button", { name: "첫 시험 작업 선택", exact: true }).click();
      await page.getByRole("menuitem", { name: /학부모 코멘트/ }).click();
    };
    await openComments();
    const modal = page.getByRole("dialog", { name: "학부모 코멘트", exact: true });
    const input = modal.getByLabel("모바일순서학생", { exact: true });
    await input.fill("최신 내용 확인 전 초안");
    harness.serverEdit("다른 선생님이 공개한 코멘트");
    await modal.getByRole("button", { name: "학부모에게 공개", exact: true }).click();
    await expect(modal.getByRole("status").filter({ hasText: "다른 선생님이 수정했습니다" })).toBeVisible();
    harness.setCommentReadFailure(true);
    await modal.getByRole("button", { name: "최신 내용 확인", exact: true }).click();
    await expect(modal.getByRole("status").filter({ hasText: "최신 내용을 불러오지 못했습니다" })).toBeVisible();
    await expect(input).toHaveValue("최신 내용 확인 전 초안");
    harness.setCommentReadFailure(false);
    let releaseRead!: () => void;
    const heldRead = new Promise<void>(resolve => { releaseRead = resolve; });
    let readStarted = false;
    await page.route("**/api/v1/results/admin/sessions/9002/exam/9101/parent-comments/", async route => {
      if (route.request().method() === "GET" && !readStarted) {
        readStarted = true;
        await heldRead;
      }
      await route.fallback();
    });
    try {
      await modal.getByRole("button", { name: "최신 내용 확인", exact: true }).click();
      await expect.poll(() => readStarted).toBe(true);
      await expect(modal.getByRole("button", { name: "최신 내용 확인 중…", exact: true })).toBeDisabled();
      await expect(modal.getByRole("button", { name: "학부모에게 공개", exact: true })).toBeDisabled();
      await page.keyboard.press("Escape");
      await expect(modal).toBeVisible();
      await input.fill("기다리는 동안 더 자세히 작성한 최종 초안");
      releaseRead();
      await expect(modal.getByRole("status").filter({ hasText: "최신 코멘트:" })).toContainText("다른 선생님이 공개한 코멘트");
      await expect(input).toHaveValue("기다리는 동안 더 자세히 작성한 최종 초안");
      await modal.getByTitle("최소화", { exact: true }).click();
      await page.getByRole("tab", { name: "출결", exact: true }).click();
      await expect(page).toHaveURL(/\/attendance$/);
      await expect(page.getByRole("button", { name: "첫 시험 작업 선택", exact: true })).toHaveCount(0);
      await page.goBack();
      await expect(page).toHaveURL(/\/scores$/);
      await openComments();
      await expect(input).toHaveValue("기다리는 동안 더 자세히 작성한 최종 초안");
      await modal.getByRole("button", { name: "학부모에게 공개", exact: true }).click();
      await expect(modal.getByRole("status").filter({ hasText: "학부모에게 공개했습니다" })).toBeVisible();
      expect(harness.comment()).toEqual({ text: "기다리는 동안 더 자세히 작성한 최종 초안", version: 2 });
      await modal.screenshot({ path: testInfo.outputPath(`comment-latest-draft-${width}.png`), animations: "disabled" });
      await page.keyboard.press("Escape");
      await expect(modal).toBeHidden();
      await page.reload();
      await openComments();
      await expect(input).toHaveValue("기다리는 동안 더 자세히 작성한 최종 초안");
    } finally {
      releaseRead();
    }
  });
}

for (const recovery of ["removed", "lost-response"] as const) {
  const width = recovery === "removed" ? 1366 : 390;
  test(`@assessment-total-recovery ${width}px ${recovery} 합산 설정 재조회·저장·새로고침`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await openCompositionScores(page);
    const harness = await installComposition(page, false, recovery);
    await page.reload();
    await page.getByRole("button", { name: "시험 총점 합산 설정", exact: true }).click();
    const modal = page.getByRole("dialog", { name: "합산 설정", exact: true });
    await modal.getByRole("button", { name: "시험 총점 위로 이동", exact: true }).click();
    await expect(modal.getByRole("group", { name: "시험 총점 · 1개 합산", exact: true })).toBeVisible();
    await modal.getByRole("button", { name: "합산 설정 저장", exact: true }).click();
    if (recovery === "lost-response") {
      await expect(modal.getByRole("alert")).toBeVisible();
      expect(harness.totals()).toEqual({ version: 1, examIds: [9101], examOrder: [9101, 9102] });
      // Retrying the unchanged draft must not toggle or overwrite the committed selection.
      await expect(modal.getByRole("button", { name: "합산 설정 저장", exact: true })).toBeEnabled();
      await modal.getByRole("button", { name: "합산 설정 저장", exact: true }).click();
      await expect(modal.getByRole("alert")).toContainText("다른 선생님");
      expect(harness.totals().version).toBe(1);
    } else {
      await expect(modal.getByRole("alert")).toContainText("차시 평가 목록이 변경");
      expect(harness.totals()).toEqual({ version: 0, examIds: [9101], examOrder: [9101] });
    }
    await expect(modal.getByRole("button", { name: "합산 설정 저장", exact: true })).toBeDisabled();
    await modal.getByRole("button", { name: "최신 설정으로 다시 시작", exact: true }).click();
    await expect(modal.getByRole("button", { name: "합산 설정 저장", exact: true })).toBeEnabled();
    await expect(modal.getByRole("group", { name: "시험 총점 · 1개 합산", exact: true })).toBeVisible();
    await expect(modal.getByRole("button", { name: "둘째 시험 위로 이동", exact: true })).toHaveCount(recovery === "removed" ? 0 : 1);
    await page.screenshot({ path: testInfo.outputPath(`total-config-${recovery}-${width}.png`), animations: "disabled" });
    await modal.getByRole("button", { name: "합산 설정 저장", exact: true }).click();
    await expect(modal).toBeHidden();
    expect(harness.writes.at(-1)).toMatchObject({ expected_version: recovery === "removed" ? 0 : 1,
      exam_ids: [9101], exam_order: recovery === "removed" ? [9101] : [9101, 9102] });
    expect(harness.totals().version).toBe(recovery === "removed" ? 1 : 2);
    await page.reload();
    const row = page.locator("tbody tr").filter({ hasText: "모바일순서학생" }).last();
    await expect(row.locator(".assessment-total-value").first()).toHaveText("0 / 100");
    if (recovery === "removed") {
      await expect(page.getByRole("button", { name: "첫 시험 작업 선택", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "둘째 시험 작업 선택", exact: true })).toHaveCount(0);
    } else {
      await expect.poll(() => page.locator('[data-testid^="score-column-order-exam-"]').evaluateAll(nodes => nodes.map(node => Number(node.getAttribute("data-column-id"))))).toEqual([9101, 9102]);
    }
  });
}

for (const width of [1366, 390]) {
  test(`@assessment-feedback ${width}px 합산 실패 복구·0점·미채점·새로고침과 코멘트 공개`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await openCompositionScores(page);
    const harness = await installComposition(page);
    await page.reload();
    const row = page.locator("tbody tr").filter({ hasText: "모바일순서학생" }).last();
    await expect(row.locator(".assessment-total-value").first()).toContainText("0 / 200");
    await expect(row.locator(".assessment-total-value").first()).toContainText("집계 중 · 1/2");
    await page.getByRole("button", { name: "시험 총점 합산 설정", exact: true }).click();
    const modal = page.getByRole("dialog", { name: "합산 설정", exact: true });
    // Wait for the opening scale animation before drag or visual capture.
    await expect.poll(() => modal.evaluate(node =>
      Math.abs(node.getBoundingClientRect().width - node.clientWidth),
    )).toBeLessThan(1);
    if (width === 1366) {
      // Drag the visible grip, not the row center where text/actions can intercept the pointer.
      await modal.locator(".assessment-totals-divider").first().dragTo(
        modal.locator(".assessment-totals-option").filter({ has: page.getByRole("button", { name: "둘째 시험 위로 이동", exact: true }) }),
        { sourcePosition: { x: 14, y: 22 }, targetPosition: { x: 14, y: 22 } },
      );
    } else { await modal.getByRole("button", { name: "시험 총점 위로 이동", exact: true }).press("Enter"); }
    await expect(modal.getByRole("group", { name: "시험 총점 · 1개 합산" })).toBeVisible();
    await modal.getByRole("button", { name: "과제 총점 위로 이동", exact: true }).click();
    await page.screenshot({ path: testInfo.outputPath(`assessment-totals-modal-${width}.png`), animations: "disabled" });
    await modal.getByRole("button", { name: "합산 설정 저장", exact: true }).click();
    await expect(modal.getByRole("alert")).toContainText("합산 저장 일시 실패");
    await expect(modal.getByRole("group", { name: "시험 총점 · 1개 합산" })).toBeVisible();
    await modal.getByRole("button", { name: "합산 설정 저장", exact: true }).click();
    await expect(modal).toBeHidden();
    expect(harness.writes).toHaveLength(2);
    expect(harness.writes[1]).toMatchObject({ exam_ids: [9101], homework_ids: [9151] });
    await page.reload();
    await expect(row.locator(".assessment-total-value").first()).toHaveText("0 / 100");
    await expect(row.locator(".assessment-total-value").last()).toHaveText("25 / 100");
    // Moving an excluded column before an included column crosses the total boundary.
    if (width === 1366) {
      await page.locator(".scores-col-drag-handle").filter({ has: page.getByRole("button", { name: "둘째 시험 작업 선택", exact: true }) }).dragTo(page.locator(".scores-col-drag-handle").filter({ has: page.getByRole("button", { name: "첫 시험 작업 선택", exact: true }) }));
    } else {
      await page.getByRole("button", { name: "둘째 시험 이전 순서로 이동", exact: true }).click();
    }
    await expect.poll(() => harness.writes.length).toBe(3);
    expect(harness.writes[2]).toMatchObject({ exam_ids: [9102, 9101], exam_order: [9102, 9101], homework_ids: [9151] });
    await page.reload();
    await expect(row.locator(".assessment-total-value").first()).toContainText("0 / 200");
    await expect(row.locator(".assessment-total-value").first()).toContainText("집계 중 · 1/2");
    await row.locator('[data-col-type="exam-summary"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`assessment-main-column-inclusion-${width}.png`), animations: "disabled" });
    // Completion-only items can reorder within excluded columns but cannot enter the sum.
    if (width === 1366) {
      await page.locator(".scores-col-drag-handle").filter({ has: page.getByRole("button", { name: "준비물 통과형 작업 선택", exact: true }) }).dragTo(page.locator(".scores-col-drag-handle").filter({ has: page.getByRole("button", { name: "첫 과제 작업 선택", exact: true }) }));
    } else {
      await page.getByRole("button", { name: "준비물 통과형 이전 순서로 이동", exact: true }).click();
      await expect.poll(() => harness.writes.length).toBe(4);
      await expect.poll(() => page.locator('[data-testid^="score-column-order-homework-"]').evaluateAll(nodes => nodes.map(node => Number(node.getAttribute("data-column-id"))))).toEqual([9151, 9153, 9152]);
      await page.getByRole("button", { name: "준비물 통과형 이전 순서로 이동", exact: true }).click();
    }
    await expect.poll(() => harness.writes.length).toBe(width === 1366 ? 4 : 5);
    expect(harness.writes.at(-1)).toMatchObject({ homework_ids: [9151], homework_order: [9151, 9153, 9152] });
    await page.reload();
    await expect(row.locator(".assessment-total-value").last()).toHaveText("25 / 100");

    // Saving the total settings must retain completion items among excluded columns.
    const writesBeforeReopen = harness.writes.length;
    await page.getByRole("button", { name: "시험 총점 합산 설정", exact: true }).click();
    await modal.getByRole("button", { name: "합산 설정 저장", exact: true }).click();
    await expect(modal).toBeHidden();
    expect(harness.writes).toHaveLength(writesBeforeReopen + 1);
    expect(harness.writes.at(-1)).toMatchObject({ homework_ids: [9151], homework_order: [9151, 9153, 9152] });
    await page.reload();
    await expect.poll(() => page.locator('[data-testid^="score-column-order-homework-"]').evaluateAll(nodes => nodes.map(node => Number(node.getAttribute("data-column-id"))))).toEqual([9151, 9153, 9152]);

    await row.locator('[data-col-type="exam-summary"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`assessment-totals-${width}.png`), animations: "disabled" });
    await row.locator('[data-col-type="homework-summary"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`assessment-homework-totals-${width}.png`), animations: "disabled" });
    await page.getByRole("button", { name: "첫 시험 작업 선택", exact: true }).click();
    await page.getByRole("menuitem", { name: /학부모 코멘트/ }).click();
    const comment = page.getByRole("dialog", { name: "학부모 코멘트", exact: true });
    await comment.getByLabel("모바일순서학생", { exact: true }).fill("풀이 과정을 설명하는 연습을 해 주세요.");
    await comment.getByRole("button", { name: "학부모에게 공개", exact: true }).click();
    await expect(comment.getByRole("status").filter({ hasText: "학부모에게 공개했습니다." })).toBeVisible();
    await page.reload();
    await page.getByRole("button", { name: "첫 시험 작업 선택", exact: true }).click();
    await page.getByRole("menuitem", { name: /학부모 코멘트/ }).click();
    await expect(page.getByRole("dialog", { name: "학부모 코멘트" }).getByLabel("모바일순서학생", { exact: true })).toHaveValue(harness.comment().text);
    await expect.poll(() => comment.evaluate(node =>
      Math.abs(node.getBoundingClientRect().width - node.clientWidth),
    )).toBeLessThan(1);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
    await page.screenshot({ path: testInfo.outputPath(`assessment-parent-comment-${width}.png`), fullPage: true, animations: "disabled" });
  });
}

for (const width of [1366, 390]) {
  test(`@assessment-feedback ${width}px 열린 코멘트 재조회는 미편집 갱신·초안 충돌·저장 안내를 보존한다`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await openCompositionScores(page);
    const harness = await installComposition(page, true);
    await page.reload();
    await page.getByRole("button", { name: "첫 시험 작업 선택", exact: true }).click();
    await page.getByRole("menuitem", { name: /학부모 코멘트/ }).click();
    const modal = page.getByRole("dialog", { name: "학부모 코멘트", exact: true });
    const editor = modal.locator(".parent-comment-row").filter({ has: page.getByLabel("모바일순서학생", { exact: true }) });
    const refreshEditor = modal.locator(".parent-comment-row").filter({ has: page.getByLabel("함께 배정된 학생", { exact: true }) });
    const input = modal.getByLabel("모바일순서학생", { exact: true });
    await expect(input).toHaveValue("");
    let refreshNumber = 0;
    const refetch = async () => {
      await refreshEditor.getByLabel("함께 배정된 학생", { exact: true }).fill(`다른 학생 공개 ${++refreshNumber}`);
      await Promise.all([
        page.waitForResponse(response => response.request().method() === "GET" && response.url().includes("/exam/9101/parent-comments/")),
        refreshEditor.getByRole("button", { name: "학부모에게 공개", exact: true }).click(),
      ]);
    };
    harness.serverEdit("다른 선생님의 첫 수정");
    await refetch();
    await expect(input).toHaveValue("다른 선생님의 첫 수정");
    await modal.getByText("수정 이력 (1)", { exact: true }).click();
    await expect(editor.locator("details p")).toHaveText("다른 선생님의 첫 수정");
    await input.fill("보존할 작성 초안");
    const unloadIsBlocked = () => page.evaluate(() => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event); return event.defaultPrevented;
    });
    expect(await unloadIsBlocked()).toBe(true);
    // Real browser navigation must ask before discarding an unpublished draft.
    const unloadDialog = page.waitForEvent("dialog");
    // Invoke the real browser reload without waiting for a navigation that the
    // user's dismissal intentionally cancels (page.reload waits until timeout).
    const cancelledReload = page.evaluate(() => window.location.reload());
    const warning = await unloadDialog;
    expect(warning.type()).toBe("beforeunload");
    await warning.dismiss();
    await cancelledReload;
    await expect(input).toHaveValue("보존할 작성 초안");
    harness.serverEdit("다른 선생님의 두 번째 수정");
    await refetch();
    await expect(input).toHaveValue("보존할 작성 초안");
    await expect(editor.locator("details p")).toHaveText("다른 선생님의 첫 수정");
    // A different student's save can refetch a roster that no longer contains this draft.
    harness.setAssigned(false);
    await refetch();
    await expect(input).toHaveValue("보존할 작성 초안");
    await expect(editor.getByRole("button", { name: "학부모에게 공개", exact: true })).toBeDisabled();
    await expect(editor.getByRole("status").filter({ hasText: "배정이 해제" })).toBeVisible();
    await input.fill("보존할 작성 초안 수정");
    await expect(input).toHaveValue("보존할 작성 초안 수정");
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
    await modal.screenshot({ path: testInfo.outputPath(`comment-unassigned-draft-${width}.png`), animations: "disabled" });
    // Minimize to use the ordinary tabs, then browser-back into the score page.
    // The editor unmounts on the attendance route; only scoped memory may recover it.
    await modal.getByTitle("최소화", { exact: true }).click();
    await page.getByRole("tab", { name: "출결", exact: true }).click();
    await expect(page).toHaveURL(/\/attendance$/);
    await expect(page.getByRole("button", { name: "첫 시험 작업 선택", exact: true })).toHaveCount(0);
    await page.goBack();
    await expect(page).toHaveURL(/\/scores$/);
    await page.getByRole("button", { name: "첫 시험 작업 선택", exact: true }).click();
    await page.getByRole("menuitem", { name: /학부모 코멘트/ }).click();
    await expect(input).toHaveValue("보존할 작성 초안 수정");
    await expect(editor.getByRole("button", { name: "학부모에게 공개", exact: true })).toBeDisabled();
    await modal.getByText("수정 이력 (1)", { exact: true }).click();
    harness.setAssigned(true);
    await editor.getByRole("button", { name: "배정 다시 확인", exact: true }).click();
    await expect(editor.getByRole("button", { name: "학부모에게 공개", exact: true })).toBeEnabled();
    await expect(input).toHaveValue("보존할 작성 초안 수정");
    // Reverting the draft must consume the already-fetched newer server row.
    await input.fill("다른 선생님의 첫 수정");
    await expect(input).toHaveValue("다른 선생님의 두 번째 수정");
    await expect(editor.locator("details p")).toHaveText("다른 선생님의 두 번째 수정");
    await input.fill("보존할 작성 초안");
    harness.serverEdit("다른 선생님의 세 번째 수정");
    await refetch();
    await expect(input).toHaveValue("보존할 작성 초안");
    await editor.getByRole("button", { name: "학부모에게 공개", exact: true }).click();
    await expect(editor.getByRole("status").filter({ hasText: "다른 선생님이 수정했습니다" })).toBeVisible();
    expect(harness.commentWrites).toEqual([2]);
    await modal.getByRole("button", { name: "최신 내용 확인", exact: true }).click();
    await expect(editor.getByRole("status").filter({ hasText: "다른 선생님의 세 번째 수정" })).toBeVisible();
    await expect(input).toHaveValue("보존할 작성 초안");
    // The invalidation may return an older snapshot after PUT has already succeeded.
    harness.staleNextCommentRead("다른 선생님의 두 번째 수정", 2);
    await Promise.all([
      page.waitForResponse(response => response.request().method() === "GET" && response.url().includes("/exam/9101/parent-comments/")),
      editor.getByRole("button", { name: "학부모에게 공개", exact: true }).click(),
    ]);
    await expect(input).toHaveValue("보존할 작성 초안");
    await expect(editor.getByRole("status").filter({ hasText: "학부모에게 공개했습니다" })).toBeVisible();
    expect(harness.commentWrites).toEqual([2, 3]);
    expect(harness.comment()).toEqual({ text: "보존할 작성 초안", version: 4 });
    // A matching acknowledgement must retain the successful publication message.
    await refetch();
    await expect(input).toHaveValue("보존할 작성 초안");
    await expect(editor.getByRole("status").filter({ hasText: "학부모에게 공개했습니다" })).toBeVisible();
    // A failed refresh retains the assigned row; discard must reset its mounted editor too.
    await input.fill("조회 실패 뒤 폐기할 초안");
    harness.setCommentReadFailure(true);
    await refetch();
    await expect(modal.getByRole("alert")).toContainText("코멘트를 불러오지 못했습니다");
    await expect(editor.getByRole("button", { name: "학부모에게 공개", exact: true })).toBeDisabled();
    await editor.getByRole("button", { name: "초안 버리기", exact: true }).click();
    await expect(input).toHaveValue("보존할 작성 초안");
    expect(await unloadIsBlocked()).toBe(false);
    harness.setCommentReadFailure(false);
    await editor.getByRole("button", { name: "배정 다시 확인", exact: true }).click();
    await expect(modal.getByRole("alert")).toHaveCount(0);
    await input.fill("조회 복구 후 공개한 코멘트");
    await editor.getByRole("button", { name: "학부모에게 공개", exact: true }).click();
    await expect(editor.getByRole("status").filter({ hasText: "학부모에게 공개했습니다" })).toBeVisible();
    expect(harness.comment()).toEqual({ text: "조회 복구 후 공개한 코멘트", version: 5 });
    await input.fill("배정 해제 후 폐기할 초안");
    harness.setAssigned(false);
    await refetch();
    await expect(input).toHaveValue("배정 해제 후 폐기할 초안");
    await editor.getByRole("button", { name: "초안 버리기", exact: true }).click();
    await expect(input).toHaveCount(0);
    expect(await unloadIsBlocked()).toBe(false);
    await page.keyboard.press("Escape");
    await expect(modal).toBeHidden();
    await expect(page.getByRole("dialog", { name: "작성 중인 코멘트" })).toHaveCount(0);
  });
}
