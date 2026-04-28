/**
 * UI/UX 실사용 감사 — 운영(hakwonplus.com).
 * Admin/Student 핵심 라우트 별 (1) 풀페이지 스크린샷 (2) 보이는 CTA/뱃지/주요 텍스트 덤프.
 * 데이터 변경 없음.
 */
import { test } from "../fixtures/strictTest";
import { loginViaUI } from "../helpers/auth";
import * as path from "node:path";
import * as fs from "node:fs";
import { fileURLToPath } from "node:url";

const __filename_ = fileURLToPath(import.meta.url);
const __dirname_ = path.dirname(__filename_);
const SHOTS = path.resolve(__dirname_, "../audit/_uiux_review");
fs.mkdirSync(SHOTS, { recursive: true });

const BASE = "https://hakwonplus.com";

type Route = { name: string; path: string; waitFor?: string };

const ADMIN_ROUTES: Route[] = [
  { name: "01-dashboard", path: "/admin/dashboard" },
  { name: "02-students", path: "/admin/students/home" },
  { name: "03-lectures", path: "/admin/lectures" },
  { name: "04-results", path: "/admin/results" },
  { name: "05-submissions", path: "/admin/results/submissions" },
  { name: "06-exams", path: "/admin/exams" },
  { name: "07-fees", path: "/admin/fees" },
  { name: "08-clinic", path: "/admin/clinic" },
  { name: "09-counsel", path: "/admin/counsel" },
  { name: "10-notice", path: "/admin/notice" },
  { name: "11-message", path: "/admin/message" },
  { name: "12-community-board", path: "/admin/community/board" },
  { name: "13-community-qna", path: "/admin/community/qna" },
  { name: "14-storage", path: "/admin/storage" },
  { name: "15-videos", path: "/admin/videos" },
];

const STUDENT_ROUTES: Route[] = [
  { name: "s01-dashboard", path: "/student" },
  { name: "s02-attendance", path: "/student/attendance" },
  { name: "s03-grades", path: "/student/grades" },
  { name: "s04-exams", path: "/student/exams" },
  { name: "s05-sessions", path: "/student/sessions" },
  { name: "s06-notices", path: "/student/notices" },
  { name: "s07-community", path: "/student/community" },
  { name: "s08-more", path: "/student/more" },
];

async function captureRoute(page: import("@playwright/test").Page, role: "admin" | "student", r: Route) {
  const url = `${BASE}${r.path}`;
  const out: Record<string, unknown> = { route: r.path, name: r.name };
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20_000 });
    await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});
    // 살짝 더 대기 — 위젯 렌더
    await page.waitForTimeout(1_200);
    await page.screenshot({ path: path.join(SHOTS, `${role}-${r.name}.png`), fullPage: true });

    // 주요 시각 요소 덤프 — 사용자 관점에서 보이는 CTA/뱃지/페이지 타이틀/카드 헤더
    const meta = await page.evaluate(() => {
      const txt = (el: Element | null) => (el?.textContent || "").trim().replace(/\s+/g, " ").slice(0, 120);
      const visible = (el: Element) => {
        const r = (el as HTMLElement).getBoundingClientRect();
        const cs = getComputedStyle(el as HTMLElement);
        return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none";
      };

      const buttons = Array.from(document.querySelectorAll("button, a[role='button'], [data-testid$='-btn'], [data-testid*='cta']"))
        .filter(visible)
        .map((b) => ({
          text: txt(b),
          disabled: (b as HTMLButtonElement).disabled || b.getAttribute("aria-disabled") === "true",
          testid: b.getAttribute("data-testid") || null,
          aria: b.getAttribute("aria-label") || null,
        }))
        .filter((b) => b.text || b.aria)
        .slice(0, 40);

      const headings = Array.from(document.querySelectorAll("h1, h2, h3, [role='heading']"))
        .filter(visible)
        .map((h) => txt(h))
        .filter(Boolean)
        .slice(0, 20);

      const badges = Array.from(document.querySelectorAll(".ds-badge, .ds-status-badge, [class*='badge'], [class*='Badge']"))
        .filter(visible)
        .map((b) => ({ text: txt(b), cls: (b as HTMLElement).className.slice(0, 80) }))
        .filter((b) => b.text)
        .slice(0, 30);

      const empties = Array.from(document.querySelectorAll("[data-testid*='empty'], [class*='empty'], [class*='Empty']"))
        .filter(visible)
        .map((e) => txt(e))
        .filter(Boolean)
        .slice(0, 10);

      const inputs = Array.from(document.querySelectorAll("input, textarea, select"))
        .filter(visible)
        .map((i) => ({
          tag: i.tagName.toLowerCase(),
          placeholder: (i as HTMLInputElement).placeholder || "",
          value: ((i as HTMLInputElement).value || "").slice(0, 60),
          name: (i as HTMLInputElement).name || "",
        }))
        .slice(0, 20);

      const errors = Array.from(document.querySelectorAll("[role='alert'], .ant-message-error, [class*='error']"))
        .filter(visible)
        .map((e) => txt(e))
        .filter(Boolean)
        .slice(0, 10);

      const title = document.title;
      const tableRows = document.querySelectorAll("table tbody tr, [role='row']").length;
      const cardCount = document.querySelectorAll("[class*='card' i]").length;

      return { title, headings, buttons, badges, empties, inputs, errors, tableRows, cardCount };
    });
    Object.assign(out, meta);
  } catch (e) {
    out.error = String(e);
  }
  return out;
}

test.describe("UI/UX 실사용 감사 (운영)", () => {
  test.setTimeout(15 * 60_000);

  test("admin 핵심 라우트 캡처+덤프", async ({ page }) => {
    await loginViaUI(page, "admin");
    const reports: unknown[] = [];
    for (const r of ADMIN_ROUTES) {
      const m = await captureRoute(page, "admin", r);
      reports.push(m);
      console.log(`[ADMIN] ${r.path} → ${(m as { tableRows?: number }).tableRows ?? "?"} rows, ${(m as { buttons?: unknown[] }).buttons?.length ?? 0} btns`);
    }
    fs.writeFileSync(path.join(SHOTS, "admin-dump.json"), JSON.stringify(reports, null, 2), "utf8");
  });

  test("student 핵심 라우트 캡처+덤프", async ({ page }) => {
    await loginViaUI(page, "student");
    const reports: unknown[] = [];
    for (const r of STUDENT_ROUTES) {
      const m = await captureRoute(page, "student", r);
      reports.push(m);
      console.log(`[STUDENT] ${r.path} → ${(m as { tableRows?: number }).tableRows ?? "?"} rows, ${(m as { buttons?: unknown[] }).buttons?.length ?? 0} btns`);
    }
    fs.writeFileSync(path.join(SHOTS, "student-dump.json"), JSON.stringify(reports, null, 2), "utf8");
  });
});
