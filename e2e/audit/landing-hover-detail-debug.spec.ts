// hover thumbnail + 상세 페이지 debug
import { test, expect } from "@playwright/test";
import { gotoAndSettle } from "../helpers/wait";

const PROD = "https://tchul.com";
const OUT = "C:/academy/_artifacts/sessions/tchul-landing-2026-05-11";

test("hover thumbnail 캡처 + 콘솔 에러", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("console", (msg) => { if (msg.type() === "error" || msg.type() === "warning") errors.push(`${msg.type()}: ${msg.text()}`); });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  let pdfResponses = 0;
  page.on("response", async (r) => {
    if (r.url().includes("curated.pdf")) {
      pdfResponses += 1;
      const h = r.headers();
      console.log("PDF_RESP", r.status(), r.url().slice(-80), "ct=", h["content-type"], "xfo=", h["x-frame-options"], "csp=", (h["content-security-policy"] || "").slice(0, 80));
    }
  });

  await gotoAndSettle(page, `${PROD}/landing`, { timeout: 20_000 });

  // hit_reports 섹션으로 스크롤
  const firstCard = page.locator('a[href*="/landing/reports/"]').first();
  await expect(firstCard).toBeVisible({ timeout: 10_000 });
  await firstCard.scrollIntoViewIfNeeded();
  await expect(firstCard).toBeInViewport({ timeout: 5_000 });
  // 카드 컨테이너 위에 hover (a 부모 div)
  const cardWrap = firstCard.locator("..");
  const hoverPdfResponse = page.waitForResponse((r) => r.url().includes("curated.pdf"), { timeout: 10_000 }).catch(() => undefined);
  await cardWrap.hover();
  await hoverPdfResponse;
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await page.screenshot({ path: `${OUT}/v10-hover-thumbnail.png`, fullPage: false });
  console.log("HOVER ERRS:", JSON.stringify(errors.slice(0, 5)), "PDF_RESPONSES:", pdfResponses);

  // 상세 페이지 진입
  await Promise.all([
    page.waitForURL(/\/landing\/reports\/.+/, { timeout: 15_000 }),
    firstCard.click(),
  ]);
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  await expect(page.locator("iframe").first()).toBeAttached({ timeout: 10_000 });
  await page.waitForFunction(
    () => {
      const iframe = document.querySelector("iframe") as HTMLIFrameElement | null;
      return !!iframe && iframe.clientWidth > 0 && iframe.clientHeight > 0 && iframe.src.length > 0;
    },
    null,
    { timeout: 10_000 },
  );
  await page.screenshot({ path: `${OUT}/v10-detail-page.png`, fullPage: false });
  console.log("DETAIL URL:", page.url());

  // iframe 안 PDF 로드 검증
  const iframeInfo = await page.evaluate(() => {
    const ifr = document.querySelector("iframe") as HTMLIFrameElement | null;
    if (!ifr) return { found: false };
    return { found: true, src: ifr.src, width: ifr.clientWidth, height: ifr.clientHeight };
  });
  console.log("IFRAME:", JSON.stringify(iframeInfo));

  console.log("DETAIL ERRS:", JSON.stringify(errors.slice(0, 8)));
  await ctx.close();
});
