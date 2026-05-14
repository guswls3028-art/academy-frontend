// PATH: e2e/audit/park-chul-real-pdf-e2e-2026-05-14.spec.ts
// 박철T 학원장 실제 PDF 파일 직접 publish → 학원장/외부인 양쪽 시각 검증.
//
// 본질 4-step:
//   1) 적중보고서 작성 (기존 작동)
//   2) PDF 다운로드 (기존 작동)
//   3) PC 이미지 편집 (시스템 외)
//   4) PDF 업로드 → 외부 비로그인 노출 ← 본 spec 핵심
//
// 학원장이 실제로 카페에 올리던 큐레이션 보고서 PDF (4.7MB)를 그대로 업로드.
// 학원장 admin UI 시각 + 학생 외부 viewer 시각 desktop / mobile 양쪽 캡처.
/* eslint-disable no-restricted-syntax */

import { test, expect, request as pwRequest } from "@playwright/test";
import { loginViaUI } from "../helpers/auth.ts";
import * as fs from "node:fs";
import * as path from "node:path";

const TCHUL = process.env.TCHUL_BASE_URL || "https://tchul.com";
const API_BASE = process.env.E2E_API_URL || "https://api.hakwonplus.com";

const REAL_PDF_PATH = "C:/Users/heon7/OneDrive/문서/카카오톡 받은 파일/2026 언남고 1학기 기말고사 생명과학-큐레이션보고서.pdf";

test.describe.configure({ mode: "serial" });

let createdShowcaseId: number | null = null;
let createdShareUrl = "";

test("박철T 실 PDF — 학원장 admin publish 시각 + URL 복사", async ({ page }) => {
  await loginViaUI(page, "tchul-admin");
  await page.goto(`${TCHUL}/landing/admin/matchup-board`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "_artifacts/pc-real-1-admin-list-before.png", fullPage: true });

  // 학원장이 "+ 적중보고서 게시" 클릭 → 모달 등장
  const openBtn = page.getByTestId("open-publish-modal");
  await openBtn.click();
  await page.waitForTimeout(800);

  // "내 PC의 PDF 업로드" 모드 — testid + JS click (button onClick 안전)
  const uploadModeCard = page.getByTestId("publish-mode-upload");
  await uploadModeCard.evaluate((el: HTMLButtonElement) => el.click());
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "_artifacts/pc-real-2-publish-modal-upload-mode.png", fullPage: true });

  // 파일 input — display:none 이라 testid 로 직접 setInputFiles
  const fileInput = page.getByTestId("publish-pdf-file");
  await fileInput.setInputFiles(REAL_PDF_PATH);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "_artifacts/pc-real-2b-after-file-select.png", fullPage: true });

  // 제목 — [E2E] tag 명시
  const stamp = Date.now();
  const realTitle = `[E2E-REAL-${stamp}] 2026 언남고 1학기 기말고사 생명과학 (학원장 실 PDF 시각 검증)`;
  const titleInput = page.locator('input[type="text"]').first();
  await titleInput.fill(realTitle);

  // 코멘트
  const descTextarea = page.locator('textarea').first();
  if (await descTextarea.isVisible({ timeout: 1500 }).catch(() => false)) {
    await descTextarea.fill("E2E 자동 검증 (즉시 cleanup). 실 학원장 PDF 4.7MB 업로드 path.");
  }

  await page.screenshot({ path: "_artifacts/pc-real-3-form-filled.png", fullPage: true });

  // "게시" 버튼 click
  const submitBtn = page.locator("button", { hasText: /^게시$/ }).last();
  await submitBtn.click();

  // 게시 처리 — toast 등장 / list reload 대기
  await page.waitForTimeout(6000);
  await page.screenshot({ path: "_artifacts/pc-real-4-after-publish.png", fullPage: true });

  // 새 row 찾기 — list 의 첫 row (id 가장 큼)
  const rows = page.locator('[data-testid^="matchup-showcase-row-"]');
  const firstRowTestId = await rows.first().getAttribute("data-testid");
  console.log("first row test id:", firstRowTestId);
  const m = firstRowTestId?.match(/matchup-showcase-row-(\d+)/);
  if (m) {
    createdShowcaseId = Number(m[1]);
    createdShareUrl = `${TCHUL}/landing/matchup-board/${createdShowcaseId}`;
    console.log("created showcase id:", createdShowcaseId, "share URL:", createdShareUrl);
  }
  expect(createdShowcaseId).not.toBeNull();

  // 박철T spec — "🔗 링크 복사" 클릭 → clipboard
  const shareBtn = page.locator(`[data-testid="matchup-share-${createdShowcaseId}"]`);
  if (await shareBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await shareBtn.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: "_artifacts/pc-real-5-share-clicked.png", fullPage: false });
  }
});

test("박철T 실 PDF — 비로그인 desktop viewer (외부 학부모 입장)", async ({ browser }) => {
  expect(createdShareUrl).not.toEqual("");

  const guestCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const guestPage = await guestCtx.newPage();

  let nativeConfirmFired = false;
  guestPage.on("dialog", async (d) => { nativeConfirmFired = true; await d.dismiss(); });

  // ─── 1) detail 직접 진입 (카톡 share URL 학생 click 시나리오) ───
  await guestPage.goto(createdShareUrl);
  await guestPage.waitForLoadState("networkidle");
  await guestPage.waitForTimeout(4000);
  await guestPage.screenshot({ path: "_artifacts/pc-real-6-guest-desktop-detail.png", fullPage: true });

  // iframe PDF stream 직접 검증 — backend hotfix 적용 여부 확인
  const iframe = guestPage.locator("iframe").first();
  const iframeSrc = await iframe.getAttribute("src");
  console.log("iframe src:", iframeSrc);

  if (iframeSrc) {
    const pdfResp = await guestPage.request.get(iframeSrc);
    const ct = pdfResp.headers()["content-type"] || "";
    const body = await pdfResp.body();
    const bodyHead = body.slice(0, 8).toString("utf8");
    console.log("pdf stream — status:", pdfResp.status(), "ct:", ct, "size:", body.length, "head:", JSON.stringify(bodyHead));
    expect(pdfResp.status(), "비로그인 iframe PDF fetch 200").toBe(200);
    expect(ct).toContain("pdf");
    expect(bodyHead).toContain("%PDF");
  }

  // ─── 2) public list 진입 ───
  await guestPage.goto(`${TCHUL}/landing/matchup-board`);
  await guestPage.waitForLoadState("networkidle");
  await guestPage.waitForTimeout(2000);
  await guestPage.screenshot({ path: "_artifacts/pc-real-7-guest-desktop-list.png", fullPage: true });

  // ─── 3) main landing 진입 (외부 학부모가 "박철T 매치업" 검색 후 진입할 때) ───
  await guestPage.goto(`${TCHUL}/landing`);
  await guestPage.waitForLoadState("networkidle");
  await guestPage.waitForTimeout(2000);
  await guestPage.screenshot({ path: "_artifacts/pc-real-8-guest-desktop-landing.png", fullPage: true });

  expect(nativeConfirmFired).toBe(false);
  await guestCtx.close();
});

test("박철T 실 PDF — 비로그인 mobile viewer (학생 폰)", async ({ browser }) => {
  expect(createdShareUrl).not.toEqual("");

  const guestCtx = await browser.newContext({
    viewport: { width: 375, height: 812 },
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
    isMobile: true,
    hasTouch: true,
  });
  const guestPage = await guestCtx.newPage();

  await guestPage.goto(createdShareUrl);
  await guestPage.waitForLoadState("networkidle");
  await guestPage.waitForTimeout(4000);
  await guestPage.screenshot({ path: "_artifacts/pc-real-9-guest-mobile-detail.png", fullPage: true });

  // mobile list
  await guestPage.goto(`${TCHUL}/landing/matchup-board`);
  await guestPage.waitForLoadState("networkidle");
  await guestPage.waitForTimeout(2000);
  await guestPage.screenshot({ path: "_artifacts/pc-real-10-guest-mobile-list.png", fullPage: true });

  await guestCtx.close();
});

test("박철T 실 PDF — cleanup destroy", async () => {
  expect(createdShowcaseId).not.toBeNull();
  // tchul-admin 토큰 새로 받음
  const tokenResp = await pwRequest.newContext().then((ctx) => ctx.post(`${API_BASE}/api/v1/token/`, {
    data: {
      username: process.env.TCHUL_ADMIN_USER || "01035023313",
      password: process.env.TCHUL_ADMIN_PASS || "727258",
      tenant_code: "tchul",
    },
    headers: { "Content-Type": "application/json", "X-Tenant-Code": "tchul" },
  }));
  const tokenJson = await tokenResp.json();
  const access = tokenJson.access;
  expect(access).toBeTruthy();

  const apiCtx = await pwRequest.newContext({
    extraHTTPHeaders: { Authorization: `Bearer ${access}`, "X-Tenant-Code": "tchul" },
  });
  const delResp = await apiCtx.delete(`${API_BASE}/api/v1/landing-public/matchup-showcase/${createdShowcaseId}/`);
  console.log("cleanup status:", delResp.status());
  expect([200, 204]).toContain(delResp.status());
  await apiCtx.dispose();
});
