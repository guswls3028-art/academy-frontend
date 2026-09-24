import { expect, test, type Page } from "../fixtures/strictTest";
import { getBaseUrl } from "../helpers/auth";
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
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/v1/core/subscription/") {
      await route.fulfill({ json: { tenant_name: "실제 발송학원" } });
    } else if (path === "/api/v1/messaging/templates/991/" && route.request().method() === "PATCH") {
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
