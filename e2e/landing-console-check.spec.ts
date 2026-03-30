// E2E: 콘솔 에러 확인 — 랜딩 관련 페이지에서 JS 에러 없는지

import { test, expect } from "@playwright/test";

const BASE = "http://localhost:5173";

test("프로모 + 샘플 갤러리 — 콘솔 에러 없음", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));

  // 프로모 페이지
  await page.goto(`${BASE}/promo`);
  await page.waitForLoadState("networkidle");

  // 샘플 갤러리
  await page.goto(`${BASE}/promo/landing-samples`);
  await page.waitForLoadState("networkidle");

  // Minimal Tutor 미리보기
  await page.getByText("Minimal Tutor").first().click();
  await page.waitForTimeout(1000);

  // Premium Dark 미리보기
  await page.getByRole("button", { name: "다음 →" }).click();
  await page.waitForTimeout(1000);

  // 네트워크 에러 (API 미접속)는 무시 — 실제 서비스에서는 동작
  const realErrors = errors.filter(
    (e) => !e.includes("ERR_CONNECTION_REFUSED") && !e.includes("Network Error") && !e.includes("Failed to fetch") && !e.includes("net::ERR")
  );

  console.log("Console errors (filtered):", realErrors);
  expect(realErrors.length).toBe(0);
});
