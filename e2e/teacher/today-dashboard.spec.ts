/**
 * E2E: 선생앱 Today 대시보드
 * - 인사말 + KPI 4그리드(수업/출결입력/처리할일/최근제출)
 * - "지금 처리할 일" 섹션 항상 노출(0건이면 친화 빈 카드)
 * - "오늘의 수업" 헤더 + 세션 카드(또는 빈 상태 CTA)
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

test.describe("선생앱 Today 대시보드", () => {
  test.use({ viewport: MOBILE_VIEWPORT, userAgent: MOBILE_UA });

  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
    await page.evaluate(() => {
      localStorage.removeItem("teacher:preferAdmin");
    });
  });

  test("인사말 + KPI 4그리드 + 핵심 섹션 노출, 콘솔 에러 없음", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto(`${BASE}/teacher`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForTimeout(2500);

    // 인사말 (관리자 로그인이라 user.name fallback "선생님" 가능)
    await expect(page.getByText(/안녕하세요/).first()).toBeVisible({ timeout: 8_000 });

    // KPI 4개 라벨 (변경 시 ui-quality.md 기록)
    await expect(page.getByText("오늘 수업", { exact: true })).toBeVisible();
    await expect(page.getByText("출결 입력", { exact: true })).toBeVisible();
    await expect(page.getByText("처리할 일", { exact: true })).toBeVisible();
    await expect(page.getByText("최근 제출", { exact: true })).toBeVisible();

    // 섹션 헤더 (항상 노출)
    await expect(page.getByText("지금 처리할 일", { exact: true })).toBeVisible();
    await expect(page.getByText("오늘의 수업", { exact: true })).toBeVisible();

    // 구 디자인 잔재 없음
    await expect(page.getByText("바로가기", { exact: true })).toHaveCount(0);
    await expect(page.getByText("운영 강의", { exact: true })).toHaveCount(0);
    await expect(page.getByText("총 시험", { exact: true })).toHaveCount(0);

    const hardErrors = errors.filter((e) => {
      const low = e.toLowerCase();
      if (low.includes("warning") || low.includes("favicon") || low.includes("sourcemap")) return false;
      if (low.includes("failed to load resource")) return false;
      if (low.includes("404") || low.includes("network error")) return false;
      return true;
    });
    expect(hardErrors, `JS runtime errors:\n${hardErrors.join("\n")}`).toHaveLength(0);
  });

  test("처리할 일: 항목이 있으면 라벨 노출, 0건이면 친화 빈 카드", async ({ page }) => {
    await page.goto(`${BASE}/teacher`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForTimeout(3500);

    // 헤더는 항상 보여야 함 (자리 일관성)
    await expect(page.getByText("지금 처리할 일", { exact: true })).toBeVisible({ timeout: 8_000 });

    const allowedLabels = [
      "답변 대기 질문",
      "답변 대기 상담",
      "클리닉 예약 신청",
      "가입 신청 학생",
      "처리 대기 제출",
    ];

    // 페이지 전체에서 라벨 매칭으로 두 시나리오 분기
    let hasItems = false;
    for (const label of allowedLabels) {
      const cnt = await page.getByText(label, { exact: true }).count();
      if (cnt > 0) {
        hasItems = true;
        break;
      }
    }

    if (hasItems) {
      // PendingRow의 aria-label: "{라벨} {N}건 처리하기"
      await expect(page.getByRole("button", { name: /\d+건 처리하기/ }).first()).toBeVisible();
    } else {
      // 0건 친화 카드
      await expect(page.getByText("처리할 일이 없어요", { exact: false })).toBeVisible();
    }
  });
});
