import { expect, test, type Page } from "../fixtures/strictTest";
import { openCompositionScores } from "../helpers/assessmentCompositionMock";

const original = {
  id: 991, name: "공유 성적 안내", category: "grades", subject: "학부모 수업 안내",
  body: "처음 저장한 성적 안내입니다.", is_system: false, is_user_default: true,
  created_at: "2026-10-21T00:00:00Z", updated_at: "2026-10-21T00:00:00Z",
};

async function openSharedTemplate(page: Page, loseFirstAcknowledgement = false, initiallyDefault = true, changeBeforeModalRead = false) {
  await openCompositionScores(page);
  let saved = { ...original, is_user_default: initiallyDefault };
  const writes: Record<string, unknown>[] = [];
  const sends: string[] = [];
  let defaults = 0;
  let templateReads = 0;
  await page.route("**/api/v1/messaging/**", async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith("/send/preflight/")) return route.fulfill({ json: {
      ok: true, can_send: false, mode: "now", send_to: request.postDataJSON().send_to,
      recipient: { selected: 1, resolved: 1, valid_phone: 1, skipped_no_phone: 0, duplicate_phone: 0, unique_phone: 1, invalid_or_deleted: 0, limit: 500 },
      template: { ok: true, source: "unified", name: "성적 안내", detail: "", uses_unified_template: true, template_type: "grades" },
      preview_recipients: [], limits: { hourly_limit: 500, sent_last_hour: 0, remaining_this_hour: 500 }, blockers: [], warnings: [],
    } });
    if (path.endsWith("/templates/")) {
      const response = { ...saved };
      if (++templateReads === 1 && changeBeforeModalRead) {
        saved = { ...saved, body: "창을 여는 동안 다른 선생님이 저장한 안내입니다.", updated_at: "2026-10-21T00:00:01Z" };
      }
      return route.fulfill({ json: [response] });
    }
    if (path.endsWith("/991/set-default/")) {
      defaults++;
      saved = { ...saved, is_user_default: request.postDataJSON().is_user_default };
      return route.fulfill({ json: saved });
    }
    if (path.endsWith("/templates/991/") && request.method() === "PATCH") {
      const payload = request.postDataJSON();
      writes.push(payload);
      const unchanged = payload.body === saved.body && (payload.subject === undefined || payload.subject === saved.subject);
      if (payload.expected_updated_at && payload.expected_updated_at !== saved.updated_at && !unchanged) {
        return route.fulfill({ status: 409, json: {
          code: "template_conflict", detail: "다른 직원이 이 문구를 수정했습니다.", current_template: saved,
        } });
      }
      saved = { ...saved, body: payload.body, subject: payload.subject ?? saved.subject,
        updated_at: `2026-10-21T00:00:0${writes.length + 1}Z` };
      if (loseFirstAcknowledgement && writes.length === 1) return route.abort("aborted");
      return route.fulfill({ json: saved });
    }
    if (path.endsWith("/send/")) sends.push(path);
    return route.fulfill({ json: {} });
  });
  await page.getByRole("checkbox", { name: "모바일순서학생 선택", exact: true }).check();
  await page.getByRole("button", { name: "수업결과 알림톡 발송" }).click();
  const modal = page.getByRole("dialog", { name: /^알림톡 발송/ });
  const editor = modal.getByRole("textbox", { name: "안내문", exact: true });
  if (!initiallyDefault) {
    await modal.getByRole("button", { name: "안내문 바꾸기", exact: true }).click();
    await page.getByRole("button", { name: /^공유 성적 안내/ }).click();
    await page.getByRole("button", { name: "이 안내문 적용", exact: true }).filter({ visible: true }).click();
  }
  await expect(editor).toContainText(original.body);
  return { modal, editor, writes, sends, read: () => saved, defaults: () => defaults,
    otherEdit: (body: string) => { saved = { ...saved, body, updated_at: "2026-10-21T00:00:01Z" }; } };
}

for (const width of [1366, 390]) {
  test(`발송창 진입 중 변경된 공유 문구는 처음 읽은 본문 버전으로 충돌을 감지한다 ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const { modal, editor, writes, read } = await openSharedTemplate(page, false, true, true);
    await editor.fill("처음 문구를 바탕으로 작성한 내 초안입니다.");
    await modal.getByRole("button", { name: "변경 내용 저장", exact: true }).click();
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0].expected_updated_at).toBe(original.updated_at);
    await expect(modal.getByRole("region", { name: "문구 수정 충돌" }))
      .toContainText("창을 여는 동안 다른 선생님이 저장한 안내입니다.");
    await expect(editor).toContainText("처음 문구를 바탕으로 작성한 내 초안입니다.");
    expect(read().body).toBe("창을 여는 동안 다른 선생님이 저장한 안내입니다.");
  });
}

for (const width of [1366, 390]) {
  test(`공유 성적 문구 동시 편집은 초안과 최신본을 보존하고 명시적으로 다시 저장한다 ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const scenario = await openSharedTemplate(page);
    const { modal, editor, writes } = scenario;
    await editor.fill("내가 작성 중인 성적 안내입니다.");
    scenario.otherEdit("다른 선생님이 저장한 다음 차시 안내입니다.");
    await modal.getByRole("button", { name: "변경 내용 저장", exact: true }).click();
    await expect.poll(() => writes.length).toBe(1);
    expect(scenario.read().body).toBe("다른 선생님이 저장한 다음 차시 안내입니다.");
    const conflict = modal.getByRole("region", { name: "문구 수정 충돌" });
    await expect(conflict).toContainText(scenario.read().body);
    await expect(editor).toContainText("내가 작성 중인 성적 안내입니다.");
    await expect(editor).toHaveAttribute("contenteditable", "true");
    await expect.poll(() => conflict.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await conflict.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`template-conflict-${width}.png`), animations: "disabled" });
    await modal.getByRole("button", { name: "변경 내용 저장", exact: true }).click();
    const confirm = page.getByRole("alertdialog", { name: "현재 초안으로 저장할까요?" });
    await confirm.getByRole("button", { name: "계속 편집", exact: true }).click();
    expect(writes).toHaveLength(1);
    await editor.fill("다른 선생님 안내와 내 안내를 함께 반영했습니다.");
    await modal.getByRole("button", { name: "변경 내용 저장", exact: true }).click();
    await confirm.getByRole("button", { name: "이 초안 저장", exact: true }).click();
    await expect(conflict).toBeHidden();
    expect(writes[1].expected_updated_at).toBe("2026-10-21T00:00:01Z");
    expect(scenario.read().subject).toBe(original.subject);
    await modal.getByRole("button", { name: "취소", exact: true }).click();
    await page.reload();
    await page.getByRole("checkbox", { name: "모바일순서학생 선택", exact: true }).check();
    await page.getByRole("button", { name: "수업결과 알림톡 발송" }).click();
    await expect(editor).toContainText("다른 선생님 안내와 내 안내를 함께 반영했습니다.");
    expect(scenario.sends).toEqual([]);
  });
}

test("충돌한 초안을 버릴 때만 최신 문구를 적용한다", async ({ page }) => {
  const { modal, editor, writes, otherEdit, read } = await openSharedTemplate(page);
  await editor.fill("보존할 개인 초안");
  otherEdit("공유 문구의 최신 안내");
  await modal.getByRole("button", { name: "변경 내용 저장", exact: true }).click();
  const conflict = modal.getByRole("region", { name: "문구 수정 충돌" });
  await conflict.getByRole("button", { name: "최신 문구로 바꾸기", exact: true }).click();
  const confirm = page.getByRole("alertdialog", { name: "작성한 문구를 바꿀까요?" });
  await confirm.getByRole("button", { name: "계속 편집", exact: true }).click();
  await expect(editor).toContainText("보존할 개인 초안");
  await conflict.getByRole("button", { name: "최신 문구로 바꾸기", exact: true }).click();
  await confirm.getByRole("button", { name: "수정 내용 버리고 바꾸기", exact: true }).click();
  await expect(editor).toContainText(read().body);
  await expect(conflict).toBeHidden();
  expect(writes).toHaveLength(1);
});

test("문구 저장 응답 유실은 같은 버전과 초안으로 재시도한다", async ({ page }) => {
  const { modal, editor, writes, read } = await openSharedTemplate(page, true);
  await editor.fill("응답 유실 뒤에도 보존할 문구");
  await modal.getByRole("button", { name: "변경 내용 저장", exact: true }).click();
  await expect(page.getByText("문구 업데이트에 실패했습니다.", { exact: true })).toBeVisible();
  await expect(editor).toContainText("응답 유실 뒤에도 보존할 문구");
  await modal.getByRole("button", { name: "변경 내용 저장", exact: true }).click();
  await expect(modal.getByRole("button", { name: "변경 내용 저장", exact: true })).toBeHidden();
  expect(writes).toHaveLength(2);
  expect(writes[1]).toEqual(writes[0]);
  expect(read().body).toBe("응답 유실 뒤에도 보존할 문구");
});

test("기본 문구 지정은 충돌한 초안의 저장이 성공한 뒤에만 진행한다", async ({ page }) => {
  const scenario = await openSharedTemplate(page, false, false);
  const { modal, editor, writes } = scenario;
  await editor.fill("기본으로 사용할 새 안내문");
  scenario.otherEdit("다른 직원의 새 안내문");
  const setDefault = modal.getByRole("button", { name: "성적 안내 기본으로 지정", exact: true });
  await setDefault.click();
  await expect(modal.getByRole("region", { name: "문구 수정 충돌" })).toBeVisible();
  expect(scenario.defaults()).toBe(0);
  expect(scenario.read().body).toBe("다른 직원의 새 안내문");
  await setDefault.click();
  await page.getByRole("alertdialog", { name: "현재 초안으로 저장할까요?" })
    .getByRole("button", { name: "계속 편집", exact: true }).click();
  expect(scenario.defaults()).toBe(0);
  expect(writes).toHaveLength(1);
  await editor.fill("두 직원의 안내를 반영한 기본 문구");
  await setDefault.click();
  await page.getByRole("alertdialog", { name: "현재 초안으로 저장할까요?" })
    .getByRole("button", { name: "이 초안 저장", exact: true }).click();
  await expect(setDefault).toBeHidden();
  expect(scenario.defaults()).toBe(1);
  expect(scenario.read()).toMatchObject({ body: "두 직원의 안내를 반영한 기본 문구", is_user_default: true });
});

for (const width of [1366, 390]) {
  test(`새 성적 문구의 저장 응답 유실 뒤 재시도는 문구 하나만 만든다 ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const { modal, editor, sends } = await openSharedTemplate(page);
    const created: Array<typeof original> = [];
    const requests: Array<{ client_request_id?: string }> = [];
    const results = new Map<string, typeof original>();
    let defaults = 0;
    await page.route("**/api/v1/messaging/templates/**", async route => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (path.endsWith("/templates/") && request.method() === "POST") {
        const payload = request.postDataJSON();
        requests.push(payload);
        let row = payload.client_request_id ? results.get(payload.client_request_id) : undefined;
        if (!row) {
          row = { ...original, ...payload, body: payload.body.trim(), id: 994 + created.length, is_user_default: false };
          created.push(row!);
          if (payload.client_request_id) results.set(payload.client_request_id, row!);
        }
        if (requests.length === 1) return route.abort("aborted");
        return route.fulfill({ status: 200, json: { ...row, creation_content_changed: false } });
      }
      if (/\/99[4-9]\/set-default\/$/.test(path)) {
        defaults++;
        const id = Number(path.split("/").at(-3));
        const row = created.find(item => item.id === id)!;
        row.is_user_default = request.postDataJSON().is_user_default;
        return route.fulfill({ json: row });
      }
      if (path.endsWith("/templates/")) return route.fulfill({ json: [{ ...original, is_user_default: defaults === 0 }, ...created] });
      return route.fallback();
    });
    await editor.fill(" \n응답 유실에도 한 번만 저장할 다음 수업 안내\n ");
    await modal.getByRole("button", { name: "새 문구로 저장", exact: true }).click();
    await modal.getByPlaceholder("예: 출결 알림, 성적표 안내").fill("중복 없는 성적 기본 문구");
    await modal.getByRole("checkbox", { name: "성적 안내 기본으로 지정 · 이 학원 직원 공통", exact: true }).check();
    await modal.getByRole("button", { name: "저장", exact: true }).click();
    await expect(page.getByText(/문구 저장.*실패|저장 결과를 확인하지 못했습니다/).first()).toBeVisible();
    expect(created).toHaveLength(1);
    expect(defaults).toBe(0);
    await expect(editor).toHaveAttribute("contenteditable", "false");
    await expect(modal.getByPlaceholder("예: 출결 알림, 성적표 안내")).toBeDisabled();
    await expect(modal.getByRole("button", { name: "안내문 바꾸기", exact: true })).toBeDisabled();
    await modal.getByRole("button", { name: "취소", exact: true }).last().click();
    await page.getByRole("alertdialog", { name: "문구 저장 결과 확인 전 나갈까요?" })
      .getByRole("button", { name: "돌아가서 확인", exact: true }).click();
    expect(requests).toHaveLength(1);
    const beforeUnload = page.waitForEvent("dialog");
    const interruptedReload = page.reload().catch(error => error);
    const leave = await beforeUnload;
    expect(leave.type()).toBe("beforeunload");
    await leave.dismiss();
    await interruptedReload;
    await expect(modal.getByRole("button", { name: "저장 확인·재시도", exact: true })).toBeVisible();
    await modal.getByRole("button", { name: "저장 확인·재시도", exact: true }).scrollIntoViewIfNeeded();
    await expect.poll(() => modal.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`template-save-recovery-${width}.png`), animations: "disabled" });
    await modal.getByRole("button", { name: /^(저장|저장 확인·재시도)$/ }).click();
    await expect(modal.locator(".send-modal__tpl-bar-name")).toHaveText("중복 없는 성적 기본 문구");
    expect(created).toHaveLength(1);
    expect(requests).toHaveLength(2);
    expect(requests[0].client_request_id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(requests[1]).toEqual(requests[0]);
    expect(defaults).toBe(1);
    await modal.getByRole("button", { name: "취소", exact: true }).click();
    await page.reload();
    await page.getByRole("checkbox", { name: "모바일순서학생 선택", exact: true }).check();
    await page.getByRole("button", { name: "수업결과 알림톡 발송" }).click();
    await expect(editor).toContainText(created[0].body);
    await expect(modal.locator(".send-modal__tpl-bar-name")).toHaveText(created[0].name);
    expect(sends).toEqual([]);
  });
}

test("생성 재시도 전에 다른 직원이 수정한 문구는 보존하고 기본 지정은 확인 뒤 진행한다", async ({ page }) => {
  const { modal, editor } = await openSharedTemplate(page);
  let saved = { ...original, id: 994, name: "다른 직원도 수정한 문구", body: "내가 새로 만든 안내문", is_user_default: false };
  let posts = 0;
  let defaults = 0;
  await page.route("**/api/v1/messaging/templates/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/templates/") && route.request().method() === "POST") {
      posts++;
      if (posts === 1) return route.abort("aborted");
      return route.fulfill({ json: { ...saved, creation_content_changed: true } });
    }
    if (path.endsWith("/994/set-default/")) {
      defaults++;
      saved = { ...saved, is_user_default: route.request().postDataJSON().is_user_default };
      return route.fulfill({ json: saved });
    }
    return route.fallback();
  });
  await editor.fill(saved.body);
  await modal.getByRole("button", { name: "새 문구로 저장", exact: true }).click();
  await modal.getByPlaceholder("예: 출결 알림, 성적표 안내").fill(saved.name);
  await modal.getByRole("checkbox", { name: "성적 안내 기본으로 지정 · 이 학원 직원 공통", exact: true }).check();
  await modal.getByRole("button", { name: "저장", exact: true }).click();
  await expect(modal.getByRole("button", { name: "저장 확인·재시도", exact: true })).toBeVisible();
  saved = { ...saved, body: "다른 직원이 보완한 안내문", updated_at: "2026-10-21T00:00:04Z" };
  await modal.getByRole("button", { name: "저장 확인·재시도", exact: true }).click();
  const conflict = modal.getByRole("region", { name: "문구 수정 충돌" });
  await expect(conflict).toContainText(saved.body);
  await expect(editor).toContainText("내가 새로 만든 안내문");
  expect(posts).toBe(2);
  expect(defaults).toBe(0);
  await conflict.getByRole("button", { name: "최신 문구로 바꾸기", exact: true }).click();
  await page.getByRole("alertdialog", { name: "작성한 문구를 바꿀까요?" })
    .getByRole("button", { name: "수정 내용 버리고 바꾸기", exact: true }).click();
  await expect(editor).toContainText(saved.body);
  await modal.getByRole("button", { name: "성적 안내 기본으로 지정", exact: true }).click();
  await expect(modal.getByRole("button", { name: "성적 안내 기본으로 지정", exact: true })).toBeHidden();
  expect(defaults).toBe(1);
  expect(saved.body).toBe("다른 직원이 보완한 안내문");
});
