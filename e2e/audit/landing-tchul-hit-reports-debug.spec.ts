// hit_reports 카드 미렌더 원인 디버그
import { test } from "@playwright/test";

test("tchul.com hit_reports fetch 응답 직접 호출 + DOM 확인", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await ctx.newPage();
  const requests: Array<{ url: string; status: number; body: string }> = [];

  page.on("response", async (r) => {
    if (r.url().includes("/matchup/landing/public/")) {
      try {
        requests.push({ url: r.url(), status: r.status(), body: (await r.text()).slice(0, 400) });
      } catch (e) {
        requests.push({ url: r.url(), status: r.status(), body: "[read err]" });
      }
    }
  });
  page.on("pageerror", (e) => console.log("PAGE_ERROR:", e.message));
  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") {
      console.log(`BROWSER_${msg.type().toUpperCase()}:`, msg.text());
    }
  });

  await page.goto("https://tchul.com/landing", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  console.log("REQUESTS:", JSON.stringify(requests, null, 2));

  // hit_reports 섹션의 카드 컨테이너 DOM 확인
  const cardsHtml = await page.evaluate(() => {
    const headings = Array.from(document.querySelectorAll("h2"));
    const hitHeader = headings.find((h) => h.textContent?.includes("최근 적중"));
    if (!hitHeader) return "no-section";
    const section = hitHeader.closest("section");
    return section ? section.innerHTML.slice(0, 1000) : "no-parent";
  });
  console.log("HIT_SECTION_HTML:", cardsHtml);

  // 직접 fetch 호출
  const direct = await page.evaluate(async () => {
    try {
      const res = await fetch("/api/v1/matchup/landing/public/?ids=25,27,14", { credentials: "same-origin" });
      const txt = await res.text();
      return { status: res.status, body: txt.slice(0, 400) };
    } catch (e) {
      return { error: String(e) };
    }
  });
  console.log("DIRECT_FETCH:", JSON.stringify(direct));

  await ctx.close();
});
