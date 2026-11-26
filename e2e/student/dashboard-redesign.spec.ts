/**
 * 학생 대시보드 개편 — 지정된 후보 환경 검증.
 *
 * 점검 항목:
 *   - 오늘 할 일과 QR 출석이 보이는지
 *   - 그림 가이드와 프로필 메뉴를 각각 열 수 있는지
 *   - 페이지 로드 시 console error 0건
 *   - 모바일 뷰포트 (390x844) 풀페이지 스크린샷
 *
 * 학부모 자녀 스위처는 별도 학부모 계정이 필요 — 본 spec 범위 외.
 */
import { test, expect } from "../fixtures/strictTest";
import { loginViaUI } from "../helpers/auth";

test.describe("학생 대시보드 개편", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("학생 홈에서 QR 출석, 그림 가이드, 프로필 메뉴를 찾을 수 있다", async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
    });

    await loginViaUI(page, "student");
    await page.goto(`${(process.env.E2E_BASE_URL || "https://hakwonplus.com").replace(/\/$/, "")}/student/dashboard`, { waitUntil: "load" });
    await page.waitForLoadState("networkidle", { timeout: 12_000 }).catch(() => {});

    await expect(page.getByRole("heading", { name: "오늘", exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name: "학습 현황", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /^전체 메뉴/ })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /QR 출석/ })).toBeVisible();
    await page.getByRole("button", { name: "학생 사용 가이드", exact: true }).click();
    await page.getByRole("button", { name: "프로필에서 내 정보와 설정 찾기" }).click();
    await expect(page.getByRole("dialog").getByRole("img")).toBeVisible();
    await page.getByRole("button", { name: "가이드 닫기" }).click();
    await page.getByRole("button", { name: "프로필 메뉴", exact: true }).click();
    await expect(page.getByRole("button", { name: "내 정보", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "프로필 메뉴", exact: true }).click();
    await expect(page.getByRole("tablist", { name: "자녀 선택" })).toHaveCount(0);

    await page.screenshot({ path: testInfo.outputPath("dashboard-redesign.png"), fullPage: true });

    /* 페이지 로드 시 console.error / pageerror 0건 (네트워크 일시 오류는 strictBrowser가 분류) */
    const fatal = errors.filter((e) =>
      !/Failed to load resource/i.test(e) && !/favicon/i.test(e),
    );
    expect(fatal, `unexpected runtime errors:\n${fatal.join("\n")}`).toEqual([]);
  });
});
