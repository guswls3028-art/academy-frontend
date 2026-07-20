/**
 * 도구 4탭 실사용 리뷰 P0/P1 검증 (2026-04-27)
 * — Tenant 1 (hakwonplus) 운영 환경
 *
 * 검증 대상:
 *   P0-1/P0-2: PPT/PDF 업로드 silent reject 해결 — toast 노출
 *   P0-3/P0-4: 클리닉 iframe ↔ React 동기화 — 직접 편집으로 다운로드 버튼 활성화
 *   P1-1: OMR mc 한도 silent clamp 안내
 *   P1-2: OMR 입력 변경 후 자동 갱신
 *   P1-4: 타이머 모드 전환 시 confirm
 *   P1-5: 클리닉 파싱 실패 가이드
 *
 *   골든 패스: OMR PDF 다운로드 (%PDF-), 타이머 ZIP endpoint, 클리닉 PDF 다운로드.
 */
import { test, expect } from "../fixtures/strictTest";
import { loginViaUI } from "../helpers/auth";
import { gotoAndSettle } from "../helpers/wait";

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";

async function openOmrTool(page: import("@playwright/test").Page) {
  await gotoAndSettle(page, `${BASE}/admin/dashboard`);
  await page.getByRole("link", { name: "도구", exact: true }).click();
  await page.getByRole("link", { name: "OMR 생성", exact: true }).click();
  await expect(page.getByRole("region", { name: "OMR 답안지 설정" })).toBeVisible();
}

function isOmrPreviewFor(
  response: import("@playwright/test").Response,
  expected: Record<string, string | number | boolean>,
) {
  if (!response.url().includes("/tools/omr/preview/") || response.request().method() !== "POST") {
    return false;
  }
  try {
    const body = response.request().postDataJSON() as Record<string, unknown>;
    return Object.entries(expected).every(([key, value]) => body[key] === value);
  } catch {
    return false;
  }
}

test.describe("Tools 4탭 실사용 리뷰 P0/P1", () => {
  test.setTimeout(120_000);

  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
  });

  // ── PPT ──────────────────────────────────────────

  test("PPT-1. 미지원 형식 드롭 시 toast 노출 (P0-1)", async ({ page }) => {
    await gotoAndSettle(page, `${BASE}/admin/tools/ppt`);

    // hidden input에 .txt 파일 강제 주입 (드래그 불가환경 회피)
    const fileInput = page.locator('input[type="file"][accept*="image"]');
    await fileInput.setInputFiles({
      name: "test.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("not an image"),
    });

    // toast 출현 확인
    const warn = page.getByText(/지원하지 않는 형식|JPG\/PNG/i).first();
    await expect(warn).toBeVisible({ timeout: 5_000 });
  });

  test("PPT-2. PDF 모드 — 잘못된 형식 toast (P0-2)", async ({ page }) => {
    await gotoAndSettle(page, `${BASE}/admin/tools/ppt`);

    // PDF 탭 전환
    await page.getByRole("button", { name: "PDF" }).click();

    const fileInput = page.locator('input[type="file"][accept="application/pdf"]');
    await expect(fileInput).toBeAttached({ timeout: 5_000 });
    await fileInput.setInputFiles({
      name: "test.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("not a pdf"),
    });

    const warn = page.getByText(/PDF 파일만 업로드/i).first();
    await expect(warn).toBeVisible({ timeout: 5_000 });
  });

  // ── OMR ──────────────────────────────────────────

  test("OMR-1. mc 한도 초과 입력 → 60 자동 보정 + toast (P1-1)", async ({ page }) => {
    await openOmrTool(page);

    const mc = page.locator('input[type="number"]').first();
    await mc.fill("99");
    await mc.blur();

    // toast
    const warn = page.getByText(/객관식은 최대 60/i).first();
    await expect(warn).toBeVisible({ timeout: 5_000 });

    // 값 클램프 — 60 또는 그 이하
    await expect(mc).toHaveValue(/^\d+$/);
    const v = await mc.inputValue();
    expect(Number(v)).toBeLessThanOrEqual(60);
  });

  test("OMR-2. 입력 변경 → 700ms 후 미리보기 자동 갱신 (P1-2)", async ({ page }) => {
    await openOmrTool(page);

    const examInput = page.getByPlaceholder("제1회 단원평가");
    await examInput.fill("실사용리뷰_E2E_시험명");

    // 디바운스(700ms) + 네트워크 — 1.5초 충분
    const previewReq = page.waitForResponse(
      (response) => isOmrPreviewFor(response, { exam_title: "실사용리뷰_E2E_시험명" }),
      { timeout: 4_000 },
    );
    await previewReq;
  });

  test("OMR-3. 객관식 전용 답안지는 빈 단답형 공간을 선택해 숨긴다", async ({ page }) => {
    await openOmrTool(page);

    const numericInputs = page.locator('input[type="number"]');
    const previewResponsePromise = page.waitForResponse(
      (response) => isOmrPreviewFor(response, { mc_count: 30, essay_count: 0 }),
    );
    await numericInputs.nth(0).fill("30");
    await numericInputs.nth(1).fill("0");
    await previewResponsePromise;

    const optionalAreaSwitch = page.getByRole("switch", { name: "단답형 작성 공간 표시" });
    await expect(optionalAreaSwitch).toBeEnabled();
    await expect(optionalAreaSwitch).toBeChecked();

    const preview = page.frameLocator('iframe[title="OMR 답안지 미리보기"]');
    await expect(preview.getByText("단답형 공간", { exact: true })).toBeVisible();

    const hiddenPreviewPromise = page.waitForResponse(
      (response) => isOmrPreviewFor(response, {
        mc_count: 30,
        essay_count: 0,
        include_optional_essay_area: false,
      }),
    );
    await optionalAreaSwitch.click();
    const hiddenPreviewResponse = await hiddenPreviewPromise;
    expect(hiddenPreviewResponse.request().postDataJSON()).toMatchObject({
      mc_count: 30,
      essay_count: 0,
      include_optional_essay_area: false,
    });
    await expect(preview.getByText("단답형 공간", { exact: true })).toHaveCount(0);
    await expect(preview.getByText("객관식 1번 ~ 15번", { exact: true })).toBeVisible();
  });

  test("OMR-4. 단답형 전용 20문항 미리보기", async ({ page }) => {
    await openOmrTool(page);

    const numericInputs = page.locator('input[type="number"]');
    const previewResponsePromise = page.waitForResponse(
      (response) => isOmrPreviewFor(response, { mc_count: 0, essay_count: 20 }),
    );
    await numericInputs.nth(0).fill("0");
    await numericInputs.nth(1).fill("20");
    const previewResponse = await previewResponsePromise;
    expect(previewResponse.request().postDataJSON()).toMatchObject({
      mc_count: 0,
      essay_count: 20,
    });

    const preview = page.frameLocator('iframe[title="OMR 답안지 미리보기"]');
    await expect(preview.getByText("단답형 20문항", { exact: true })).toBeVisible();
    await expect(preview.getByText(/객관식 \d+번/)).toHaveCount(0);
    await expect(page.getByRole("switch", { name: "단답형 작성 공간 표시" })).toBeDisabled();
  });

  test("OMR-5. 빈 단답형 공간을 숨긴 PDF 다운로드 — %PDF- 매직", async ({ page }) => {
    await openOmrTool(page);

    const numericInputs = page.locator('input[type="number"]');
    await numericInputs.nth(0).fill("30");
    await numericInputs.nth(1).fill("0");
    const optionalAreaSwitch = page.getByRole("switch", { name: "단답형 작성 공간 표시" });
    await expect(optionalAreaSwitch).toBeEnabled();
    await optionalAreaSwitch.click();

    const pdfRequestPromise = page.waitForRequest(
      (request) => {
        if (!request.url().includes("/tools/omr/pdf/") || request.method() !== "POST") return false;
        try {
          return request.postDataJSON().include_optional_essay_area === false;
        } catch {
          return false;
        }
      },
      { timeout: 20_000 },
    );
    const downloadPromise = page.waitForEvent("download", { timeout: 20_000 });
    await page.getByRole("button", { name: /PDF 다운로드/ }).click();
    const pdfRequest = await pdfRequestPromise;
    const dl = await downloadPromise;

    expect(pdfRequest.postDataJSON()).toMatchObject({
      mc_count: 30,
      essay_count: 0,
      include_optional_essay_area: false,
    });

    const path = await dl.path();
    expect(path).toBeTruthy();
    if (path) {
      const fs = await import("node:fs/promises");
      const head = await fs.readFile(path).then((b) => b.subarray(0, 5).toString("ascii"));
      expect(head).toBe("%PDF-");
    }
  });

  test("OMR-6. 레거시 공개 생성 경로는 인식 SSOT 생성기로 이동한다", async ({ page }) => {
    await gotoAndSettle(
      page,
      `${BASE}/omr-sheet.html?logo=x%22%20onerror%3D%22alert(document.domain)`,
    );

    await expect(page).toHaveURL(/\/admin\/tools\/omr$/);
    await expect(page.getByRole("region", { name: "OMR 답안지 설정" })).toBeVisible();
  });

  // ── Clinic ──────────────────────────────────────────

  test("CLN-1. 잘못된 paste → 가이드 toast (P1-5)", async ({ page }) => {
    await gotoAndSettle(page, `${BASE}/admin/tools/clinic`);

    const ta = page.locator("#clinic-paste-ta");
    await ta.fill("이건 형식 안 맞는 무작위 텍스트입니다");
    await page.getByRole("button", { name: /^생성$/ }).click();

    const warn = page.getByText(/데이터를 인식하지 못했습니다|카테고리 형식/i).first();
    await expect(warn).toBeVisible({ timeout: 5_000 });
  });

  test("CLN-2. 카테고리 paste → 미리보기 + 다운로드 버튼 활성화 (P0-3/P0-4)", async ({ page }) => {
    await gotoAndSettle(page, `${BASE}/admin/tools/clinic`);

    const ta = page.locator("#clinic-paste-ta");
    await ta.fill("시험+과제: [E2E-tools] 홍길동, 김철수\n시험: [E2E-tools] 이영희\n과제: [E2E-tools] 박민수");
    await page.getByRole("button", { name: /^생성$/ }).click();

    // 파싱 성공 toast
    await expect(page.getByText(/클리닉 대상자 4명 파싱 완료/i)).toBeVisible({ timeout: 5_000 });

    // 다운로드 버튼 enabled
    const dlBtn = page.getByRole("button", { name: /PDF 다운로드/ });
    await expect(dlBtn).toBeEnabled({ timeout: 5_000 });

    // iframe 안 이름 노출
    const iframe = page.frameLocator("#cprev");
    await expect(iframe.getByText("홍길동").first()).toBeVisible({ timeout: 5_000 });
  });

  test("CLN-3. PDF 다운로드 → %PDF- 매직", async ({ page }) => {
    await gotoAndSettle(page, `${BASE}/admin/tools/clinic`);

    const ta = page.locator("#clinic-paste-ta");
    await ta.fill("시험+과제: [E2E-tools] 홍길동\n시험: [E2E-tools] 이영희");
    await page.getByRole("button", { name: /^생성$/ }).click();
    await expect(page.getByRole("button", { name: /PDF 다운로드/ })).toBeEnabled({ timeout: 5_000 });

    const downloadPromise = page.waitForEvent("download", { timeout: 30_000 });
    await page.getByRole("button", { name: /PDF 다운로드/ }).click();
    const dl = await downloadPromise;

    const path = await dl.path();
    if (path) {
      const fs = await import("node:fs/promises");
      const head = await fs.readFile(path).then((b) => b.subarray(0, 5).toString("ascii"));
      expect(head).toBe("%PDF-");
    }
  });

  // ── Timer ──────────────────────────────────────────

  test("TMR-1. ZIP endpoint 호출 OK", async ({ page }) => {
    await gotoAndSettle(page, `${BASE}/admin/tools/stopwatch`);

    const respPromise = page.waitForResponse(
      (r) => r.url().includes("/tools/timer/download/") && r.request().method() === "GET",
      { timeout: 10_000 },
    );
    await page.getByRole("button", { name: /Windows용 다운로드/ }).click();
    const resp = await respPromise;
    expect(resp.status()).toBe(200);
    const json = await resp.json();
    expect(json.download_url).toBeTruthy();
    expect(json.filename).toContain(".zip");
  });

  test("TMR-2. 타이머 진행 후 모드 전환 → confirm dialog (P1-4)", async ({ page }) => {
    await gotoAndSettle(page, `${BASE}/admin/tools/stopwatch`);

    // 1분 프리셋 클릭 → ready phase
    await page.getByRole("button", { name: /^1분$/ }).click();
    await expect(page.getByText("READY")).toBeVisible({ timeout: 5_000 });

    // 모드 토글 — '스톱워치' 버튼 클릭
    let dialogMessage = "";
    page.once("dialog", async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.dismiss();
    });
    await page.getByRole("button", { name: /^스톱워치$/ }).click();
    await expect.poll(() => dialogMessage, { timeout: 5_000 }).toMatch(/타이머가 진행 중|시간이 사라/i);
  });
});
