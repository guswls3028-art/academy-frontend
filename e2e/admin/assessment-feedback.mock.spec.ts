import { expect, test, type Page } from "../fixtures/strictTest";
import { openCompositionScores } from "../helpers/assessmentCompositionMock";

async function installComposition(page: Page) {
  const writes: Record<string, unknown>[] = [];
  let version = 0, text = "", commentVersion = 0, failSave = true;
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
      if (failSave) { failSave = false; await route.fulfill({ status: 503, json: { detail: "합산 저장 일시 실패" } }); return; }
      expect(body.expected_version).toBe(version);
      examIds = body.exam_ids; homeworkIds = body.homework_ids;
      examOrder = body.exam_order ?? examOrder; homeworkOrder = body.homework_order ?? homeworkOrder; version++;
      await route.fulfill({ json: { version, exam_ids: examIds, homework_ids: homeworkIds } }); return;
    }
    if (path.includes("/exam/9101/parent-comments/")) {
      if (route.request().method() === "PUT") { const body = route.request().postDataJSON(); expect(body.version).toBe(commentVersion); text = body.text; commentVersion++; }
      const row = { enrollment_id: 9201, student_id: 9301, student_name: "모바일순서학생", text, version: commentVersion,
        updated_by: 12, updated_at: "2026-10-19T10:00:00Z", history: text ? [{ version: commentVersion, text, author_id: 12, author_name: "선생님", created_at: "2026-10-19T10:00:00Z" }] : [] };
      await route.fulfill({ json: route.request().method() === "PUT" ? row : { items: [row] } }); return;
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
  return { writes, comment: () => ({ text, version: commentVersion }) };
}

for (const width of [1366, 390]) {
  test(`@assessment-feedback ${width}px 합산 실패 복구·0점·미채점·새로고침과 코멘트 공개`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await openCompositionScores(page);
    const harness = await installComposition(page);
    await page.reload();
    const row = page.getByRole("row").filter({ hasText: "모바일순서학생" }).last();
    await expect(row.locator(".assessment-total-value").first()).toContainText("0 / 200");
    await expect(row.locator(".assessment-total-value").first()).toContainText("집계 중 · 1/2");
    await page.getByRole("button", { name: "시험 총점 합산 설정", exact: true }).click();
    const modal = page.getByRole("dialog", { name: "합산 설정", exact: true });
    if (width === 1366) {
      await modal.locator(".assessment-totals-divider").first().dragTo(modal.locator(".assessment-totals-option").filter({ has: page.getByRole("button", { name: "둘째 시험 위로 이동", exact: true }) }));
    } else { await modal.getByRole("button", { name: "시험 총점 위로 이동", exact: true }).press("Enter"); }
    await modal.getByRole("button", { name: "과제 총점 위로 이동", exact: true }).click();
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
    await page.screenshot({ path: testInfo.outputPath(`assessment-main-column-inclusion-${width}.png`), fullPage: true });
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


    await page.screenshot({ path: testInfo.outputPath(`assessment-totals-${width}.png`), fullPage: true });
    await page.getByRole("button", { name: "첫 시험 작업 선택", exact: true }).click();
    await page.getByRole("menuitem", { name: /학부모 코멘트/ }).click();
    const comment = page.getByRole("dialog", { name: "학부모 코멘트", exact: true });
    await comment.getByLabel("모바일순서학생", { exact: true }).fill("풀이 과정을 설명하는 연습을 해 주세요.");
    await comment.getByRole("button", { name: "학부모에게 공개", exact: true }).click();
    await expect(comment.getByRole("status")).toContainText("학부모에게 공개했습니다.");
    await page.reload();
    await page.getByRole("button", { name: "첫 시험 작업 선택", exact: true }).click();
    await page.getByRole("menuitem", { name: /학부모 코멘트/ }).click();
    await expect(page.getByRole("dialog", { name: "학부모 코멘트" }).getByLabel("모바일순서학생", { exact: true })).toHaveValue(harness.comment().text);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
    await page.screenshot({ path: testInfo.outputPath(`assessment-parent-comment-${width}.png`), fullPage: true });
  });
}
