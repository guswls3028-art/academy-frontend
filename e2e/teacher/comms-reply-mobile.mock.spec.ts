import { test, expect } from "../fixtures/strictTest";

const BASE = process.env.E2E_LOCAL_BASE_URL || "http://127.0.0.1:5175";
const POST_ID = 990001;

test.describe("선생님 소통 모바일 답변 시트", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  });

  test("Q&A 답변 등록 버튼이 하단 탭바에 가려지지 않고 답변을 등록한다", async ({ page }) => {
    const post = {
      id: POST_ID,
      post_type: "qna",
      title: "[E2E] 모바일 답변 버튼 회귀",
      content: "<p>감수 1분열 중기는 다양성과 상관이 있는데</p><p>왜 감수 2분열 중기는 다양성과 상관이 없나요</p>",
      author_display_name: "어찬희",
      author_role: "student",
      replies_count: 0,
      created_at: "2026-06-03T08:49:00.000Z",
    };
    const replies: Array<{
      id: number;
      post: number;
      content: string;
      author_display_name: string;
      author_role: string;
      created_at: string;
    }> = [];

    await page.route("**/api/v1/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname.replace(/^\/api\/v1/, "");
      const json = (body: unknown, status = 200) =>
        route.fulfill({
          status,
          contentType: "application/json",
          body: JSON.stringify(body),
        });

      if (path === "/core/program/") {
        return json({
          tenantCode: "hakwonplus",
          display_name: "학원플러스",
          ui_config: { login_title: "학원플러스" },
          feature_flags: {},
          is_active: true,
        });
      }

      if (path === "/core/me/") {
        return json({
          id: 101,
          username: "teacher",
          name: "선생님",
          phone: null,
          is_staff: true,
          is_superuser: false,
          tenantRole: "admin",
        });
      }

      if (path === "/community/admin/posts/") {
        const postType = url.searchParams.get("post_type");
        const results = postType === "qna" ? [post] : [];
        return json({ results, count: results.length });
      }

      if (path === "/community/posts/" && request.method() === "GET") {
        return json({ results: [post], count: 1 });
      }

      if (path === `/community/posts/${POST_ID}/replies/` && request.method() === "GET") {
        return json({ results: replies, count: replies.length });
      }

      if (path === `/community/posts/${POST_ID}/replies/` && request.method() === "POST") {
        const raw = request.postData();
        let payload: { content?: string } = {};
        if (raw) {
          try {
            payload = JSON.parse(raw) as { content?: string };
          } catch {
            payload = Object.fromEntries(new URLSearchParams(raw)) as { content?: string };
          }
        }
        const reply = {
          id: 880001,
          post: POST_ID,
          content: `<p>${String(payload.content ?? "")}</p>`,
          author_display_name: "선생님",
          author_role: "staff",
          created_at: new Date().toISOString(),
        };
        replies.push(reply);
        post.replies_count = replies.length;
        return json(reply, 201);
      }

      return json({});
    });

    await page.addInitScript(() => {
      localStorage.setItem("access", "mock-access");
      localStorage.setItem("refresh", "mock-refresh");
      localStorage.setItem("tenant_code", "hakwonplus");
      sessionStorage.setItem("tenantCode", "hakwonplus");
    });

    await page.goto(`${BASE}/teacher/comms?tab=qna`, { waitUntil: "load", timeout: 20_000 });

    await expect(page.getByText(post.title)).toBeVisible({ timeout: 10_000 });
    await page.getByText(post.title).click();
    await expect(page.getByText("감수 1분열 중기는 다양성과 상관이 있는데")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("왜 감수 2분열 중기는 다양성과 상관이 없나요")).toBeVisible();
    await expect.poll(async () => page.locator("body").innerText()).not.toContain("<p>");
    await expect(page.getByText("아직 답변이 없습니다")).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: "답변 작성" }).click();
    const sheet = page.getByRole("dialog", { name: "답변 작성" });
    await expect(sheet).toBeVisible({ timeout: 10_000 });

    const answer = "감수 2분열이라서 그래요.";
    await sheet.getByPlaceholder(/답변을 입력하세요/).fill(answer);

    const submit = sheet.getByRole("button", { name: "등록" });
    await expect(submit).toBeVisible();
    await expect(submit).toBeEnabled();
    await expect
      .poll(() => submit.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        const target = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return target === el || el.contains(target);
      }))
      .toBe(true);

    const replyResponse = page.waitForResponse(
      (res) => res.request().method() === "POST" && res.url().includes(`/community/posts/${POST_ID}/replies/`),
      { timeout: 10_000 },
    );
    await submit.click();
    expect((await replyResponse).status()).toBe(201);

    await expect(sheet).not.toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(answer)).toBeVisible({ timeout: 10_000 });
    await expect.poll(async () => page.locator("body").innerText()).not.toContain("<p>");
  });
});
