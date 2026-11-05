import { expect, test, type Page } from "../fixtures/strictTest";
import { openCompositionScores } from "../helpers/assessmentCompositionMock";
import type { SessionScoreMeta, SessionScoreRow } from "../../src/shared/api/contracts/sessionScores";

async function setup(page: Page, automatic = false, failFirstSave = !automatic) {
  const response = page.waitForResponse(r => r.url().includes("/sessions/9002/scores/") && r.status() === 200);
  await openCompositionScores(page);
  const scores = await (await response).json() as { meta: SessionScoreMeta; rows: SessionScoreRow[] };
  scores.meta.total_config = { version: 1, exam_ids: [9101], homework_ids: [9151, 9152], exam_order: [9101, 9102], homework_order: [9151, 9152] };
  scores.rows[0].exam_total = { score: 80, max_score: 100, selected_count: 1, scored_count: 1, complete: true };
  scores.rows[0].homework_total = { score: 180, max_score: 200, selected_count: 2, scored_count: 2, complete: true };
  const orderWrites: Record<string, unknown>[] = [];
  await page.route("**/api/v1/results/admin/sessions/9002/scores/", route => route.fulfill({ json: scores }));
  await page.route("**/api/v1/results/admin/sessions/9002/total-config/", async route => {
    const payload = route.request().postDataJSON();
    orderWrites.push(payload);
    expect(payload.exam_ids).toEqual([9101]);
    const byId = new Map(scores.meta.exams.map(exam => [exam.exam_id, exam]));
    scores.meta.exams = payload.exam_order.map((id: number, index: number) => ({ ...byId.get(id)!, display_order: index }));
    scores.meta.total_config = { ...payload, version: scores.meta.total_config!.version + 1 };
    return route.fulfill({ json: scores.meta.total_config });
  });
  let saved = { id: 991, name: "수업 결과 안내", category: "grades", subject: "",
    body: automatic ? "직접 쓴 공지\n#{시험목록}\n#{과제목록}" : "직접 쓴 공지\n#{시험1명}: #{시험1}/#{시험1만점}\n총점 #{시험총점}/#{시험총만점}\n#{과제목록}",
    is_system: false, is_user_default: true, solapi_status: "", solapi_template_id: "", updated_at: "2026-11-05T10:00:00Z" };
  const saves: Record<string, unknown>[] = [], sends: Record<string, unknown>[] = [];
  let failSave = failFirstSave;
  await page.route("**/api/v1/messaging/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/templates/991/") && route.request().method() === "PATCH") {
      const payload = route.request().postDataJSON(); saves.push(payload);
      if (failSave) { failSave = false; return route.fulfill({ status: 503, json: { detail: "문구 저장 일시 실패" } }); }
      saved = { ...saved, ...payload, updated_at: "2026-11-05T10:01:00Z" };
      return route.fulfill({ json: saved });
    }
    if (path.endsWith("/templates/")) return route.fulfill({ json: [saved] });
    if (path.endsWith("/send/preflight/")) {
      const payload = route.request().postDataJSON();
      const rendered = payload.alimtalk_extra_vars_per_student?.[9301]?._body_subst;
      expect(typeof rendered).toBe("string");
      return route.fulfill({ json: {
        ok: true, can_send: true, mode: "now", send_to: payload.send_to,
        recipient: { selected: 1, resolved: 1, valid_phone: 1, skipped_no_phone: 0, duplicate_phone: 0, unique_phone: 1, invalid_or_deleted: 0, limit: 500 },
        template: { ok: true, source: "unified", name: "성적 안내", solapi_template_id: "E2E_GRADES", solapi_status: "APPROVED", detail: "", uses_unified_template: true, template_type: "grades" },
        preview_recipients: [{ student_id: 9301, student_name: "모바일순서학생", phone: "010****0001", excluded: false, exclude_reason: "", full_message_body: rendered }],
        limits: { hourly_limit: 500, sent_last_hour: 0, remaining_this_hour: 500 }, blockers: [], warnings: [],
      } });
    }
    if (path.endsWith("/send/")) {
      const payload = route.request().postDataJSON(); sends.push(payload);
      return route.fulfill({ json: { request_id: payload.client_request_id, accepted_count: 1, enqueued: 1, scheduled: 0, enqueue_failed: 0, skipped_no_phone: 0 } });
    }
    return route.fulfill({ json: {} });
  });
  await page.reload();
  const open = async () => {
    await page.getByRole("checkbox", { name: "모바일순서학생 선택" }).check();
    await page.getByRole("button", { name: "수업결과 알림톡 발송" }).click();
    return page.getByRole("dialog", { name: /^알림톡 발송/ });
  };
  return { open, scores, saves, sends, orderWrites, saved: () => saved };
}

for (const width of [1366, 390]) {
  test(`@alimtalk-order ${width}px 합산 제외 시험 누락 복구·저장 재시도·재열기·발송 본문`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const harness = await setup(page);
    const modal = await harness.open();
    const missing = modal.getByRole("region", { name: "본문에 없는 수업 결과" });
    const editor = modal.getByRole("textbox", { name: "안내문", exact: true });
    await expect(missing).toContainText("본문에 없는 결과 1개");
    await expect(missing).toContainText("둘째 시험");
    await missing.getByRole("button", { name: "빠진 결과를 본문 끝에 넣기" }).click();
    await expect(missing).toHaveCount(0);
    await expect(editor).toContainText("직접 쓴 공지");
    await expect(editor.locator('[data-message-variable="시험2결과"]')).toHaveCount(1);
    await expect(modal.getByLabel("현재 학생의 실제 발송 문구", { exact: true })).toContainText("둘째 시험: 80/100");
    await expect(modal.getByLabel("현재 학생의 실제 발송 문구", { exact: true })).toContainText("총점 80/100");
    await modal.getByRole("button", { name: "변경 내용 저장", exact: true }).click();
    await expect(page.getByText("문구 저장 일시 실패", { exact: true })).toBeVisible();
    await expect(editor.locator('[data-message-variable="시험2결과"]')).toHaveCount(1);
    await modal.getByRole("button", { name: "변경 내용 저장", exact: true }).click();
    await expect.poll(() => harness.saves.length).toBe(2);
    expect(harness.saved().body).toContain("#{시험2결과}");
    await expect(modal.getByRole("button", { name: "변경 내용 저장", exact: true })).toBeHidden();
    await modal.getByRole("button", { name: "취소", exact: true }).click();
    await page.reload();
    await harness.open();
    await expect(editor.locator('[data-message-variable="시험2결과"]')).toHaveCount(1);
    await expect(missing).toHaveCount(0);
    await expect.poll(() => modal.evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: testInfo.outputPath(`alimtalk-order-${width}.png`), animations: "disabled" });
    await modal.getByRole("button", { name: "보낼 내용 확인", exact: true }).click();
    await page.getByRole("dialog", { name: "보내기 전 마지막 확인" }).getByRole("button", { name: "발송하기", exact: true }).click();
    await expect.poll(() => harness.sends.length).toBe(2);
    for (const payload of harness.sends) {
      const body = (payload.alimtalk_extra_vars_per_student as Record<string, { _body_subst: string }>)[9301]._body_subst;
      expect(body).toContain("직접 쓴 공지"); expect(body).toContain("둘째 시험: 80/100"); expect(body).toContain("총점 80/100");
    }
    expect(harness.orderWrites).toEqual([]);
  });
}

test("@alimtalk-order 자동 결과 목록 저장 후 새 시험 포함·순서 이동은 합산을 보존한다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  const harness = await setup(page, false, false);
  await page.getByRole("button", { name: "둘째 시험 이전 순서로 이동", exact: true }).click();
  await expect.poll(() => harness.orderWrites.length).toBe(1);
  expect(harness.orderWrites[0]).toMatchObject({ exam_ids: [9101], exam_order: [9102, 9101] });
  await page.reload();
  const modal = await harness.open();
  const editor = modal.getByRole("textbox", { name: "안내문", exact: true });
  await editor.fill("직접 쓴 공지\n");
  await editor.click(); await editor.press("Control+End");
  await modal.getByRole("button", { name: "시험 목록", exact: true }).click();
  await editor.press("Control+End"); await page.keyboard.insertText("\n추가 공지");
  await modal.getByRole("button", { name: "변경 내용 저장", exact: true }).click();
  await expect.poll(() => harness.saves.length).toBe(1);
  expect(harness.saved().body).toContain("#{시험목록}");
  expect(harness.saved().body).toContain("추가 공지");
  await modal.getByRole("button", { name: "취소", exact: true }).click();
  const exam = { ...harness.scores.meta.exams[0], exam_id: 9103, title: "새 하프모의", display_order: 3 };
  harness.scores.meta.exams.push(exam);
  harness.scores.rows[0].exams.push({ ...harness.scores.rows[0].exams[0], exam_id: 9103, title: exam.title });
  await page.reload(); await harness.open();
  await expect(editor.locator('[data-message-variable="시험3결과"]')).toHaveCount(1);
  await expect(modal.getByLabel("현재 학생의 실제 발송 문구", { exact: true })).toContainText("새 하프모의: 80/100");
  expect(harness.scores.meta.total_config!.exam_ids).toEqual([9101]);
  expect(harness.sends).toEqual([]);
});
