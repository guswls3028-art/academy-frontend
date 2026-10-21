import { expect, test, type Page } from "../fixtures/strictTest";
import { openCompositionScores } from "../helpers/assessmentCompositionMock";
import { getBaseUrl } from "../helpers/auth";
import { realMessagingSkipReason } from "../helpers/safety";
import { installLocalAuthApiStubs, installTenantOneInitScript } from "../helpers/localAuthApiStubs";

async function openTemplateEditor(page: Page, openEditor = true, initialBody = "한글 안내 #{시험총점}") {
  const baseUrl = getBaseUrl("admin");
  test.skip(!/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(baseUrl), "문구 편집 검증은 로컬 route mock 전용");
  await installLocalAuthApiStubs(page);
  await installTenantOneInitScript(page);
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = `${encode({ alg: "none", typ: "JWT" })}.${encode({ exp: Math.floor(Date.now() / 1000) + 3600, tenant_code: "hakwonplus", user_id: 12 })}.sig`;
  await page.addInitScript((access) => {
    localStorage.setItem("access", access);
    localStorage.setItem("refresh", `${access}-refresh`);
  }, token);
  let saved = {
    id: 991,
    name: "수업 결과 검증 문구",
    category: "grades",
    subject: "",
    body: initialBody,
    is_system: false,
    is_user_default: false,
    solapi_status: "",
    solapi_template_id: "",
    created_at: "2026-09-20T00:00:00Z",
    updated_at: "2026-09-20T00:00:00Z",
  };
  const writes: Record<string, unknown>[] = [];
  const copies: typeof saved[] = [];
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/v1/core/subscription/") {
      await route.fulfill({ json: { tenant_name: "실제 발송학원" } });
    } else if (path === "/api/v1/messaging/templates/991/" && route.request().method() === "PATCH") {
      const payload = route.request().postDataJSON() as Record<string, unknown>;
      writes.push(payload);
      saved = { ...saved, ...payload };
      await route.fulfill({ json: saved });
    } else if (path === "/api/v1/messaging/templates/" && route.request().method() === "POST") {
      const payload = route.request().postDataJSON() as Record<string, unknown>;
      writes.push(payload);
      const created = { ...saved, ...payload, id: 994 + copies.length };
      copies.push(created);
      await route.fulfill({ json: created });
    } else if (path === "/api/v1/messaging/templates/") {
      await route.fulfill({ json: [saved, ...copies,
        { ...saved, id: 992, name: "기본 성적 예시", is_system: true },
        { ...saved, id: 993, name: "연결된 성적 공개", is_system: true },
      ] });
    } else if (/^\/api\/v1\/messaging\/templates\/\d+\/$/.test(path) && route.request().method() === "GET") {
      const id = Number(path.split("/").at(-2));
      const item = [saved, ...copies,
        { ...saved, id: 992, name: "기본 성적 예시", is_system: true },
        { ...saved, id: 993, name: "연결된 성적 공개", is_system: true },
      ].find((template) => template.id === id);
      await route.fulfill({ status: item ? 200 : 404, json: item ?? { detail: "Not found." } });
    } else if (path === "/api/v1/messaging/auto-send/") {
      await route.fulfill({ json: [{ trigger: "exam_score_published", template: 993, enabled: false }] });
    } else if (path.startsWith("/api/v1/messaging/")) {
      await route.fulfill({ json: {} });
    } else {
      await route.fallback();
    }
  });
  await page.goto(`${baseUrl}/workspace/message/templates`, { waitUntil: "domcontentloaded" });
  await expect(page.getByText("수업 결과 검증 문구", { exact: true })).toBeVisible({ timeout: 30_000 });
  if (openEditor) {
    await page.getByRole("button", { name: "수정", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "문구 수정", exact: true })).toBeVisible();
  }
  return writes;
}

test.describe("안내문 변수 편집", () => {
  test("고정 결제 안내는 과거 본문 편집·복제 대신 승인 양식을 보고 일반 안내로 돌아갈 수 있다", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const writes = await openTemplateEditor(page, false);
    const fixed = { id: 991, name: "고정 결제 안내", category: "payment", body: "예전 결제 본문", is_system: false };
    await page.route("**/api/v1/messaging/templates/**", async (route) => {
      if (route.request().method() !== "GET") return route.fallback();
      return route.fulfill({ json: new URL(route.request().url()).pathname.endsWith("/991/") ? fixed : [fixed] });
    });
    await page.reload();
    const categories = page.getByRole("navigation", { name: "문구 카테고리" });
    await categories.getByRole("button", { name: "결제", exact: true }).click();
    await expect(page.getByRole("button", { name: "새 문구", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "복제", exact: true })).toHaveCount(0);
    await expect(page.getByText("예전 결제 본문", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "보기", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "안내 내용 보기", exact: true });
    await expect(dialog.getByLabel("카카오톡 실제 발송 미리보기")).toContainText("결제가 완료되었습니다.");
    await expect(dialog.getByRole("textbox", { name: "안내문", exact: true })).toHaveCount(0);
    await dialog.getByRole("button", { name: "닫기", exact: true }).click();
    await categories.getByRole("button", { name: "사용자", exact: true }).click();
    await expect(page.getByRole("button", { name: "새 문구", exact: true })).toBeEnabled();
    expect(writes).toEqual([]);
  });

  for (const role of ["admin", "teacher"] as const) {
    for (const width of [1366, 390]) {
      test(`${role} ${width}px 보관함은 다른 화면에서 수정한 최신 문구를 열고 저장 실패·재열기를 복구한다`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width, height: 900 });
        await openTemplateEditor(page, false, "목록에 남아 있는 이전 본문");
        let current = { id: 991, name: "수업 결과 검증 문구", category: "grades", subject: "",
          body: "다른 화면에서 저장한 최신 안내", is_system: false, alimtalk_envelope_type: "score" };
        let reads = 0;
        let writes = 0;
        let failLoad = true;
        await page.route("**/api/v1/messaging/templates/991/", async (route) => {
          if (route.request().method() === "GET") {
            reads++;
            if (failLoad) return route.fulfill({ status: 503, json: { detail: "최신 문구 조회 연결 실패" } });
            return route.fulfill({ json: current });
          }
          if (route.request().method() === "PATCH") {
            if (++writes === 1) return route.fulfill({ status: 503, json: { detail: "문구 저장 연결 실패" } });
            current = { ...current, ...route.request().postDataJSON() };
            return route.fulfill({ json: current });
          }
          return route.fallback();
        });
        const open = async (as: typeof role) => {
          await page.goto(`${getBaseUrl("admin")}/workspace/${as === "admin" ? "message/templates" : "mobile/message-templates"}`);
          await page.getByRole("button", { name: as === "admin" ? "수정" : "수업 결과 검증 문구 편집", exact: true }).click();
        };
        await open(role);
        await expect(page.getByRole("alert")).toContainText("최신 문구 조회 연결 실패");
        await expect(page.getByRole("dialog", { name: "문구 불러오기", exact: true })).toBeVisible();
        expect(writes).toBe(0);
        const failedReads = reads;
        failLoad = false;
        await page.getByRole("button", { name: "다시 불러오기", exact: true }).click();
        const dialog = page.getByRole("dialog", { name: role === "admin" ? "문구 수정" : "문구 편집", exact: true });
        const editor = dialog.getByRole("textbox", { name: role === "admin" ? "안내문" : "안내 문구", exact: true });
        await expect(editor).toHaveText(current.body);
        await expect(editor).not.toContainText("목록에 남아 있는 이전 본문");
        const changed = `${role} ${width}px에서 정상 수정한 안내\n#{학생이름} 학생의 학습을 응원합니다.`;
        await editor.fill(changed);
        const save = dialog.getByRole("button", { name: "수정", exact: true });
        await save.click();
        await expect(dialog.getByRole("alert")).toContainText("문구 저장 연결 실패");
        await expect(editor).toContainText("정상 수정한 안내");
        expect(current.body).toBe("다른 화면에서 저장한 최신 안내");
        await expect.poll(() => dialog.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
        await page.screenshot({ path: testInfo.outputPath(`library-${role}-${width}.png`) });
        await save.click();
        await expect(dialog).toBeHidden();
        expect(current.body).toBe(changed);
        expect(writes).toBe(2);
        await page.reload();
        const other = role === "admin" ? "teacher" : "admin";
        await open(other);
        const consumer = page.getByRole("dialog", { name: other === "admin" ? "문구 수정" : "문구 편집", exact: true });
        await expect(consumer.getByRole("textbox", { name: other === "admin" ? "안내문" : "안내 문구", exact: true })).toContainText("정상 수정한 안내");
        if (other === "teacher") await consumer.getByText("발송 형태 예시 보기", { exact: true }).click();
        await expect(consumer.getByLabel("카카오톡 실제 발송 미리보기")).toBeVisible();
        await expect(consumer.getByLabel("카카오톡 실제 발송 미리보기")).toContainText(`${role} ${width}px에서 정상 수정한 안내`);
        expect(reads).toBe(failedReads + 2);
        expect(writes).toBe(2);
      });
    }
  }

  test("문구 관리 기본 지정은 중복 클릭과 응답 유실 재시도에도 지정 상태를 유지한다", async ({ page }) => {
    await openTemplateEditor(page, false);
    let saved = { id: 991, name: "수업 결과 검증 문구", category: "grades", subject: "", body: "한글 안내 #{시험총점}",
      is_system: false, is_user_default: false, solapi_status: "", solapi_template_id: "" };
    const intents: boolean[] = [];
    let release = () => {};
    const gate = new Promise<void>(resolve => { release = resolve; });
    let aborted = 0;
    page.on("requestfailed", request => {
      if (new URL(request.url()).pathname.endsWith("/991/set-default/")
        && request.failure()?.errorText === "net::ERR_ABORTED") aborted++;
    });
    await page.route("**/api/v1/messaging/templates/**", async route => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith("/991/set-default/")) {
        expect(route.request().method()).toBe("POST");
        const desired = route.request().postDataJSON().is_user_default;
        expect(typeof desired).toBe("boolean");
        intents.push(desired);
        if (intents.length === 1) await gate;
        saved = { ...saved, is_user_default: desired };
        if (intents.length === 1) return route.abort("aborted");
        return route.fulfill({ json: saved });
      }
      if (path.endsWith("/templates/")) return route.fulfill({ json: [saved] });
      return route.fallback();
    });
    try {
      const button = page.getByRole("button", { name: "발송 기본으로 지정", exact: true });
      await button.evaluate(node => { (node as HTMLButtonElement).click(); (node as HTMLButtonElement).click(); });
      await expect.poll(() => intents.length).toBe(1);
      await expect(page.getByRole("button", { name: "기본 설정 중…", exact: true })).toBeDisabled();
      release();
      await expect(page.getByText("기본 문구 지정에 실패했습니다.", { exact: true })).toBeVisible();
      expect(saved.is_user_default).toBe(true);
      expect(aborted).toBe(1);
      await button.click();
      await expect(page.getByRole("button", { name: "기본 해제", exact: true })).toBeVisible();
      expect(intents).toEqual([true, true]);
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.getByRole("button", { name: "기본 해제", exact: true })).toBeVisible();
      expect(saved.is_user_default).toBe(true);
      expect(intents).toHaveLength(2);
    } finally {
      release();
    }
  });

  test("복제 초안 저장 실패 후 입력을 유지하고 재시도하면 원본을 보존한다", async ({ page }) => {
    const writes = await openTemplateEditor(page, false);
    let attempts = 0;
    await page.route("**/api/v1/messaging/templates/", async (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      attempts++;
      if (attempts === 1) return route.fulfill({ status: 503, json: { detail: "temporary failure" } });
      return route.fallback();
    });
    await page.getByRole("button", { name: "복제", exact: true }).first().click();
    const modal = page.getByRole("dialog", { name: "문구 추가", exact: true });
    const editor = modal.getByRole("textbox", { name: "안내문", exact: true });
    await editor.click();
    await page.keyboard.press("Control+End");
    await page.keyboard.insertText(" 실패 후 다시 저장");
    await modal.getByRole("button", { name: "저장", exact: true }).click();
    await expect(page.getByText("저장에 실패했습니다.", { exact: true })).toBeVisible();
    await expect(editor).toContainText("실패 후 다시 저장");
    expect(writes).toHaveLength(0);
    await modal.getByRole("button", { name: "저장", exact: true }).click();
    await expect(modal).toBeHidden();
    expect(attempts).toBe(2);
    expect(writes).toHaveLength(1);
    await page.getByText("수업 결과 검증 문구", { exact: true }).click();
    await expect(page.getByRole("dialog", { name: "문구 수정", exact: true })
      .getByRole("textbox", { name: "안내문", exact: true })).not.toContainText("실패 후 다시 저장");
  });

  for (const width of [1100, 1366, 390]) {
    test(`${width}px 복제 취소는 저장하지 않고 편집한 초안은 한 번만 저장한다`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      const writes = await openTemplateEditor(page, false);
      const duplicate = page.getByRole("button", { name: "복제", exact: true }).first();
      const modal = page.getByRole("dialog", { name: "문구 추가", exact: true });
      await duplicate.click();
      await expect(modal).toBeVisible();
      await expect(modal.getByPlaceholder("예: 출석 안내, 시험 일정 공지")).toHaveValue("복사 - 수업 결과 검증 문구");
      expect(writes).toHaveLength(0);
      await modal.getByRole("button", { name: "취소", exact: true }).click();
      await expect(modal).toBeHidden();
      expect(writes).toHaveLength(0);
      await expect(page.getByText("복사 - 수업 결과 검증 문구", { exact: true })).toHaveCount(0);

      await duplicate.click();
      const editor = modal.getByRole("textbox", { name: "안내문", exact: true });
      await editor.click();
      await page.keyboard.press("Control+End");
      await page.keyboard.insertText(" 복제한 한글 안내");
      await modal.getByRole("button", { name: "취소", exact: true }).click();
      const closeConfirm = page.getByRole("alertdialog", { name: "수정한 문구를 닫을까요?" });
      await expect(closeConfirm).toBeVisible();
      await closeConfirm.getByRole("button", { name: "계속 편집", exact: true }).click();
      await expect(editor).toContainText("복제한 한글 안내");
      await expect(editor.locator('[data-message-variable="시험총점"]')).toHaveCount(1);
      expect(writes).toHaveLength(0);
      await expect.poll(() => modal.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`template-copy-draft-${width}.png`) });
      await modal.getByRole("button", { name: "저장", exact: true }).click();
      await expect(modal).toBeHidden();
      expect(writes).toHaveLength(1);
      expect(writes[0].body).toBe("한글 안내 #{시험총점} 복제한 한글 안내");
      await expect(page.getByText("복사 - 수업 결과 검증 문구", { exact: true })).toBeVisible();
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.getByText("복사 - 수업 결과 검증 문구", { exact: true }).click();
      await expect(page.getByRole("dialog", { name: "문구 수정", exact: true })
        .getByRole("textbox", { name: "안내문", exact: true })).toContainText("복제한 한글 안내");
      await page.getByRole("button", { name: "취소", exact: true }).click();
      await page.getByText("수업 결과 검증 문구", { exact: true }).click();
      await expect(page.getByRole("dialog", { name: "문구 수정", exact: true })
        .getByRole("textbox", { name: "안내문", exact: true })).not.toContainText("복제한 한글 안내");
      expect(writes).toHaveLength(1);
      if (width === 390) {
        await page.getByRole("dialog", { name: "문구 수정", exact: true })
          .getByRole("button", { name: "취소", exact: true }).click();
        await page.goto(`${getBaseUrl("admin")}/workspace/mobile/message-templates`, { waitUntil: "domcontentloaded" });
        await expect(page.getByRole("heading", { name: "알림톡 문구", exact: true })).toBeVisible();
        await page.getByRole("button", { name: "복사 - 수업 결과 검증 문구 편집", exact: true }).click();
        const teacherEditor = page.getByRole("dialog", { name: "문구 편집", exact: true })
          .getByRole("textbox", { name: "안내 문구", exact: true });
        await expect(teacherEditor).toContainText("복제한 한글 안내");
        await expect(teacherEditor.locator('[data-message-variable="시험총점"]')).toHaveCount(1);
        expect(writes).toHaveLength(1);
      }
    });
  }

  test("삭제한 제공 문구는 선택한 항목만 복원하고 실패해도 선택을 유지한다", async ({ page }) => {
    await openTemplateEditor(page, false);
    await page.setViewportSize({ width: 390, height: 844 });
    let remaining = [
      { key: "freeform_general", name: "다시 사용할 공지 문구", category: "default" },
      { key: "freeform_payment", name: "복원하지 않을 수납 문구", category: "payment" },
    ];
    const requests: unknown[] = [];
    await page.route("**/api/v1/messaging/provision-defaults/", async (route) => {
      if (route.request().method() === "POST") {
        requests.push(route.request().postDataJSON());
        if (requests.length === 1) return route.fulfill({ status: 503, json: { detail: "일시적인 복원 실패" } });
        remaining = remaining.filter((item) => item.key !== "freeform_general");
        return route.fulfill({ json: { created_templates: 1, created_configs: 0, reset_templates: 0, linked: 0, total_templates: 4, total_configs: 1, suppressed_defaults: remaining } });
      }
      return route.fulfill({ json: { suppressed_defaults: remaining } });
    });
    const restore = page.locator("details").filter({ has: page.getByText("다시 쓸 제공 문구 선택 복원", { exact: true }) });
    await restore.locator("summary").click();
    const selected = restore.getByRole("checkbox", { name: "다시 사용할 공지 문구" });
    await selected.check();
    await restore.getByRole("button", { name: "선택한 1개 문구 복원" }).click();
    await expect(page.getByText("일시적인 복원 실패", { exact: true })).toBeVisible();
    await expect(selected).toBeChecked();
    await restore.getByRole("button", { name: "선택한 1개 문구 복원" }).click();
    await expect(selected).toHaveCount(0);
    expect(requests).toEqual([{ restore_keys: ["freeform_general"] }, { restore_keys: ["freeform_general"] }]);
    await page.reload();
    await page.getByText("다시 쓸 제공 문구 선택 복원", { exact: true }).click();
    await expect(page.getByRole("checkbox", { name: "복원하지 않을 수납 문구" })).not.toBeChecked();
    expect(requests).toHaveLength(2);
  });
  test.setTimeout(90_000);
  test.use({ serviceWorkers: "block" });

  test("제공 문구는 접고 실제 설정 연결과 저장 문구를 구분해 검색한다", async ({ page }) => {
    await openTemplateEditor(page, false);
    await expect(page.getByText("수업 결과 검증 문구", { exact: true })).toBeVisible();
    await expect(page.getByText("연결된 성적 공개", { exact: true })).toBeVisible();
    await expect(page.getByText("자동발송 설정에 연결", { exact: true })).toBeVisible();
    await expect(page.getByText("기본 성적 예시", { exact: true })).toBeHidden();
    await page.getByLabel("저장 문구 검색").fill("기본 성적 예시");
    await expect(page.getByText("기본 성적 예시", { exact: true })).toBeVisible();
    await expect(page.getByText("수업 결과 검증 문구", { exact: true })).toBeHidden();
    await page.getByLabel("저장 문구 검색").clear();
    await expect(page.getByText("수업 결과 검증 문구", { exact: true })).toBeVisible();
  });

  for (const width of [1366, 390]) {
    test(`${width}px 한글·변수 편집과 실행 취소 후 저장한 본문을 다시 연다`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      const writes = await openTemplateEditor(page);
      const modal = page.getByRole("dialog", { name: "문구 수정", exact: true });
      const editor = modal.getByRole("textbox", { name: "안내문", exact: true });
      await expect(editor).toHaveAttribute("contenteditable", "true");
      await expect(editor.locator('[data-message-variable="시험총점"]')).toHaveAttribute("contenteditable", "false");

      await editor.click();
      await page.keyboard.press("Control+End");
      await page.keyboard.insertText(" 추가 한글 안내");
      await expect(editor).toContainText("추가 한글 안내");
      await modal.getByRole("button", { name: "실행 취소", exact: true }).click();
      await expect(editor).not.toContainText("추가 한글 안내");
      await modal.getByRole("button", { name: "다시 실행", exact: true }).click();
      await expect(editor).toContainText("추가 한글 안내");

      await editor.click();
      await page.keyboard.press("Control+End");
      await modal.getByRole("button", { name: "시험 총점", exact: true }).click();
      await expect(editor.locator('[data-message-variable="시험총점"]')).toHaveCount(2);
      await editor.press("Control+z");
      await expect(editor.locator('[data-message-variable="시험총점"]')).toHaveCount(1);
      await expect(editor).toContainText("추가 한글 안내");
      await modal.getByRole("button", { name: "다시 실행", exact: true }).click();
      await expect(editor.locator('[data-message-variable="시험총점"]')).toHaveCount(2);
      const individual = modal.getByRole("button", { name: "시험·과제별 정보 더 보기", exact: true });
      await expect(individual).toHaveAttribute("aria-expanded", "true");
      await expect(modal.getByRole("button", { name: "시험 1 이름", exact: true })).toBeVisible();
      await individual.focus();
      await page.keyboard.press("Enter");
      await expect(individual).toHaveAttribute("aria-expanded", "false");
      await expect(modal.getByRole("button", { name: "시험 1 이름", exact: true })).toBeHidden();
      await individual.focus();
      await page.keyboard.press("Enter");
      await expect(individual).toHaveAttribute("aria-expanded", "true");
      expect(writes).toHaveLength(0);
      await expect(modal).toBeVisible();
      await modal.getByRole("button", { name: "시험 1 이름", exact: true }).click();
      await expect(editor.locator('[data-message-variable="시험1명"]')).toHaveCount(1);
      await editor.press("Control+z");
      await expect(editor.locator('[data-message-variable="시험1명"]')).toHaveCount(0);
      expect(writes).toHaveLength(0);
      await expect(modal).toBeVisible();
      await expect.poll(() => modal.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`message-editor-${width}.png`) });
      await modal.getByRole("button", { name: "수정", exact: true }).click();
      await expect(modal).toBeHidden();
      expect(writes).toHaveLength(1);
      expect(writes[0].body).toBe("한글 안내 #{시험총점} 추가 한글 안내#{시험총점}");

      await page.reload({ waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: "수정", exact: true }).click();
      await expect(editor).toContainText("추가 한글 안내");
      await expect(editor.locator('[data-message-variable="시험총점"]')).toHaveCount(2);
    });
  }

  test("변수를 포함한 본문을 복사·붙여넣기하고 선택 교체를 되돌린다", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const writes = await openTemplateEditor(page);
    const modal = page.getByRole("dialog", { name: "문구 수정", exact: true });
    const editor = modal.getByRole("textbox", { name: "안내문", exact: true });
    await editor.click();
    await page.keyboard.press("Control+a");
    await page.keyboard.press("Control+c");
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe("한글 안내 #{시험총점}");
    await page.keyboard.insertText("교체한 한글 문장");
    await expect(editor).toHaveText("교체한 한글 문장");
    await page.keyboard.press("Control+z");
    await expect(editor.locator('[data-message-variable="시험총점"]')).toHaveCount(1);
    await editor.click();
    await page.keyboard.press("Control+End");
    await page.keyboard.press("Control+v");
    await expect(editor.locator('[data-message-variable="시험총점"]')).toHaveCount(2);
    await modal.getByRole("button", { name: "수정", exact: true }).click();
    await expect(modal).toBeHidden();
    expect(writes[0].body).toBe("한글 안내 #{시험총점}한글 안내 #{시험총점}");
  });

  test("빠른 입력 사이에 넣은 블록은 앞뒤 문장과 따로 실행 취소하고 다시 실행한다", async ({ page }) => {
    const writes = await openTemplateEditor(page);
    const modal = page.getByRole("dialog", { name: "문구 수정", exact: true });
    const editor = modal.getByRole("textbox", { name: "안내문", exact: true });
    await expect(editor).toHaveAttribute("contenteditable", "true");
    // Keep all edits inside the history grouping window even on a slow CI worker.
    await page.clock.setFixedTime(new Date());
    await editor.click();
    await page.keyboard.press("Control+End");
    await page.keyboard.insertText(" 빠른 입력");
    await modal.getByRole("button", { name: "시험 총점", exact: true }).click();
    await page.keyboard.insertText(" 뒤 문장");
    await editor.press("Control+z");
    await expect(editor).not.toContainText("뒤 문장");
    await expect(editor).toContainText("빠른 입력");
    await expect(editor.locator('[data-message-variable="시험총점"]')).toHaveCount(2);
    await editor.press("Control+z");
    await expect(editor.locator('[data-message-variable="시험총점"]')).toHaveCount(1);
    await expect(editor).toContainText("빠른 입력");
    await editor.press("Control+y");
    await expect(editor.locator('[data-message-variable="시험총점"]')).toHaveCount(2);
    await editor.press("Control+y");
    await expect(editor).toContainText("뒤 문장");
    await modal.getByRole("button", { name: "수정", exact: true }).click();
    await expect(modal).toBeHidden();
    expect(writes[0].body).toBe("한글 안내 #{시험총점} 빠른 입력#{시험총점} 뒤 문장");
  });

  for (const clipboard of ["image", "empty"] as const) {
    test(`${clipboard} 클립보드는 선택 본문과 이전 편집 이력을 보존한다`, async ({ page }) => {
      const writes = await openTemplateEditor(page);
      const modal = page.getByRole("dialog", { name: "문구 수정", exact: true });
      const editor = modal.getByRole("textbox", { name: "안내문", exact: true });
      await editor.click();
      await editor.press("Control+End");
      await page.keyboard.insertText(" 추가 입력");
      await editor.press("Control+a");
      const unchanged = await editor.evaluate((node, clipboard) => {
        const html = node.innerHTML;
        const selection = node.ownerDocument.getSelection()!;
        const { anchorNode, anchorOffset, focusNode, focusOffset } = selection;
        const clipboardData = new DataTransfer();
        if (clipboard === "image") {
          clipboardData.items.add(new File([new Uint8Array([137, 80, 78, 71])], "clipboard.png", { type: "image/png" }));
        }
        node.dispatchEvent(new ClipboardEvent("paste", { clipboardData, bubbles: true, cancelable: true }));
        return {
          body: node.innerHTML === html,
          selection: selection.anchorNode === anchorNode && selection.anchorOffset === anchorOffset
            && selection.focusNode === focusNode && selection.focusOffset === focusOffset,
        };
      }, clipboard);
      expect(unchanged).toEqual({ body: true, selection: true });
      await editor.press("Control+z");
      await expect(editor).not.toContainText("추가 입력");
      await expect(editor.locator('[data-message-variable="시험총점"]')).toHaveCount(1);
      await editor.press("Control+y");
      await expect(editor).toContainText("추가 입력");
      await modal.getByRole("button", { name: "수정", exact: true }).click();
      await expect(modal).toBeHidden();
      expect(writes[0].body).toBe("한글 안내 #{시험총점} 추가 입력");
    });
  }

  test("공백과 줄바꿈만 있는 텍스트도 그대로 붙여넣는다", async ({ page }) => {
    await openTemplateEditor(page);
    const modal = page.getByRole("dialog", { name: "문구 수정", exact: true });
    const editor = modal.getByRole("textbox", { name: "안내문", exact: true });
    await editor.click();
    await editor.press("Control+a");
    await editor.evaluate((node) => {
      const clipboardData = new DataTransfer();
      clipboardData.setData("text/plain", " \n\n ");
      node.dispatchEvent(new ClipboardEvent("paste", { clipboardData, bubbles: true, cancelable: true }));
    });
    await expect.poll(() => editor.evaluate((node) => Array.from(node.querySelectorAll("p"))
      .map((paragraph) => paragraph.textContent).join("\n"))).toBe(" \n\n ");
    await editor.press("Control+z");
    await expect(editor.locator('[data-message-variable="시험총점"]')).toHaveCount(1);
  });

  for (const selection of ["end", "all", "forward", "backward", "atom"] as const) {
    test(`붙여넣기 직전 ${selection} 선택을 반영하고 실행 취소·재실행 후 저장한다`, async ({ page }) => {
      const original = "한글 안내 #{시험총점}\n\n끝 줄";
      const pasted = "새 #{학생이름3}\n\n문장";
      const expected = selection === "end" ? original + pasted
        : selection === "all" ? pasted
        : selection === "atom" ? `한글 안내 ${pasted}\n\n끝 줄`
        : `한글 ${pasted} #{시험총점}\n\n끝 줄`;
      const writes = await openTemplateEditor(page, true, original);
      const modal = page.getByRole("dialog", { name: "문구 수정", exact: true });
      const editor = modal.getByRole("textbox", { name: "안내문", exact: true });
      await expect(editor).toHaveAttribute("contenteditable", "true");
      await editor.click();
      // Undo restores AllSelection. Change only the native selection and paste in the
      // same browser task, before asynchronous selectionchange can update the editor.
      await editor.press("Control+a");
      await page.keyboard.insertText("임시 교체");
      await editor.press("Control+z");
      await expect(editor.locator('[data-message-variable="시험총점"]')).toHaveCount(1);
      await editor.evaluate((node, { selection, pasted }) => {
        const native = node.ownerDocument.getSelection()!;
        const paragraph = node.querySelector("p")!;
        if (selection === "end") {
          native.setBaseAndExtent(node, node.childNodes.length, node, node.childNodes.length);
        } else if (selection === "all") {
          native.setBaseAndExtent(node, 0, node, node.childNodes.length);
        } else if (selection === "atom") {
          const atom = paragraph.querySelector("[data-message-variable]")!;
          const index = Array.from(paragraph.childNodes).indexOf(atom);
          native.setBaseAndExtent(paragraph, index, paragraph, index + 1);
        } else {
          const text = paragraph.firstChild!;
          native.setBaseAndExtent(text, selection === "forward" ? 3 : 5, text, selection === "forward" ? 5 : 3);
        }
        const clipboardData = new DataTransfer();
        clipboardData.setData("text/plain", pasted);
        node.dispatchEvent(new ClipboardEvent("paste", { clipboardData, bubbles: true, cancelable: true }));
      }, { selection, pasted });
      const readBody = () => editor.evaluate((node) => Array.from(node.querySelectorAll("p")).map((paragraph) => {
        const copy = paragraph.cloneNode(true) as HTMLElement;
        for (const atom of copy.querySelectorAll("[data-message-variable]")) {
          atom.replaceWith(`#{${atom.getAttribute("data-message-variable")}}`);
        }
        return copy.textContent;
      }).join("\n"));
      await expect.poll(readBody).toBe(expected);
      await editor.press("Control+z");
      await expect.poll(readBody).toBe(original);
      await editor.press("Control+y");
      await expect.poll(readBody).toBe(expected);
      await modal.getByRole("button", { name: "수정", exact: true }).click();
      await expect(modal).toBeHidden();
      expect(writes[0].body).toBe(expected);
    });
  }

  test("여러 줄과 빈 줄을 복사·붙여넣기하고 블록 삭제를 되돌려 원문 그대로 저장한다", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const original = "첫 줄 #{학생이름3}\n둘째 줄\n\n마지막 #{시험총점}";
    const writes = await openTemplateEditor(page, true, original);
    const modal = page.getByRole("dialog", { name: "문구 수정", exact: true });
    const editor = modal.getByRole("textbox", { name: "안내문", exact: true });
    await editor.click();
    await editor.press("Control+a");
    await editor.press("Control+c");
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(original);
    await page.keyboard.insertText("임시 교체 문장");
    await editor.press("Control+a");
    await editor.press("Control+v");
    await expect(editor.locator('[data-message-variable]')).toHaveCount(2);
    await editor.press("Control+z");
    await expect(editor).toHaveText("임시 교체 문장");
    await editor.press("Control+y");
    await expect(editor.locator('[data-message-variable]')).toHaveCount(2);
    await editor.press("Control+End");
    await editor.press("Backspace");
    await expect(editor.locator('[data-message-variable="시험총점"]')).toHaveCount(0);
    await editor.press("Control+z");
    await expect(editor.locator('[data-message-variable="시험총점"]')).toHaveCount(1);
    await editor.press("Control+a");
    await editor.press("Control+c");
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(original);
    await modal.getByRole("button", { name: "수정", exact: true }).click();
    await expect(modal).toBeHidden();
    expect(writes[0].body).toBe(original);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "수정", exact: true }).click();
    await expect(editor.locator('[data-message-variable]')).toHaveCount(2);
    await editor.click();
    await editor.press("Control+a");
    await editor.press("Control+c");
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(original);
  });
});

async function openGuardedSender(page: Page, initiallyDefault = true, approvedTemplate = false) {
  const baseUrl = getBaseUrl("admin");
  const mockOnlyReason = realMessagingSkipReason(baseUrl, "", "0");
  test.skip(
    !/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?(?:\/|$)/.test(baseUrl),
    mockOnlyReason ?? "발송 초안 보호 route-mock 검증은 로컬 dev 서버 전용",
  );
  await openCompositionScores(page);
  const sends: Record<string, unknown>[] = [];
  let releaseFailure: (() => void) | undefined;
  const failureGate = new Promise<void>(resolve => { releaseFailure = resolve; });
  await page.route("**/api/v1/messaging/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/templates/")) return route.fulfill({ json: [{
      id: 991, name: approvedTemplate ? "안전한 수업 안내 · 학부모에게 전달할 긴 성적 안내문" : "안전한 수업 안내", category: "grades", subject: "", body: "오늘 수업 안내입니다.",
      is_system: false, is_user_default: initiallyDefault,
      solapi_status: approvedTemplate ? "APPROVED" : "", solapi_template_id: approvedTemplate ? "E2E_GRADES" : "",
    }] });
    if (path.endsWith("/send/preflight/")) {
      const payload = route.request().postDataJSON();
      return route.fulfill({ json: {
        ok: true, can_send: true, mode: "now", send_to: payload.send_to,
        recipient: { selected: 1, resolved: 1, valid_phone: 1, skipped_no_phone: 0, duplicate_phone: 0, unique_phone: 1, invalid_or_deleted: 0, limit: 500 },
        template: { ok: true, source: "unified", name: "성적 안내", solapi_template_id: "E2E_GRADES", solapi_status: "APPROVED", detail: "", uses_unified_template: true, template_type: "grades" },
        preview_recipients: [{ student_id: 9301, student_name: "모바일순서학생", phone: "010****0001", excluded: false, exclude_reason: "", full_message_body: payload.raw_body || "오늘 수업 안내입니다." }],
        limits: { hourly_limit: 500, sent_last_hour: 0, remaining_this_hour: 500 }, blockers: [], warnings: [],
      } });
    }
    if (path.endsWith("/send/")) {
      const payload = route.request().postDataJSON(); sends.push(payload);
      if (sends.length === 2) {
        await failureGate;
        return route.fulfill({ status: 503, json: { detail: "두 번째 대상 접수 응답 지연" } });
      }
      return route.fulfill({ json: { request_id: payload.client_request_id, accepted_count: 1, enqueued: 1, scheduled: 0, enqueue_failed: 0, skipped_no_phone: 0 } });
    }
    return route.fulfill({ json: {} });
  });
  await page.getByRole("checkbox", { name: "모바일순서학생 선택" }).check();
  await page.getByRole("button", { name: "수업결과 알림톡 발송" }).click();
  const modal = page.getByRole("dialog", { name: /^알림톡 발송/ });
  if (!initiallyDefault) {
    await modal.getByRole("button", { name: "안내문 바꾸기", exact: true }).click();
    await page.getByRole("button", { name: /^안전한 수업 안내/ }).click();
    await expect(page.getByLabel("선택할 안내문 내용")).toHaveText("오늘 수업 안내입니다.");
    await page.getByRole("button", { name: "이 안내문 적용", exact: true }).filter({ visible: true }).click();
  }
  await expect(modal.getByRole("textbox", { name: "안내문", exact: true })).toContainText("오늘 수업 안내입니다.");
  return { modal, sends, releaseFailure: () => releaseFailure?.() };
}

for (const width of [1366, 390]) {
  test(`성적 안내문 상태 배지와 저장 버튼이 눌리지 않고 표시된다 ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const { modal, sends } = await openGuardedSender(page, false, true);
    await modal.getByRole("textbox", { name: "안내문", exact: true })
      .fill("오늘 수업 안내입니다. 학부모에게 전달할 추가 안내를 작성했습니다.");
    const bar = modal.locator(".send-modal__tpl-bar");
    await bar.scrollIntoViewIfNeeded();
    for (const label of ["사용 가능", "수정됨"]) {
      const badge = bar.getByText(label, { exact: true });
      await expect(badge).toBeVisible();
      await expect.poll(() => badge.evaluate(element => element.getBoundingClientRect().height)).toBeLessThanOrEqual(28);
    }
    for (const label of ["변경 내용 저장", "새 문구로 저장", "성적 안내 기본으로 지정", "안내문 바꾸기"]) {
      const button = bar.getByRole("button", { name: label, exact: true });
      await expect(button).toBeVisible();
      expect(await button.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    }
    await expect.poll(() => bar.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`message-template-header-${width}.png`), animations: "disabled" });
    expect(sends).toHaveLength(0);
  });

  test(`발송 초안 닫기·양식 교체는 폐기를 확인하고 취소하면 보존한다 ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const { modal, sends } = await openGuardedSender(page);
    const editor = modal.getByRole("textbox", { name: "안내문", exact: true });
    await editor.click(); await page.keyboard.press("Control+End"); await page.keyboard.insertText(" 작성 중인 내용");
    await modal.getByRole("button", { name: "취소", exact: true }).click();
    const closeConfirm = page.getByRole("alertdialog", { name: "작성한 문구를 닫을까요?" });
    await expect(closeConfirm).toBeVisible();
    await expect.poll(() => closeConfirm.evaluate(node =>
      node.getAnimations({ subtree: true }).filter(animation => animation.playState === "running").length,
    )).toBe(0);
    await page.screenshot({ path: testInfo.outputPath(`message-draft-discard-confirm-${width}.png`), animations: "disabled" });
    await closeConfirm.getByRole("button", { name: "계속 편집", exact: true }).click();
    await expect(editor).toContainText("작성 중인 내용");
    await modal.getByRole("button", { name: "안내문 바꾸기", exact: true }).click();
    await page.getByRole("button", { name: /직접 작성 보낼 안내문을 처음부터 작성합니다/ }).click();
    const replaceConfirm = page.getByRole("alertdialog", { name: "작성한 문구를 바꿀까요?" });
    await replaceConfirm.getByRole("button", { name: "계속 편집", exact: true }).click();
    await expect(editor).toContainText("작성 중인 내용");
    await modal.getByRole("button", { name: "안내문 바꾸기", exact: true }).click();
    await page.getByRole("button", { name: /직접 작성 보낼 안내문을 처음부터 작성합니다/ }).click();
    await replaceConfirm.getByRole("button", { name: "수정 내용 버리고 바꾸기", exact: true }).click();
    await expect(editor).toBeEmpty();
    await editor.fill("새 초안");
    await page.keyboard.press("Escape");
    await closeConfirm.getByRole("button", { name: "수정 내용 버리고 닫기", exact: true }).click();
    await expect(modal).toBeHidden();
    expect(sends).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`message-draft-discard-${width}.png`), animations: "disabled" });
  });
}

test("발송 중 Escape·배경·닫기를 막고 부분 실패 재시도는 같은 요청을 보존한다", async ({ page }) => {
  const { modal, sends, releaseFailure } = await openGuardedSender(page);
  await modal.getByRole("button", { name: "보낼 내용 확인", exact: true }).click();
  await page.getByRole("dialog", { name: "보내기 전 마지막 확인" }).getByRole("button", { name: "발송하기", exact: true }).click();
  await expect.poll(() => sends.length).toBe(2);
  await expect(modal.getByRole("button", { name: "대화상자 종료", exact: true })).toHaveCount(0);
  await expect(modal.getByRole("button", { name: "취소", exact: true })).toBeDisabled();
  await page.keyboard.press("Escape"); await page.mouse.click(2, 2);
  await expect(modal).toBeVisible();
  releaseFailure();
  await expect(modal.getByRole("button", { name: "같은 요청으로 재시도", exact: true })).toBeVisible();
  await modal.getByRole("button", { name: "취소", exact: true }).click();
  const unresolved = page.getByRole("alertdialog", { name: "발송 결과 확인 전 나갈까요?" });
  await expect(unresolved).toContainText("이미 접수된 대상이 있을 수 있습니다");
  await unresolved.getByRole("button", { name: "돌아가서 확인", exact: true }).click();
  await expect(modal).toBeVisible();
  expect(sends).toHaveLength(2);
  await modal.getByRole("button", { name: "같은 요청으로 재시도", exact: true }).click();
  await expect(modal).toBeHidden();
  expect(sends).toHaveLength(4);
  expect(new Set(sends.map(payload => payload.client_request_id)).size).toBe(1);
});


test("편집하지 않은 문구도 부분 접수 뒤 닫기는 결과 미확인을 명시적으로 확인한다", async ({ page }) => {
  const { modal, sends, releaseFailure } = await openGuardedSender(page);
  await modal.getByRole("button", { name: "보낼 내용 확인", exact: true }).click();
  await page.getByRole("dialog", { name: "보내기 전 마지막 확인" }).getByRole("button", { name: "발송하기", exact: true }).click();
  await expect.poll(() => sends.length).toBe(2);
  releaseFailure();
  await expect(modal.getByRole("button", { name: "같은 요청으로 재시도", exact: true })).toBeVisible();
  await modal.getByRole("button", { name: "취소", exact: true }).click();
  await page.getByRole("alertdialog", { name: "발송 결과 확인 전 나갈까요?" })
    .getByRole("button", { name: "결과 미확인 상태로 나가기", exact: true }).click();
  await expect(modal).toBeHidden();
  expect(sends).toHaveLength(2);
});

for (const width of [1366, 390]) {
  test(`문구 저장·기본 지정은 중복 요청과 초안 교체를 막고 실패 후 복구한다 ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const { modal, sends } = await openGuardedSender(page, false);
    let template = { id: 991, name: "안전한 수업 안내", category: "grades", subject: "", body: "오늘 수업 안내입니다.",
      is_system: false, is_user_default: false, solapi_status: "", solapi_template_id: "" };
    const created: typeof template[] = [];
    let defaultCalls = 0;
    const defaultIntents: Array<{ id: number; desired: boolean }> = [];
    let lostAcknowledgements = 0;
    page.on("requestfailed", request => {
      if (new URL(request.url()).pathname.endsWith("/991/set-default/")
        && request.failure()?.errorText === "net::ERR_ABORTED") lostAcknowledgements++;
    });
    let createCalls = 0;
    let releaseDefault = () => {};
    let releaseCreate = () => {};
    const defaultGate = new Promise<void>(resolve => { releaseDefault = resolve; });
    const createGate = new Promise<void>(resolve => { releaseCreate = resolve; });
    await page.route("**/api/v1/messaging/templates/**", async route => {
      const path = new URL(route.request().url()).pathname;
      const defaultMatch = /\/(991|994)\/set-default\/$/.exec(path);
      if (defaultMatch) {
        const id = Number(defaultMatch[1]);
        const desired = route.request().postDataJSON().is_user_default;
        expect(typeof desired).toBe("boolean");
        defaultIntents.push({ id, desired });
        if (id === 991) {
          defaultCalls++;
          if (defaultCalls === 1) {
            await defaultGate;
            return route.fulfill({ status: 503, json: { detail: "일시적인 기본 지정 실패" } });
          }
          template = { ...template, is_user_default: desired };
          // The server committed, but no acknowledgement reached the client.
          if (defaultCalls === 2) return route.abort("aborted");
          return route.fulfill({ json: template });
        }
        created[0] = { ...created[0], is_user_default: desired };
        if (desired) template = { ...template, is_user_default: false };
        return route.fulfill({ json: created[0] });
      }
      if (path.endsWith("/templates/") && route.request().method() === "POST") {
        createCalls++;
        const payload = route.request().postDataJSON();
        await createGate;
        const saved = { ...template, ...payload, id: 994, is_user_default: false };
        created.push(saved);
        return route.fulfill({ status: 201, json: saved });
      }
      if (path.endsWith("/templates/")) return route.fulfill({ json: [template, ...created] });
      return route.fallback();
    });
    try {
      const defaultButton = modal.getByRole("button", { name: "성적 안내 기본으로 지정", exact: true });
      await defaultButton.evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); });
      await expect.poll(() => defaultCalls).toBe(1);
      await expect(defaultButton).toBeDisabled();
      await expect(modal.getByRole("button", { name: "안내문 바꾸기", exact: true })).toBeDisabled();
      await expect(modal.getByRole("button", { name: "취소", exact: true })).toBeDisabled();
      await page.keyboard.press("Escape");
      await expect(modal).toBeVisible();
      releaseDefault();
      await expect(page.getByText("기본 문구 지정에 실패했습니다.", { exact: true })).toBeVisible();
      await expect(defaultButton).toBeEnabled();
      await defaultButton.click();
      await expect.poll(() => defaultCalls).toBe(2);
      await expect(defaultButton).toBeEnabled();
      expect(template.is_user_default).toBe(true);
      expect(lostAcknowledgements).toBe(1);
      await defaultButton.click();
      await expect(defaultButton).toBeHidden();
      expect(defaultCalls).toBe(3);
      expect(template.is_user_default).toBe(true);
      expect(defaultIntents).toEqual(Array(3).fill({ id: 991, desired: true }));

      const editor = modal.getByRole("textbox", { name: "안내문", exact: true });
      await editor.fill("다음에도 보존할 새 안내문");
      await modal.getByRole("button", { name: "새 문구로 저장", exact: true }).click();
      await modal.getByPlaceholder("예: 출결 알림, 성적표 안내").fill("보존한 성적 안내문");
      await modal.getByRole("checkbox", { name: "성적 안내 기본으로 지정 · 이 학원 직원 공통", exact: true }).check();
      await modal.getByRole("button", { name: "저장", exact: true }).click();
      await expect.poll(() => createCalls).toBe(1);
      await expect(modal.getByRole("status")).toContainText("문구 변경을 저장하고 있어요");
      await expect(modal.getByRole("button", { name: "안내문 바꾸기", exact: true })).toBeDisabled();
      await expect(editor).toHaveAttribute("contenteditable", "false");
      await expect(modal.getByRole("button", { name: "대화상자 종료", exact: true })).toHaveCount(0);
      await page.keyboard.press("Escape"); await page.mouse.click(2, 2);
      await expect(modal).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`message-template-saving-${width}.png`), animations: "disabled" });
      releaseCreate();
      await expect(modal.locator(".send-modal__tpl-bar-name")).toHaveText("보존한 성적 안내문");
      await expect(editor).toHaveAttribute("contenteditable", "true");
      await expect(editor).toContainText("다음에도 보존할 새 안내문");
      expect(created).toHaveLength(1);
      expect(created[0].body).toBe("다음에도 보존할 새 안내문");
      expect(created[0].is_user_default).toBe(true);
      expect(defaultIntents.at(-1)).toEqual({ id: 994, desired: true });
      await modal.getByRole("button", { name: "취소", exact: true }).click();
      await expect(modal).toBeHidden();
      await page.reload();
      await page.getByRole("checkbox", { name: "모바일순서학생 선택", exact: true }).check();
      await page.getByRole("button", { name: "수업결과 알림톡 발송" }).click();
      await expect(editor).toContainText("다음에도 보존할 새 안내문");
      await expect(defaultButton).toBeHidden();
      await modal.getByRole("button", { name: "안내문 바꾸기", exact: true }).click();
      await expect(page.getByRole("button", { name: /^보존한 성적 안내문/ })).toBeVisible();
      expect(sends).toEqual([]);
    } finally {
      releaseDefault(); releaseCreate();
    }
  });
}
