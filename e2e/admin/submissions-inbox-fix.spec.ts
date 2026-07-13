/**
 * Submissions Inbox — 미식별/orphan row 액션 분기 회귀 검증.
 *
 * 회귀 케이스:
 * - 미식별 row 의 "바로가기" 클릭 → SessionLayout 의 "잘못된 세션 접근입니다." 데드락
 * - orphan row (Exam 결손) 에 대한 처리 동선 부재
 *
 * 검증:
 * - 인박스 페이지에 "잘못된 세션 접근" 텍스트 미노출
 * - needs_identification + target_resolved 분기에 따라 학생지정 / 지정 불가 / 폐기 버튼 노출
 * - 폐기 클릭 시 confirm 다이얼로그 노출 (실제 폐기는 cancel — 데이터 보호)
 *
 * 데이터 의존: 미식별/orphan row 가 있을 때만 의미. 데이터 없으면 skip.
 */
import { test, expect } from "../fixtures/strictTest";
import { loginViaUI, getBaseUrl } from "../helpers/auth";

test("미식별 제출 인박스 — 가드 + 액션 분기 + confirm 다이얼로그", async ({ page }) => {
  test.setTimeout(120_000);

  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

  await loginViaUI(page, "admin");

  await page.goto(`${getBaseUrl("admin")}/admin/results/submissions`, { waitUntil: "domcontentloaded" });

  // 데이터 로드 대기
  await page.waitForFunction(
    () => {
      const banner = document.querySelector('[data-testid="submissions-needs-identification-banner"]');
      const polishBtn = Array.from(document.querySelectorAll("button")).find((b) => (b.textContent || "").trim() === "폐기");
      const empty = document.body.innerText.includes("대기 중인 제출이 없습니다");
      return !!banner || !!polishBtn || empty;
    },
    { timeout: 25_000 },
  );
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});

  // ── 1) 잘못된 세션 접근 텍스트 부재 (이전 데드락 해소) ──
  const hasErrorText = await page.getByText("잘못된 세션 접근").isVisible().catch(() => false);
  expect(hasErrorText, "인박스에 '잘못된 세션 접근' 메시지가 보이면 안 됨").toBe(false);

  // ── 2) row 액션 매트릭스 ──
  const allButtons = await page.$$eval("button", (els) =>
    els.map((el) => (el.textContent || "").trim()),
  );
  const polishCount = allButtons.filter((t) => t === "폐기").length;
  const cannotIdCount = allButtons.filter((t) => t === "지정 불가").length;
  const identifyCount = allButtons.filter((t) => t === "학생 지정").length;

  // 미식별 row 가 있을 때만 액션 분기 검증
  const banner = page.getByTestId("submissions-needs-identification-banner");
  const bannerVisible = await banner.isVisible().catch(() => false);

  if (bannerVisible) {
    // needs_id row 마다 (학생지정 OR 지정 불가) + 폐기 가 함께 노출되어야 한다
    expect(polishCount).toBeGreaterThan(0);
    expect(identifyCount + cannotIdCount).toBeGreaterThan(0);

    // ── 3) 폐기 클릭 → 사유 picker 모달 노출 → 취소 ──
    const firstDiscard = page.getByRole("button", { name: "폐기" }).first();
    await firstDiscard.click();
    await expect(page.getByText("폐기 사유").first()).toBeVisible({ timeout: 5_000 });
    await page.getByRole("button", { name: "취소" }).click();
    await expect(page.getByText("폐기 사유")).toHaveCount(0, { timeout: 3_000 });
  } else {
    test.info().annotations.push({ type: "skip-reason", description: "미식별 row 없음 — 액션 분기 검증 skip" });
  }

  expect(errors.filter((e) => !e.includes("AbortError"))).toHaveLength(0);
});
