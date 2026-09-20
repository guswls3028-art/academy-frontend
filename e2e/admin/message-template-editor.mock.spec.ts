import { expect, test, type Page } from "../fixtures/strictTest";
import { getBaseUrl } from "../helpers/auth";
import { installLocalAuthApiStubs, installTenantOneInitScript } from "../helpers/localAuthApiStubs";

async function openTemplateEditor(page: Page, openEditor = true) {
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
    body: "한글 안내 #{시험총점}",
    is_system: false,
    is_user_default: false,
    solapi_status: "",
    solapi_template_id: "",
    created_at: "2026-09-20T00:00:00Z",
    updated_at: "2026-09-20T00:00:00Z",
  };
  const writes: Record<string, unknown>[] = [];
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/v1/messaging/templates/991/" && route.request().method() === "PATCH") {
      const payload = route.request().postDataJSON() as Record<string, unknown>;
      writes.push(payload);
      saved = { ...saved, ...payload };
      await route.fulfill({ json: saved });
    } else if (path === "/api/v1/messaging/templates/") {
      await route.fulfill({ json: [saved,
        { ...saved, id: 992, name: "기본 성적 예시", is_system: true },
        { ...saved, id: 993, name: "연결된 성적 공개", is_system: true },
      ] });
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
});
