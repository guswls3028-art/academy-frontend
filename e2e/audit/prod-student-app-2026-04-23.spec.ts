/**
 * 학생앱 정밀 검사 (2026-04-23)
 *
 * 홈 화면의 빠른메뉴 버튼(영상/성적/시험/과제/일정/클리닉/커뮤니티/보관함)
 * 을 실제 클릭하여 각 기능 페이지가 정상 렌더되는지 확인.
 */
import { test, expect, type Page } from "@playwright/test";
import { loginViaUI, getBaseUrl } from "../helpers/auth";
import * as fs from "fs";
import * as path from "path";

const DIR = "e2e/screenshots/prod-audit-2026-04-23/student";
const REPORT = "e2e/reports/prod-student-app-2026-04-23.md";

type F = { k: string; lvl: "FAIL" | "WARN" | "INFO"; msg: string };
const findings: F[] = [];

async function shot(page: Page, name: string) {
  fs.mkdirSync(DIR, { recursive: true });
  await page.screenshot({ path: path.join(DIR, `${name}.png`), fullPage: true }).catch(() => {});
}

async function waitSettled(page: Page, ms = 1500) {
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

test.describe.configure({ mode: "serial" });

test("학생앱 홈 빠른메뉴 정상 동작", async ({ page }) => {
  test.setTimeout(180_000);

  await loginViaUI(page, "student");
  await waitSettled(page, 2000);
  await shot(page, "00-home");

  // 빠른메뉴는 홈 본문의 아이콘 버튼. 하단 탭바에도 동일 이름이 있으므로
  // 본문 컨테이너 내에서만 탐색. 홈 본문 = 하단 탭바(nav) 이전의 영역.
  const items = ["영상", "성적", "시험", "과제", "일정", "클리닉", "커뮤니티", "보관함"];
  for (const name of items) {
    // 홈으로 복귀
    const homeBtn = page.locator("nav a:has-text('홈'), nav button:has-text('홈'), a:has-text('홈')").last();
    if (await homeBtn.count() > 0) {
      await homeBtn.click({ timeout: 5000 }).catch(() => {});
      await waitSettled(page, 800);
    } else {
      await page.goto(getBaseUrl("student") + "/student/dashboard", { waitUntil: "load" });
      await waitSettled(page, 1000);
    }

    // 빠른메뉴는 보통 큰 아이콘 버튼 — 하단 nav가 아닌 곳.
    // 하단 nav 안의 것 제외하고 본문에서 텍스트 매치.
    const target = page.locator(`main :text-is("${name}"), [role='main'] :text-is("${name}"), section :text-is("${name}")`).first();
    const fallback = page.locator(`:text-is("${name}")`).first();

    let clicked = false;
    if (await target.count() > 0) {
      await target.click({ timeout: 5000 }).catch(() => {});
      clicked = true;
    } else if (await fallback.count() > 0) {
      await fallback.click({ timeout: 5000 }).catch(() => {});
      clicked = true;
    }

    if (!clicked) {
      findings.push({ k: `home-menu-${name}`, lvl: "WARN", msg: `${name} 메뉴 버튼을 찾지 못함` });
      continue;
    }

    await waitSettled(page, 1500);
    await shot(page, `menu-${name}`);

    const url = page.url();
    const body = (await page.locator("body").innerText().catch(() => "")) || "";
    const hasError = /문제가 발생했습니다|Something went wrong|오류가 발생/.test(body);

    if (hasError) {
      findings.push({ k: `home-menu-${name}`, lvl: "FAIL", msg: `${name} 페이지에서 에러 UI 노출 (${url})` });
    } else if (body.length < 80) {
      findings.push({ k: `home-menu-${name}`, lvl: "WARN", msg: `${name} 페이지 본문 너무 짧음 (${body.length}자)` });
    } else {
      findings.push({ k: `home-menu-${name}`, lvl: "INFO", msg: `${name} OK (${url})` });
    }
  }

  fs.mkdirSync(path.dirname(REPORT), { recursive: true });
  const lines = [
    "# 학생앱 정밀 검사 — 2026-04-23",
    "",
    `- FAIL=${findings.filter(f => f.lvl === "FAIL").length}  WARN=${findings.filter(f => f.lvl === "WARN").length}  INFO=${findings.filter(f => f.lvl === "INFO").length}`,
    "",
    ...findings.map(f => `- [${f.lvl}] [${f.k}] ${f.msg}`),
  ];
  fs.writeFileSync(REPORT, lines.join("\n"), "utf-8");

  const fails = findings.filter(f => f.lvl === "FAIL");
  console.log(`\n=== 학생앱 결과 === FAIL=${fails.length} WARN=${findings.filter(f=>f.lvl==='WARN').length} INFO=${findings.filter(f=>f.lvl==='INFO').length}\n`);
  expect.soft(fails, fails.map(f => f.msg).join("\n")).toHaveLength(0);
});
