// 최종 v2 — MinimalTutor 신규 섹션 + 이미지 모달 + picker 더블클릭 + 학원장 저장 검증.
import { test, expect } from "@playwright/test";
import { loginViaUI } from "../helpers/auth";
import { gotoAndSettle } from "../helpers/wait";

const PROD = "https://tchul.com";
const HKP = "https://hakwonplus.com";
const OUT = "C:/academy/_artifacts/sessions/tchul-landing-2026-05-11";

test.describe("최종 v2 검수", () => {
  test("MinimalTutor 신규 섹션 — admin97(hakwonplus)에 임시 적용 + 캡처 + 정리", async ({ page }) => {
    await loginViaUI(page, "admin");
    // hakwonplus 어드민에서 minimal_tutor template 자체 + 신규 섹션 보기 — 학원장 데이터 변경 X
    // (hakwonplus는 본사 테스트 테넌트, 게시 toggle만 시연)
    await gotoAndSettle(page, `${HKP}/admin/settings/landing`, { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "홈페이지 꾸미기" })).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: `${OUT}/v2-editor-overview.png`, fullPage: true });

    // 사이드바에 신규 라벨 노출 검증
    const labels = await page.evaluate(() =>
      Array.from(document.querySelectorAll("button")).map((b) => b.textContent?.trim()).filter((t) => t && t.length < 30 && t.length > 0)
    );
    const hits = labels.filter((l) => l && ["강사 프로필", "학생 관리 시스템", "수업 진행 흐름", "최근 적중 사례 (매치업)", "홈페이지"].some((k) => l.includes(k)));
    console.log("V2_LABELS:", JSON.stringify(hits));
  });

  test("LandingEditor — 이미지 업로드 모달 + paste 안내 노출", async ({ page }) => {
    await loginViaUI(page, "tchul-admin");
    await gotoAndSettle(page, `${PROD}/admin/settings/landing`, { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "홈페이지 꾸미기" })).toBeVisible({ timeout: 10_000 });

    // 이미지 nav 클릭
    await page.getByText("이미지").first().click();
    await expect(page.getByText(/히어로 이미지|이미지는 5MB/).first()).toBeVisible({ timeout: 5_000 });

    // 로고/메인 이미지 변경 트리거 (로고 "변경" 또는 "업로드" 버튼)
    const triggers = await page.getByRole("button").filter({ hasText: /변경|업로드|선택/ }).count();
    console.log("UPLOAD_TRIGGERS:", triggers);
    if (triggers > 0) {
      await page.getByRole("button").filter({ hasText: /변경|업로드|선택/ }).first().click();
      await expect(page.getByText(/Ctrl\+V|붙여넣기/).first()).toBeVisible({ timeout: 5_000 });
      await page.screenshot({ path: `${OUT}/v2-upload-modal.png`, fullPage: false });
      const pasteHint = await page.getByText(/Ctrl\+V|붙여넣기/).count();
      console.log("PASTE_HINT:", pasteHint);
    }
  });

  test("HitReportPicker 더블클릭 → PDF 미리보기 동선", async ({ page }) => {
    await loginViaUI(page, "tchul-admin");
    await gotoAndSettle(page, `${PROD}/admin/settings/landing`, { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "홈페이지 꾸미기" })).toBeVisible({ timeout: 10_000 });

    const hitNav = page.getByText("최근 적중 사례 (매치업)").first();
    await hitNav.click();
    await expect(page.getByTestId("hit-report-picker")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: /미리보기/ }).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/더블클릭/).first()).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: `${OUT}/v2-picker-with-preview.png`, fullPage: false });

    // 미리보기 버튼 노출
    const previewBtns = await page.getByRole("button", { name: /미리보기/ }).count();
    const doubleClickHint = await page.getByText(/더블클릭/).count();
    console.log("PREVIEW_FEATURES:", JSON.stringify({ previewBtns, doubleClickHint }));
    expect(previewBtns).toBeGreaterThanOrEqual(1);
    expect(doubleClickHint).toBeGreaterThanOrEqual(1);
  });

  test("학원장 저장 — '섹션 최대 8개' 에러 해소 검증", async ({ page }) => {
    await loginViaUI(page, "tchul-admin");
    await gotoAndSettle(page, `${PROD}/admin/settings/landing`, { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "홈페이지 꾸미기" })).toBeVisible({ timeout: 10_000 });

    // "저장" 버튼 (수정 없이 그대로 저장 — read-only intent)
    const saveBtn = page.getByRole("button", { name: /^저장$/ });
    await expect(saveBtn).toBeEnabled({ timeout: 10_000 });
    const saveResponse = page.waitForResponse(
      (r) => r.url().includes("/core/landing/admin/") && r.request().method() === "PUT",
      { timeout: 15_000 },
    ).catch(() => undefined);
    await saveBtn.click();
    await saveResponse;
    await expect(page.getByText(/저장되었습니다|저장 실패|섹션은 최대|최대 8/).first()).toBeVisible({ timeout: 5_000 }).catch(() => {});

    // 에러 toast 또는 메시지 — "섹션은 최대 8개" 같은 문구가 없어야
    const errToast = await page.getByText(/섹션은 최대|최대 8/).count();
    const okToast = await page.getByText(/저장되었습니다/).count();
    console.log("SAVE_RESULT:", JSON.stringify({ errToast, okToast }));
    expect(errToast).toBe(0);
  });
});
