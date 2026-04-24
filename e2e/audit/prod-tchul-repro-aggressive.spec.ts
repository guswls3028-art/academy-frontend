/**
 * tchul 커뮤니티 간헐 에러 — 적극 재현 (2026-04-24)
 *
 * v2 감사 순회 시퀀스를 20회 반복 재현하며 pageerror/console error/network
 * 실패 전부 캡처. 한 번이라도 ErrorBoundary fallback UI("오류가 발생했습니다")
 * 노출 시 stack trace 기록.
 */
import { test } from "@playwright/test";
import { loginViaUI, getBaseUrl } from "../helpers/auth";
import * as fs from "fs";
import * as path from "path";

const DIR = "e2e/screenshots/prod-audit-v2-2026-04-23/tchul-aggressive";
const REPORT = "e2e/reports/tchul-aggressive-repro.md";

const DOMAINS_BEFORE_COMMUNITY = [
  "/admin/dashboard",
  "/admin/students",
  "/admin/lectures",
  "/admin/clinic",
  "/admin/exams",
  "/admin/results",
  "/admin/videos",
  "/admin/message",
  "/admin/storage",
  "/admin/tools",
  "/admin/settings",
];

test("tchul 커뮤니티 20회 반복 재현 — 에러 캡처", async ({ page, context }) => {
  test.setTimeout(600_000);
  fs.mkdirSync(DIR, { recursive: true });

  const errors: Array<{ run: number; kind: string; text: string; stack?: string }> = [];

  page.on("pageerror", (err) => {
    errors.push({ run: currentRun, kind: "pageerror", text: err.message, stack: err.stack?.slice(0, 2000) });
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const t = msg.text();
      if (/favicon|ResizeObserver|Download the React|cf-nel/.test(t)) return;
      errors.push({ run: currentRun, kind: "console.error", text: t.slice(0, 2000) });
    }
  });
  page.on("requestfailed", (req) => {
    const url = req.url();
    if (/cdn-cgi|beacon|analytics|favicon|hot-update/.test(url)) return;
    errors.push({ run: currentRun, kind: "requestfailed", text: `${req.method()} ${url} — ${req.failure()?.errorText || ""}` });
  });

  let currentRun = 0;
  const base = getBaseUrl("tchul-admin");

  await loginViaUI(page, "tchul-admin");
  await page.waitForTimeout(1500);

  let firstErrorRun = -1;
  const errorSummaries: Array<{ run: number; summary: string }> = [];

  for (let i = 1; i <= 20; i++) {
    currentRun = i;

    // 랜덤 도메인 3~5개 훑은 후 커뮤니티 진입 (v2 감사 부하 재현)
    const visits = shuffle([...DOMAINS_BEFORE_COMMUNITY]).slice(0, 3 + (i % 3));
    for (const p of visits) {
      await page.goto(base + p, { waitUntil: "commit" }).catch(()=>{});
      await page.waitForTimeout(300 + Math.floor(Math.random() * 500));
    }

    // 커뮤니티 진입 — 사이드바 클릭
    const clicked = await page.locator(`aside.sidebar a.nav-item:has-text("커뮤니티")`).first().click({ timeout: 5000 }).then(() => true).catch(() => false);
    if (!clicked) {
      await page.goto(base + "/admin/community", { waitUntil: "load" }).catch(()=>{});
    }
    // 즉시 + 2초 + 5초 캡처
    for (const delay of [200, 2000, 5000]) {
      await page.waitForTimeout(delay);
      const body = (await page.locator("body").innerText().catch(() => "")) || "";
      if (/오류가 발생했습니다|문제가 발생했습니다/.test(body)) {
        if (firstErrorRun < 0) firstErrorRun = i;
        const shotPath = path.join(DIR, `run-${i}-error-at-${delay}ms.png`);
        await page.screenshot({ path: shotPath, fullPage: true }).catch(()=>{});
        errorSummaries.push({ run: i, summary: `delay=${delay}ms body에 에러 UI 노출` });
        break;
      }
    }
  }

  // 리포트
  fs.mkdirSync(path.dirname(REPORT), { recursive: true });
  const out = [
    "# tchul.com 커뮤니티 20회 적극 재현",
    "",
    `- 에러 발생 run: ${errorSummaries.length}건 / 20회`,
    `- 첫 발생 run: ${firstErrorRun > 0 ? `#${firstErrorRun}` : "없음"}`,
    "",
    "## run별 에러 요약",
    ...(errorSummaries.length ? errorSummaries.map(e => `- run #${e.run}: ${e.summary}`) : ["- (전 run에서 에러 UI 미노출)"]),
    "",
    "## 캡처된 pageerror / console.error / requestfailed",
    errors.length === 0 ? "(없음)" : "```",
    ...errors.slice(0, 200).map(e => `run #${e.run} [${e.kind}] ${e.text}${e.stack ? "\n" + e.stack : ""}`),
    errors.length ? "```" : "",
  ];
  fs.writeFileSync(REPORT, out.join("\n"), "utf-8");
  console.log(`\n=== 적극 재현 결과: 에러 run=${errorSummaries.length}/20, 첫 발생=#${firstErrorRun} ===\n  errors captured: ${errors.length}`);
});

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
