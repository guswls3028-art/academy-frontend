/**
 * 학생앱 iPhone Safari 뷰포트 검사 (2026-04-24)
 *
 * iPhone 13 디바이스 프로파일로 홈 빠른메뉴 8종 + 세부 페이지 진입 확인.
 */
import { test, expect, type Page } from "@playwright/test";
import { loginViaUI, getBaseUrl } from "../helpers/auth";
import * as fs from "fs";
import * as path from "path";

const DIR = "e2e/screenshots/prod-audit-v2-2026-04-23/student-iphone";
const REPORT = "e2e/reports/prod-student-app-iphone-2026-04-24.md";

type F = { k: string; lvl: "FAIL" | "WARN" | "INFO"; msg: string };
const findings: F[] = [];

// iPhone 13 viewport + UA를 Chromium에서 시뮬레이션 (webkit 바이너리 불필요)
test.use({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
});

async function waitSettled(page: Page, ms = 1500) {
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

async function shot(page: Page, name: string) {
  fs.mkdirSync(DIR, { recursive: true });
  await page.screenshot({ path: path.join(DIR, `${name}.png`), fullPage: true }).catch(() => {});
}

test("학생앱 iPhone 13 Safari — 홈 빠른메뉴 8종", async ({ page }) => {
  test.setTimeout(180_000);

  await loginViaUI(page, "student");
  await waitSettled(page, 2000);
  await shot(page, "00-home");

  const items = ["영상", "성적", "시험", "과제", "일정", "클리닉", "커뮤니티", "보관함"];
  for (const name of items) {
    await page.goto(getBaseUrl("student") + "/student/dashboard", { waitUntil: "load" }).catch(() => {});
    await waitSettled(page, 1000);

    const target = page.locator(`main :text-is("${name}"), section :text-is("${name}"), [role='main'] :text-is("${name}")`).first();
    const fallback = page.locator(`:text-is("${name}")`).first();

    const loc = (await target.count()) > 0 ? target : fallback;
    if ((await loc.count()) === 0) {
      findings.push({ k: name, lvl: "WARN", msg: "버튼 미발견" });
      continue;
    }
    await loc.click({ timeout: 5000 }).catch(()=>{});
    await waitSettled(page, 1200);
    await shot(page, `menu-${name}`);

    const url = page.url();
    const body = (await page.locator("body").innerText().catch(()=>"") || "");
    if (/문제가 발생했습니다|오류가 발생/.test(body)) {
      findings.push({ k: name, lvl: "FAIL", msg: `에러 UI — ${url}` });
    } else if (body.length < 80) {
      findings.push({ k: name, lvl: "WARN", msg: `본문 과소 ${body.length}자 — ${url}` });
    } else {
      findings.push({ k: name, lvl: "INFO", msg: `OK — ${url}` });
    }
  }

  fs.mkdirSync(path.dirname(REPORT), { recursive: true });
  const counts = {
    FAIL: findings.filter(f => f.lvl === "FAIL").length,
    WARN: findings.filter(f => f.lvl === "WARN").length,
    INFO: findings.filter(f => f.lvl === "INFO").length,
  };
  const lines = [
    `# 학생앱 iPhone 13 Safari 검사 — 2026-04-24`,
    ``,
    `- FAIL=${counts.FAIL}  WARN=${counts.WARN}  INFO=${counts.INFO}`,
    ``,
    ...findings.map(f => `- [${f.lvl}] ${f.k} — ${f.msg}`),
  ];
  fs.writeFileSync(REPORT, lines.join("\n"), "utf-8");
  console.log(`\n=== iPhone 학생앱 === FAIL=${counts.FAIL} WARN=${counts.WARN} INFO=${counts.INFO}\n`);
  expect.soft(findings.filter(f => f.lvl === "FAIL"), findings.filter(f=>f.lvl==='FAIL').map(f=>f.msg).join('\n')).toHaveLength(0);
});
