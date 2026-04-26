/**
 * E2E: 선생앱 Today 대시보드 — 재구성 검증
 * - 8타일 바로가기 제거
 * - vanity KPI(운영 강의/총 시험) 제거
 * - 미처리 일감 최상단(있을 때) + counsel 항목 포함
 * - 오늘의 수업 카운트 헤더
 *
 * 실행:
 *   E2E_BASE_URL=http://localhost:5174 E2E_API_URL=http://localhost:8000 \
 *   pnpm exec playwright test e2e/teacher/today-dashboard.spec.ts
 */
import { test, expect } from "../fixtures/strictTest";
import { loginViaUI, getBaseUrl } from "../helpers/auth";

const BASE = getBaseUrl("admin");

const MOBILE_VIEWPORT = { width: 390, height: 844 } as const;
const MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

test.describe("선생앱 Today 대시보드 재구성", () => {
  test.use({ viewport: MOBILE_VIEWPORT, userAgent: MOBILE_UA });

  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
    await page.evaluate(() => {
      localStorage.removeItem("teacher:preferAdmin");
    });
  });

  test("새 구조: 바로가기/허영KPI 제거 + 오늘의 수업 헤더 노출", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto(`${BASE}/teacher`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForTimeout(2500);

    await expect(page.getByText(/오늘의 수업/).first()).toBeVisible({ timeout: 8_000 });

    await expect(page.getByText("바로가기", { exact: true })).toHaveCount(0);
    await expect(page.getByText("운영 강의", { exact: true })).toHaveCount(0);
    await expect(page.getByText("총 시험", { exact: true })).toHaveCount(0);
    await expect(page.getByText("요약", { exact: true })).toHaveCount(0);

    const hardErrors = errors.filter((e) => {
      const low = e.toLowerCase();
      if (low.includes("warning") || low.includes("favicon") || low.includes("sourcemap")) return false;
      if (low.includes("failed to load resource")) return false;
      if (low.includes("404") || low.includes("network error")) return false;
      return true;
    });
    expect(hardErrors, `JS runtime errors:\n${hardErrors.join("\n")}`).toHaveLength(0);
  });

  test("미처리 일감 섹션 — 0건이면 숨김, 있으면 라우팅 동작", async ({ page }) => {
    await page.goto(`${BASE}/teacher`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForTimeout(3500);

    const pendingHeader = page.getByText("지금 처리할 일", { exact: true });
    const headerVisible = await pendingHeader.isVisible().catch(() => false);

    if (!headerVisible) {
      console.log("[INFO] 미처리 일감 0건 — 섹션 숨김 정상");
      return;
    }

    const allowedLabels = [
      "답변 대기 질문",
      "답변 대기 상담",
      "클리닉 예약 신청",
      "가입 신청 학생",
      "처리 대기 제출",
    ];

    const card = pendingHeader.locator("xpath=following::*[1]");
    const cardText = (await card.textContent()) || "";
    const matchedLabels = allowedLabels.filter((l) => cardText.includes(l));
    expect(
      matchedLabels.length,
      `미처리 일감에 알려진 라벨 미노출. 카드 텍스트: ${cardText}`,
    ).toBeGreaterThan(0);

    expect(cardText).toMatch(/\d+건/);
  });
});
