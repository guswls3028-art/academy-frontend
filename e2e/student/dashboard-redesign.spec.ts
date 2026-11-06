/**
 * 학생 대시보드 개편 — 지정된 후보 환경 검증.
 *
 * 점검 항목:
 *   - 새 섹션 골격 (오늘 할 일, 학습 현황, 전체 메뉴와 상태 카드)
 *   - 전체 메뉴로 이동하는 링크와 상태 카드 진입이 유지되는지
 *   - 페이지 로드 시 console error 0건
 *   - 모바일 뷰포트 (390x844) 풀페이지 스크린샷
 *
 * 학부모 자녀 스위처는 별도 학부모 계정이 필요 — 본 spec 범위 외.
 */
import { test, expect } from "../fixtures/strictTest";
import { loginViaUI } from "../helpers/auth";

test.describe("학생 대시보드 개편", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("새 레이아웃 — 섹션 골격 + 전체 메뉴 이동 + 중복 제거", async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
    });

    await loginViaUI(page, "student");
    await page.goto(`${(process.env.E2E_BASE_URL || "https://hakwonplus.com").replace(/\/$/, "")}/student/dashboard`, { waitUntil: "load" });
    await page.waitForLoadState("networkidle", { timeout: 12_000 }).catch(() => {});

    /* 핵심 섹션 */
    await expect(page.getByText("확인할 일", { exact: true })).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText("나의 학습 현황", { exact: true })).toBeVisible();

    const appArea = page.locator("[data-guide='dash-apps']");
    await expect(appArea.getByRole("link")).toHaveCount(2);
    await expect(appArea.getByRole("link", { name: /^전체 메뉴/ })).toHaveAttribute("href", "/student/menu");
    await expect(appArea.getByRole("link", { name: /^클리닉 패스카드/ })).toHaveAttribute("href", "/student/idcard");

    /* 학생 본인 계정에선 학부모 자녀 스위처 노출 안 됨 */
    await expect(page.getByRole("tablist", { name: "자녀 선택" })).toHaveCount(0);

    await page.screenshot({ path: testInfo.outputPath("dashboard-redesign.png"), fullPage: true });

    /* 페이지 로드 시 console.error / pageerror 0건 (네트워크 일시 오류는 strictBrowser가 분류) */
    const fatal = errors.filter((e) =>
      !/Failed to load resource/i.test(e) && !/favicon/i.test(e),
    );
    expect(fatal, `unexpected runtime errors:\n${fatal.join("\n")}`).toEqual([]);
  });
});
