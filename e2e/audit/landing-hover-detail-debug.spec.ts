// hover thumbnail + 상세 페이지 debug
import { test } from "@playwright/test";

const PROD = "https://tchul.com";
const OUT = "C:/academy/_artifacts/sessions/tchul-landing-2026-05-11";

test("hover thumbnail 캡처 + 콘솔 에러", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("console", (msg) => { if (msg.type() === "error" || msg.type() === "warning") errors.push(`${msg.type()}: ${msg.text()}`); });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("response", async (r) => {
    if (r.url().includes("curated.pdf")) {
      const h = r.headers();
      console.log("PDF_RESP", r.status(), r.url().slice(-80), "ct=", h["content-type"], "xfo=", h["x-frame-options"], "csp=", (h["content-security-policy"] || "").slice(0, 80));
    }
  });

  await page.goto(`${PROD}/landing`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  // hit_reports 섹션으로 스크롤
  const firstCard = page.locator('a[href*="/landing/reports/"]').first();
  await firstCard.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  // 카드 컨테이너 위에 hover (a 부모 div)
  const cardWrap = firstCard.locator("..");
  await cardWrap.hover();
  await page.waitForTimeout(2500);  // PDF 로드 시간
  await page.screenshot({ path: `${OUT}/v10-hover-thumbnail.png`, fullPage: false });
  console.log("HOVER ERRS:", JSON.stringify(errors.slice(0, 5)));

  // 상세 페이지 진입
  await firstCard.click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(3500);
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
