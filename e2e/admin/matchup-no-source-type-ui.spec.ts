// PATH: e2e/admin/matchup-no-source-type-ui.spec.ts
//
// 자료 유형 UI 완전 제거 검증 — 학원장 directive 2026-05-09.
// 업로드 모달에 자료 유형 라디오/뱃지/안내 모두 시각 노출 0.
// hidden div 의 sourceType 자동 추천만 backend 로 전송 확인.

import { test, expect } from "../fixtures/strictTest";
import { waitForCondition } from "../helpers/wait";

const BASE = "https://hakwonplus.com";
const API = "https://api.hakwonplus.com";
const ADMIN_USER = "admin97";
const ADMIN_PASS = "koreaseoul97";
const TENANT = "hakwonplus";

const OUT = "../_artifacts/sessions/matchup-realuse-2026-05-09-final";

async function login(page: import("@playwright/test").Page) {
  const resp = await page.request.post(`${API}/api/v1/token/`, {
    data: { username: ADMIN_USER, password: ADMIN_PASS, tenant_code: TENANT },
    headers: { "Content-Type": "application/json", "X-Tenant-Code": TENANT },
    timeout: 60_000,
  });
  expect(resp.status()).toBe(200);
  const tokens = await resp.json() as { access: string; refresh: string };
  await page.addInitScript(({ access, refresh }) => {
    localStorage.setItem("access", access);
    localStorage.setItem("refresh", refresh);
  }, tokens);
}

test.describe("자료 유형 UI 제거 검증", () => {
  test.setTimeout(120_000);

  test("업로드 모달에서 자료 유형 라디오 시각 노출 0", async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/admin/storage/matchup`, { waitUntil: "load", timeout: 30_000 });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    const upBtn = page.locator('button:has-text("업로드"), button:has-text("시험지"), button:has-text("자료 등록")').first();
    await expect(upBtn).toBeVisible({ timeout: 15_000 });
    await upBtn.click();

    const modal = page.locator('[data-testid="matchup-upload-modal"]');
    await expect(modal).toBeVisible();

    // 자료 유형 라디오 button 시각 노출 0 — display:none 안에 있어야 함.
    const radios = page.locator('button[data-source-type]');
    const radioCount = await radios.count();
    console.error("[INFO] visible source_type buttons =", radioCount, "(expected 0)");
    expect(radioCount).toBe(0);

    // 자료 유형 텍스트 노출 0
    const labelByText = page.locator('text=/자료 유형/i').filter({ visible: true });
    const labelCount = await labelByText.count();
    console.error("[INFO] visible '자료 유형' text =", labelCount);

    // hidden 자동 추천 div 는 dom 에 존재
    const autoDiv = page.locator('[data-testid="matchup-upload-source-type-auto"]');
    expect(await autoDiv.count()).toBe(1);

    // 빈 모달 캡처
    await page.screenshot({ path: `${OUT}/01-empty-modal.png`, fullPage: true });
    await modal.screenshot({ path: `${OUT}/01b-empty-modal-only.png` });

    // 파일 추가 후에도 라디오 안 보임
    const fileInput = page.locator('[data-testid="matchup-file-input"]');
    await fileInput.setInputFiles({
      name: "수학_해설_2026.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 dummy"),
    });

    const radiosAfter = page.locator('button[data-source-type]');
    expect(await radiosAfter.count()).toBe(0);

    // 자동 추천 결과 — hidden div data 속성 확인
    await waitForCondition(
      async () => (await autoDiv.getAttribute("data-source-type")) === "explanation",
      { timeoutMs: 10_000, intervalMs: 250, description: "해설 파일 source_type 자동 추천" },
    );
    const sourceType = await autoDiv.getAttribute("data-source-type");
    const reason = await autoDiv.getAttribute("data-source-type-reason");
    console.error("[AUTO] sourceType =", sourceType, "reason =", reason);
    // "해설" filename → explanation 추천
    expect(sourceType).toBe("explanation");

    await page.screenshot({ path: `${OUT}/02-with-haeseol-file.png`, fullPage: true });
    await modal.screenshot({ path: `${OUT}/02b-modal-haeseol.png` });
  });

  test("학생 카카오톡 jpg → student_exam_photo 자동 전송", async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/admin/storage/matchup`, { waitUntil: "load", timeout: 30_000 });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    const upBtn = page.locator('button:has-text("시험지"), button:has-text("업로드")').first();
    await expect(upBtn).toBeVisible({ timeout: 15_000 });
    await upBtn.click();

    const fileInput = page.locator('[data-testid="matchup-file-input"]');
    await expect(fileInput).toBeAttached({ timeout: 10_000 });
    await fileInput.setInputFiles({
      name: "KakaoTalk_20260509_학생답안.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]),
    });

    const autoDiv = page.locator('[data-testid="matchup-upload-source-type-auto"]');
    await waitForCondition(
      async () => (await autoDiv.getAttribute("data-source-type")) === "student_exam_photo",
      { timeoutMs: 10_000, intervalMs: 250, description: "학생 답안 이미지 source_type 자동 추천" },
    );
    const sourceType = await autoDiv.getAttribute("data-source-type");
    expect(sourceType).toBe("student_exam_photo");

    await page.screenshot({ path: `${OUT}/03-kakao-jpg.png`, fullPage: true });
  });
});
