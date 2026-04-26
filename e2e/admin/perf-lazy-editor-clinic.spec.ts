/**
 * E2E: 프론트엔드 성능 최적화 2건 운영 검증
 *
 * 시나리오 A — RichTextEditor lazy 분할 회귀 없음
 *   공지사항 페이지 "추가" 버튼 → NoticeCreatePane 인라인 렌더
 *   → ProseMirror 에디터 마운트 → 제목+내용 입력 → "등록" → 목록 노출 → cleanup
 *
 * 시나리오 B — clinic 훅 staleTime 회귀 없음
 *   /admin/clinic 진입 → 페이지 정상 렌더 + 콘솔/네트워크 에러 없음
 *
 * 시나리오 C — 빠른 스모크
 *   대시보드 + 학생 목록 → ChunkLoadError 없이 렌더
 */
// 의도적 baseTest 사용: 본 spec은 시나리오 B/C 에서 자체 consoleErrors 수집 +
// criticalErrors 필터링 로직(L185~) 으로 콘솔 결함을 직접 검증한다.
// strictTest 로 마이그레이션하면 attachStrictBrowserGuards 와 자체 수집 로직이
// 동일 채널을 이중 구독해 false positive 와 noise 가 늘어난다.
import { test, expect, type Page } from "@playwright/test";
import { loginViaUI, getBaseUrl } from "../helpers/auth";

const BASE = getBaseUrl("admin");
const TIMESTAMP = Date.now();
const TAG = `[E2E-${TIMESTAMP}]`;

async function snap(page: Page, name: string) {
  await page.screenshot({
    path: `e2e/screenshots/perf-opt-${name}.png`,
    fullPage: false,
  });
}

// ─────────────────────────────────────────────
// 시나리오 A — RichTextEditor lazy 분할
// ─────────────────────────────────────────────
test.describe("시나리오 A — RichTextEditor lazy 분할 회귀", () => {
  const createdNoticeTitle = `${TAG} lazy editor test`;
  let createdNoticeId: string | null = null;

  test("공지 추가 패널에서 lazy 에디터 마운트 + 입력 + 등록", async ({
    page,
  }) => {
    await loginViaUI(page, "admin");

    // 1. 공지사항 페이지 진입
    await page.goto(`${BASE}/admin/community/notice`, {
      waitUntil: "load",
      timeout: 20000,
    });
    await page.waitForLoadState("networkidle");

    await snap(page, "A1-notice-list-before");

    // 2. "+ 추가" 버튼 클릭 (NoticeAdminPage: Button text "추가")
    const addBtn = page
      .getByRole("button", { name: /^\+\s*추가$|^추가$/ })
      .first();
    await expect(addBtn).toBeVisible({ timeout: 10000 });
    await addBtn.click();

    await snap(page, "A2-create-pane-opened");

    // 3. NoticeCreatePane이 인라인으로 렌더됨
    //    RichTextEditor lazy wrapper: Suspense fallback은 .rich-editor[aria-busy=true]
    //    실제 에디터: .ProseMirror
    //    최대 15초 기다림 (lazy chunk 로드 시간 포함)
    const editorContainer = page.locator(".ProseMirror").first();
    await expect(editorContainer).toBeVisible({ timeout: 15000 });

    await snap(page, "A3-editor-mounted");

    // 4. 제목 입력
    const titleInput = page
      .locator("input[placeholder*='공지 제목']")
      .first();
    await expect(titleInput).toBeVisible({ timeout: 5000 });
    await titleInput.fill(createdNoticeTitle);

    // 5. ProseMirror 에디터에 내용 입력
    await editorContainer.click();
    await page.keyboard.type(`${TAG} lazy editor — content body`);

    await snap(page, "A4-editor-typed");

    // 6. API 응답 캡처 준비
    const createResponsePromise = page.waitForResponse(
      (resp) =>
        resp.url().includes("/posts") &&
        resp.request().method() === "POST" &&
        resp.status() < 400,
      { timeout: 15000 }
    );

    // 7. "등록" 버튼 클릭
    const submitBtn = page
      .getByRole("button", { name: /^등록$|^등록 중/ })
      .first();
    await expect(submitBtn).toBeVisible({ timeout: 5000 });
    await submitBtn.click();

    // 8. 저장 API 응답 확인
    let savedStatus = 0;
    try {
      const resp = await createResponsePromise;
      savedStatus = resp.status();
      try {
        const body = await resp.json();
        createdNoticeId = String(body?.id ?? body?.data?.id ?? "");
        console.log(
          `[A] 공지 생성 성공: id=${createdNoticeId}, status=${savedStatus}, url=${resp.url()}`
        );
      } catch {
        console.log(`[A] 공지 생성 status=${savedStatus}`);
      }
    } catch (e) {
      console.warn(`[A] 저장 API 응답 캡처 실패: ${e}`);
    }

    await page.waitForLoadState("networkidle");
    await snap(page, "A5-after-register");

    // 9. 공지 목록에 TAG가 보이는지 확인 (등록 후 목록 갱신)
    const noticeInList = page.locator(`text=${TAG}`).first();
    await expect(noticeInList).toBeVisible({ timeout: 10000 });

    await snap(page, "A6-notice-in-list");

    console.log("[A] PASS — lazy editor 마운트 + 입력 + 등록 + 목록 반영 확인");
  });

  test.afterAll(async ({ browser }) => {
    if (!createdNoticeId) {
      console.log(`[A cleanup] createdNoticeId 없음 — TAG 텍스트로 UI 삭제 시도`);
    }
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    try {
      await loginViaUI(p, "admin");
      await p.goto(`${BASE}/admin/community/notice`, {
        waitUntil: "load",
        timeout: 20000,
      });
      await p.waitForLoadState("networkidle");

      // TAG가 있는 공지 카드 클릭
      const noticeCard = p.locator(`text=${TAG}`).first();
      const cardVisible = await noticeCard.isVisible({ timeout: 5000 }).catch(() => false);
      if (!cardVisible) {
        console.log("[A cleanup] TAG 공지 없음 — 이미 삭제됐거나 등록 안 됨");
        return;
      }
      await noticeCard.click();
      await p.waitForLoadState("networkidle");

      // 삭제 버튼
      const delBtn = p.getByRole("button", { name: "삭제" }).last();
      const delVisible = await delBtn.isVisible({ timeout: 5000 }).catch(() => false);
      if (!delVisible) {
        console.warn("[A cleanup] 삭제 버튼 없음");
        return;
      }
      await delBtn.click();

      // 확인 다이얼로그 ("삭제" 또는 "확인" 버튼)
      const confirmBtn = p
        .getByRole("button", { name: /^삭제$|^확인$|^예$/ })
        .last();
      const confirmVisible = await confirmBtn
        .isVisible({ timeout: 3000 })
        .catch(() => false);
      if (confirmVisible) await confirmBtn.click();

      await p.waitForLoadState("networkidle");
      console.log(`[A cleanup] 공지 삭제 완료 (id=${createdNoticeId ?? "unknown"})`);
    } catch (e) {
      console.warn(`[A cleanup] 실패: ${e}`);
    } finally {
      await ctx.close();
    }
  });
});

// ─────────────────────────────────────────────
// 시나리오 B — clinic 훅 staleTime 회귀
// ─────────────────────────────────────────────
test.describe("시나리오 B — clinic staleTime 회귀", () => {
  test("clinic 홈 페이지 정상 렌더 + 콘솔 에러 없음", async ({ page }) => {
    await loginViaUI(page, "admin");

    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    const networkErrors: string[] = [];
    page.on("response", (resp) => {
      if (
        resp.status() >= 500 &&
        resp.url().includes("api.hakwonplus.com")
      ) {
        networkErrors.push(`${resp.status()} ${resp.url()}`);
      }
    });

    // clinic 관련 API 응답 수집
    const clinicApiCalls: Array<{ url: string; status: number }> = [];
    page.on("response", (resp) => {
      if (
        resp.url().includes("/clinic/") ||
        resp.url().includes("participants") ||
        resp.url().includes("clinic-targets")
      ) {
        clinicApiCalls.push({ url: resp.url(), status: resp.status() });
      }
    });

    // /admin/clinic 진입
    await page.goto(`${BASE}/admin/clinic`, {
      waitUntil: "load",
      timeout: 20000,
    });
    await page.waitForLoadState("networkidle");

    await snap(page, "B1-clinic-home");

    // 페이지 주요 콘텐츠 확인
    const mainContent = page
      .locator("main, [class*='page'], [class*='home']")
      .first();
    await expect(mainContent).toBeVisible({ timeout: 10000 });

    // 콘텐츠 영역 중 하나라도 보여야 함
    const hasContent = await page
      .locator("[class*='card'], [class*='section'], [class*='panel'], table, ul, li")
      .first()
      .isVisible()
      .catch(() => false);

    await snap(page, "B2-clinic-content");

    console.log("[B] clinic API responses:", clinicApiCalls.slice(0, 15));
    console.log("[B] console errors:", consoleErrors.slice(0, 10));
    console.log("[B] network 5xx errors:", networkErrors.slice(0, 10));

    // ChunkLoadError 등 critical 에러 없어야 함
    const criticalErrors = consoleErrors.filter(
      (e) =>
        e.includes("ChunkLoadError") ||
        e.includes("Loading chunk") ||
        e.includes("Cannot read properties of undefined") ||
        e.includes("null is not an object")
    );
    expect(criticalErrors, `Critical JS errors: ${criticalErrors.join(", ")}`).toHaveLength(0);
    expect(hasContent, "clinic 페이지에 콘텐츠 없음").toBeTruthy();

    // clinic-participants, clinic-sessions-tree, clinic-settings 중 하나 이상 200 응답
    const successCalls = clinicApiCalls.filter((c) => c.status === 200);
    console.log("[B] 성공적인 clinic API 호출:", successCalls.length);
    expect(successCalls.length, "clinic API 200 응답 없음").toBeGreaterThan(0);
  });

  test("clinic 대기 신청 상태 변경 후 즉시 반영 (invalidate > staleTime)", async ({
    page,
  }) => {
    await loginViaUI(page, "admin");

    const clinicApiCalls: Array<{ url: string; method: string; status: number }> =
      [];
    page.on("response", (resp) => {
      if (
        resp.url().includes("/clinic/") ||
        resp.url().includes("participants") ||
        resp.url().includes("clinic-targets")
      ) {
        clinicApiCalls.push({
          url: resp.url(),
          method: resp.request().method(),
          status: resp.status(),
        });
      }
    });

    await page.goto(`${BASE}/admin/clinic`, {
      waitUntil: "load",
      timeout: 20000,
    });
    await page.waitForLoadState("networkidle");

    await snap(page, "B3-clinic-before-action");

    // 대기 신청 탭/버튼 찾기
    const pendingTab = page
      .locator("button, [role='tab']")
      .filter({ hasText: /대기|신청|Pending/i })
      .first();
    const pendingTabVisible = await pendingTab
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (pendingTabVisible) {
      await pendingTab.click();
      await page.waitForLoadState("networkidle");
      await snap(page, "B4-clinic-pending-tab");
    }

    // 승인 버튼 탐색
    const approveBtn = page
      .getByRole("button", { name: /^승인$|^Approve$/ })
      .first();
    const approveBtnVisible = await approveBtn
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (approveBtnVisible) {
      const beforeCount = clinicApiCalls.length;
      await approveBtn.click();
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1500);

      await snap(page, "B5-clinic-after-approve");

      const afterCount = clinicApiCalls.length;
      const refetchHappened = afterCount > beforeCount;
      console.log(
        `[B] 승인 전 API 호출: ${beforeCount}, 후: ${afterCount}, refetch 발생: ${refetchHappened}`
      );
      console.log("[B] 승인 후 clinic API:", clinicApiCalls.slice(beforeCount));
      expect(refetchHappened, "invalidate 후 refetch 없음 — staleTime이 캐시 재사용 막음").toBeTruthy();
    } else {
      console.log("[B] 대기 신청 없음 — 상태 변경 skip. 페이지 로드만 확인.");
      await expect(page.locator("main, [class*='page']").first()).toBeVisible();
    }
  });
});

// ─────────────────────────────────────────────
// 시나리오 C — 빠른 스모크
// ─────────────────────────────────────────────
test.describe("시나리오 C — lazy 분할 사이드 이펙트 스모크", () => {
  test("대시보드 렌더 + ChunkLoadError 없음", async ({ page }) => {
    await loginViaUI(page, "admin");

    const jsErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") jsErrors.push(msg.text());
    });

    await page.waitForLoadState("networkidle");
    await snap(page, "C1-dashboard");

    const criticalErrors = jsErrors.filter(
      (e) =>
        e.includes("ChunkLoadError") ||
        e.includes("Loading chunk") ||
        e.includes("Cannot read properties of undefined")
    );
    console.log("[C] dashboard console errors:", jsErrors.slice(0, 10));
    expect(criticalErrors, `ChunkLoadError detected: ${criticalErrors.join(", ")}`).toHaveLength(0);

    await expect(
      page.locator("main, [class*='dashboard'], [class*='page']").first()
    ).toBeVisible();
  });

  test("학생 목록 렌더 + ChunkLoadError 없음", async ({ page }) => {
    await loginViaUI(page, "admin");

    const jsErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") jsErrors.push(msg.text());
    });

    await page.goto(`${BASE}/admin/students`, {
      waitUntil: "load",
      timeout: 20000,
    });
    await page.waitForLoadState("networkidle");
    await snap(page, "C2-students-list");

    const criticalErrors = jsErrors.filter(
      (e) =>
        e.includes("ChunkLoadError") ||
        e.includes("Loading chunk") ||
        e.includes("Cannot read properties of undefined")
    );
    console.log("[C] students console errors:", jsErrors.slice(0, 10));
    expect(criticalErrors, `ChunkLoadError detected: ${criticalErrors.join(", ")}`).toHaveLength(0);

    await expect(page.locator("main, [class*='page']").first()).toBeVisible();
  });
});
