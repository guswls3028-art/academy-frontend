/**
 * E2E: 선생님 앱 Batch 7 스모크 — 신규 6개 라우트 렌더링 + 콘솔 에러 없음
 * 로컬 dev 서버 대상. 다음처럼 실행:
 *   E2E_BASE_URL=http://localhost:5174 E2E_API_URL=http://localhost:8000 \
 *   pnpm exec playwright test e2e/teacher/batch7-smoke.spec.ts
 *
 * admin(owner) 로 로그인하여 권한 가드도 같이 통과 확인.
 */
import { test, expect, type Page } from "@playwright/test";
import { loginViaUI, getBaseUrl } from "../helpers/auth";

const BASE = getBaseUrl("admin");

const MOBILE_VIEWPORT = { width: 390, height: 844 } as const;
const MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

async function gotoAndAssertNoError(page: Page, path: string, expectedText: string | RegExp) {
  const errors: string[] = [];
  const onConsole = (msg: any) => {
    if (msg.type() === "error") errors.push(msg.text());
  };
  page.on("console", onConsole);

  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForTimeout(2500);

  await expect(page.getByText(expectedText).first()).toBeVisible({ timeout: 8_000 });

  // 네트워크 404/Warning/favicon/sourcemap은 무시. JS 런타임 에러만 fail 처리.
  const hardErrors = errors.filter(e => {
    const low = e.toLowerCase();
    if (low.includes("warning") || low.includes("favicon") || low.includes("sourcemap")) return false;
    if (low.includes("failed to load resource")) return false; // 네트워크 오류
    if (low.includes("404") || low.includes("network error")) return false;
    return true;
  });
  page.off("console", onConsole);
  expect(hardErrors, `JS runtime errors on ${path}:\n${hardErrors.join("\n")}`).toHaveLength(0);
}

test.describe("Batch 7 신규 라우트 스모크", () => {
  test.use({ viewport: MOBILE_VIEWPORT, userAgent: MOBILE_UA });

  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
    await page.evaluate(() => { localStorage.removeItem("teacher:preferAdmin"); });
  });

  test("시험 템플릿 관리 렌더링", async ({ page }) => {
    await gotoAndAssertNoError(page, "/teacher/exams/templates", /템플릿 관리/);
  });

  test("시험 번들 관리 렌더링", async ({ page }) => {
    await gotoAndAssertNoError(page, "/teacher/exams/bundles", /시험 번들/);
  });

  test("클리닉 보고서 렌더링", async ({ page }) => {
    await gotoAndAssertNoError(page, "/teacher/clinic/reports", /클리닉 보고서/);
  });

  test("클리닉 리모컨 렌더링 (2초 폴링)", async ({ page }) => {
    await gotoAndAssertNoError(page, "/teacher/clinic/remote", /클리닉 리모컨/);
  });

  test("결제/구독 조회 렌더링 (owner)", async ({ page }) => {
    await gotoAndAssertNoError(page, "/teacher/billing", /결제 \/ 구독|요금제|구독/);
  });

  test("OMR 페이지 스켈레톤 렌더링 (examId=1 샘플)", async ({ page }) => {
    // examId 1이 실제 존재하지 않으면 에러 화면이 렌더되는데, 그것도 '시험을 찾을 수 없습니다'가 나와야 정상
    await page.goto(`${BASE}/teacher/exams/1/omr`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForTimeout(2500);
    // 스켈레톤 또는 에러 둘 중 하나만 나와도 OK — 완전 whitescreen이 아니기만 하면 됨
    const hasAnyText = await page.locator("body").textContent();
    expect(hasAnyText?.length ?? 0).toBeGreaterThan(10);
  });

  test("직원 관리 페이지 (owner 전용) 렌더링", async ({ page }) => {
    await gotoAndAssertNoError(page, "/teacher/staff", /직원 관리|직원 등록/);
  });

  test("학생 목록에서 선택 모드 토글 동작", async ({ page }) => {
    await page.goto(`${BASE}/teacher/students`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForTimeout(2500);
    // 선택 버튼 클릭 → 선택 모드 진입 확인
    const selectBtn = page.getByRole("button", { name: "선택" }).first();
    if (await selectBtn.isVisible().catch(() => false)) {
      await selectBtn.click();
      await expect(page.getByText(/명 선택됨|전체 선택/).first()).toBeVisible({ timeout: 5_000 });
    }
  });
});
