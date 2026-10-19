import { expect, test, type Page } from "../fixtures/strictTest";
import { getBaseUrl } from "../helpers/auth";
import { installLocalAuthApiStubs, installTenantOneInitScript } from "../helpers/localAuthApiStubs";

async function setup(page: Page, system = false, fixedBody?: string) {
  const fixed = fixedBody !== undefined;
  const base = getBaseUrl("admin");
  test.skip(!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(base), "격리된 route mock 전용");
  await installLocalAuthApiStubs(page);
  await installTenantOneInitScript(page);
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = `${encode({ alg: "none" })}.${encode({ exp: Math.floor(Date.now() / 1000) + 3600, tenant_code: "hakwonplus", user_id: 12 })}.sig`;
  await page.addInitScript((access) => {
    localStorage.setItem("access", access);
    localStorage.setItem("refresh", `${access}-refresh`);
  }, token);
  const original = { id: 101, category: fixed ? "signup" : "clinic", name: "기존 안내 문구", subject: "옛 제목",
    body: fixedBody ?? "예전에 사용하던 안내문", is_system: system, is_user_default: false,
    solapi_template_id: "", solapi_status: "", created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z" };
  const templates = new Map([[101, original], [102, { ...original, id: 102, name: "현재 연결 문구", body: "최근 저장한 안내문 #{학생이름}" }]]);
  const state = { linked: 101, nextId: 200, creates: 0, connects: 0, sends: 0, failLink: false, failLoad: false, failSave: false };
  const updates: number[] = [];
  let releaseInitialConfigs!: () => void;
  const initialConfigsReady = new Promise<void>((resolve) => { releaseInitialConfigs = resolve; });
  const config = () => {
    const template = templates.get(state.linked)!;
    return { id: 1, trigger: fixed ? "withdrawal_complete" : "clinic_reminder", template: template.id,
      template_name: template.name, template_subject: template.subject, template_body: template.body,
      template_is_system: template.is_system, enabled: true, message_mode: "alimtalk",
      effective_template_type: fixed ? "notice_withdrawal" : "clinic_info", effective_template_source: "unified",
      effective_template_is_approved: true, effective_template_solapi_status: "APPROVED",
      policy_mode: fixed ? "SYSTEM_AUTO" : "AUTO_DEFAULT", implementation_status: "implemented", minutes_before: 30,
      delay_mode: "immediate", delay_value: null, show_actual_time: false };
  };
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api\/v1/, "");
    if (path === "/core/subscription/") return route.fulfill({ json: { tenant_name: "문구 검증학원" } });
    if (path === "/messaging/info/") return route.fulfill({ json: { alimtalk_available: true, tenant_messaging_enabled: true, can_manage_messaging: true, messaging_disabled: false } });
    if (path === "/messaging/auto-send/") {
      if (request.method() === "GET") await initialConfigsReady;
      if (request.method() === "PATCH") {
        state.connects++;
        if (state.failLink) return route.fulfill({ status: 503, json: { detail: "연결을 저장하지 못했습니다." } });
        const patch = request.postDataJSON().configs[0];
        expect(Object.keys(patch).sort()).toEqual(["template_id", "trigger"]);
        state.linked = patch.template_id;
      }
      return route.fulfill({ json: [config()] });
    }
    if (path === "/messaging/templates/") {
      if (request.method() === "POST") {
        state.creates++;
        const saved = { ...original, ...request.postDataJSON(), id: state.nextId++, is_system: false };
        templates.set(saved.id, saved);
        return route.fulfill({ status: 201, json: saved });
      }
      // Deliberately stale list: the editor must resolve the live connection.
      return route.fulfill({ json: [original] });
    }
    const match = path.match(/^\/messaging\/templates\/(\d+)\/$/);
    if (match) {
      const id = Number(match[1]);
      if (request.method() === "GET" && state.failLoad) return route.fulfill({ status: 503, json: { detail: "현재 문구를 불러오지 못했습니다." } });
      if (request.method() === "PATCH") {
        if (state.failSave) return route.fulfill({ status: 400, json: { body: ["문구를 다시 확인해 주세요."] } });
        updates.push(id);
        templates.set(id, { ...templates.get(id)!, ...request.postDataJSON() });
      }
      return route.fulfill({ json: templates.get(id) });
    }
    if (path.includes("/send/") || path.includes("/notifications/confirm/")) state.sends++;
    if (path.startsWith("/messaging/")) return route.fulfill({ json: [] });
    return route.fallback();
  });
  const openPage = async () => {
    await page.goto(`${base}/workspace/message/auto-send`, { waitUntil: "domcontentloaded" });
    const section = page.getByRole("button", { name: fixed ? "가입/등록" : "클리닉/상담", exact: true });
    try {
      // A real API response can arrive after the user chooses a section.
      // Keep that choice across the loading skeleton instead of dropping it.
      await section.click();
      await expect(section).toHaveAttribute("aria-current", "true");
    } finally {
      releaseInitialConfigs();
    }
    await expect(page.getByRole("button", { name: fixed ? "내용 보기" : "문구 수정", exact: true })).toBeVisible();
  };
  await openPage();
  return { state, templates, updates, original, openPage };
}

for (const fixedBody of ["", "과거에 저장한 미사용 메모"]) {
  test(`고정 안내는 ${fixedBody ? "과거 메모 대신" : "저장 메모가 없어도"} 승인 양식을 보여준다`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: fixedBody ? 1366 : 390, height: 900 });
    const { state, updates, templates } = await setup(page, false, fixedBody);
    const previewButton = page.getByRole("button", { name: "미리보기", exact: true });
    await previewButton.click();
    await expect(page.getByRole("dialog")).toContainText("퇴원 처리가 완료되었습니다");
    await expect(page.getByRole("dialog")).not.toContainText("과거에 저장한 미사용 메모");
    const close = page.getByRole("dialog").getByRole("button", { name: "대화상자 종료", exact: true });
    await close.focus();
    for (const key of ["Tab", "Shift+Tab", "Tab"]) {
      await page.keyboard.press(key);
      await expect(close).toBeFocused();
    }
    await page.screenshot({ path: testInfo.outputPath("fixed-alimtalk-preview.png") });
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(previewButton).toBeFocused();
    await page.getByRole("button", { name: "내용 보기", exact: true }).click();
    await expect(page.getByRole("dialog")).toContainText("퇴원 처리가 완료되었습니다");
    await expect(page.getByRole("dialog")).not.toContainText("과거에 저장한 미사용 메모");
    await expect(page.getByRole("dialog").getByRole("button", { name: "저장하고 적용" })).toHaveCount(0);
    expect(updates).toEqual([]);
    expect(templates.get(101)?.body).toBe(fixedBody);
    expect(state.sends).toBe(0);
  });
}

for (const width of [1100, 1366, 390]) {
  test(`${width}px 로딩 중 메뉴 선택 → 현재 연결 문구 수정 → 저장 → 예시 → 새로고침`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const { state, templates, updates, openPage } = await setup(page);
    state.linked = 102;
    await page.getByRole("button", { name: "문구 수정", exact: true }).click();
    // Trigger labels are UI-owned; identify the editor by its action and textbox.
    const editorDialog = page.getByRole("dialog").filter({ has: page.getByRole("button", { name: "저장하고 적용" }) });
    const editor = editorDialog.getByRole("textbox", { name: "안내문", exact: true });
    await expect(editor).toContainText("최근 저장한 안내문");
    await expect(editor).not.toContainText("예전에 사용하던");
    await editor.fill("이번에 수정한 긴 한글 안내입니다.\n시간에 맞춰 준비해 주세요.");
    await expect(editorDialog.getByText("이번에 수정한 긴 한글 안내입니다.", { exact: false }).first()).toBeVisible();
    await expect.poll(() => editorDialog.evaluate((node) => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: testInfo.outputPath(`auto-send-editor-${width}.png`) });
    const applyButton = editorDialog.getByRole("button", { name: "저장하고 적용" });
    await applyButton.focus();
    await page.keyboard.press("Tab");
    await expect(editorDialog.getByRole("button", { name: "대화상자 종료", exact: true })).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(applyButton).toBeFocused();
    await applyButton.click();
    await expect(editorDialog).toBeHidden();
    expect(updates).toEqual([102]);
    expect(templates.get(101)?.body).toBe("예전에 사용하던 안내문");
    expect(templates.get(102)?.body).toContain("이번에 수정한");
    await expect(page.getByText(/이번에 수정한 긴 한글 안내입니다/).first()).toBeVisible();
    await openPage();
    await page.getByRole("button", { name: "문구 수정", exact: true }).click();
    await expect(editor).toContainText("이번에 수정한");
    expect(state.creates).toBe(0);
    expect(state.sends).toBe(0);
  });
}

test("기본 문구의 수정본 연결 실패는 초안을 유지하고 재시도해도 중복 생성하지 않는다", async ({ page }) => {
  const { state, templates, original, updates, openPage } = await setup(page, true);
  state.failLink = true;
  await page.getByRole("button", { name: "문구 수정", exact: true }).click();
  const modal = page.getByRole("dialog").filter({ has: page.getByRole("button", { name: "저장하고 적용" }) });
  const editor = modal.getByRole("textbox", { name: "안내문", exact: true });
  await editor.fill("내가 직접 작성한 새 안내문");
  await modal.getByRole("button", { name: "저장하고 적용" }).click();
  await expect(modal.getByRole("alert")).toContainText("자동발송 연결을 완료하지 못했습니다");
  await expect(editor).toContainText("내가 직접 작성한 새 안내문");
  expect(state.linked).toBe(101);
  expect(state.creates).toBe(1);
  state.failLink = false;
  await modal.getByRole("button", { name: "저장하고 적용" }).click();
  await expect(modal).toBeHidden();
  expect(state.creates).toBe(1);
  expect(state.linked).toBe(200);
  expect(updates).toEqual([200]);
  expect(templates.get(101)).toEqual(original);
  await openPage();
  await expect(page.getByText("내가 직접 작성한 새 안내문", { exact: true })).toBeVisible();
  expect(state.sends).toBe(0);
});

test("조회 실패에서 재시도하고 저장 실패·닫기 취소에도 편집 내용을 보존한다", async ({ page }) => {
  const { state, templates } = await setup(page);
  state.failLoad = true;
  await page.getByRole("button", { name: "문구 수정", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("현재 문구를 불러오지 못했습니다");
  expect(templates.get(101)?.body).toBe("예전에 사용하던 안내문");
  state.failLoad = false;
  await page.getByRole("button", { name: "다시 불러오기" }).click();
  const modal = page.getByRole("dialog").filter({ has: page.getByRole("button", { name: "저장하고 적용" }) });
  const editor = modal.getByRole("textbox", { name: "안내문", exact: true });
  await editor.fill("저장 실패 후 유지할 초안");
  state.failSave = true;
  await modal.getByRole("button", { name: "저장하고 적용" }).click();
  await expect(modal.getByRole("alert")).toContainText("문구를 다시 확인해 주세요");
  await modal.getByRole("button", { name: "취소", exact: true }).click();
  await page.getByRole("button", { name: "계속 편집", exact: true }).click();
  await expect(editor).toContainText("저장 실패 후 유지할 초안");
  state.failSave = false;
  await modal.getByRole("button", { name: "저장하고 적용" }).click();
  await expect(modal).toBeHidden();
  expect(templates.get(101)?.body).toBe("저장 실패 후 유지할 초안");
  expect(state.sends).toBe(0);
});
