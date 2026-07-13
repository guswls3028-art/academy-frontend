/**
 * 일괄 폐기 + 폐기 사유 모달 회귀 검증.
 * - 미식별 row 가 있을 때만 의미. 데이터 없으면 skip.
 * - 모달은 열어서 검증만, 실제 폐기는 수행하지 않음 (cancel).
 */
import { test, expect } from "../fixtures/strictTest";
import { loginViaUI, getBaseUrl } from "../helpers/auth";

test("inbox 일괄 선택 + 폐기 사유 모달 + cancel", async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

  await loginViaUI(page, "admin");
  await page.goto(`${getBaseUrl("admin")}/admin/results/submissions`, { waitUntil: "domcontentloaded" });

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

  const banner = page.getByTestId("submissions-needs-identification-banner");
  const bannerVisible = await banner.isVisible().catch(() => false);
  if (!bannerVisible) {
    test.info().annotations.push({ type: "skip-reason", description: "미식별 row 없음 — skip" });
    return;
  }

  // 모두 선택 체크박스
  const selectAll = page.getByLabel("모두 선택");
  await selectAll.check();
  // 선택됨 텍스트 노출
  await expect(page.getByText(/\d+건 선택됨/)).toBeVisible({ timeout: 3_000 });

  // 일괄 폐기 클릭
  await page.getByRole("button", { name: "일괄 폐기" }).click();

  // 사유 모달 노출
  await expect(page.getByText("폐기 사유")).toBeVisible({ timeout: 5_000 });
  // 사유 옵션 5종 노출
  await expect(page.getByText("스캔/사진 품질 불량")).toBeVisible();
  await expect(page.getByText("오업로드")).toBeVisible();
  await expect(page.getByText("중복 업로드")).toBeVisible();
  await expect(page.getByText("원본 시험/과제 없음")).toBeVisible();

  // 취소 — 데이터 변경 방지
  await page.getByRole("button", { name: "취소" }).click();
  await expect(page.getByText("폐기 사유")).toHaveCount(0, { timeout: 3_000 });

  // 선택 해제 후 일괄 폐기 버튼 사라짐
  await page.getByRole("button", { name: "선택 해제" }).click();
  await expect(page.getByRole("button", { name: "일괄 폐기" })).toHaveCount(0);

  expect(errors.filter((e) => !e.includes("AbortError"))).toHaveLength(0);
});
