import { expect, test, type Page } from "../fixtures/strictTest";
import { openCompositionScores } from "../helpers/assessmentCompositionMock";

async function installComposition(page: Page, includeRefreshRow = false) {
  const writes: Record<string, unknown>[] = [];
  let version = 0, text = "", commentVersion = 0, failSave = true;
  let staleNextRead: { text: string; version: number } | undefined;
  const commentWrites: number[] = [];
  let refreshText = "", refreshVersion = 0;
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
      if (route.request().method() === "PUT" && path.endsWith("/9202/")) {
        const body = route.request().postDataJSON();
        expect(body.version).toBe(refreshVersion);
        refreshText = body.text; refreshVersion++;
        await route.fulfill({ json: { enrollment_id: 9202, student_id: 9302, student_name: "함께 배정된 학생",
          text: refreshText, version: refreshVersion, updated_by: 12, updated_at: "2026-10-19T10:00:00Z", history: [] } }); return;
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
      await route.fulfill({ json: route.request().method() === "PUT" ? row : { items: [row, ...(includeRefreshRow ? [{
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
  return { writes, commentWrites, comment: () => ({ text, version: commentVersion }),
    serverEdit: (value: string) => { text = value; commentVersion++; },
    staleNextCommentRead: (value: string, version: number) => { staleNextRead = { text: value, version }; },
  };
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
      await modal.locator(".assessment-totals-divider").first().dragTo(modal.locator(".assessment-totals-option").filter({ has: page.getByRole("button", { name: "둘째 시험 위로 이동", exact: true }) }));
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
    await expect(comment.getByRole("status")).toContainText("학부모에게 공개했습니다.");
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
  test(`@assessment-feedback ${width}px 열린 코멘트 재조회는 미편집 갱신·초안 충돌·저장 안내를 보존한다`, async ({ page }) => {
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
    harness.serverEdit("다른 선생님의 두 번째 수정");
    await refetch();
    await expect(input).toHaveValue("보존할 작성 초안");
    await expect(editor.locator("details p")).toHaveText("다른 선생님의 첫 수정");
    // Reverting the draft must consume the already-fetched newer server row.
    await input.fill("다른 선생님의 첫 수정");
    await expect(input).toHaveValue("다른 선생님의 두 번째 수정");
    await expect(editor.locator("details p")).toHaveText("다른 선생님의 두 번째 수정");
    await input.fill("보존할 작성 초안");
    harness.serverEdit("다른 선생님의 세 번째 수정");
    await refetch();
    await expect(input).toHaveValue("보존할 작성 초안");
    await editor.getByRole("button", { name: "학부모에게 공개", exact: true }).click();
    await expect(editor.getByRole("status")).toContainText("다른 선생님이 수정했습니다");
    expect(harness.commentWrites).toEqual([2]);
    await modal.getByRole("button", { name: "최신 내용 확인", exact: true }).click();
    await expect(editor.getByRole("status")).toContainText("다른 선생님의 세 번째 수정");
    await expect(input).toHaveValue("보존할 작성 초안");
    // The invalidation may return an older snapshot after PUT has already succeeded.
    harness.staleNextCommentRead("다른 선생님의 두 번째 수정", 2);
    await Promise.all([
      page.waitForResponse(response => response.request().method() === "GET" && response.url().includes("/exam/9101/parent-comments/")),
      editor.getByRole("button", { name: "학부모에게 공개", exact: true }).click(),
    ]);
    await expect(input).toHaveValue("보존할 작성 초안");
    await expect(editor.getByRole("status")).toContainText("학부모에게 공개했습니다");
    expect(harness.commentWrites).toEqual([2, 3]);
    expect(harness.comment()).toEqual({ text: "보존할 작성 초안", version: 4 });
    // A matching acknowledgement must retain the successful publication message.
    await refetch();
    await expect(input).toHaveValue("보존할 작성 초안");
    await expect(editor.getByRole("status")).toContainText("학부모에게 공개했습니다");
    await page.keyboard.press("Escape");
    await expect(modal).toBeHidden();
    await expect(page.getByRole("dialog", { name: "작성 중인 코멘트" })).toHaveCount(0);
  });
}
