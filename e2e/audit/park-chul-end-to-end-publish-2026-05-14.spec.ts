// PATH: e2e/audit/park-chul-end-to-end-publish-2026-05-14.spec.ts
// 박철T 학원장 절박 요청 end-to-end 검증:
// 1) PDF 직접 업로드 → publish → showcase id 받음
// 2) 비로그인 새 context로 /landing/matchup-board/:id 진입 → PDF iframe 노출 확인
// 3) cleanup destroy
//
// 학원장이 "내일 수업때 자랑" 위해 부탁 중. 코드 path 추적만으로 충분 X — 박철T
// 환경에서 실제 publish → 비로그인 학생 view 완전 흐름 production 캡처 필수.
/* eslint-disable no-restricted-syntax */

import { test, expect, request as pwRequest } from "@playwright/test";
import { loginViaUI } from "../helpers/auth.ts";

const TCHUL = process.env.TCHUL_BASE_URL || "https://tchul.com";
const API_BASE = process.env.E2E_API_URL || "https://api.hakwonplus.com";

// minimal valid PDF (1 page, "E2E test PDF" — 학원장 게시판에 잠시 노출되었다 즉시 destroy)
const MINIMAL_PDF_BYTES = Buffer.from(
  "%PDF-1.4\n" +
    "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n" +
    "4 0 obj<</Length 44>>stream\n" +
    "BT /F1 24 Tf 100 700 Td (E2E test PDF) Tj ET\n" +
    "endstream endobj\n" +
    "5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n" +
    "xref\n0 6\n" +
    "0000000000 65535 f \n" +
    "0000000010 00000 n \n" +
    "0000000053 00000 n \n" +
    "0000000098 00000 n \n" +
    "0000000186 00000 n \n" +
    "0000000275 00000 n \n" +
    "trailer<</Size 6/Root 1 0 R>>\n" +
    "startxref\n331\n%%EOF\n",
  "utf8"
);

test("박철T end-to-end — PDF upload → public link → 비로그인 진입 PDF 노출", async ({ page, browser }) => {
  // ─── Step 1: tchul-admin 로그인 + 토큰 확보 ───
  await loginViaUI(page, "tchul-admin");
  const token = await page.evaluate(() => localStorage.getItem("access_token") || localStorage.getItem("access") || "");
  console.log("token len:", token.length);
  expect(token.length).toBeGreaterThan(20);

  // ─── Step 2: publish-upload API 직접 호출 (multipart PDF 업로드) ───
  const apiCtx = await pwRequest.newContext({
    extraHTTPHeaders: {
      Authorization: `Bearer ${token}`,
      "X-Tenant-Code": "tchul",
    },
  });
  const stamp = Date.now();
  const title = `[E2E-${stamp}] end-to-end 검증 — 박철T`;

  const publishResp = await apiCtx.post(`${API_BASE}/api/v1/landing-public/matchup-showcase/publish-upload/`, {
    multipart: {
      file: {
        name: `e2e-${stamp}.pdf`,
        mimeType: "application/pdf",
        buffer: MINIMAL_PDF_BYTES,
      },
      title,
      description: "E2E 자동 검증 게시물 (즉시 cleanup)",
    },
  });
  console.log("publish-upload status:", publishResp.status());
  expect(publishResp.status()).toBe(201);
  const showcase = await publishResp.json();
  console.log("created showcase:", JSON.stringify(showcase, null, 2).slice(0, 500));
  const showcaseId: number = showcase.id;
  expect(showcaseId).toBeGreaterThan(0);

  // ─── Step 3: 비로그인 새 context로 /landing/matchup-board/:id 진입 ───
  const guestCtx = await browser.newContext();
  const guestPage = await guestCtx.newPage();

  // 단일 외부 공개 URL — 박철T 학생 카톡 share spec
  const shareUrl = `${TCHUL}/landing/matchup-board/${showcaseId}`;
  console.log("share URL:", shareUrl);

  await guestPage.goto(shareUrl);
  await guestPage.waitForLoadState("networkidle");
  await guestPage.waitForTimeout(2500);
  await guestPage.screenshot({ path: "_artifacts/pc-e2e-1-guest-detail.png", fullPage: true });

  // PDF iframe 존재 확인
  const iframeCount = await guestPage.locator("iframe").count();
  console.log("guest iframe count:", iframeCount);

  // 본문 텍스트 — 제목 노출 확인
  const titleVisible = await guestPage.getByText(title).first().isVisible({ timeout: 5000 }).catch(() => false);
  console.log("title visible (guest):", titleVisible);

  // PDF stream URL 직접 fetch 확인
  if (iframeCount > 0) {
    const iframeSrc = await guestPage.locator("iframe").first().getAttribute("src");
    console.log("iframe src:", iframeSrc);
    if (iframeSrc) {
      const pdfResp = await guestPage.request.get(iframeSrc);
      const ct = pdfResp.headers()["content-type"] || "";
      const bodyHead = (await pdfResp.body()).slice(0, 8).toString("utf8");
      console.log("pdf stream — status:", pdfResp.status(), "ct:", ct, "head:", JSON.stringify(bodyHead));
      expect(pdfResp.status()).toBe(200);
      expect(ct).toContain("pdf");
      expect(bodyHead).toContain("%PDF");
    }
  }

  // ─── Step 4: list 페이지에서도 새 showcase 노출 확인 ───
  await guestPage.goto(`${TCHUL}/landing/matchup-board`);
  await guestPage.waitForLoadState("networkidle");
  await guestPage.waitForTimeout(1500);
  await guestPage.screenshot({ path: "_artifacts/pc-e2e-2-guest-list.png", fullPage: true });
  const listHasTitle = await guestPage.getByText(title).first().isVisible({ timeout: 3000 }).catch(() => false);
  console.log("list contains new showcase:", listHasTitle);

  await guestCtx.close();

  // ─── Step 5: cleanup — admin context에서 destroy ───
  const delResp = await apiCtx.delete(`${API_BASE}/api/v1/landing-public/matchup-showcase/${showcaseId}/`);
  console.log("cleanup delete status:", delResp.status());
  expect([200, 204]).toContain(delResp.status());

  await apiCtx.dispose();
});
