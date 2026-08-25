import type { Page, Route } from "@playwright/test";
import { expect, test } from "../fixtures/strictTest";
import {
  installLocalAuthApiStubs,
  installTenantOneInitScript,
} from "../helpers/localAuthApiStubs";
import { gotoAndSettle } from "../helpers/wait";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";
const API_BASE = process.env.E2E_API_URL || "http://127.0.0.1:8000";
const POST_ID = 4401;
const FILE_NAME = "29번-정답-정오.jpg";

async function seed(page: Page) {
  test.skip(
    !/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(BASE),
    "게시판 사진 route-mock 검증은 로컬 서버 전용",
  );
  await installTenantOneInitScript(page);
}

async function publishLocalAdminAuth(page: Page) {
  await gotoAndSettle(page, `${BASE}/login/hakwonplus`, { timeout: 60_000 });
  await page.evaluate(async (apiBase) => {
    const response = await fetch(`${apiBase}/api/v1/token/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: "route-mock-refresh" }),
    });
    if (!response.ok) throw new Error(`local auth token setup failed: ${response.status}`);
    const tokens = await response.json() as { access: string; refresh: string };
    const { publishLoginTokenEnvelope } = await import("/src/shared/auth/tokenSession.ts");
    await publishLoginTokenEnvelope(tokens.access, tokens.refresh);
  }, API_BASE);
}

async function installApi(page: Page) {
  const state = {
    createCount: 0,
    uploadAttempts: 0,
    attachmentPersisted: false,
    uploadKeys: [] as string[],
  };

  const attachment = {
    id: 91,
    original_name: FILE_NAME,
    size_bytes: 27,
    content_type: "image/jpeg",
    created_at: "2026-08-25T12:23:00Z",
    download_url: "https://cdn.example.test/29-answer.jpg",
  };
  const post = () => ({
    id: POST_ID,
    post_type: "board",
    title: "1회차 생물 다양성 메인자료 유형출제 29번 정답 정오",
    content: "<p>정답</p><p>수정 전 ④</p><p>수정 후 ③</p>",
    created_by: 12,
    created_by_display: "박철",
    author_role: "staff",
    created_at: "2026-08-25T12:23:00Z",
    updated_at: "2026-08-25T12:23:00Z",
    replies_count: 0,
    mappings: [],
    attachments: state.attachmentPersisted ? [attachment] : [],
  });

  await page.route("**/api/v1/**", async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, "");
    const json = (body: unknown, status = 200) => route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });

    if (request.method() === "OPTIONS") return route.fulfill({ status: 204 });
    if (path === "/staffs/me/") return json({ id: 12, is_payroll_manager: true });
    if (path === "/staffs/currently-working/") return json([]);
    if (path === "/community/scope-nodes/") return json({ count: 0, results: [] });
    if (path === "/community/posts/counts/") {
      return json({
        total: state.createCount > 0 ? 1 : 0,
        global_count: state.createCount > 0 ? 1 : 0,
        by_node_id: {},
        by_lecture_id: {},
      });
    }
    if (path === "/community/admin/posts/") {
      return json({ count: state.createCount > 0 ? 1 : 0, results: state.createCount > 0 ? [post()] : [] });
    }
    if (path === "/community/posts/" && request.method() === "POST") {
      state.createCount += 1;
      return json(post(), 201);
    }
    if (path === `/community/posts/${POST_ID}/attachments/` && request.method() === "POST") {
      state.uploadAttempts += 1;
      const body = request.postDataBuffer()?.toString("latin1") ?? "";
      const key = body.match(/name="idempotency_key"\r\n\r\n([^\r\n]+)/)?.[1];
      if (key) state.uploadKeys.push(key);
      if (state.uploadAttempts === 1) return json({ detail: "사진 저장소 연결이 일시적으로 실패했습니다." }, 503);
      state.attachmentPersisted = true;
      return json([attachment], 201);
    }
    if (path === `/community/posts/${POST_ID}/`) return json(post());
    if (path === `/community/posts/${POST_ID}/replies/`) return json([]);
    if (path === "/lectures/lectures/") return json([]);
    if (path === "/lectures/attendance/arrival-overview/") {
      return json({
        today: "2026-08-25",
        tomorrow: "2026-08-26",
        range_end: "2026-09-01",
        range_days: 7,
        summary: { soon: 0, today: 0, tomorrow: 0, upcoming: 0, time_unset: 0, overdue: 0 },
        items: [],
      });
    }
    if (path === "/results/admin/teacher-dashboard-counts/") return json({ video_failed: 0 });
    if (path.includes("pending-count") || path.includes("unread-count")) return json({ count: 0 });
    return json({ count: 0, results: [] });
  });

  await installLocalAuthApiStubs(page);
  await publishLocalAdminAuth(page);
  return state;
}

async function composePhotoPost(page: Page) {
  const createButton = page.getByRole("button", { name: "+ 글쓰기" });
  await expect(createButton).toBeVisible({ timeout: 60_000 });
  await expect(createButton).toBeEnabled({ timeout: 60_000 });
  await createButton.click({ timeout: 60_000 });
  await page.getByPlaceholder("게시물 제목을 입력하세요").fill(
    "1회차 생물 다양성 메인자료 유형출제 29번 정답 정오",
  );
  await page.locator(".cms-form__file-input--hidden").setInputFiles({
    name: FILE_NAME,
    mimeType: "image/jpeg",
    buffer: Buffer.from("board photo persistence"),
  });

  const editor = page.locator(".cms-form__body .ProseMirror");
  await editor.fill("정답\n\n수정 전 ④\n\n수정 후 ③");
  await expect(page.getByText(FILE_NAME, { exact: true })).toBeVisible();
}

test.describe("게시판 사진 첨부 저장", () => {
  test.beforeEach(async ({ page }) => {
    await seed(page);
  });

  test("첨부 실패 뒤 같은 게시물에 사진만 재시도하고 재조회에도 유지한다", async ({ page }) => {
    const state = await installApi(page);
    await page.setViewportSize({ width: 1366, height: 900 });
    await gotoAndSettle(page, `${BASE}/workspace/community/board`, { timeout: 60_000 });
    await composePhotoPost(page);

    await page.getByRole("button", { name: "등록", exact: true }).click();
    await expect(page.getByText("게시물은 저장됐지만", { exact: false })).toBeVisible();
    await expect(page.getByText(FILE_NAME, { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "첨부 다시 시도", exact: true })).toBeVisible();
    expect(state.createCount).toBe(1);
    expect(state.uploadAttempts).toBe(1);

    await page.getByRole("button", { name: "첨부 다시 시도", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`\\?id=${POST_ID}$`));
    await expect(page.getByText("첨부파일 (1)", { exact: true })).toBeVisible();
    await expect(page.getByText(FILE_NAME, { exact: true })).toBeVisible();
    expect(state.createCount).toBe(1);
    expect(state.uploadAttempts).toBe(2);
    expect(state.uploadKeys).toHaveLength(2);
    expect(state.uploadKeys[1]).toBe(state.uploadKeys[0]);

    await page.reload();
    await expect(page.getByText("첨부파일 (1)", { exact: true })).toBeVisible();
    await expect(page.getByText(FILE_NAME, { exact: true })).toBeVisible();
  });

  test("390px에서도 본문 작성 후 선택한 사진과 재시도 동선을 유지한다", async ({ page }) => {
    await installApi(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoAndSettle(page, `${BASE}/workspace/community/board`, { timeout: 60_000 });
    await composePhotoPost(page);

    await page.getByRole("button", { name: "등록", exact: true }).click();
    await expect(page.getByText(FILE_NAME, { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "첨부 다시 시도", exact: true })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
