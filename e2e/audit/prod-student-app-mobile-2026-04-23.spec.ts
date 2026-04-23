/**
 * 학생앱 모바일(Pixel 5) 뷰포트 검사 (2026-04-23)
 *
 * 학생앱은 실사용 디바이스가 모바일이므로, 데스크톱 헤드리스에서는
 * 숨겨지거나 레이아웃이 다른 UI 요소가 있을 수 있음.
 */
import { test, expect, devices, type Page } from "@playwright/test";
import { loginViaUI, getBaseUrl } from "../helpers/auth";
import * as fs from "fs";
import * as path from "path";

const DIR = "e2e/screenshots/prod-audit-v2-2026-04-23/student-mobile";
const REPORT = "e2e/reports/prod-student-app-mobile-2026-04-23.md";

type F = { k: string; lvl: "FAIL" | "WARN" | "INFO"; msg: string };
const findings: F[] = [];

test.use({ ...devices["Pixel 5"] });

async function waitSettled(page: Page, ms = 1500) {
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

async function shot(page: Page, name: string) {
  fs.mkdirSync(DIR, { recursive: true });
  await page.screenshot({ path: path.join(DIR, `${name}.png`), fullPage: true }).catch(() => {});
}

test("학생앱 모바일 — 홈 빠른메뉴 8종", async ({ page }) => {
  test.setTimeout(180_000);

  await loginViaUI(page, "student");
  await waitSettled(page, 2000);
  await shot(page, "00-home");

  const items = ["영상", "성적", "시험", "과제", "일정", "클리닉", "커뮤니티", "보관함"];
  for (const name of items) {
    // 홈 복귀
    await page.goto(getBaseUrl("student") + "/student/dashboard", { waitUntil: "load" }).catch(() => {});
    await waitSettled(page, 1000);

    // 본문의 빠른메뉴 버튼 (하단 탭바 제외하기 위해 main/section 우선)
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

  // 리포트
  fs.mkdirSync(path.dirname(REPORT), { recursive: true });
  const counts = {
    FAIL: findings.filter(f => f.lvl === "FAIL").length,
    WARN: findings.filter(f => f.lvl === "WARN").length,
    INFO: findings.filter(f => f.lvl === "INFO").length,
  };
  const lines = [
    `# 학생앱 모바일(Pixel 5) 검사 — 2026-04-23`,
    ``,
    `- FAIL=${counts.FAIL}  WARN=${counts.WARN}  INFO=${counts.INFO}`,
    ``,
    ...findings.map(f => `- [${f.lvl}] ${f.k} — ${f.msg}`),
  ];
  fs.writeFileSync(REPORT, lines.join("\n"), "utf-8");
  console.log(`\n=== 모바일 학생앱 === FAIL=${counts.FAIL} WARN=${counts.WARN} INFO=${counts.INFO}\n`);
  expect.soft(findings.filter(f => f.lvl === "FAIL"), findings.filter(f=>f.lvl==='FAIL').map(f=>f.msg).join('\n')).toHaveLength(0);
});
