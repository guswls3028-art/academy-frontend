/**
 * 운영 도메인별 정밀 감사 (2026-04-23)
 *
 * 목적: 실제 배포 서버(hakwonplus.com)에서 도메인별로 사이드바 클릭 → 리스트 →
 *       상세 진입까지 실사용 경로를 따라 스크린샷을 수집하고 콘솔/네트워크
 *       에러를 도메인별로 기록한다.
 *
 * 판정 기준:
 *   - 페이지 렌더 실패(흰 화면 / "문제가 발생했습니다" 류) = FAIL
 *   - 5xx 또는 치명 4xx(401 제외) = FAIL
 *   - 콘솔 error 로그 = WARN (수집만)
 */
import { test, expect, type Page, type ConsoleMessage, type Request } from "@playwright/test";
import { loginViaUI, getBaseUrl } from "../helpers/auth";
import * as fs from "fs";
import * as path from "path";

const SCREENSHOT_DIR = "e2e/screenshots/prod-audit-2026-04-23";
const REPORT_PATH = "e2e/reports/prod-domain-audit-2026-04-23.md";

type DomainCheck = {
  key: string;
  label: string;
  navLabel: string;        // sidebar label
  listPath: string;        // expected URL path after click
  detailSelector?: string; // optional first-row clickable selector
};

const DOMAINS: DomainCheck[] = [
  { key: "dashboard", label: "대시보드", navLabel: "대시보드", listPath: "/admin/dashboard" },
  { key: "students",  label: "학생",     navLabel: "학생",     listPath: "/admin/students"  },
  { key: "lectures",  label: "강의",     navLabel: "강의",     listPath: "/admin/lectures"  },
  { key: "clinic",    label: "클리닉",   navLabel: "클리닉",   listPath: "/admin/clinic"    },
  { key: "exams",     label: "시험",     navLabel: "시험",     listPath: "/admin/exams"     },
  { key: "results",   label: "성적",     navLabel: "성적",     listPath: "/admin/results"   },
  { key: "videos",    label: "영상",     navLabel: "영상",     listPath: "/admin/videos"    },
  { key: "message",   label: "메시지",   navLabel: "메시지",   listPath: "/admin/message"   },
  { key: "storage",   label: "자료실",   navLabel: "자료실",   listPath: "/admin/storage"   },
  { key: "community", label: "커뮤니티", navLabel: "커뮤니티", listPath: "/admin/community" },
  { key: "tools",     label: "도구",     navLabel: "도구",     listPath: "/admin/tools"     },
  { key: "settings",  label: "설정",     navLabel: "설정",     listPath: "/admin/settings"  },
];

type Finding = {
  domain: string;
  level: "FAIL" | "WARN" | "INFO";
  message: string;
};

const findings: Finding[] = [];

function attachListeners(page: Page, domainKey: string) {
  const entries: string[] = [];

  page.on("console", (msg: ConsoleMessage) => {
    if (msg.type() === "error") {
      const text = msg.text();
      if (/favicon|ResizeObserver|Download the React DevTools/.test(text)) return;
      entries.push(`CONSOLE error: ${text}`);
      findings.push({ domain: domainKey, level: "WARN", message: `console.error — ${text.slice(0, 240)}` });
    }
  });

  page.on("requestfailed", (req: Request) => {
    const url = req.url();
    if (/beacon|analytics|favicon|hot-update/.test(url)) return;
    const failure = req.failure()?.errorText || "";
    entries.push(`REQ FAILED: ${req.method()} ${url} — ${failure}`);
    findings.push({ domain: domainKey, level: "WARN", message: `request failed — ${req.method()} ${new URL(url).pathname} ${failure}` });
  });

  page.on("response", (resp) => {
    const status = resp.status();
    const url = resp.url();
    if (status >= 500) {
      entries.push(`HTTP ${status}: ${url}`);
      findings.push({ domain: domainKey, level: "FAIL", message: `HTTP ${status} — ${new URL(url).pathname}` });
    } else if (status === 400 || status === 403 || status === 404) {
      // Some are legitimate (e.g., 404 lookups). Only record if it's an API 4xx on our api host.
      if (/api\.hakwonplus\.com/.test(url)) {
        entries.push(`HTTP ${status}: ${url}`);
        findings.push({ domain: domainKey, level: "WARN", message: `HTTP ${status} — ${new URL(url).pathname}` });
      }
    }
  });

  return entries;
}

async function shot(page: Page, name: string) {
  const p = path.join(SCREENSHOT_DIR, name + ".png");
  await page.screenshot({ path: p, fullPage: true }).catch(() => {});
  return p;
}

async function clickSidebar(page: Page, label: string): Promise<boolean> {
  // 사이드바는 aside.sidebar 안의 NavLink. 텍스트로 찾는다.
  const link = page.locator(`aside.sidebar a.nav-item:has-text("${label}")`).first();
  const exists = (await link.count()) > 0;
  if (!exists) return false;
  await link.click({ timeout: 6_000 }).catch(() => {});
  return true;
}

async function waitSettled(page: Page, ms = 1500) {
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

function hasVisibleErrorBoundary(html: string): boolean {
  // 흔한 에러 UI 문구들
  return (
    /문제가 발생했습니다/.test(html) ||
    /Something went wrong/i.test(html) ||
    /오류가 발생했습니다/.test(html) ||
    /페이지를 불러올 수 없/.test(html)
  );
}

test.describe.configure({ mode: "serial" });

test.describe("운영 도메인별 정밀 감사 (hakwonplus.com / 2026-04-23)", () => {
  test.setTimeout(180_000);

  test("전 도메인 사이드바 네비 + 렌더 + 첫 항목 상세", async ({ page }) => {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

    // 1. 로그인
    await loginViaUI(page, "admin");
    await waitSettled(page);
    await shot(page, "00-dashboard-initial");

    // URL 확인
    const afterLogin = page.url();
    findings.push({ domain: "__login__", level: "INFO", message: `logged in. url=${afterLogin}` });

    // 2. 도메인별 순회
    for (const d of DOMAINS) {
      const entries = attachListeners(page, d.key);

      // 사이드바 클릭 (실사용 경로)
      const clicked = await clickSidebar(page, d.navLabel);
      if (!clicked) {
        // fallback: 직접 goto
        findings.push({ domain: d.key, level: "WARN", message: `사이드바에서 "${d.navLabel}" 링크를 찾지 못해 직접 URL 이동` });
        await page.goto(getBaseUrl("admin") + d.listPath, { waitUntil: "load" }).catch(() => {});
      }
      await waitSettled(page);

      // URL 일치 검증
      const cur = new URL(page.url());
      if (!cur.pathname.startsWith(d.listPath)) {
        findings.push({
          domain: d.key,
          level: "WARN",
          message: `expected path ${d.listPath} but got ${cur.pathname}`,
        });
      }

      // 에러 바운더리/빈 페이지 감지
      const bodyHtml = await page.content();
      if (hasVisibleErrorBoundary(bodyHtml)) {
        findings.push({ domain: d.key, level: "FAIL", message: `에러 UI 노출됨 — ${d.label}` });
      }
      const bodyText = (await page.locator("body").innerText().catch(() => "")).trim();
      if (bodyText.length < 50) {
        findings.push({ domain: d.key, level: "FAIL", message: `본문 텍스트가 너무 짧음 (${bodyText.length}자) — 렌더 실패 의심` });
      }

      await shot(page, `${d.key}-01-list`);

      // 3. 도메인별 상세 진입 (가능한 경우만)
      try {
        await tryEnterDetail(page, d);
        await waitSettled(page, 1000);
        await shot(page, `${d.key}-02-detail`);
      } catch (e) {
        findings.push({ domain: d.key, level: "INFO", message: `상세 진입 스킵: ${String(e).slice(0, 120)}` });
      }

      // 상세에서 리스트로 복귀 (다음 도메인 위한 initial state)
      await page.goto(getBaseUrl("admin") + d.listPath, { waitUntil: "load" }).catch(() => {});
      await waitSettled(page, 500);

      // entry 분석은 findings에 이미 기록됨 — local entries는 디버그용
      void entries;
    }

    // 4. 추가 상시 체크: 학생 상세 탭 확인 (학생 → 첫 학생 → 탭 몇개)
    try {
      await page.goto(getBaseUrl("admin") + "/admin/students", { waitUntil: "load" });
      await waitSettled(page);
      await clickFirstStudentRow(page);
      await waitSettled(page, 1500);
      await shot(page, "zz-student-detail");
    } catch (e) {
      findings.push({ domain: "students-deep", level: "INFO", message: `학생 상세 진입 실패: ${String(e).slice(0, 120)}` });
    }

    // 5. 결과 저장
    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    fs.writeFileSync(REPORT_PATH, renderReport(findings), "utf-8");

    // 요약 assertion: FAIL 개수만 출력 (테스트 자체는 통과시켜 리포트 수집에 집중)
    const fails = findings.filter((f) => f.level === "FAIL");
    console.log(`\n=== 감사 결과 ===\nFAIL=${fails.length} WARN=${findings.filter(f=>f.level==='WARN').length} INFO=${findings.filter(f=>f.level==='INFO').length}\nReport: ${REPORT_PATH}\n`);

    // FAIL은 허용 X — 쉽게 확인하려고 expect로 마킹. 다만 스크린샷은 이미 저장됨.
    expect.soft(fails, `FAIL 항목:\n${fails.map(f=>`- [${f.domain}] ${f.message}`).join("\n")}`).toHaveLength(0);
  });
});

async function tryEnterDetail(page: Page, d: DomainCheck) {
  switch (d.key) {
    case "students": {
      await clickFirstStudentRow(page);
      return;
    }
    case "lectures": {
      const row = page.locator("table tbody tr, [data-row-type='lecture']").first();
      if ((await row.count()) > 0) await row.click({ timeout: 4000 }).catch(()=>{});
      return;
    }
    case "clinic": {
      // 클리닉 콘솔 — 사이드바 그룹 내 첫 탭 클릭
      const tab = page.locator("aside a, [role='tab']").nth(2);
      if ((await tab.count()) > 0) await tab.click({ timeout: 4000 }).catch(()=>{});
      return;
    }
    case "exams":
    case "results": {
      const row = page.locator("table tbody tr").first();
      if ((await row.count()) > 0) await row.click({ timeout: 4000 }).catch(()=>{});
      return;
    }
    case "videos": {
      const card = page.locator("[data-video-card], .video-card, table tbody tr").first();
      if ((await card.count()) > 0) await card.click({ timeout: 4000 }).catch(()=>{});
      return;
    }
    case "message": {
      // 탭 전환(예: 템플릿) 만
      const tab = page.locator("button:has-text('알림톡'), button:has-text('SMS'), button:has-text('템플릿')").first();
      if ((await tab.count()) > 0) await tab.click({ timeout: 4000 }).catch(()=>{});
      return;
    }
    case "community": {
      const post = page.locator("article, table tbody tr, [data-post-id]").first();
      if ((await post.count()) > 0) await post.click({ timeout: 4000 }).catch(()=>{});
      return;
    }
    case "settings": {
      const item = page.locator("a[href*='/admin/settings/'], button").first();
      if ((await item.count()) > 0) await item.click({ timeout: 4000 }).catch(()=>{});
      return;
    }
    default:
      return;
  }
}

async function clickFirstStudentRow(page: Page) {
  const candidates = [
    "table tbody tr:not(:has(thead))",
    "[data-student-id]",
    "a[href*='/admin/students/']:not([href$='/students'])",
  ];
  for (const sel of candidates) {
    const loc = page.locator(sel).first();
    if ((await loc.count()) > 0) {
      await loc.click({ timeout: 4000 }).catch(() => {});
      return;
    }
  }
}

function renderReport(findings: Finding[]): string {
  const byDomain = new Map<string, Finding[]>();
  for (const f of findings) {
    const arr = byDomain.get(f.domain) || [];
    arr.push(f);
    byDomain.set(f.domain, arr);
  }
  const lines: string[] = [];
  lines.push("# 운영 도메인별 정밀 감사 — 2026-04-23\n");
  lines.push(`- 대상: https://hakwonplus.com (Tenant 1 admin97)`);
  lines.push(`- FAIL=${findings.filter(f=>f.level==='FAIL').length}  WARN=${findings.filter(f=>f.level==='WARN').length}  INFO=${findings.filter(f=>f.level==='INFO').length}`);
  lines.push("");
  for (const [domain, arr] of byDomain) {
    lines.push(`## ${domain}`);
    const f = arr.filter(x=>x.level==='FAIL');
    const w = arr.filter(x=>x.level==='WARN');
    const i = arr.filter(x=>x.level==='INFO');
    if (f.length) { lines.push("**FAIL**"); f.forEach(x => lines.push(`- ${x.message}`)); }
    if (w.length) { lines.push("**WARN**"); w.forEach(x => lines.push(`- ${x.message}`)); }
    if (i.length) { lines.push("**INFO**"); i.forEach(x => lines.push(`- ${x.message}`)); }
    lines.push("");
  }
  return lines.join("\n");
}
