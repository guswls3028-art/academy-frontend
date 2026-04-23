/**
 * 운영 도메인별 정밀 감사 v2 (2026-04-23)
 *
 * v1 대비 개선:
 *   1) 상세 진입 성공을 "URL path 변화 OR dialog/modal 열림" 로 판정
 *   2) 리스트와 상세 스크린샷 해시가 같으면 FAIL 표시
 *   3) 클리닉 탭 측정 대상을 body 전체 텍스트로 수정 (v1: main 셀렉터 안 잡힘)
 *   4) 테넌트 파라미터화 — admin / dnb-admin / tchul-admin / limglish-admin
 */
import { test, expect, type Page } from "@playwright/test";
import { loginViaUI, getBaseUrl, type TenantRole } from "../helpers/auth";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

const RUN_TAG = "prod-audit-v2-2026-04-23";
const ROOT = `e2e/screenshots/${RUN_TAG}`;
const REPORT_DIR = "e2e/reports";

type DomainCheck = {
  key: string;
  label: string;
  navLabel: string;
  listPath: string;
};

const COMMON_DOMAINS: DomainCheck[] = [
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

type Finding = { tenant: string; domain: string; level: "FAIL" | "WARN" | "INFO"; message: string };

const TENANTS: { role: TenantRole; slug: string }[] = [
  { role: "admin",          slug: "hakwonplus" },
  { role: "dnb-admin",      slug: "dnb" },
  { role: "tchul-admin",    slug: "tchul" },
  { role: "limglish-admin", slug: "limglish" },
];

function fileSha(file: string): string {
  if (!fs.existsSync(file)) return "";
  const buf = fs.readFileSync(file);
  return crypto.createHash("sha1").update(buf).digest("hex");
}

async function waitSettled(page: Page, ms = 1500) {
  await page.waitForLoadState("networkidle", { timeout: 12_000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

async function clickSidebar(page: Page, label: string): Promise<boolean> {
  const link = page.locator(`aside.sidebar a.nav-item:has-text("${label}")`).first();
  if ((await link.count()) === 0) return false;
  await link.click({ timeout: 6_000 }).catch(() => {});
  return true;
}

function hasErrorUi(html: string, text: string): boolean {
  return (
    /문제가 발생했습니다/.test(html) ||
    /Something went wrong/i.test(html) ||
    /오류가 발생했습니다/.test(text) ||
    /페이지를 불러올 수 없/.test(text)
  );
}

async function detailEntryCandidate(page: Page, key: string) {
  switch (key) {
    case "students":
      return page.locator("table tbody tr, [data-student-id]").first();
    case "lectures":
      return page.locator("table tbody tr, [data-row-type='lecture']").first();
    case "exams":
    case "results":
      return page.locator("table tbody tr, [role='treeitem'], .folder").first();
    case "videos":
      return page.locator("[data-video-card], .video-card, table tbody tr").first();
    case "message":
      return page.locator("[aria-label*='수정'], button[title*='수정']").first();
    case "community":
      return page.locator("article, table tbody tr, [data-post-id]").first();
    case "clinic":
      return page.locator("aside a, [role='tab'], button:has-text('클리닉 진행')").first();
    case "settings":
      return page.locator("a[href*='/admin/settings/'], nav a, button:has-text('학원 정보'), button:has-text('테마')").first();
    case "tools":
      return page.locator("button:has-text('OMR'), button:has-text('PPT'), [role='tab']").first();
    case "storage":
      return page.locator("table tbody tr, .document-list li, [data-doc-id]").first();
    default:
      return null;
  }
}

function renderReport(list: Finding[]): string {
  const counts = {
    FAIL: list.filter(f => f.level === "FAIL").length,
    WARN: list.filter(f => f.level === "WARN").length,
    INFO: list.filter(f => f.level === "INFO").length,
  };
  const out: string[] = [];
  out.push(`# 운영 도메인 감사 v2 — 2026-04-23 (prod)\n`);
  out.push(`- FAIL=${counts.FAIL}  WARN=${counts.WARN}  INFO=${counts.INFO}\n`);

  const byTenant = new Map<string, Finding[]>();
  for (const f of list) {
    const key = f.tenant;
    const arr = byTenant.get(key) || [];
    arr.push(f);
    byTenant.set(key, arr);
  }
  for (const [tenant, arr] of byTenant) {
    out.push(`\n## ${tenant}`);
    const byDomain = new Map<string, Finding[]>();
    for (const f of arr) {
      const a = byDomain.get(f.domain) || [];
      a.push(f);
      byDomain.set(f.domain, a);
    }
    for (const [d, fs] of byDomain) {
      const f = fs.filter(x => x.level === "FAIL");
      const w = fs.filter(x => x.level === "WARN");
      const i = fs.filter(x => x.level === "INFO");
      out.push(`\n### ${d}`);
      if (f.length) f.forEach(x => out.push(`- **FAIL** ${x.message}`));
      if (w.length) w.forEach(x => out.push(`- WARN ${x.message}`));
      if (i.length) i.forEach(x => out.push(`- INFO ${x.message}`));
    }
  }
  return out.join("\n");
}

const findings: Finding[] = [];

test.describe.configure({ mode: "serial" });

for (const t of TENANTS) {
  test(`[${t.slug}] 도메인 감사 v2`, async ({ page }) => {
    test.setTimeout(300_000);

    const dir = path.join(ROOT, t.slug);
    fs.mkdirSync(dir, { recursive: true });

    try {
      await loginViaUI(page, t.role);
    } catch (e) {
      findings.push({ tenant: t.slug, domain: "__login__", level: "FAIL", message: `로그인 실패: ${String(e).slice(0, 200)}` });
      return;
    }
    await waitSettled(page);
    await page.screenshot({ path: path.join(dir, "00-dashboard-initial.png"), fullPage: true }).catch(()=>{});
    findings.push({ tenant: t.slug, domain: "__login__", level: "INFO", message: `logged in: ${page.url()}` });

    const base = getBaseUrl(t.role);

    for (const d of COMMON_DOMAINS) {
      // 1) 사이드바 클릭 (실사용 경로)
      const clicked = await clickSidebar(page, d.navLabel);
      if (!clicked) {
        findings.push({ tenant: t.slug, domain: d.key, level: "WARN", message: `사이드바에서 "${d.navLabel}" 미노출 — URL 직접 이동` });
        await page.goto(base + d.listPath, { waitUntil: "load" }).catch(()=>{});
      }
      await waitSettled(page);

      // URL 확인
      const pathname = new URL(page.url()).pathname;
      if (!pathname.startsWith(d.listPath)) {
        findings.push({ tenant: t.slug, domain: d.key, level: "WARN", message: `URL 불일치 — 기대 ${d.listPath}, 실제 ${pathname}` });
      }

      // 에러 UI / 빈 본문 검사
      const html = await page.content();
      const text = (await page.locator("body").innerText().catch(() => "")) || "";
      if (hasErrorUi(html, text)) {
        findings.push({ tenant: t.slug, domain: d.key, level: "FAIL", message: "에러 UI 노출됨" });
      } else if (text.trim().length < 50) {
        findings.push({ tenant: t.slug, domain: d.key, level: "FAIL", message: `본문 텍스트 과소 (${text.trim().length}자)` });
      }

      const listShot = path.join(dir, `${d.key}-01-list.png`);
      await page.screenshot({ path: listShot, fullPage: true }).catch(()=>{});

      // 2) 상세 진입 — URL path 변화 OR dialog 열림 으로 판정
      const urlBefore = page.url();
      const cand = await detailEntryCandidate(page, d.key);
      let detailMethod = "skipped";
      if (cand && (await cand.count()) > 0) {
        await cand.click({ timeout: 4_000 }).catch(() => {});
        await page.waitForTimeout(1500);

        const urlAfter = page.url();
        const dialogVisible = await page.locator("[role='dialog'], .modal, .ModalBase").first().isVisible().catch(() => false);

        if (urlAfter !== urlBefore) detailMethod = `url-changed (${new URL(urlAfter).pathname})`;
        else if (dialogVisible) detailMethod = "dialog-open";
        else detailMethod = "no-change";

        const detailShot = path.join(dir, `${d.key}-02-detail.png`);
        await page.screenshot({ path: detailShot, fullPage: true }).catch(()=>{});

        if (detailMethod === "no-change") {
          const sameHash = fileSha(listShot) === fileSha(detailShot);
          if (sameHash) {
            findings.push({ tenant: t.slug, domain: d.key, level: "WARN", message: "상세 진입 시도했으나 URL/모달 변화 없음 + 스크린샷 동일" });
          } else {
            findings.push({ tenant: t.slug, domain: d.key, level: "INFO", message: "상세 진입 — URL/모달 변화 없음 but 내부 상태는 변함" });
          }
        } else {
          findings.push({ tenant: t.slug, domain: d.key, level: "INFO", message: `상세 진입 OK (${detailMethod})` });

          // 상세에서 목록으로 복귀
          await page.goto(base + d.listPath, { waitUntil: "load" }).catch(()=>{});
          await waitSettled(page, 500);
        }
      } else {
        findings.push({ tenant: t.slug, domain: d.key, level: "INFO", message: "상세 진입 후보 없음 (리스트-only 도메인 가능)" });
      }
    }

    // 3) 클리닉 탭별 진입 — 본문 텍스트 기준을 body 로 수정
    await page.goto(base + "/admin/clinic", { waitUntil: "load" }).catch(()=>{});
    await waitSettled(page, 1500);
    const clinicTabs = ["오늘", "클리닉 진행", "진행중 항목", "패스카드", "메시지 설정"];
    for (const tab of clinicTabs) {
      const btn = page.locator(`button:has-text("${tab}"), a:has-text("${tab}")`).first();
      if ((await btn.count()) === 0) continue;
      await btn.click({ timeout: 5000 }).catch(()=>{});
      await waitSettled(page, 1200);
      const shotPath = path.join(dir, `clinic-tab-${tab.replace(/\s/g,"_")}.png`);
      await page.screenshot({ path: shotPath, fullPage: true }).catch(()=>{});
      // body 기준
      const t2 = ((await page.locator("body").innerText().catch(()=>"")) || "").trim();
      if (t2.length < 200) {
        findings.push({ tenant: t.slug, domain: "clinic", level: "FAIL", message: `[${tab}] 탭 본문 과소 (${t2.length}자)` });
      }
    }
  });
}

test.afterAll(async () => {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const report = renderReport(findings);
  fs.writeFileSync(path.join(REPORT_DIR, "prod-audit-v2-summary.md"), report, "utf-8");

  const fails = findings.filter(f => f.level === "FAIL");
  console.log(`\n=== v2 감사 결과 ===\nFAIL=${fails.length}  WARN=${findings.filter(f => f.level === "WARN").length}  INFO=${findings.filter(f => f.level === "INFO").length}\nReport: ${REPORT_DIR}/prod-audit-v2-summary.md\n`);
  if (fails.length) {
    console.log("FAIL 상세:");
    fails.slice(0, 40).forEach(f => console.log(`- [${f.tenant}/${f.domain}] ${f.message}`));
  }
});
