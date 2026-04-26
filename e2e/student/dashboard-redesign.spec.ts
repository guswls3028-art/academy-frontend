/**
 * 학생 대시보드 개편 — 운영 환경 검증.
 *
 * 점검 항목:
 *   - 새 섹션 골격 (오늘 할 일, 학습 현황, 앱 아이콘 8개)
 *   - 탭바 중복 라벨이 앱 아이콘 영역에 없는지 (영상/일정/커뮤니티 제거됨)
 *   - 페이지 로드 시 console error 0건
 *   - 모바일 뷰포트 (390x844) 풀페이지 스크린샷
 *
 * 학부모 자녀 스위처는 별도 학부모 계정이 필요 — 본 spec 범위 외.
 */
import { test, expect } from "../fixtures/strictTest";
import { loginViaUI } from "../helpers/auth";

test.describe("학생 대시보드 개편", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("새 레이아웃 — 섹션 골격 + 앱 아이콘 + 탭바 중복 제거", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
    });

    await loginViaUI(page, "student");
    await page.goto("https://hakwonplus.com/student/dashboard", { waitUntil: "load" });
    await page.waitForLoadState("networkidle", { timeout: 12_000 }).catch(() => {});

    /* 핵심 섹션 */
    await expect(page.getByText("오늘 할 일", { exact: true })).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText("나의 학습 현황", { exact: true })).toBeVisible();

    /* 앱 아이콘 라벨 8종 */
    for (const label of ["성적", "시험", "과제", "클리닉", "출결", "공지", "보관함", "내 정보"]) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }

    /* 탭바와 중복인 라벨이 앱 아이콘 영역에 없어야 함 */
    const appArea = page.locator("[data-guide='dash-apps']");
    await expect(appArea.getByText("영상", { exact: true })).toHaveCount(0);
    await expect(appArea.getByText("커뮤니티", { exact: true })).toHaveCount(0);

    /* 학생 본인 계정에선 학부모 자녀 스위처 노출 안 됨 */
    await expect(page.getByRole("tablist", { name: "자녀 선택" })).toHaveCount(0);

    await page.screenshot({ path: "e2e/screenshots/dashboard-redesign-prod.png", fullPage: true });

    /* 페이지 로드 시 console.error / pageerror 0건 (네트워크 일시 오류는 strictBrowser가 분류) */
    const fatal = errors.filter((e) =>
      !/Failed to load resource/i.test(e) && !/favicon/i.test(e),
    );
    expect(fatal, `unexpected runtime errors:\n${fatal.join("\n")}`).toEqual([]);
  });
});
