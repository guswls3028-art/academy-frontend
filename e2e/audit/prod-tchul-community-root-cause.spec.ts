/**
 * tchul.com 커뮤니티 에러 루트원인 재현 (2026-04-23)
 *
 * v2 감사에서 발견: tchul 관리자가 /admin/community 진입 시 ErrorBoundary.
 * 이 스펙은 네트워크 요청·응답과 console.error 전부를 캡처해서
 * 루트 원인을 특정한다.
 */
import { test } from "@playwright/test";
import { loginViaUI, getBaseUrl } from "../helpers/auth";
import * as fs from "fs";
import * as path from "path";

const DIR = "e2e/screenshots/prod-audit-v2-2026-04-23/tchul-community-rc";
const LOG = "e2e/reports/tchul-community-root-cause.md";

test("tchul 커뮤니티 에러 — 네트워크/콘솔 덤프", async ({ page }) => {
  test.setTimeout(120_000);
  fs.mkdirSync(DIR, { recursive: true });

  const logs: string[] = [];
  const reqs: { url: string; status: number; body?: string }[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      if (/favicon|ResizeObserver/.test(text)) return;
      logs.push(`CONSOLE ERROR: ${text}`);
    }
  });

  page.on("pageerror", (err) => {
    logs.push(`PAGE ERROR: ${err.name}: ${err.message}\n${err.stack?.slice(0, 1500) || ""}`);
  });

  page.on("response", async (resp) => {
    const url = resp.url();
    const status = resp.status();
    if (!/tchul\.com|api\.tchul\.com|api\.hakwonplus\.com/.test(url)) return;
    if (status >= 400) {
      let body = "";
      try { body = (await resp.text()).slice(0, 600); } catch {}
      reqs.push({ url, status, body });
    } else if (/community|post|notice|qna|category|board/.test(url)) {
      reqs.push({ url, status });
    }
  });

  await loginViaUI(page, "tchul-admin");
  await page.waitForTimeout(1500);

  // 사이드바 클릭 (실사용 경로)
  const link = page.locator(`aside.sidebar a.nav-item:has-text("커뮤니티")`).first();
  if (await link.count() > 0) {
    await link.click({ timeout: 6_000 }).catch(()=>{});
  } else {
    await page.goto(getBaseUrl("tchul-admin") + "/admin/community", { waitUntil: "load" });
  }
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(()=>{});
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(DIR, "community-error.png"), fullPage: true }).catch(()=>{});

  const body = (await page.locator("body").innerText().catch(()=>"") || "");

  const out: string[] = [];
  out.push(`# tchul.com 커뮤니티 에러 루트원인 — 2026-04-23\n`);
  out.push(`- URL: ${page.url()}`);
  out.push(`- 본문: ${body.slice(0, 400)}`);
  out.push("");
  out.push("## Console / Page errors");
  out.push("```");
  out.push(logs.join("\n") || "(없음)");
  out.push("```");
  out.push("");
  out.push("## Network (상태 >=400 또는 community/post 관련)");
  for (const r of reqs) {
    out.push(`- ${r.status} ${r.url}${r.body ? `\n  - body: ${r.body}` : ""}`);
  }
  fs.mkdirSync(path.dirname(LOG), { recursive: true });
  fs.writeFileSync(LOG, out.join("\n"), "utf-8");
  console.log(`Saved: ${LOG}`);
});
