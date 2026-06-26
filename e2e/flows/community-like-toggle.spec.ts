/**
 * E2E: 커뮤니티 좋아요 토글 + 댓글 좋아요 + 주소복사 + 404/권한 + visibility gate
 * TCHUL public landing tenant
 * Tag: [E2E-{timestamp}]
 * Backend: POST /api/v1/community/posts/<id>/like/ (toggle) / DELETE (cancel)
 */

import { test, expect } from "../fixtures/strictTest";
import { loginViaUI, getBaseUrl } from "../helpers/auth";

const BASE = getBaseUrl("tchul-admin");
const TIMESTAMP = Date.now();
const TAG = `[E2E-${TIMESTAMP}]`;

// ── helpers ──────────────────────────────────────────────────────────────────

async function screenshot(page: import("@playwright/test").Page, name: string) {
  await page.screenshot({
    path: `e2e/screenshots/community-like-${name}-${TIMESTAMP}.png`,
    fullPage: false,
  });
}

// ── tests ─────────────────────────────────────────────────────────────────────

test.describe("커뮤니티 좋아요 토글 E2E", () => {

  // S1 + S2 + S3: 글쓰기 → 좋아요 토글 → 댓글 좋아요 → 주소복사
  test("S1-S3: 글쓰기 + 게시물 좋아요 토글 + 댓글 좋아요 + 주소복사", async ({ page }) => {
    // ── 로그인 ──────────────────────────────────────────────────────────────
    await loginViaUI(page, "tchul-admin");

    // ── 글쓰기 페이지로 이동 ─────────────────────────────────────────────────
    await page.goto(`${BASE}/landing/community/board/write`, { waitUntil: "load" });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    // 제목 + 내용 입력
    await page.locator('[data-testid="landing-community-write-title"]').fill(`${TAG} like-toggle test`);
    await page.locator('[data-testid="landing-community-write-content"]').fill("좋아요 토글 E2E");

    await screenshot(page, "s1-before-submit");

    // 글 등록
    await page.locator('[data-testid="landing-community-write-submit"]').click();

    // 글 상세 페이지로 이동 대기 (/landing/community/board/posts/<id>)
    await page.waitForURL(/\/landing\/community\/board\/posts\/\d+/, { timeout: 20_000 });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    const postUrl = page.url();
    console.log("Post URL:", postUrl);

    // 본문 노출 확인
    await expect(page.locator('[data-testid="landing-community-post-body"]')).toBeVisible();

    await screenshot(page, "s1-post-detail");

    // ── 좋아요 버튼 확인 ─────────────────────────────────────────────────────
    const likeBtn = page.locator('[data-testid="landing-community-like"]');
    await expect(likeBtn).toBeVisible();

    // 초기 상태 — 좋아요 0
    await expect(likeBtn).toContainText("좋아요 0");
    const initialBorder = await likeBtn.evaluate((el) => getComputedStyle(el).borderColor);
    console.log("Initial border color:", initialBorder);

    // ── 1차 클릭 → 좋아요 1 (active) ────────────────────────────────────────
    // Use Promise.all to wait for both: the API POST response AND the optimistic DOM update
    const t0 = Date.now();
    const [like1Resp] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes("/like/") && r.request().method() === "POST",
        { timeout: 8_000 }
      ),
      likeBtn.click(),
    ]);
    // optimistic update: DOM should change almost immediately (< 1s)
    await expect(likeBtn).toContainText("좋아요 1", { timeout: 3_000 });
    const latency = Date.now() - t0;
    console.log(`Like toggle latency: ${latency}ms`);
    const like1Body = await like1Resp.json() as { liked?: boolean; count?: number };
    console.log("1st click API response:", like1Body);

    // active 스타일 검증 — aria-pressed=true
    await expect(likeBtn).toHaveAttribute("aria-pressed", "true");
    const activeBorder = await likeBtn.evaluate((el) => getComputedStyle(el).borderColor);
    console.log("Active border color:", activeBorder);

    await screenshot(page, "s1-like-active");

    // ── 2차 클릭 → 취소 → 좋아요 0 — wait for DELETE API to complete before next click ───
    const [unlike1Resp] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes("/like/") && r.request().method() === "DELETE",
        { timeout: 8_000 }
      ),
      likeBtn.click(),
    ]);
    await expect(likeBtn).toContainText("좋아요 0", { timeout: 3_000 });
    await expect(likeBtn).toHaveAttribute("aria-pressed", "false");
    const unlike1Body = await unlike1Resp.json() as { liked?: boolean; count?: number };
    console.log("2nd click (unlike) API response:", unlike1Body);
    await screenshot(page, "s1-like-cancelled");

    // ── 3차 클릭 → 좋아요 1 (다시 활성) — wait for POST to complete before reload ──────
    const [likeResp] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes("/like/") && r.request().method() === "POST",
        { timeout: 8_000 }
      ),
      likeBtn.click(),
    ]);
    await expect(likeBtn).toContainText("좋아요 1", { timeout: 3_000 });
    await expect(likeBtn).toHaveAttribute("aria-pressed", "true");
    // Confirm backend responded with liked: true
    const likeRespBody = await likeResp.json() as { liked?: boolean; count?: number };
    console.log("3rd click API response:", likeRespBody);

    // ── F5 새로고침 → 영속화 확인 ─────────────────────────────────────────
    // Extract post ID from URL to build exact filter for the post detail GET
    const postId = page.url().split("/posts/")[1]?.replace(/\D/g, "");
    console.log("Post ID for reload check:", postId);

    // Set up response listener BEFORE reload, matching only the specific post detail endpoint
    const postDetailRespPromise = page.waitForResponse(
      (r) => {
        const url = r.url();
        const method = r.request().method();
        // Match /community/posts/<id>/ but NOT /replies/ or /like/
        return (
          method === "GET" &&
          url.includes(`/community/posts/${postId}/`) &&
          !url.includes("/replies/") &&
          !url.includes("/like/") &&
          r.status() === 200
        );
      },
      { timeout: 25_000 }
    );

    await page.reload({ waitUntil: "load" });

    const getResp = await postDetailRespPromise;
    // Also wait for networkidle so React has time to update DOM from the GET response
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    const getRespBody = await getResp.json() as { like_count?: number; is_liked?: boolean };
    console.log("GET after reload — like_count:", getRespBody.like_count, "is_liked:", getRespBody.is_liked);

    const likeBtnAfterReload = page.locator('[data-testid="landing-community-like"]');
    await expect(likeBtnAfterReload).toBeVisible({ timeout: 10_000 });
    await expect(likeBtnAfterReload).toContainText("좋아요 1", { timeout: 15_000 });
    await expect(likeBtnAfterReload).toHaveAttribute("aria-pressed", "true");
    await screenshot(page, "s1-like-persisted-after-reload");

    // ── S2: 댓글 작성 ────────────────────────────────────────────────────────
    const replyInput = page.locator('[data-testid="landing-community-reply-input"]');
    await expect(replyInput).toBeVisible();
    await replyInput.fill("좋아요 테스트 댓글");

    await page.locator('button[type="submit"]:has-text("댓글 등록")').click();
    // 댓글 등록 후 목록에 나타날 때까지 대기
    await page.waitForFunction(() => {
      const buttons = document.querySelectorAll('[data-testid^="landing-community-reply-like-"]');
      return buttons.length > 0;
    }, undefined, { timeout: 10_000 });

    await screenshot(page, "s2-reply-added");

    // 댓글 좋아요 버튼 찾기 (첫 번째)
    const replyLikeBtn = page.locator('[data-testid^="landing-community-reply-like-"]').first();
    await expect(replyLikeBtn).toBeVisible();

    // 초기 — 좋아요 0 + inactive state
    await expect(replyLikeBtn).toContainText("좋아요 0");
    await expect(replyLikeBtn).toHaveAttribute("aria-pressed", "false");

    // 클릭 → 좋아요 1 + active state
    await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes("/replies/") && r.url().includes("/like/") && r.request().method() === "POST",
        { timeout: 8_000 },
      ),
      replyLikeBtn.click(),
    ]);
    await expect(replyLikeBtn).toHaveAttribute("aria-pressed", "true");
    await expect(replyLikeBtn).toContainText("좋아요 1", { timeout: 3_000 });
    await screenshot(page, "s2-reply-like-active");

    // 다시 클릭 → 좋아요 0 + inactive state
    await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes("/replies/") && r.url().includes("/like/") && r.request().method() === "DELETE",
        { timeout: 8_000 },
      ),
      replyLikeBtn.click(),
    ]);
    await expect(replyLikeBtn).toHaveAttribute("aria-pressed", "false");
    await expect(replyLikeBtn).toContainText("좋아요 0", { timeout: 3_000 });
    await screenshot(page, "s2-reply-like-cancelled");

    // ── S3: 주소복사 버튼 ────────────────────────────────────────────────────
    const shareBtn = page.locator('[data-testid="landing-community-share"]');
    await expect(shareBtn).toBeVisible();

    // 클립보드 권한을 브라우저에 grant
    await page.context().grantPermissions(["clipboard-write", "clipboard-read"]);

    await shareBtn.click();
    // 버튼 텍스트 → "복사됨 ✓"
    await expect(shareBtn).toContainText("복사됨", { timeout: 3_000 });
    await screenshot(page, "s3-share-done");

    // 복사 완료 상태가 원래 라벨로 되돌아오는지 확인
    await expect(shareBtn).toContainText("주소복사", { timeout: 5_000 });
    await screenshot(page, "s3-share-reverted");
  });

  // S4: 404
  test("S4-a: 없는 postId → '글을 찾을 수 없습니다' + 게시판 목록으로 버튼", async ({ page }) => {
    await loginViaUI(page, "tchul-admin");
    await page.goto(`${BASE}/landing/community/board/posts/99999999`, { waitUntil: "load" });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    await expect(page.locator("text=글을 찾을 수 없습니다")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("text=게시판 목록으로")).toBeVisible({ timeout: 5_000 });
    await screenshot(page, "s4-not-found");
  });

  // S4: 비로그인 → 로그인 유도
  test("S4-b: 비로그인으로 게시물 접근 → 로그인 유도 화면", async ({ browser }) => {
    // 새 incognito context
    const ctx = await browser.newContext({ storageState: undefined });
    const page = await ctx.newPage();
    try {
      // 임의의 실존 가능성 있는 URL (낮은 id)
      await page.goto(`${BASE}/landing/community/board/posts/1`, { waitUntil: "load" });
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

      // 로그인 유도 텍스트 OR 로그인 링크 확인 (first() to avoid strict-mode violation)
      const loginPrompt = page.locator("text=학원 가족만 볼 수 있는 글이에요");
      const loginLink = page.locator("a:has-text('로그인하고 보기')");
      const either = loginPrompt.or(loginLink).first();
      await expect(either).toBeVisible({ timeout: 10_000 });

      await page.screenshot({
        path: `e2e/screenshots/community-like-s4-unauthenticated-${TIMESTAMP}.png`,
        fullPage: false,
      });
    } finally {
      await ctx.close();
    }
  });

  // S6: visibility gate — 비로그인 접근 (uses page fixture for auth stability)
  // Note: owner can create board posts. Using board type
  // which has the same frontend visibility gate (login required for all post types).
  test("S6: visibility gate — 비로그인으로 게시물 접근 → 로그인 유도", async ({ page, browser }) => {
    // Use fixture page (auth already stable via loginViaUI)
    await loginViaUI(page, "tchul-admin");

    // Navigate to board write page.
    await page.goto(`${BASE}/landing/community/board/write`, { waitUntil: "load" });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    await page.locator('[data-testid="landing-community-write-title"]').fill(`${TAG} visibility gate test`);
    await page.locator('[data-testid="landing-community-write-content"]').fill("visibility gate E2E test — unauthenticated access blocked");

    await page.screenshot({ path: `e2e/screenshots/community-like-s6-before-submit-${TIMESTAMP}.png` });

    await page.locator('[data-testid="landing-community-write-submit"]').click();

    // Navigate to any board post page after submit
    await page.waitForURL(/\/landing\/community\/\w+\/posts\/\d+/, { timeout: 25_000 });
    const qnaPostUrl = page.url();
    console.log("QnA post URL:", qnaPostUrl);

    await page.screenshot({ path: `e2e/screenshots/community-like-s6-qna-created-${TIMESTAMP}.png` });

    // 비로그인으로 같은 URL 접근 (fresh incognito context)
    const anonCtx = await browser.newContext({ storageState: undefined });
    const anonPage = await anonCtx.newPage();
    try {
      await anonPage.goto(qnaPostUrl, { waitUntil: "load" });
      await anonPage.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

      // 로그인 유도 OR 404 (visibility gate) — first() avoids strict-mode when multiple match
      const loginPrompt = anonPage.locator("text=학원 가족만 볼 수 있는 글이에요");
      const loginLink = anonPage.locator("a:has-text('로그인하고 보기')");
      const notFound = anonPage.locator("text=글을 찾을 수 없습니다");
      const gated = loginPrompt.or(loginLink).or(notFound).first();
      await expect(gated).toBeVisible({ timeout: 10_000 });

      await anonPage.screenshot({
        path: `e2e/screenshots/community-like-s6-qna-gated-${TIMESTAMP}.png`,
        fullPage: false,
      });
    } finally {
      await anonCtx.close();
    }
  });
});
