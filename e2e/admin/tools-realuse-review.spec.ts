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

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";

test.describe("Tools 4탭 실사용 리뷰 P0/P1", () => {
  test.setTimeout(120_000);

  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
  });

  // ── PPT ──────────────────────────────────────────

  test("PPT-1. 미지원 형식 드롭 시 toast 노출 (P0-1)", async ({ page }) => {
    await page.goto(`${BASE}/admin/tools/ppt`, { waitUntil: "load" });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});

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
    await page.goto(`${BASE}/admin/tools/ppt`, { waitUntil: "load" });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});

    // PDF 탭 전환
    await page.getByRole("button", { name: "PDF" }).click();
    await page.waitForTimeout(300);

    const fileInput = page.locator('input[type="file"][accept="application/pdf"]');
    await fileInput.setInputFiles({
      name: "test.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("not a pdf"),
    });

    const warn = page.getByText(/PDF 파일만 업로드/i).first();
    await expect(warn).toBeVisible({ timeout: 5_000 });
  });

  // ── OMR ──────────────────────────────────────────

  test("OMR-1. mc 한도 초과 입력 → 45 자동 보정 + toast (P1-1)", async ({ page }) => {
    await page.goto(`${BASE}/admin/tools/omr`, { waitUntil: "load" });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});

    const mc = page.locator('input[type="number"]').first();
    await mc.fill("99");
    await mc.blur();

    // toast
    const warn = page.getByText(/객관식은 최대 45/i).first();
    await expect(warn).toBeVisible({ timeout: 5_000 });

    // 값 클램프 — 45 또는 그 이하
    await expect(mc).toHaveValue(/^\d+$/);
    const v = await mc.inputValue();
    expect(Number(v)).toBeLessThanOrEqual(45);
  });

  test("OMR-2. 입력 변경 → 700ms 후 미리보기 자동 갱신 (P1-2)", async ({ page }) => {
    await page.goto(`${BASE}/admin/tools/omr`, { waitUntil: "load" });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});

    const examInput = page.getByPlaceholder("제1회 단원평가");
    await examInput.fill("실사용리뷰_E2E_시험명");

    // 디바운스(700ms) + 네트워크 — 1.5초 충분
    const previewReq = page.waitForResponse(
      (r) => r.url().includes("/tools/omr/preview/") && r.request().method() === "POST",
      { timeout: 4_000 },
    );
    await previewReq;
  });

  test("OMR-3. PDF 다운로드 골든패스 — %PDF- 매직", async ({ page }) => {
    await page.goto(`${BASE}/admin/tools/omr`, { waitUntil: "load" });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});

    const downloadPromise = page.waitForEvent("download", { timeout: 20_000 });
    await page.getByRole("button", { name: /PDF 다운로드/ }).click();
    const dl = await downloadPromise;

    const path = await dl.path();
    expect(path).toBeTruthy();
    if (path) {
      const fs = await import("node:fs/promises");
      const head = await fs.readFile(path).then((b) => b.subarray(0, 5).toString("ascii"));
      expect(head).toBe("%PDF-");
    }
  });

  // ── Clinic ──────────────────────────────────────────

  test("CLN-1. 잘못된 paste → 가이드 toast (P1-5)", async ({ page }) => {
    await page.goto(`${BASE}/admin/tools/clinic`, { waitUntil: "load" });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});

    const ta = page.locator("#clinic-paste-ta");
    await ta.fill("이건 형식 안 맞는 무작위 텍스트입니다");
    await page.getByRole("button", { name: /^생성$/ }).click();

    const warn = page.getByText(/데이터를 인식하지 못했습니다|카테고리 형식/i).first();
    await expect(warn).toBeVisible({ timeout: 5_000 });
  });

  test("CLN-2. 카테고리 paste → 미리보기 + 다운로드 버튼 활성화 (P0-3/P0-4)", async ({ page }) => {
    await page.goto(`${BASE}/admin/tools/clinic`, { waitUntil: "load" });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});

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
    await page.goto(`${BASE}/admin/tools/clinic`, { waitUntil: "load" });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});

    const ta = page.locator("#clinic-paste-ta");
    await ta.fill("시험+과제: [E2E-tools] 홍길동\n시험: [E2E-tools] 이영희");
    await page.getByRole("button", { name: /^생성$/ }).click();
    await page.waitForTimeout(500);

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
    await page.goto(`${BASE}/admin/tools/stopwatch`, { waitUntil: "load" });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});

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
    await page.goto(`${BASE}/admin/tools/stopwatch`, { waitUntil: "load" });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});

    // 1분 프리셋 클릭 → ready phase
    await page.getByRole("button", { name: /^1분$/ }).click();
    await page.waitForTimeout(300);

    // confirm dialog 핸들러 — 결과 캡처 후 dismiss
    let dialogShown = false;
    page.on("dialog", async (d) => {
      dialogShown = true;
      expect(d.message()).toMatch(/타이머가 진행 중|시간이 사라/i);
      await d.dismiss();
    });

    // 모드 토글 — '스톱워치' 버튼 클릭
    await page.getByRole("button", { name: /^스톱워치$/ }).click();
    await page.waitForTimeout(500);

    expect(dialogShown).toBe(true);
  });
});
