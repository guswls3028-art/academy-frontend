import { verifyMixedHomeworkScoreEdit } from "./verifyMixedHomeworkScoreEdit";
import type { Browser, Page } from "@playwright/test";
import { expect } from "../fixtures/strictTest";
import { isExplicitScoreFinish, verifyScoreCorrectionWhileEditing } from "./verifyScoreCorrectionWhileEditing";

/** Closed browser counterpart to the isolated score correction and ordering journey. */
export async function runHomeworkCorrectionFixture(page: Page, browser: Browser, width: number, token: string) {
  const sessionId = 9002, enrollmentId = 9201, homeworkId = 9151, completionId = 9152;
  const studentName = "자동저장학생1", homeworkTitle = "단원 복습", completionTitle = "준비 확인";
  const base = `/api/v1/results/admin/sessions/${sessionId}`;
  const scoresPath = `${base}/scores/`, configPath = `${base}/total-config/`;
  const readScores = () => page.evaluate(async path => {
    const response = await fetch(path);
    if (!response.ok) throw new Error("Closed score read failed");
    return response.json();
  }, scoresPath);
  const scores = await readScores();
  // A conditional page-exit release also returns 204, but cannot acknowledge Finish.
  const commitPath = `${base}/score-draft/commit/`;
  const [pageExit] = await Promise.all([
    page.waitForResponse(response => response.request().method() === "POST" && new URL(response.url()).pathname === commitPath),
    page.evaluate(path => fetch(path, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ release_lease: true, release_if_empty: true }) }).then(response => response.status), commitPath),
  ]);
  expect(pageExit.status()).toBe(204);
  expect(isExplicitScoreFinish(pageExit, sessionId)).toBe(false);
  const numeric = scores.meta.homeworks[0], row = scores.rows[0], item = row.homeworks[0];
  const block = item.block;
  Object.assign(block, { teacher_resolved: false, correction_status: "PENDING", correction_note: "", correction_updated_at: null });
  const completion = { ...numeric, homework_id: completionId, title: completionTitle, grading_mode: "COMPLETION", max_score: 1 };
  const completionFor = (score: number | null) => ({ homework_id: completionId, title: completionTitle,
    block: { ...block, score, max_score: 1, passed: score === null ? null : score === 1, updated_at: score === null ? null : block.updated_at } });
  const completionItem = completionFor(width === 1366 ? null : 1);
  const peer = scores.rows[1], peerItem = peer.homeworks[0], peerCompletion = completionFor(width === 1366 ? null : 0);
  let version = 0;
  await page.route("**/api/v1/homework/scores/quick/", async route => {
    expect(route.request().method()).toBe("PATCH");
    const data = route.request().postDataJSON();
    expect([enrollmentId, peer.enrollment_id]).toContain(data.enrollment_id);
    expect([homeworkId, completionId]).toContain(data.homework_id);
    const target = data.enrollment_id === enrollmentId ? (data.homework_id === homeworkId ? item : completionItem)
      : (data.homework_id === homeworkId ? peerItem : peerCompletion);
    if ((data.expected_updated_at ?? null) !== (target.block.updated_at ?? null)) {
      return route.fulfill({ status: 409, json: { code: "SCORE_CELL_CONFLICT", server_value: target.block } });
    }
    Object.assign(target.block, { score: data.score, passed: data.score >= (data.homework_id === completionId ? 1 : 80),
      updated_at: `2026-09-02T12:00:${String(++version).padStart(2, "0")}Z` });
    return route.fulfill({ json: target.block });
  });
  const config = { version: 1, exam_ids: [9101], exam_order: [9101], homework_ids: [homeworkId], homework_order: [homeworkId, completionId] };
  const decisions: boolean[] = [];
  await page.route(`**${scoresPath}`, route => {
    scores.meta.total_config = config;
    scores.meta.homeworks = config.homework_order.map(id => id === homeworkId ? numeric : completion);
    row.homeworks = config.homework_order.map(id => id === homeworkId ? item : completionItem);
    peer.homeworks = config.homework_order.map(id => id === homeworkId ? peerItem : peerCompletion);
    row.homework_total = config.homework_ids.length ? { score: block.score, max_score: 100, selected_count: 1, scored_count: 1, complete: true } : null;
    return route.fulfill({ json: scores });
  });
  await page.route(`**${configPath}`, async route => {
    if (route.request().method() === "PUT") {
      const body = route.request().postDataJSON();
      expect(body.expected_version).toBe(config.version);
      const included = body.homework_ids ?? config.homework_ids;
      expect(included).not.toContain(completionId);
      config.homework_ids = included;
      config.homework_order = body.homework_order ?? config.homework_order;
      config.version++;
    }
    await route.fulfill({ json: config });
  });
  await page.route(`**${base}/score-correction/`, async route => {
    expect(route.request().method()).toBe("PATCH");
    const body = route.request().postDataJSON();
    expect(body).toMatchObject({ source_type: "homework", source_id: homeworkId, enrollment_id: enrollmentId });
    decisions.push(body.completed);
    Object.assign(block, { teacher_resolved: body.completed, correction_status: body.completed ? "COMPLETED" : "PENDING",
      correction_note: body.note, correction_updated_at: `2026-09-01T12:00:0${decisions.length}Z` });
    await route.fulfill({ json: block });
  });
  const parent = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: "block" });
  try {
    const parentPage = await parent.newPage();
    await parentPage.addInitScript(jwt => {
      localStorage.setItem("access", jwt); localStorage.setItem("refresh", jwt);
      localStorage.setItem("tenant_code", "hakwonplus"); sessionStorage.setItem("tenantCode", "hakwonplus");
      localStorage.setItem("parent_selected_student_id_hakwonplus_22", "9301");
    }, token);
    const parentReads: boolean[] = [];
    await parentPage.route("**/api/v1/**", async route => {
      const req = route.request(), path = new URL(req.url()).pathname;
      if (req.method() === "OPTIONS") return route.fulfill({ status: 204 });
      if (path.endsWith("/core/program/")) return route.fulfill({ json: { tenantCode: "hakwonplus", display_name: "검증 학원", is_active: true, feature_flags: {} } });
      if (path.endsWith("/core/me/")) return route.fulfill({ json: { id: 22, username: "qa-parent", tenantRole: "parent", is_staff: false, linkedStudents: [{ id: 9301, name: studentName }] } });
      if (path.endsWith("/student/me/")) return route.fulfill({ json: { id: 9301, name: studentName, is_student: true } });
      if (path.endsWith("/student/grades/")) {
        expect(req.headers()["x-student-id"]).toBe("9301");
        parentReads.push(block.teacher_resolved);
        return route.fulfill({ json: { exams: [], homeworks: [{ homework_id: homeworkId, enrollment_id: enrollmentId,
          session_id: sessionId, session_title: "1차시", lecture_id: 9001, lecture_title: "자동 저장 검증반", title: homeworkTitle,
          score: block.score, max_score: 100, passed: true, achievement: "PASS", teacher_resolved: block.teacher_resolved }] } });
      }
      return route.fulfill({ json: { count: 0, next: null, previous: null, results: [], items: [] } });
    });
    await parentPage.goto(new URL("/student/grades", page.url()).href);
    await page.reload();
    await verifyMixedHomeworkScoreEdit(page, width, readScores, { sessionId, enrollmentId, comparisonEnrollmentId: peer.enrollment_id, homeworkId, completionId, studentName,
      comparisonName: peer.student_name, homeworkTitle, completionTitle });
    const persisted = await readScores();
    expect(persisted.rows[0].homework_total).toMatchObject({ score: 92, max_score: 100 });
    await verifyScoreCorrectionWhileEditing(page, parentPage, readScores, { sessionId, enrollmentId, homeworkId, homeworkTitle, studentName, maxScore: 100 });
    expect(parentReads).toContain(true);
    expect(decisions).toEqual([true, false]);
    expect(block).toMatchObject({ score: 92, passed: true, teacher_resolved: false, correction_note: "", correction_status: "PENDING" });
  } finally { await parent.close(); }

  const toggleTotal = async (included: boolean) => {
    await page.getByRole("button", { name: "과제 총점 합산 설정", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "합산 설정", exact: true });
    await dialog.getByRole("checkbox", { name: `${homeworkTitle} 합산에 포함`, exact: true }).setChecked(included);
    await dialog.getByRole("button", { name: "합산 설정 저장", exact: true }).click();
    await expect(dialog).toBeHidden();
  };
  const rendered = () => page.locator('[data-testid^="score-column-order-homework-"]').evaluateAll(nodes => nodes.map(n => Number(n.getAttribute("data-column-id"))));
  for (const reversed of [true, false]) {
    const order = reversed ? [completionId, homeworkId] : [homeworkId, completionId];
    const [moved, previous] = reversed ? [completionTitle, homeworkTitle] : [homeworkTitle, completionTitle];
    await toggleTotal(false);
    const save = page.waitForResponse(r => r.request().method() === "PUT" && new URL(r.url()).pathname === configPath);
    if (width === 1366) {
      const handle = (title: string) => page.locator(".scores-col-drag-handle").filter({ has: page.getByRole("button", { name: `${title} 작업 선택`, exact: true }) });
      await handle(moved).dragTo(handle(previous));
    } else await page.getByRole("button", { name: `${moved} 이전 순서로 이동`, exact: true }).click();
    expect((await save).status()).toBe(200);
    await page.reload(); await expect.poll(rendered).toEqual(order);
    expect(config.homework_order).toEqual(order); expect(config.homework_ids).toEqual([]);
    await toggleTotal(true);
    await page.reload(); await expect.poll(rendered).toEqual(order);
    const saved = await readScores();
    expect(saved.meta.total_config).toMatchObject({ homework_order: order, homework_ids: [homeworkId] });
    expect(saved.rows[0].homework_total).toMatchObject({ score: 92, max_score: 100 });
  }
}
